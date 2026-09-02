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

  it('任何环境都拒绝尚未实现的 s3 对象存储驱动', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OBJECT_STORAGE_DRIVER', 's3');
    await expect(loadEnv()).rejects.toThrow(/OBJECT_STORAGE_DRIVER|S3/);
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

  it('生产环境提供独立密钥、正式 DB/CORS/SMTP 时正常解析', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(64));
    vi.stubEnv('CODE_SALT', 's'.repeat(32));
    vi.stubEnv('DATABASE_URL', 'postgresql://cphos:secret@db.cphos.cn:5432/cphos');
    vi.stubEnv('CORS_ORIGIN', 'https://exam.cphos.cn');
    vi.stubEnv('HOST', '127.0.0.1');
    vi.stubEnv('SMTP_HOST', 'smtp.cphos.cn');
    vi.stubEnv('SMTP_FROM', 'CPHOS <no-reply@cphos.cn>');
    const { env } = await loadEnv();
    expect(env.JWT_SECRET).toBe('j'.repeat(64));
    expect(env.SMTP_SECURE).toBe(false);
  });

  it('生产环境拒绝开发默认数据库与 localhost CORS', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', 'j'.repeat(64));
    vi.stubEnv('CODE_SALT', 's'.repeat(32));
    vi.stubEnv('DATABASE_URL', 'postgresql://cphos:cphos@127.0.0.1:54329/cphos');
    vi.stubEnv('CORS_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('SMTP_HOST', 'smtp.cphos.cn');
    vi.stubEnv('SMTP_FROM', 'CPHOS <no-reply@cphos.cn>');
    await expect(loadEnv()).rejects.toThrow(/DATABASE_URL|CORS_ORIGIN/);
  });
});
