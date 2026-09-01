import type { EmailCodePurpose, UserDto } from '@cphos/shared';
import type { EmailCode, UserAccount, MemberProfile, School, Team, MemberRole } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { env } from '../../env.js';
import { Errors } from '../../lib/errors.js';
import { renderCodeEmail, sendMail } from '../../lib/mailer.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateCode,
  generateRefreshToken,
  hashCode,
  hashToken,
  normalizeEmail,
} from '../../lib/security.js';

// ---------- 用户 DTO ----------

type ProfileWithSchool = (MemberProfile & { school: School | null; team: Team | null }) | null;

function toUserDto(user: UserAccount & { profile: ProfileWithSchool }): UserDto {
  return {
    id: String(user.id),
    email: user.email,
    loginName: user.loginName,
    displayName: user.displayName,
    status: user.status,
    role: user.role,
    protected: user.protected,
    emailVerified: user.emailVerifiedAt !== null,
    legacyMemberId: user.legacyMemberId === null ? null : String(user.legacyMemberId),
    createdAt: user.createdAt.toISOString(),
    profile: user.profile
      ? {
          realName: user.profile.realName,
          schoolId: user.profile.schoolId === null ? null : String(user.profile.schoolId),
          schoolName: user.profile.school?.name ?? null,
          role: user.profile.role,
          defaultSlot: user.profile.defaultSlot,
          uploadLimit: user.profile.uploadLimit,
          teamId: user.profile.teamId === null ? null : String(user.profile.teamId),
          teamName: user.profile.team?.name ?? null,
          teamUploadLimit: user.profile.team?.uploadLimit ?? null,
        }
      : null,
  };
}

export const USER_INCLUDE = {
  profile: { include: { school: true, team: true } },
} as const;

// ---------- 验证码 ----------

const DAILY_CODE_LIMIT = 10;
const RESEND_INTERVAL_MS = 60_000;


interface IssuedCode {
  code: string;
  to: string;
  ttlMinutes: number;
}

