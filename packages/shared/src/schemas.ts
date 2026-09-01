import { z } from 'zod';
import {
  ACCOUNT_ROLES,
  ARBITRATION_STATUSES,
  AUDIT_ACTIONS,
  AUDIT_STATUSES,
  EMAIL_CODE_PURPOSES,
  EXAM_STATUSES,
  MARKING_TASK_STATUSES,
  MEMBER_ROLES,
  PAPER_STATUSES,
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

// ---------- 账号安全 ----------

/** 忘记密码：只填邮箱，若存在则发送重置验证码（不暴露邮箱是否注册） */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** 使用邮箱验证码重置密码 */
export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: codeSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** 登录后修改密码：需校验当前密码 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码').max(72),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** 申请换绑邮箱：向新邮箱发送验证码，并再次校验登录密码 */
export const requestEmailChangeSchema = z.object({
  newEmail: emailSchema,
  currentPassword: z.string().min(1, '请输入当前密码').max(72),
});
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;

/** 确认换绑邮箱 */
export const confirmEmailChangeSchema = z.object({
  newEmail: emailSchema,
  code: codeSchema,
});
export type ConfirmEmailChangeInput = z.infer<typeof confirmEmailChangeSchema>;

// ---------- 审核与认领 ----------

/** 数字 ID（BigInt 主键经 JSON 序列化为字符串） */
export const idSchema = z.string().trim().max(18, '参数不合法').regex(/^\d+$/, '参数不合法');

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
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

export const listAuditLogsQuerySchema = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  q: z.string().trim().max(100).optional(),
  applicationId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

// ---------- 成员与账号管理 ----------

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

/** 成员资料更新 */
export const updateMemberSchema = z.object({
  realName: z.string().trim().min(1, '请输入真实姓名').max(50, '姓名过长').optional(),
  schoolId: idSchema.nullable().optional(),
  role: z.enum(MEMBER_ROLES).optional(),
  defaultSlot: z.number().int().min(1).max(10).nullable().optional(),
  uploadLimit: z.number().int().min(0).max(60000).optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const listMembersQuerySchema = z.object({
  role: z.enum(MEMBER_ROLES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

export const listAccountsQuerySchema = z.object({
  role: z.enum(ACCOUNT_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;

// ---------- 团队 ----------

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, '请输入团队名称').max(50, '团队名称过长'),
  uploadLimit: z.number().int().min(0).max(60000).default(100),
  leaderUserId: idSchema,
  memberUserIds: z.array(idSchema).max(200).default([]),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z
  .object({
    name: z.string().trim().min(1, '请输入团队名称').max(50, '团队名称过长').optional(),
    uploadLimit: z.number().int().min(0).max(60000).optional(),
    leaderUserId: idSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.uploadLimit !== undefined || v.leaderUserId !== undefined, {
    message: '没有需要更新的内容',
  });
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamMembersSchema = z.object({
  userIds: z.array(idSchema).min(1, '请选择成员').max(200),
});
export type TeamMembersInput = z.infer<typeof teamMembersSchema>;

export const listTeamsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;

// ---------- 字典管理 ----------

/** 名称字典（赛区 / 年级 / 奖项 / 题号） */
export const dictNameSchema = z.object({
  name: z.string().trim().min(1, '请输入名称').max(100, '名称过长'),
});
export type DictNameInput = z.infer<typeof dictNameSchema>;

/** 学校：名称 + 所属赛区 */
export const schoolInputSchema = z.object({
  name: z.string().trim().min(1, '请输入学校名称').max(100, '学校名称过长'),
  areaId: idSchema,
});
export type SchoolInput = z.infer<typeof schoolInputSchema>;

export const updateSchoolSchema = z
  .object({
    name: z.string().trim().min(1, '请输入学校名称').max(100, '学校名称过长').optional(),
    areaId: idSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.areaId !== undefined, { message: '没有需要更新的内容' });
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

// ---------- 考试域：M2-A ----------

export const createExamSchema = z.object({
  name: z.string().trim().min(1, '请输入考试名称').max(100, '考试名称过长'),
  description: z.string().trim().max(500, '描述过长').optional(),
});
export type CreateExamInput = z.infer<typeof createExamSchema>;

export const updateExamSchema = z
  .object({
    name: z.string().trim().min(1, '请输入考试名称').max(100, '考试名称过长').optional(),
    description: z.string().trim().max(500, '描述过长').nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, {
    message: '没有需要更新的内容',
  });
export type UpdateExamInput = z.infer<typeof updateExamSchema>;

export const examTitleSchema = z.object({
  slot: z.number().int().min(1, '槽位不合法').max(30),
  title: z.string().trim().min(1, '请输入页面标题').max(100, '标题过长'),
  questionLabel: z.string().trim().max(100, '题号标签过长').optional(),
  point: z.number().min(0).max(10000).optional(),
});

export const upsertExamConfigSchema = z.object({
  slotCount: z.number().int().min(1).max(30),
  defaultPoint: z.number().min(0).max(10000),
  gap: z.number().min(0).max(10000),
  titleMapping: z.array(examTitleSchema).max(40).optional(),
});
export type UpsertExamConfigInput = z.infer<typeof upsertExamConfigSchema>;

export const listExamsQuerySchema = z.object({
  status: z.enum(EXAM_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, '请输入学生姓名').max(50, '姓名过长'),
  schoolId: idSchema.optional(),
  gradeId: idSchema.optional(),
  prizeId: idSchema.optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z
  .object({
    name: z.string().trim().min(1, '请输入学生姓名').max(50, '姓名过长').optional(),
    schoolId: idSchema.nullable().optional(),
    gradeId: idSchema.nullable().optional(),
    prizeId: idSchema.nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.schoolId !== undefined ||
      v.gradeId !== undefined ||
      v.prizeId !== undefined,
    { message: '没有需要更新的内容' },
  );
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export const listStudentsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  schoolId: idSchema.optional(),
  gradeId: idSchema.optional(),
  prizeId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;

// ---------- 考试域：M2-B 整卷 / 答题卡页 / 题目图片 ----------

export const createPaperSchema = z.object({
  examId: idSchema,
  studentId: idSchema,
});
export type CreatePaperInput = z.infer<typeof createPaperSchema>;

export const addPaperPageSchema = z.object({
  pageNo: z.number().int().min(1).max(1000),
  fileKey: z.string().trim().min(1, '缺少文件键').max(500),
  mimeType: z.string().trim().max(100).optional(),
  sizeBytes: z.number().int().min(0).max(200 * 1024 * 1024).optional(),
});
export type AddPaperPageInput = z.infer<typeof addPaperPageSchema>;

export const cropSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const bindQuestionImageSchema = z.object({
  paperQuestionId: idSchema,
  paperPageId: idSchema,
  partIndex: z.number().int().min(0).max(100).default(0),
  crop: cropSchema.optional(),
  fileKey: z.string().trim().max(500).optional(),
});
export type BindQuestionImageInput = z.infer<typeof bindQuestionImageSchema>;

export const removeQuestionImageSchema = z.object({
  paperQuestionId: idSchema,
  paperPageId: idSchema,
  partIndex: z.number().int().min(0).max(100).default(0),
});
export type RemoveQuestionImageInput = z.infer<typeof removeQuestionImageSchema>;

export const setPaperStatusSchema = z.object({
  status: z.enum(['READY', 'ARCHIVED']),
});
export type SetPaperStatusInput = z.infer<typeof setPaperStatusSchema>;

export const listPapersQuerySchema = z.object({
  examId: idSchema.optional(),
  status: z.enum(PAPER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPapersQuery = z.infer<typeof listPapersQuerySchema>;

// ---------- 考试域：M2-C 分配与双阅任务 ----------

export const createAllocationSchema = z.object({
  note: z.string().trim().max(200).optional(),
});
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;

export const listAllocationBatchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAllocationBatchesQuery = z.infer<typeof listAllocationBatchesQuerySchema>;

export const listMarkingTasksQuerySchema = z.object({
  status: z.enum(MARKING_TASK_STATUSES).optional(),
  examId: idSchema.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMarkingTasksQuery = z.infer<typeof listMarkingTasksQuerySchema>;

// ---------- 考试域：M2-D 阅卷 / 仲裁 / BOT ----------

export const createBotSchema = z.object({
  loginName: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, '请输入机器人用户名')
    .max(50, '用户名过长')
    .regex(/^[a-z0-9._-]+$/, '用户名只能包含小写字母、数字和 . _ -'),
  displayName: z.string().trim().min(1, '请输入显示名称').max(50, '显示名称过长'),
});
export type CreateBotInput = z.infer<typeof createBotSchema>;

export const gradeMarkingTaskSchema = z.object({
  score: z.number().min(0, '分数不能为负').max(10000, '分数过大'),
  remark: z.string().trim().max(500, '备注过长').optional(),
});
export type GradeMarkingTaskInput = z.infer<typeof gradeMarkingTaskSchema>;

export const gradeArbitrationSchema = z.object({
  score: z.number().min(0, '分数不能为负').max(10000, '分数过大'),
  remark: z.string().trim().max(500, '备注过长').optional(),
});
export type GradeArbitrationInput = z.infer<typeof gradeArbitrationSchema>;

export const listArbitrationsQuerySchema = z.object({
  status: z.enum(ARBITRATION_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListArbitrationsQuery = z.infer<typeof listArbitrationsQuerySchema>;
