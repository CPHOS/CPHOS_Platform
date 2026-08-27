import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import {
  generateCode,
  generateRefreshToken,
  hashCode,
  hashToken,
  normalizeEmail,
} from '../src/lib/security.js';
import { emailSchema, passwordSchema, codeSchema } from '@cphos/shared';

describe('密码哈希（argon2id）', () => {
  it('同一密码校验通过、错误密码校验失败', async () => {
    const h = await hashPassword('secret123');
    expect(h).not.toContain('secret123');
    expect(await verifyPassword('secret123', h)).toBe(true);
    expect(await verifyPassword('secret124', h)).toBe(false);
  });

  it('相同输入两次哈希不同（随机盐）', async () => {
    const [a, b] = await Promise.all([hashPassword('secret123'), hashPassword('secret123')]);
    expect(a).not.toBe(b);
  });
});

describe('邮箱与令牌工具', () => {
  it('normalizeEmail：去空白 + 小写', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('验证码：6 位数字、哈希可复算', () => {
    const code = generateCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(hashCode('a@b.com', code)).toBe(hashCode(' A@B.COM ', code));
    expect(hashCode('a@b.com', code)).not.toBe(hashCode('a@b.com', '000000'));
  });

  it('刷新令牌：随机且哈希稳定', () => {
    const t1 = generateRefreshToken();
    const t2 = generateRefreshToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThan(32);
    expect(hashToken(t1)).toBe(hashToken(t1));
  });
});

describe('共享校验 schema', () => {
  it('邮箱 schema：规范化大小写并校验格式', () => {
    expect(emailSchema.parse('  User@Example.COM ')).toBe('user@example.com');
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('密码 schema：最短 8 位', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });

  it('验证码 schema：6 位数字', () => {
    expect(codeSchema.safeParse('123456').success).toBe(true);
    expect(codeSchema.safeParse('12ab56').success).toBe(false);
  });
});
