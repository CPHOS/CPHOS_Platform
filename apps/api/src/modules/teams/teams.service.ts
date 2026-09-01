import type {
  CreateTeamInput,
  ListTeamsQuery,
  MemberOptionDto,
  TeamDto,
  TeamListDto,
  TeamMemberDto,
  UpdateTeamInput,
} from '@cphos/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';

const TEAM_INCLUDE = {
  leader: {
    select: {
      id: true,
      email: true,
      loginName: true,
      displayName: true,
      profile: { select: { realName: true } },
    },
  },
  members: {
    include: {
      school: true,
      user: { select: { email: true, loginName: true } },
    },
  },
} as const;

type TeamWithRelations = Prisma.TeamGetPayload<{ include: typeof TEAM_INCLUDE }>;

function personName(user: {
  displayName: string | null;
  loginName: string | null;
  email: string | null;
  profile?: { realName: string | null } | null;
}): string | null {
  return user.profile?.realName ?? user.displayName ?? user.loginName ?? user.email ?? null;
}

function toMemberDto(m: TeamWithRelations['members'][number]): TeamMemberDto {
  return {
    userId: String(m.userId),
    realName: m.realName,
    schoolName: m.school?.name ?? null,
    role: m.role,
    defaultSlot: m.defaultSlot,
    account: { email: m.user.email, loginName: m.user.loginName },
  };
}

function toTeamDto(team: TeamWithRelations): TeamDto {
  const members = [...team.members].sort((a, b) => a.id < b.id ? -1 : 1);
  return {
    id: String(team.id),
    name: team.name,
    uploadLimit: team.uploadLimit,
    leaderUserId: String(team.leaderId),
    leaderName: personName(team.leader),
    memberCount: members.length,
    members: members.map(toMemberDto),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

async function findTeamOrThrow(id: bigint): Promise<TeamWithRelations> {
  const team = await prisma.team.findUnique({ where: { id }, include: TEAM_INCLUDE });
  if (!team) throw Errors.notFound('团队');
  return team;
}

type TxClient = Prisma.TransactionClient;
type DbClient = TxClient | typeof prisma;

async function assertProfiles(userIds: bigint[], client: DbClient = prisma): Promise<void> {
  if (userIds.length === 0) return;
  const profiles = await client.memberProfile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true },
  });
  const found = new Set(profiles.map((p) => String(p.userId)));
  const missing = userIds.filter((id) => !found.has(String(id)));
  if (missing.length > 0) {
    throw Errors.validation('所选账号尚无成员资料，不能加入团队');
  }
}

async function assertMembersFree(
  userIds: bigint[],
  currentTeamId?: bigint,
  client: DbClient = prisma,
): Promise<void> {
  if (userIds.length === 0) return;
  const occupied = await client.memberProfile.findMany({
    where: { userId: { in: userIds }, teamId: { not: null } },
    select: { userId: true, teamId: true },
  });
  const conflicts = occupied.filter(
    (p) => currentTeamId === undefined || p.teamId !== currentTeamId,
  );
  if (conflicts.length > 0) {
    throw Errors.validation('部分成员已属于其他团队，请先从原团队移除');
  }
}

async function assertLeaderFree(
  leaderId: bigint,
  currentTeamId?: bigint,
  client: DbClient = prisma,
): Promise<void> {
  const existing = await client.team.findFirst({
    where: { leaderId, ...(currentTeamId === undefined ? {} : { id: { not: currentTeamId } }) },
    select: { id: true },
  });
  if (existing) throw Errors.validation('该成员已是其他团队的负责人');
}

export async function listTeams(query: ListTeamsQuery): Promise<TeamListDto> {
  const { q, page, pageSize } = query;
  const where: Prisma.TeamWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { leader: { loginName: { contains: q } } },
          { leader: { displayName: { contains: q } } },
          { leader: { profile: { realName: { contains: q } } } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: TEAM_INCLUDE,
    }),
  ]);
  return { items: rows.map(toTeamDto), total, page, pageSize };
}

export async function getTeam(id: bigint): Promise<TeamDto> {
  return toTeamDto(await findTeamOrThrow(id));
}

