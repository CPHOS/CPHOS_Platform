import type {
  AccountDto,
  AccountListDto,
  BotCreatedDto,
  CreateBotInput,
  CreateInternalInput,
  ListAccountsQuery,
  ListMembersQuery,
  MemberDto,
  MemberListDto,
  UpdateMemberInput,
} from '@cphos/shared';
import type { MemberProfile, School, Team, UserAccount, UserStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { Errors } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { generateBotToken, hashToken } from '../../lib/security.js';

// ---------- include ----------

const MEMBER_INCLUDE = {
  school: true,
  team: true,
  user: { select: { email: true, loginName: true, status: true } },
} as const;

type MemberWithRelations = MemberProfile & {
  school: School | null;
  team: Team | null;
  user: { email: string | null; loginName: string | null; status: UserStatus };
};

const ACCOUNT_INCLUDE = {
  profile: { include: { school: true } },
} as const;

type AccountWithProfile = UserAccount & {
  profile: (MemberProfile & { school: School | null }) | null;
};

// ---------- DTO ----------

function toMemberDto(m: MemberWithRelations): MemberDto {
  return {
    userId: String(m.userId),
    realName: m.realName,
    schoolId: m.schoolId === null ? null : String(m.schoolId),
    schoolName: m.school?.name ?? null,
    role: m.role,
    defaultSlot: m.defaultSlot,
    uploadLimit: m.uploadLimit,
    teamId: m.teamId === null ? null : String(m.teamId),
    teamName: m.team?.name ?? null,
    account: { email: m.user.email, loginName: m.user.loginName, status: m.user.status },
  };
}

function toAccountDto(a: AccountWithProfile): AccountDto {
  return {
    id: String(a.id),
    email: a.email,
    loginName: a.loginName,
    displayName: a.displayName,
    role: a.role,
    status: a.status,
    protected: a.protected,
    createdAt: a.createdAt.toISOString(),
    profile: a.profile
      ? { realName: a.profile.realName, schoolName: a.profile.school?.name ?? null, role: a.profile.role }
      : null,
  };
}

// ---------- 成员档案 ----------

export async function listMembers(query: ListMembersQuery): Promise<MemberListDto> {
  const { role, q, page, pageSize } = query;
  const where: Prisma.MemberProfileWhereInput = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { realName: { contains: q } },
            { school: { name: { contains: q } } },
            { user: { email: { contains: q } } },
            { user: { loginName: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.memberProfile.count({ where }),
    prisma.memberProfile.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: MEMBER_INCLUDE,
    }),
  ]);
  return { items: rows.map(toMemberDto), total, page, pageSize };
}

export async function getMember(userId: bigint): Promise<MemberDto> {
  const m = await prisma.memberProfile.findUnique({ where: { userId }, include: MEMBER_INCLUDE });
  if (!m) throw Errors.notFound('成员');
  return toMemberDto(m);
}

/** 角色/槽位切换前置检查：存在 ACTIVE 批次中的未完成阅卷任务则拒绝 */
async function countIncompleteTasks(profileId: bigint): Promise<number> {
  return prisma.markingTask.count({
    where: { assigneeId: profileId, status: 'PENDING', allocation: { status: 'ACTIVE' } },
  });
}

export async function updateMember(
  userId: bigint,
  operatorId: bigint,
  input: UpdateMemberInput,
): Promise<MemberDto> {
  const current = await prisma.memberProfile.findUnique({
    where: { userId },
    include: { school: { select: { id: true, isIndividual: true } } },
  });
  if (!current) throw Errors.notFound('成员');
  if (current.school?.isIndividual && input.schoolId !== undefined) {
    const nextSchoolId = input.schoolId === null ? null : BigInt(input.schoolId);
    if (nextSchoolId !== current.schoolId) {
      throw Errors.validation('个人/特殊保护成员不允许迁出学校');
    }
  }

  // 附属教练必须归属某个团队；团队模型已上线，未入团队前不允许切换
  if (input.role === 'COACH' && current.teamId === null) {
    throw Errors.validation('附属教练需先加入团队');
  }

  if (
    (input.role && input.role !== current.role) ||
    (input.defaultSlot !== undefined && input.defaultSlot !== current.defaultSlot)
  ) {
    const incomplete = await countIncompleteTasks(current.id);
    if (incomplete > 0) {
      throw Errors.validation('该成员尚有未完成的阅卷任务，暂不能切换角色/槽位');
    }
  }

  const changes: string[] = [];
  if (input.realName !== undefined) changes.push(`姓名=${input.realName}`);
  if (input.schoolId !== undefined) changes.push(`学校=${input.schoolId ?? '空'}`);
  if (input.role !== undefined) changes.push(`角色=${input.role}`);
  if (input.defaultSlot !== undefined) changes.push(`槽位=${input.defaultSlot ?? '空'}`);
  if (input.uploadLimit !== undefined) changes.push(`限额=${input.uploadLimit}`);

  const updated = await prisma.memberProfile.update({
    where: { userId },
    data: {
      ...(input.realName !== undefined ? { realName: input.realName } : {}),
      ...(input.schoolId !== undefined
        ? { schoolId: input.schoolId === null ? null : BigInt(input.schoolId) }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.defaultSlot !== undefined ? { defaultSlot: input.defaultSlot } : {}),
      ...(input.uploadLimit !== undefined ? { uploadLimit: input.uploadLimit } : {}),
    },
    include: MEMBER_INCLUDE,
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'MEMBER_UPDATE',
      targetUserId: userId,
      remark: changes.length ? changes.join('；') : null,
    },
  });
  return toMemberDto(updated);
}

// ---------- 账号管理 ----------

