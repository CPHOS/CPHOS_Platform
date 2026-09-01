import { z } from 'zod';

/** 公开的开发默认值：仅允许非生产环境使用，生产必须显式覆盖 */
export const INSECURE_JWT_DEFAULT = 'dev-secret-change-me-0123456789abcdef';
export const INSECURE_CODE_SALT_DEFAULT = 'dev-code-salt-change-me';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3001),
    // 开发默认连接 scripts/dev-db.mjs 启动的内嵌 PostgreSQL；生产请覆盖为正式实例
    DATABASE_URL: z
      .string()
      .default('postgresql://cphos:cphos@127.0.0.1:54329/cphos'),
    JWT_SECRET: z.string().min(16).default(INSECURE_JWT_DEFAULT),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
    CODE_TTL_MINUTES: z.coerce.number().default(10),
    CODE_SALT: z.string().default(INSECURE_CODE_SALT_DEFAULT),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    // 本地开发文件存储；生产应替换为对象存储适配器
    UPLOAD_DIR: z.string().default('.uploads'),
    // SMTP 可选：配置后走真实发信；未配置时开发模式写入 .devmail/ 并在日志打印验证码
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_SECURE: z.preprocess(
      (v) => (v === undefined ? undefined : v === true || v === 'true' || v === '1'),
      z.boolean().default(false),
    ),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('CPHOS 平台 <no-reply@cphos.example>'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

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
    if (!value.SMTP_HOST || !value.SMTP_FROM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SMTP_HOST'],
        message: '生产环境必须配置 SMTP_HOST 与 SMTP_FROM，禁止使用 .devmail 文件兜底',
      });
    }
  });

export const env = schema.parse(process.env);