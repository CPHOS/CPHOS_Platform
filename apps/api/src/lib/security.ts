import { createHash, randomBytes, randomInt } from 'node:crypto';
import { env } from '../env.js';

/** 邮箱规范化：去空白 + 域名小写（用户名保留原大小写，登录匹配用规范化值） */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** 生成 6 位数字验证码 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** 验证码哈希：sha256(email|code|salt)，库内不存明文 */
export function hashCode(email: string, code: string): string {
  return createHash('sha256')
    .update(`${normalizeEmail(email)}|${code}|${env.CODE_SALT}`)
    .digest('hex');
}

/** 刷新令牌（随机 32 字节） */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 机器人一次性/可轮换 API 令牌 */
export function generateBotToken(): string {
  return 'bot_' + randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
