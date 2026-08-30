import type { EmailCodePurpose, UserDto } from '@cphos/shared';
import type { EmailCode, UserAccount, MemberProfile, School, MemberRole } from '@prisma/client';
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

type ProfileWithSchool = (MemberProfile & { school: School | null }) | null;

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
        }
      : null,
  };
}

export const USER_INCLUDE = {
  profile: { include: { school: true } },
} as const;

// ---------- 验证码 ----------

const DAILY_CODE_LIMIT = 10;
const RESEND_INTERVAL_MS = 60_000;

async function issueCode(email: string, purpose: EmailCodePurpose): Promise<number> {
  const normalized = normalizeEmail(email);

  const [latest, todayCount] = await Promise.all([
    prisma.emailCode.findFirst({
      where: { email: normalized, purpose },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailCode.count({
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
  await prisma.emailCode.create({
    data: {
      email: normalized,
      purpose,
      codeHash: hashCode(normalized, code),
      expiresAt: new Date(Date.now() + env.CODE_TTL_MINUTES * 60_000),
    },
  });

  const mail = renderCodeEmail(code);
  await sendMail({ ...mail, to: normalized });
  return env.CODE_TTL_MINUTES;
}

async function verifyCode(email: string, code: string, purpose: EmailCodePurpose): Promise<void> {
  const normalized = normalizeEmail(email);
  const record = await prisma.emailCode.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw Errors.codeInvalid();

  if (record.expiresAt.getTime() < Date.now()) throw Errors.codeExpired();
  if (record.attempts >= 5) throw Errors.codeTooManyAttempts();

  if (record.codeHash !== hashCode(normalized, code)) {
    await prisma.emailCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw Errors.codeInvalid();
  }

  await prisma.emailCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date(), attempts: { increment: 1 } },
  });
}

// ---------- 业务操作（不碰 HTTP/令牌签名，由路由层负责） ----------

export async function register(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (existing) throw Errors.emailTaken();

  const passwordHash = await hashPassword(input.password);
  await prisma.userAccount.create({ data: { email, passwordHash } });

  await issueCode(email, 'REGISTER').catch((e) => {
    console.warn('[auth] 注册验证码发送失败（用户可重发）:', e.message);
  });
  return { message: '注册成功，请查收验证码完成邮箱验证' };
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
  }
  const ttlMinutes = await issueCode(email, input.purpose);
  return { message: `验证码已发送，${ttlMinutes} 分钟内有效` };
}

export async function verifyEmail(input: { email: string; code: string }) {
  const email = normalizeEmail(input.email);
  const user = await prisma.userAccount.findUnique({ where: { email } });
  if (!user) throw Errors.notFound('该邮箱未注册');
  if (user.role !== 'PLATFORM_USER') {
    throw Errors.validation('该账号无需邮箱验证');
  }

  await verifyCode(email, input.code, 'REGISTER');
  await prisma.userAccount.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  return { message: '邮箱验证成功' };
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
    refreshToken: await issueRefreshToken(user.id),
  };
}

/** 校验刷新令牌并轮换：返回用户 + 新刷新令牌 */
export async function rotateRefreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    throw Errors.unauthorized();
  }

  const user = await prisma.userAccount.findUnique({ where: { id: record.userId } });
  if (!user || user.status === 'DISABLED') throw Errors.unauthorized();

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return {
    user: toUserDto(
      await prisma.userAccount.findUniqueOrThrow({
        where: { id: user.id },
        include: USER_INCLUDE,
      }),
    ),
    refreshToken: await issueRefreshToken(user.id),
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
  return toUserDto(user);
}

async function issueRefreshToken(userId: bigint): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return token;
}

export type { EmailCode, MemberRole };
