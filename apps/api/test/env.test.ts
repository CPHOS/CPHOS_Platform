import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INSECURE_CODE_SALT_DEFAULT,
  INSECURE_JWT_DEFAULT,
} from '../src/env.js';

async function loadEnv() {
  vi.resetModules();
  return import('../src/env.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('生产环境密钥 fail-fast', () => {
  it('非生产环境允许使用开发默认值', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('JWT_SECRET', INSECURE_JWT_DEFAULT);
    vi.stubEnv('CODE_SALT', INSECURE_CODE_SALT_DEFAULT);
    const { env } = await loadEnv();
    expect(env.NODE_ENV).toBe('development');
  });

  it('生产环境使用默认 JWT_SECRET 时拒绝启动', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', INSECURE_JWT_DEFAULT);
    vi.stubEnv('CODE_SALT', 's'.repeat(32));
    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET/);
  });

  it('生产环境使用默认 CODE_SALT 时拒绝启动', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(48));
    vi.stubEnv('CODE_SALT', INSECURE_CODE_SALT_DEFAULT);
    await expect(loadEnv()).rejects.toThrow(/CODE_SALT/);
  });

  it('生产环境拒绝过短密钥与相同密钥', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'short');
    vi.stubEnv('CODE_SALT', 'also-short');
    await expect(loadEnv()).rejects.toThrow(/JWT_SECRET/);

    vi.stubEnv('JWT_SECRET', 'j'.repeat(48));
    vi.stubEnv('CODE_SALT', 'j'.repeat(48));
    await expect(loadEnv()).rejects.toThrow(/不同的值/);
  });

  it('生产环境缺少 SMTP 配置时拒绝启动', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(64));
    vi.stubEnv('CODE_SALT', 's'.repeat(32));
    await expect(loadEnv()).rejects.toThrow(/SMTP_HOST/);
  });

  it('生产环境提供独立强随机值与 SMTP 时正常解析', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(64));
    vi.stubEnv('CODE_SALT', 's'.repeat(32));
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_FROM', 'CPHOS <no-reply@example.com>');
    const { env } = await loadEnv();
    expect(env.JWT_SECRET).toBe('j'.repeat(64));
    expect(env.SMTP_SECURE).toBe(false);
  });
});
