import { z } from 'zod';
import { AUDIT_STATUSES, EMAIL_CODE_PURPOSES } from './enums.js';

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

// ---------- 审核与认领 ----------

/** 数字 ID（BigInt 主键经 JSON 序列化为字符串） */
export const idSchema = z.string().trim().regex(/^\d+$/, '参数不合法');

/** 提交审核资料：必填 姓名/学校/原微信昵称/联系方式；选填 说明/认领（材料上传暂缓） */
export const submitApplicationSchema = z.object({
  realName: z.string().trim().min(1, '请输入真实姓名').max(50, '姓名过长'),
  schoolId: idSchema,
  wechatNickname: z.string().trim().min(1, '请输入原微信昵称').max(100, '昵称过长'),
  contact: z.string().trim().min(1, '请输入联系方式').max(50, '联系方式过长'),
  applyNote: z.string().trim().max(500, '说明过长').optional(),
  claimLegacy: z.boolean().default(false),
});
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

/** 管理员审核决策：通过 / 驳回 / 要求补材料 */
export const reviewDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_MATERIAL']),
  remark: z.string().trim().max(500, '备注过长').optional(),
  legacyMemberId: idSchema.optional(),
  defaultSlot: z.number().int().min(1).max(10).optional(),
  uploadLimit: z.number().int().min(0).max(60000).optional(),
});
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export const listApplicationsQuerySchema = z.object({
  status: z.enum(AUDIT_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