async function issueCodeInTx(
  client: Prisma.TransactionClient,
  email: string,
  purpose: EmailCodePurpose,
  userAccountId?: bigint,
  pendingPasswordHash?: string,
): Promise<IssuedCode> {
  const normalized = normalizeEmail(email);

  // 同一邮箱+用途的发码/作废/新建串行化，避免并发插入多枚有效码
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${normalized + ':' + purpose}))`;

  const [latest, todayCount] = await Promise.all([
    client.emailCode.findFirst({
      where: { email: normalized, purpose },
      orderBy: { createdAt: 'desc' },
    }),
    client.emailCode.count({
      where: {
        email: normalized,
        purpose,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_INTERVAL_MS) {
    throw Errors.codeRateLimited();
  }
  if (todayCount >= DAILY_CODE_LIMIT) {
    throw Errors.codeRateLimited();
  }

  const code = generateCode();
  await client.emailCode.updateMany({
    where: { email: normalized, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await client.emailCode.create({
    data: {
      email: normalized,
      purpose,
      codeHash: hashCode(normalized, code),
      expiresAt: new Date(Date.now() + env.CODE_TTL_MINUTES * 60_000),
      ...(userAccountId === undefined ? {} : { userAccountId }),
      ...(pendingPasswordHash === undefined ? {} : { pendingPasswordHash }),
    },
  });

  return { code, to: normalized, ttlMinutes: env.CODE_TTL_MINUTES };
}

async function issueCode(
  email: string,
  purpose: EmailCodePurpose,
  userAccountId?: bigint,
  pendingPasswordHash?: string,
  client?: Prisma.TransactionClient,
): Promise<number> {
  const issued = client
    ? await issueCodeInTx(client, email, purpose, userAccountId, pendingPasswordHash)
    : await prisma.$transaction((tx) =>
        issueCodeInTx(tx, email, purpose, userAccountId, pendingPasswordHash),
      );
  // 邮件网络 IO 移出数据库事务：失败时验证码已提交，调用方可提示重发
  await sendMail({ ...renderCodeEmail(issued.code), to: issued.to });
  return issued.ttlMinutes;
}

type VerifyOutcome =
  | { ok: true; record: EmailCode }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many' };

function throwVerifyFailure(reason: 'invalid' | 'expired' | 'too_many'): never {
  if (reason === 'expired') throw Errors.codeExpired();
  if (reason === 'too_many') throw Errors.codeTooManyAttempts();
  throw Errors.codeInvalid();
}

async function verifyCodeInTx(
  client: Prisma.TransactionClient,
  email: string,
  code: string,
  purpose: EmailCodePurpose,
  userAccountId?: bigint,
): Promise<VerifyOutcome> {
  const normalized = normalizeEmail(email);
  const record = await client.emailCode.findFirst({
    where: {
      email: normalized,
      purpose,
      consumedAt: null,
      ...(userAccountId === undefined ? {} : { userAccountId }),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return { ok: false, reason: 'invalid' };

  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (record.attempts >= 5) return { ok: false, reason: 'too_many' };

  // 原子抢占：并发请求只有一个能把 attempts +1；失败自增会在本事务提交后保留
  const claimed = await client.emailCode.updateMany({
    where: { id: record.id, consumedAt: null, attempts: { lt: 5 } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    const latest = await client.emailCode.findUnique({ where: { id: record.id } });
    return { ok: false, reason: latest && latest.attempts >= 5 ? 'too_many' : 'invalid' };
  }

  if (record.codeHash !== hashCode(normalized, code)) {
    return { ok: false, reason: 'invalid' };
  }

  // 只有正确核销者才能消费；并发重复请求会因 consumedAt 已被占用而失败
  const consumed = await client.emailCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: 'invalid' };
  return { ok: true, record: { ...record, consumedAt: new Date() } };
}

async function verifyCode(
  email: string,
  code: string,
  purpose: EmailCodePurpose,
  userAccountId?: bigint,
): Promise<EmailCode> {
  // 关键：尝试次数在事务内提交，不能把业务异常抛回导致整个事务回滚
  const outcome = await prisma.$transaction((tx) =>
    verifyCodeInTx(tx, email, code, purpose, userAccountId),
  );
  if (!outcome.ok) throwVerifyFailure(outcome.reason);
  return outcome.record;
}

// ---------- 业务操作（不碰 HTTP/令牌签名，由路由层负责） ----------

export async function register(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.userAccount.findUnique({ where: { email } });

  // 未完成邮箱验证的普通用户允许重新注册：更新待激活密码并重发验证码。
  // 已验证账号、内部账号、禁用账号仍视为邮箱占用。
  if (existing) {
    if (existing.role !== 'PLATFORM_USER' || existing.emailVerifiedAt) {
      throw Errors.emailTaken();
    }
    if (existing.status === 'DISABLED') throw Errors.userDisabled();
  }

  const passwordHash = await hashPassword(input.password);
  // 候选密码只写进本次成功签发的 EmailCode；verifyEmail 只应用被核销验证码对应的密码。
  const user = existing
    ? await prisma.userAccount.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      })
    : await prisma.userAccount.create({ data: { email } });

  // 发码受 60 秒/每日上限约束；命中频控时只允许沿用与本次密码一致的旧候选，
  // 避免攻击者用不同密码覆盖未验证账号的候选密码。
  try {
    await issueCode(email, 'REGISTER', user.id, passwordHash);
  } catch (e) {
    if ((e as { code?: string }).code !== 'CODE_RATE_LIMITED') throw e;
    const latest = await prisma.emailCode.findFirst({
      where: { email, purpose: 'REGISTER', userAccountId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const samePassword =
      latest?.pendingPasswordHash &&
      (await verifyPassword(input.password, latest.pendingPasswordHash));
    if (!samePassword) {
      throw Errors.validation('该邮箱已发送过验证码；如需更换密码，请 60 秒后重试');
    }
    console.warn('[auth] 注册码重发过快，沿用上一枚验证码');
  }

  return {
    message: existing
      ? '已为该邮箱重新提交注册，验证码已发送'
      : '注册成功，请查收验证码完成邮箱验证',
  };
}

export async function sendCode(input: { email: string; purpose: EmailCodePurpose }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.userAccount.findUnique({ where: { email } });
  if (!user) throw Errors.notFound('该邮箱未注册');
  // 注册验证码只服务于普通用户；内部账号由管理员建档、无需邮箱验证
  if (input.purpose === 'REGISTER') {
    if (user.role !== 'PLATFORM_USER') {
      throw Errors.validation('该账号无需邮箱验证');
    }
    if (user.emailVerifiedAt) {
      throw Errors.validation('邮箱已验证，无需重复验证');
    }
    // 注册新密码必须与验证码在同一 register 事务中提交；单独重发不能替换候选密码
    throw Errors.validation('请重新提交注册信息以获取新验证码');
  }
  const ttlMinutes = await issueCode(email, input.purpose, user.id);
  return { message: '验证码已发送，' + ttlMinutes + ' 分钟内有效' };
}

export async function verifyEmail(input: { email: string; code: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.userAccount.findUnique({ where: { email } });
  if (!user) throw Errors.notFound('该邮箱未注册');
  if (user.role !== 'PLATFORM_USER') {
    throw Errors.validation('该账号无需邮箱验证');
  }
  if (user.status === 'DISABLED') throw Errors.userDisabled();

  // 先独立提交验证码尝试/消费，再在同一用户上做邮箱验证，避免失败计数被回滚
  const verifiedCode = await verifyCode(email, input.code, 'REGISTER', user.id);
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.userAccount.findUniqueOrThrow({ where: { id: user.id } });
    if (fresh.emailVerifiedAt) throw Errors.validation('邮箱已验证，无需重复验证');
    const data: Prisma.UserAccountUncheckedUpdateInput = { emailVerifiedAt: new Date() };
    if (verifiedCode.pendingPasswordHash) {
      data.passwordHash = verifiedCode.pendingPasswordHash;
    }
    await tx.userAccount.update({ where: { id: user.id }, data });
  });
  return { message: '邮箱验证成功' };
}

// ---------- 账号安全：密码 / 邮箱 ----------

async function revokeAllRefreshTokens(
  userId: bigint,
  client: Pick<Prisma.TransactionClient, 'refreshToken'> = prisma,
): Promise<void> {
  await client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** 会话级失效：tokenVersion+1 并吊销所有未撤销刷新令牌（同一事务调用） */
async function invalidateSessions(userId: bigint, client: Prisma.TransactionClient): Promise<void> {
  await client.userAccount.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
  await revokeAllRefreshTokens(userId, client);
}

/**
 * 忘记密码：仅当邮箱存在且有密码时发送验证码。
 * 对外永远返回成功，避免暴露邮箱是否注册。
 */
export async function forgotPassword(input: { email: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.userAccount.findUnique({ where: { email } });
  if (user?.passwordHash) {
    await issueCode(email, 'RESET_PASSWORD', user.id).catch((e) => {
      console.warn('[auth] 重置密码验证码发送失败:', e.message);
    });
  }
  return { message: '如果该邮箱已注册，我们已发送重置验证码' };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}) {
  const email = normalizeEmail(input.email);
  const user = await prisma.userAccount.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw Errors.codeInvalid();
  if (user.status === 'DISABLED') throw Errors.userDisabled();

  await verifyCode(email, input.code, 'RESET_PASSWORD', user.id);
  await prisma.$transaction(async (tx) => {
    await tx.userAccount.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await invalidateSessions(user.id, tx);
  });
  return { message: '密码已重置，请使用新密码登录' };
}

export async function changePassword(
  userId: bigint,
  input: { currentPassword: string; newPassword: string },
) {
  const user = await prisma.userAccount.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw Errors.unauthorized();
  if (user.status === 'DISABLED') throw Errors.userDisabled();
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw Errors.validation('当前密码不正确');
  }
  if (await verifyPassword(input.newPassword, user.passwordHash)) {
    throw Errors.validation('新密码不能与当前密码相同');
  }

  await prisma.$transaction(async (tx) => {
    await tx.userAccount.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await invalidateSessions(userId, tx);
  });
  return { message: '密码已修改，请重新登录' };
}

export async function requestEmailChange(
  userId: bigint,
  input: { newEmail: string; currentPassword: string },
) {
  const user = await prisma.userAccount.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw Errors.unauthorized();
  if (user.status === 'DISABLED') throw Errors.userDisabled();
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw Errors.validation('当前密码不正确');
  }

  const newEmail = normalizeEmail(input.newEmail);
  if (user.email === newEmail) throw Errors.validation('新邮箱与当前邮箱相同');
  const existing = await prisma.userAccount.findUnique({ where: { email: newEmail } });
  if (existing && existing.id !== userId) throw Errors.emailTaken();

  const ttlMinutes = await issueCode(newEmail, 'CHANGE_EMAIL', userId);
  return { message: '验证码已发送至新邮箱，' + ttlMinutes + ' 分钟内有效' };
}

export async function confirmEmailChange(
  userId: bigint,
  input: { newEmail: string; code: string },
) {
  const newEmail = normalizeEmail(input.newEmail);
  const currentUser = await prisma.userAccount.findUnique({ where: { id: userId } });
  if (!currentUser) throw Errors.unauthorized();
  if (currentUser.status === 'DISABLED') throw Errors.userDisabled();

  await verifyCode(newEmail, input.code, 'CHANGE_EMAIL', userId);

  try {
    const user = await prisma.userAccount.update({
      where: { id: userId },
      data: { email: newEmail, emailVerifiedAt: new Date() },
      include: USER_INCLUDE,
    });
    return toUserDto(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw Errors.emailTaken();
    }
    throw err;
  }
}

/**
 * 校验凭据并返回用户 + 新刷新令牌（访问令牌由路由层用 JWT 签发）
 * 登录账号：平台用户=邮箱；内部账号=用户名（loginName）。统一按内容分流：
 * 含 @ 视为邮箱，否则视为用户名（均小写规范化匹配）。
 */
export async function login(input: { account: string; password: string }) {
  const account = input.account.trim().toLowerCase();
  const user = await prisma.userAccount.findFirst({
    where: account.includes('@') ? { email: account } : { loginName: account },
    include: USER_INCLUDE,
  });
  if (
    !user ||
    !user.passwordHash ||
    !(await verifyPassword(input.password, user.passwordHash))
  ) {
    throw Errors.invalidCredentials();
  }
  // 邮箱验证仅约束普通用户（内部账号由管理员建档、无需验证）
  if (user.role === 'PLATFORM_USER' && !user.emailVerifiedAt) {
    throw Errors.emailNotVerified();
  }
  if (user.status === 'DISABLED') throw Errors.userDisabled();

  return {
    user: toUserDto(user),
    refreshToken: await issueRefreshToken(user.id, user.tokenVersion),
  };
}

/** 校验刷新令牌并轮换：返回用户 + 新刷新令牌 */
export async function rotateRefreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) throw Errors.unauthorized();

  if (record.revokedAt) {
    // 顺序重放已撤销令牌：按泄露处理，吊销该用户全部会话
    await prisma.$transaction((tx) => invalidateSessions(record.userId, tx)).catch(() => undefined);
    throw Errors.unauthorized();
  }
  if (record.expiresAt.getTime() < Date.now()) throw Errors.unauthorized();

  const user = await prisma.userAccount.findUnique({ where: { id: record.userId } });
  if (!user || user.status === 'DISABLED' || user.tokenVersion !== record.tokenVersion) {
    if (user) {
      await prisma.$transaction((tx) => invalidateSessions(user.id, tx)).catch(() => undefined);
    }
    throw Errors.unauthorized();
  }

  const newToken = generateRefreshToken();
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null, tokenVersion: user.tokenVersion },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) {
      await invalidateSessions(user.id, tx);
      return false;
    }
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
        tokenVersion: user.tokenVersion,
      },
    });
    return true;
  });
  if (!claimed) throw Errors.unauthorized();

  return {
    user: toUserDto(
      await prisma.userAccount.findUniqueOrThrow({
        where: { id: user.id },
        include: USER_INCLUDE,
      }),
    ),
    refreshToken: newToken,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken
    .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
}

export async function getUserDto(userId: bigint): Promise<UserDto> {
  const user = await prisma.userAccount.findUnique({
    where: { id: userId },
    include: USER_INCLUDE,
  });
  if (!user) throw Errors.unauthorized();
  if (user.status === 'DISABLED') throw Errors.userDisabled();
  return toUserDto(user);
}

async function issueRefreshToken(userId: bigint, tokenVersion: number): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      tokenVersion,
    },
  });
  return token;
}

export type { EmailCode, MemberRole };