export async function listMemberOptions(): Promise<MemberOptionDto[]> {
  const rows = await prisma.memberProfile.findMany({
    orderBy: [{ role: 'asc' }, { id: 'asc' }],
    take: 1000,
    include: {
      school: true,
      user: { select: { email: true, loginName: true } },
      team: { select: { id: true, name: true } },
    },
  });
  return rows.map((m) => ({
    userId: String(m.userId),
    realName: m.realName,
    schoolName: m.school?.name ?? null,
    role: m.role,
    teamId: m.teamId === null ? null : String(m.teamId),
    teamName: m.team?.name ?? null,
    account: { email: m.user.email, loginName: m.user.loginName },
  }));
}

export async function createTeam(operatorId: bigint, input: CreateTeamInput): Promise<TeamDto> {
  const leaderId = BigInt(input.leaderUserId);
  const memberIds = [...new Set(input.memberUserIds.map((id) => BigInt(id)))].filter(
    (id) => id !== leaderId,
  );

  try {
    const team = await prisma.$transaction(async (tx) => {
      await assertProfiles([leaderId, ...memberIds], tx);
      await assertLeaderFree(leaderId, undefined, tx);
      // 负责人也是普通成员，先校验其当前归属，避免把别队 COACH 静默拉走
      await assertMembersFree([leaderId], undefined, tx);
      await assertMembersFree(memberIds, undefined, tx);

      const created = await tx.team.create({
        data: { name: input.name, uploadLimit: input.uploadLimit, leaderId },
      });
      // 条件更新：并发下只有仍是自由身的负责人/成员能被写入
      const promoted = await tx.memberProfile.updateMany({
        where: { userId: leaderId, teamId: null },
        data: { teamId: created.id, role: 'LEADER' },
      });
      if (promoted.count !== 1) {
        throw Errors.validation('该成员已属于其他团队，请先从原团队移除');
      }
      if (memberIds.length > 0) {
        const moved = await tx.memberProfile.updateMany({
          where: { userId: { in: memberIds }, teamId: null },
          data: { teamId: created.id, role: 'COACH' },
        });
        if (moved.count !== memberIds.length) {
          throw Errors.validation('部分成员已加入其他团队，请刷新后重试');
        }
      }
      await tx.auditLog.create({
        data: {
          operatorId,
          action: 'TEAM_CREATE',
          targetUserId: leaderId,
          remark: '创建团队「' + input.name + '」，成员 ' + String(memberIds.length + 1) + ' 人',
        },
      });
      return tx.team.findUniqueOrThrow({ where: { id: created.id }, include: TEAM_INCLUDE });
    });
    return toTeamDto(team);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该成员已是其他团队的负责人');
    }
    throw err;
  }
}

export async function updateTeam(
  id: bigint,
  operatorId: bigint,
  input: UpdateTeamInput,
): Promise<TeamDto> {
  const current = await findTeamOrThrow(id);
  const changes: string[] = [];
  if (input.name !== undefined) changes.push('名称=' + input.name);
  if (input.uploadLimit !== undefined) changes.push('共享限额=' + String(input.uploadLimit));

  let newLeaderId: bigint | undefined;
  if (input.leaderUserId !== undefined) {
    newLeaderId = BigInt(input.leaderUserId);
    const leaderProfile = await prisma.memberProfile.findUnique({
      where: { userId: newLeaderId },
      select: { teamId: true },
    });
    if (!leaderProfile) throw Errors.validation('所选账号尚无成员资料，不能担任负责人');
    // 新负责人必须自由身或已经属于当前团队，不能在别队不知情的情况下被拉走
    if (leaderProfile.teamId !== null && leaderProfile.teamId !== id) {
      throw Errors.validation('该成员已属于其他团队，请先从原团队移除');
    }
    await assertLeaderFree(newLeaderId, id);
    changes.push('负责人=' + input.leaderUserId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (newLeaderId !== undefined && newLeaderId !== current.leaderId) {
        // 条件更新 Team.leaderId：以读取到的旧负责人作为乐观锁；Team.leaderId 唯一约束兜底并发建队/换负责。
        const transitioned = await tx.team.updateMany({
          where: { id, leaderId: current.leaderId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.uploadLimit !== undefined ? { uploadLimit: input.uploadLimit } : {}),
            leaderId: newLeaderId,
          },
        });
        if (transitioned.count !== 1) {
          throw Errors.validation('团队负责人已发生变化，请刷新后重试');
        }
        const promoted = await tx.memberProfile.updateMany({
          where: { userId: newLeaderId, OR: [{ teamId: null }, { teamId: id }] },
          data: { teamId: id, role: 'LEADER' },
        });
        if (promoted.count !== 1) {
          throw Errors.validation('该成员已属于其他团队，请先从原团队移除');
        }
        await tx.memberProfile.updateMany({
          where: { userId: current.leaderId, teamId: id },
          data: { role: 'COACH' },
        });
      } else {
        const data: Prisma.TeamUncheckedUpdateInput = {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.uploadLimit !== undefined ? { uploadLimit: input.uploadLimit } : {}),
        };
        await tx.team.update({ where: { id }, data });
      }
      await tx.auditLog.create({
        data: {
          operatorId,
          action: 'TEAM_UPDATE',
          targetUserId: newLeaderId ?? current.leaderId,
          remark: changes.length > 0 ? changes.join('；') : '更新团队',
        },
      });
    });
    return getTeam(id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该成员已是其他团队的负责人');
    }
    throw err;
  }
}

