import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// 显式加载 apps/api/.env（相对本文件 src 或 dist 的上一级）
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });

/** 公开的开发默认值：仅允许非生产环境使用，生产必须显式覆盖 */
export const INSECURE_JWT_DEFAULT = 'dev-secret-change-me-0123456789abcdef';
export const INSECURE_CODE_SALT_DEFAULT = 'dev-code-salt-change-me';
const DEV_DATABASE_DEFAULT = 'postgresql://cphos:cphos@127.0.0.1:54329/cphos';
const DEV_CORS_DEFAULT = 'http://localhost:5173';
const DEV_SMTP_FROM = 'CPHOS 平台 <no-reply@cphos.example>';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    // 生产建议 127.0.0.1（仅允许 Nginx 反代访问）；容器可覆盖 0.0.0.0
    HOST: z.string().default('0.0.0.0'),
    // 开发默认连接 scripts/dev-db.mjs 启动的内嵌 PostgreSQL；生产请覆盖为正式实例
    DATABASE_URL: z.string().default(DEV_DATABASE_DEFAULT),
    JWT_SECRET: z.string().min(16).default(INSECURE_JWT_DEFAULT),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
    REFRESH_ROTATION_GRACE_SECONDS: z.coerce.number().default(10),
    CODE_TTL_MINUTES: z.coerce.number().default(10),
    CODE_SALT: z.string().default(INSECURE_CODE_SALT_DEFAULT),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    // 本地开发文件存储；生产应替换为对象存储适配器
    UPLOAD_DIR: z.string().default('.uploads'),
    OBJECT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_MAX_MB: z.coerce.number().default(20),
    PAPER_MAX_PAGES: z.coerce.number().default(50),
    BODY_LIMIT_MB: z.coerce.number().default(1),
    TRUST_PROXY: z.preprocess(
      (v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'),
      z.boolean().default(false),
    ),
    // 容器/特殊部署需要监听公网时才显式打开
    ALLOW_PUBLIC_BIND: z.preprocess(
      (v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'),
      z.boolean().default(false),
    ),
    ALLOW_INSECURE_HTTP: z.preprocess(
      (v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'),
      z.boolean().default(false),
    ),
    RATE_LIMIT_MAX: z.coerce.number().default(600),
    RATE_LIMIT_WINDOW: z.string().default('1 minute'),
    // SMTP 可选：配置后走真实发信；未配置时开发模式写入 .devmail/ 并在日志打印验证码
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.preprocess(
      (v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'),
      z.boolean().default(false),
    ),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default(DEV_SMTP_FROM),
  })
  .superRefine((value, ctx) => {
    if (value.OBJECT_STORAGE_DRIVER !== 'local') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OBJECT_STORAGE_DRIVER'],
        message: '当前仅实现本地文件对象存储；S3/MinIO adapter 完成前禁止选择 ' + value.OBJECT_STORAGE_DRIVER,
      });
    }

    if (value.NODE_ENV !== 'production') return;

    const looksPlaceholder = (v: string | undefined) =>
      !!v && /(change[_-]?me|example|placeholder)/i.test(v);
    for (const [path, val] of [
      ['JWT_SECRET', value.JWT_SECRET],
      ['CODE_SALT', value.CODE_SALT],
      ['DATABASE_URL', value.DATABASE_URL],
      ['SMTP_PASS', value.SMTP_PASS],
      ['SMTP_FROM', value.SMTP_FROM],
    ] as const) {
      if (looksPlaceholder(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: '生产环境 ' + path + ' 不能使用示例/占位值',
        });
      }
    }

    // 生产环境 fail-fast：禁止落到公开默认值或明显过短的密钥。
    if (value.JWT_SECRET === INSECURE_JWT_DEFAULT || value.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: '生产环境必须通过环境变量提供强随机 JWT_SECRET（至少 32 字符，且不能使用公开默认值）',
      });
    }
    if (value.CODE_SALT === INSECURE_CODE_SALT_DEFAULT || value.CODE_SALT.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CODE_SALT'],
        message: '生产环境必须通过环境变量提供强随机 CODE_SALT（至少 16 字符，且不能使用公开默认值）',
      });
    }
    if (value.JWT_SECRET === value.CODE_SALT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CODE_SALT'],
        message: '生产环境 JWT_SECRET 与 CODE_SALT 必须使用不同的值',
      });
    }
    if (!value.SMTP_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message: '生产环境必须配置 SMTP_HOST，禁止使用 .devmail 文件兜底',
      });
    }

    if (value.DATABASE_URL === DEV_DATABASE_DEFAULT || value.DATABASE_URL.includes('127.0.0.1:54329')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: '生产环境禁止使用开发内嵌数据库默认连接串',
      });
    }
    if (!value.ALLOW_PUBLIC_BIND && (value.HOST === '0.0.0.0' || value.HOST === '::')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HOST'],
        message: '生产环境默认必须绑定 127.0.0.1；如确需公网监听请显式设置 ALLOW_PUBLIC_BIND=true',
      });
    }
    const origins = value.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
    if (
      origins.length === 0 ||
      origins.some(
        (origin) =>
          (!value.ALLOW_INSECURE_HTTP && !origin.startsWith('https://')) ||
          /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$)/.test(origin) ||
          origin === '*',
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: '生产环境 CORS_ORIGIN 必须为逗号分隔的 HTTPS 正式域名，且不能包含 localhost/通配符',
      });
    }
    if (!value.SMTP_FROM || value.SMTP_FROM === DEV_SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_FROM'],
        message: '生产环境必须显式配置 SMTP_FROM，不能使用示例默认值',
      });
    }
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_USER'],
        message: '生产环境 SMTP_USER 与 SMTP_PASS 必须同时配置',
      });
    }
  });

export const env = schema.parse(process.env);