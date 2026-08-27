import { z } from 'zod';
import { EMAIL_CODE_PURPOSES } from './enums.js';

/** 邮箱：trim + 小写规范后校验 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('邮箱格式不正确')
  .max(254, '邮箱过长');

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(72, '密码最长 72 位');

export const codeSchema = z.string().regex(/^\d{6}$/, '验证码为 6 位数字');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** 登录账号：平台用户=邮箱；内部账号=用户名。统一一个输入框，按内容分流 */
export const loginSchema = z.object({
  account: z.string().trim().min(1, '请输入账号').max(254),
  password: z.string().min(1, '请输入密码').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: codeSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const sendCodeSchema = z.object({
  email: emailSchema,
  purpose: z.enum(EMAIL_CODE_PURPOSES).default('REGISTER'),
});
export type SendCodeInput = z.infer<typeof sendCodeSchema>;
