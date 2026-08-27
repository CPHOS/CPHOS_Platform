import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  // 开发默认连接 scripts/dev-db.mjs 启动的内嵌 PostgreSQL；生产请覆盖为正式实例
  DATABASE_URL: z
    .string()
    .default('postgresql://cphos:cphos@127.0.0.1:54329/cphos'),
  JWT_SECRET: z.string().min(16).default('dev-secret-change-me-0123456789abcdef'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  CODE_TTL_MINUTES: z.coerce.number().default(10),
  CODE_SALT: z.string().default('dev-code-salt-change-me'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // SMTP 可选：配置后走真实发信；未配置时开发模式写入 .devmail/ 并在日志打印验证码
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('CPHOS 平台 <no-reply@cphos.example>'),
});

export const env = schema.parse(process.env);
