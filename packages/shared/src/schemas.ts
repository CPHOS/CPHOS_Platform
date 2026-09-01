import { z } from 'zod';
import {
  ACCOUNT_ROLES,
  AUDIT_STATUSES,
  EMAIL_CODE_PURPOSES,
  MEMBER_ROLES,
  USER_STATUSES,
} from './enums.js';

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

// ---------- 成员与账号管理（功能块③） ----------

/** 创建内部账号（CPHOS_MEMBER，用户名+显示名+密码，不依赖邮箱） */
export const createInternalSchema = z.object({
  loginName: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, '请输入用户名')
    .max(50, '用户名过长')
    .regex(/^[a-z0-9._-]+$/, '用户名只能包含小写字母、数字和 . _ -'),
  displayName: z.string().trim().min(1, '请输入显示名称').max(50, '显示名称过长'),
  password: passwordSchema,
});
export type CreateInternalInput = z.infer<typeof createInternalSchema>;

/** 账号层级变更（仅超管：提升/降级 ADMIN） */
export const setAccountRoleSchema = z.object({
  role: z.enum(['ADMIN', 'CPHOS_MEMBER']),
});
export type SetAccountRoleInput = z.infer<typeof setAccountRoleSchema>;

/** 账号状态变更（启用/禁用） */
export const setAccountStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});
export type SetAccountStatusInput = z.infer<typeof setAccountStatusSchema>;

/** 成员资料更新（角色/上传限额由团队管理，此处不再编辑） */
export const updateMemberSchema = z.object({
  realName: z.string().trim().min(1, '请输入真实姓名').max(50, '姓名过长').optional(),
  schoolId: idSchema.nullable().optional(),
  defaultSlot: z.number().int().min(1).max(10).nullable().optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const listMembersQuerySchema = z.object({
  role: z.enum(MEMBER_ROLES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const listAccountsQuerySchema = z.object({
  role: z.enum(ACCOUNT_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

// ---------- 团队管理（功能块③ C3） ----------

/** 更新团队（名称 / 共享上传限额 / 换负责人） */
export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, '请输入团队名称').max(50, '名称过长').optional(),
  uploadLimit: z.number().int().min(0).max(60000).optional(),
  leaderId: idSchema.optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

/** 新增子账号：新建账号并挂入团队（管理员建档，免邮箱验证） */
export const createSubAccountSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  realName: z.string().trim().min(1, '请输入真实姓名').max(50, '姓名过长'),
  schoolId: idSchema.nullable().optional(),
});
export type CreateSubAccountInput = z.infer<typeof createSubAccountSchema>;

export const listTeamsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;

// ---------- 字典维护（管理域） ----------

const dictNameSchema = z.string().trim().min(1, '请输入名称').max(50, '名称过长');

export const createAreaSchema = z.object({ name: dictNameSchema });
export type CreateAreaInput = z.infer<typeof createAreaSchema>;

export const createSchoolSchema = z.object({
  name: dictNameSchema,
  areaId: idSchema,
});
export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

export const updateSchoolSchema = z.object({
  name: dictNameSchema.optional(),
  areaId: idSchema.optional(),
});
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

export const createDictEntrySchema = z.object({ name: dictNameSchema });
export type CreateDictEntryInput = z.infer<typeof createDictEntrySchema>;

/** 简单字典种类（年级/奖项/题号） */
export const DICT_KINDS = ['grades', 'prizes', 'topics'] as const;
export type DictKind = (typeof DICT_KINDS)[number];

export const dictKindSchema = z.enum(DICT_KINDS);

export const listSchoolsQuerySchema = z.object({
  areaId: idSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListSchoolsQuery = z.infer<typeof listSchoolsQuerySchema>;