export async function listAccounts(query: ListAccountsQuery): Promise<AccountListDto> {
  const { role, status, q, page, pageSize } = query;
  const where: Prisma.UserAccountWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q } },
            { loginName: { contains: q } },
            { displayName: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.userAccount.count({ where }),
    prisma.userAccount.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: ACCOUNT_INCLUDE,
    }),
  ]);
  return { items: rows.map(toAccountDto), total, page, pageSize };
}

export async function createInternalAccount(
  input: CreateInternalInput,
  operatorId: bigint,
): Promise<AccountDto> {
  const loginName = input.loginName.trim().toLowerCase();
  const existing = await prisma.userAccount.findUnique({ where: { loginName } });
  if (existing) throw Errors.validation('该用户名已存在');

  let account: AccountWithProfile;
  try {
    account = await prisma.userAccount.create({
      data: {
        loginName,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        role: 'CPHOS_MEMBER',
        status: 'ACTIVE',
      },
      include: ACCOUNT_INCLUDE,
    });
  } catch (err) {
    // 并发创建同名账号时唯一索引兜底 → 400
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.validation('该用户名已存在');
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'CREATE_ACCOUNT',
      targetUserId: account.id,
      remark: `创建内部账号 ${loginName}（${input.displayName}）`,
    },
  });
  return toAccountDto(account);
}

export async function setAccountRole(
  id: bigint,
  role: 'ADMIN' | 'CPHOS_MEMBER',
  operatorId: bigint,
): Promise<AccountDto> {
  const target = await prisma.userAccount.findUnique({ where: { id } });
  if (!target) throw Errors.notFound('账号');
  if (target.protected) throw Errors.validation('受保护账号不可变更角色');
  if (role === 'ADMIN' && target.role !== 'CPHOS_MEMBER') {
    throw Errors.validation('仅 CPHOS 成员可提升为管理员');
  }
  if (role === 'CPHOS_MEMBER' && target.role !== 'ADMIN') {
    throw Errors.validation('仅管理员可降级为 CPHOS 成员');
  }

  const account = await prisma.userAccount.update({
    where: { id },
    data: { role },
    include: ACCOUNT_INCLUDE,
  });

  await prisma.auditLog.create({
    data: {
      operatorId,
      action: 'ROLE_CHANGE',
      targetUserId: id,
      remark: `${target.role} → ${role}`,
    },
  });
  return toAccountDto(account);
}


export async function createBotAccount(
  input: CreateBotInput,
  operatorId: bigint,
): Promise<BotCreatedDto> {
  const loginName = input.loginName.trim().toLowerCase();
  const existing = await prisma.userAccount.findUnique({ where: { loginName } });
  if (existing) throw Errors.validation('该用户名已存在');

  const token = generateBotToken();
  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.userAccount.create({
      data: {
        loginName,
        displayName: input.displayName,
        role: 'BOT',
        status: 'ACTIVE',
        botTokenHash: hashToken(token),
        botTokenCreatedAt: new Date(),
      },
      include: ACCOUNT_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'BOT_CREATE',
        targetUserId: created.id,
        remark: '创建机器人账号 ' + loginName,
      },
    });
    return created;
  });
  return { account: toAccountDto(account), token };
}

export async function rotateBotToken(id: bigint, operatorId: bigint): Promise<BotCreatedDto> {
  const target = await prisma.userAccount.findUnique({ where: { id } });
  if (!target) throw Errors.notFound('账号');
  if (target.role !== 'BOT') throw Errors.validation('仅机器人账号可轮换令牌');
  if (target.status === 'DISABLED') throw Errors.validation('机器人账号已禁用');

  const token = generateBotToken();
  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.userAccount.update({
      where: { id },
      data: { botTokenHash: hashToken(token), botTokenCreatedAt: new Date() },
      include: ACCOUNT_INCLUDE,
    });
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'BOT_TOKEN_ROTATE',
        targetUserId: id,
        remark: '轮换机器人令牌',
      },
    });
    return updated;
  });
  return { account: toAccountDto(account), token };
}

export async function setAccountStatus(
  id: bigint,
  status: 'ACTIVE' | 'DISABLED',
  operatorId: bigint,
): Promise<AccountDto> {
  const target = await prisma.userAccount.findUnique({ where: { id } });
  if (!target) throw Errors.notFound('账号');
  if (target.protected) throw Errors.validation('受保护账号不可变更状态');
  if (target.id === operatorId && status === 'DISABLED') {
    throw Errors.validation('不能禁用自己的账号');
  }

  // 权限边界：ADMIN 层级账号的状态仅超级管理员可变更；普通 ADMIN 只管理成员/平台用户
  if (target.role === 'ADMIN') {
    const operator = await prisma.userAccount.findUnique({ where: { id: operatorId } });
    if (!operator || operator.role !== 'SUPER_ADMIN') throw Errors.forbidden();
  }
  // 平台用户必须走审核通过，不能用状态接口直接启用成无档案账号
  if (status === 'ACTIVE' && target.role === 'PLATFORM_USER') {
    const approved = await prisma.auditApplication.findFirst({
      where: { userId: id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!approved) throw Errors.validation('平台用户须先通过审核，不能直接启用');
  }

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.userAccount.update({
      where: { id },
      data: {
        status,
        ...(status === 'DISABLED' ? { tokenVersion: { increment: 1 } } : {}),
      },
      include: ACCOUNT_INCLUDE,
    });
    if (status === 'DISABLED') {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.auditLog.create({
      data: {
        operatorId,
        action: 'STATUS_CHANGE',
        targetUserId: id,
        remark: status === 'ACTIVE' ? '启用' : '禁用',
      },
    });
    return updated;
  });
  return toAccountDto(account);
}
