import type {
  CreateSubAccountInput,
  ListTeamsQuery,
  TeamDetailDto,
  TeamDto,
  TeamListDto,
  UpdateTeamInput,
} from '@cphos/shared';
import type { MemberProfile, Team } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';

/** 旧库"个人"学校 id（个人参赛者团队限额默认 1） */
const INDIVIDUAL_SCHOOL_ID = 134n;
const DEFAULT_UPLOAD_LIMIT = 100;

const TEAM_INCLUDE = {
  leader: { select: { userId: true, realName: true } },
  _count: { select: { members: true } },
} as const;

type TeamWithCount = Team & {
  leader: { userId: bigint; realName: string | null };
  _count: { members: number };
};

function toTeamDto(t: TeamWithCount): TeamDto {
  return {
    id: String(t.id),
    name: t.name,
    uploadLimit: t.uploadLimit,
    leader: { userId: String(t.leader.userId), realName: t.leader.realName },
    memberCount: t._count.members,
    createdAt: t.createdAt.toISOString(),
  };
}

// ---------- 列表 / 详情 ----------

export async function listTeams(query: ListTeamsQuery): Promise<TeamListDto> {
  const { q, page, pageSize } = query;
  const where: Prisma.TeamWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { leader: { realName: { contains: q } } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: TEAM_INCLUDE,
    }),
  ]);
  return { items: rows.map(toTeamDto), total, page, pageSize };
}

export async function getTeam(id: bigint): Promise<TeamDetailDto> {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      leader: { select: { userId: true, realName: true } },
      _count: { select: { members: true } },
      members: {
        include: { school: true, user: { select: { email: true, loginName: true } } },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!team) throw Errors.notFound('团队');
  return {
    ...toTeamDto(team),
    members: team.members.map((m) => ({
      userId: String(m.userId),
      realName: m.realName,
      schoolName: m.school?.name ?? null,
      role: m.role,
      email: m.user.email,
      loginName: m.user.loginName,
    })),
  };
}

// ---------- 更新 ----------

export async function updateTeam(id: bigint, operatorId: bigint, input: UpdateTeamInput): Promise<TeamDetailDto> {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw Errors.notFound('团队');

  const changes: string[] = [];

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.uploadLimit !== undefined) {
      if (input.name !== undefined) changes.push(`名称=${input.name}`);
      if (input.uploadLimit !== undefined) changes.push(`限额=${input.uploadLimit}`);
      await tx.team.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.uploadLimit !== undefined ? { uploadLimit: input.uploadLimit } : {}),
        },
      });
    }

    if (input.leaderId !== undefined) {
      const newLeader = await tx.memberProfile.findUnique({
        where: { userId: BigInt(input.leaderId) },
        include: { ledTeam: true },
      });
      if (!newLeader) throw Errors.notFound('成员');
      if (newLeader.teamId !== id) throw Errors.validation('新负责人必须是该团队成员');
      if (newLeader.ledTeam && newLeader.ledTeam.id !== id) {
        throw Errors.validation('该成员已负责其他团队');
      }

      const oldLeader = await tx.memberProfile.findUnique({ where: { id: team.leaderId } });

      await tx.team.update({ where: { id }, data: { leaderId: newLeader.id } });
      await tx.memberProfile.update({ where: { id: newLeader.id }, data: { role: 'LEADER' } });
      if (oldLeader && oldLeader.id !== newLeader.id) {
        await tx.memberProfile.update({ where: { id: oldLeader.id }, data: { role: 'COACH' } });
        changes.push(`负责人=${newLeader.realName ?? newLeader.id}`);
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'TEAM_UPDATE',
      remark: changes.length ? `团队 ${team.name ?? '#' + team.id}：${changes.join('；')}` : null,
    },
  });

  return getTeam(id);
}

// ---------- 子账号（新建账号挂入团队） ----------

export async function addSubAccount(
  teamId: bigint,
  operatorId: bigint,
  input: CreateSubAccountInput,
): Promise<TeamDetailDto> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw Errors.notFound('团队');

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (existing) throw Errors.validation('该邮箱已注册');

  let accountId: bigint;
  await prisma.$transaction(async (tx) => {
    let account;
    try {
      account = await tx.userAccount.create({
        data: {
          email,
          passwordHash: await hashPassword(input.password),
          role: 'PLATFORM_USER',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(), // 管理员建档即信任，无需邮箱验证
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw Errors.validation('该邮箱已注册');
      }
      throw err;
    }
    accountId = account.id;
    await tx.memberProfile.create({
      data: {
        userId: account.id,
        realName: input.realName,
        schoolId: input.schoolId ? BigInt(input.schoolId) : null,
        role: 'COACH',
        teamId,
        auditStatus: 1,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'TEAM_ADD_MEMBER',
      targetUserId: accountId!,
      remark: `新增子账号 ${input.realName}（${email}）加入团队 ${team.name ?? '#' + team.id}`,
    },
  });

  return getTeam(teamId);
}

// ---------- 移除成员（转为独立负责人，自动建单人团队） ----------

export async function removeMember(teamId: bigint, userId: bigint, operatorId: bigint): Promise<TeamDetailDto> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw Errors.notFound('团队');

  const member = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!member || member.teamId !== teamId) throw Errors.notFound('团队成员');
  if (member.id === team.leaderId) throw Errors.validation('负责人不能直接移除，请先更换负责人');

  const uploadLimit = member.schoolId === INDIVIDUAL_SCHOOL_ID ? 1 : DEFAULT_UPLOAD_LIMIT;

  await prisma.$transaction(async (tx) => {
    const ownTeam = await tx.team.create({ data: { leaderId: member.id, uploadLimit } });
    await tx.memberProfile.update({
      where: { id: member.id },
      data: { teamId: ownTeam.id, role: 'LEADER' },
    });
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'TEAM_REMOVE_MEMBER',
      targetUserId: userId,
      remark: `将 ${member.realName ?? '#' + userId} 移出团队 ${team.name ?? '#' + team.id}（转为独立负责人）`,
    },
  });

  return getTeam(teamId);
}