export async function addMembers(
  id: bigint,
  operatorId: bigint,
  userIds: bigint[],
): Promise<TeamDto> {
  const team = await findTeamOrThrow(id);
  const candidates = userIds.filter((userId) => userId !== team.leaderId);
  await assertProfiles(candidates);
  await assertMembersFree(candidates, id);

  const existing = new Set(team.members.map((m) => String(m.userId)));
  const toAdd = candidates.filter((userId) => !existing.has(String(userId)));
  if (toAdd.length === 0) throw Errors.validation('所选成员均已在团队中');

  await prisma.$transaction(async (tx) => {
    const moved = await tx.memberProfile.updateMany({
      where: { userId: { in: toAdd }, teamId: null },
      data: { teamId: id, role: 'COACH' },
    });
    if (moved.count !== toAdd.length) {
      throw Errors.validation('部分成员已被加入其他团队，请刷新后重试');
    }
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'TEAM_UPDATE',
        targetUserId: team.leaderId,
        remark: '团队「' + team.name + '」新增 ' + String(toAdd.length) + ' 名成员',
      },
    });
  });
  return getTeam(id);
}

export async function removeMembers(
  id: bigint,
  operatorId: bigint,
  userIds: bigint[],
): Promise<TeamDto> {
  const team = await findTeamOrThrow(id);
  if (userIds.some((userId) => userId === team.leaderId)) {
    throw Errors.validation('负责人不能直接从团队移除，请先变更负责人');
  }
  const memberSet = new Set(team.members.map((m) => String(m.userId)));
  const toRemove = [...new Set(userIds.map((u) => String(u)))].filter((u) => memberSet.has(u));
  if (toRemove.length === 0) throw Errors.validation('所选成员不在该团队中');

  await prisma.$transaction(async (tx) => {
    // 在事务内重读当前 leader，避免与“更换负责人”并发时移除新 leader
    // 行锁 Team，确保与 updateTeam 更换负责人串行化
    await tx.$queryRaw`SELECT "leaderId" FROM "Team" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.team.findUnique({ where: { id }, select: { leaderId: true, name: true } });
    if (!current) throw Errors.notFound('团队');
    if (userIds.some((userId) => userId === current.leaderId)) {
      throw Errors.validation('负责人不能直接从团队移除，请先变更负责人');
    }
    const removed = await tx.memberProfile.updateMany({
      where: {
        teamId: id,
        userId: { in: toRemove.map((u) => BigInt(u)) },
        NOT: { userId: current.leaderId },
      },
      data: { teamId: null, role: 'LEADER' },
    });
    if (removed.count !== toRemove.length) {
      throw Errors.validation('团队成员已发生变化，请刷新后重试');
    }
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'TEAM_UPDATE',
        targetUserId: current.leaderId,
        remark: '团队「' + current.name + '」移除 ' + String(toRemove.length) + ' 名成员',
      },
    });
  });
  return getTeam(id);
}

export async function deleteTeam(id: bigint, operatorId: bigint): Promise<void> {
  const team = await findTeamOrThrow(id);
  await prisma.$transaction(async (tx) => {
    await tx.memberProfile.updateMany({ where: { teamId: id }, data: { teamId: null, role: 'LEADER' } });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'TEAM_DELETE',
        targetUserId: team.leaderId,
        remark: '删除团队「' + team.name + '」',
      },
    });
    await tx.team.delete({ where: { id } });
  });
}

/** 向共享 DTO 暴露名称计算（供成员管理显示） */
export { personName };
