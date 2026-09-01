/**
 * 全局枚举与常量（前后端共用）
 */

export const USER_STATUSES = ['PENDING', 'ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const EMAIL_CODE_PURPOSES = ['REGISTER', 'RESET_PASSWORD', 'CHANGE_EMAIL'] as const;
export type EmailCodePurpose = (typeof EMAIL_CODE_PURPOSES)[number];

/** 业务角色（仅平台用户域）：负责人 / 附属教练。仲裁已改为功能模块，不再是身份 */
export const MEMBER_ROLES = ['LEADER', 'COACH'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/**
 * 账号层级（决定登录入口与界面）：
 * - SUPER_ADMIN：系统初始化创建，最特殊，受保护不可删除/禁用
 * - ADMIN：由超级管理员从 CPHOS 内部用户提升
 * - CPHOS_MEMBER：内部员工，管理员直接建档（不走邮箱注册验证）
 * - PLATFORM_USER：普通用户（教练/个人），仅此角色走邮箱+验证码注册
 */
export const ACCOUNT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CPHOS_MEMBER', 'PLATFORM_USER', 'BOT'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  CPHOS_MEMBER: 'CPHOS 成员',
  PLATFORM_USER: '平台用户',
  BOT: '机器人账号',
};

export const AUDIT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已驳回',
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  LEADER: '负责人',
  COACH: '附属教练',
};

/** 考试状态机 */
export const EXAM_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  CLOSED: '已结束',
  ARCHIVED: '已归档',
};

/** 整卷状态 */
export const PAPER_STATUSES = ['UPLOADING', 'READY', 'ARCHIVED'] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PAPER_STATUS_LABELS: Record<PaperStatus, string> = {
  UPLOADING: '上传中',
  READY: '已就绪',
  ARCHIVED: '已归档',
};

/** 分配批次状态 */
export const ALLOCATION_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];
export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  ACTIVE: '生效中',
  REVOKED: '已撤销',
};

/** 双阅任务状态 */
export const MARKING_TASK_STATUSES = ['PENDING', 'COMPLETED', 'CANCELED'] as const;
export type MarkingTaskStatus = (typeof MARKING_TASK_STATUSES)[number];
export const MARKING_TASK_STATUS_LABELS: Record<MarkingTaskStatus, string> = {
  PENDING: '待批阅',
  COMPLETED: '已完成',
  CANCELED: '已取消',
};

/** 仲裁任务状态 */
export const ARBITRATION_STATUSES = ['PENDING', 'CLAIMED', 'COMPLETED', 'CANCELED'] as const;
export type ArbitrationStatus = (typeof ARBITRATION_STATUSES)[number];
export const ARBITRATION_STATUS_LABELS: Record<ArbitrationStatus, string> = {
  PENDING: '待认领',
  CLAIMED: '仲裁中',
  COMPLETED: '已完成',
  CANCELED: '已取消',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: '待审核',
  ACTIVE: '正常',
  DISABLED: '已禁用',
};

/**
 * 审计动作（与 Prisma AuditAction 一致）。
 * 这里只维护展示枚举，不参与数据库；后端负责写入对应值。
 */
export const AUDIT_ACTIONS = [
  'APPROVE',
  'REJECT',
  'BIND_LEGACY',
  'REQUEST_MATERIAL',
  'UNBIND',
  'CREATE_ACCOUNT',
  'ROLE_CHANGE',
  'STATUS_CHANGE',
  'MEMBER_UPDATE',
  'TEAM_CREATE',
  'TEAM_UPDATE',
  'TEAM_DELETE',
  'EXAM_CREATE',
  'EXAM_UPDATE',
  'EXAM_CONFIG',
  'EXAM_PUBLISH',
  'EXAM_CLOSE',
  'EXAM_ARCHIVE',
  'STUDENT_CREATE',
  'STUDENT_UPDATE',
  'STUDENT_DELETE',
  'PAPER_CREATE',
  'PAPER_PAGE_ADD',
  'PAPER_QUESTION_BIND',
  'PAPER_READY',
  'PAPER_ARCHIVE',
  'ALLOCATION_CREATE',
  'ALLOCATION_REVOKE',
  'BOT_CREATE',
  'BOT_TOKEN_ROTATE',
  'MARK_TASK_GRADE',
  'ARBITRATION_CREATE',
  'ARBITRATION_CLAIM',
  'ARBITRATION_GRADE',
  'RANKING_EXPORT',
] as const;
export type AuditActionValue = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditActionValue, string> = {
  APPROVE: '审核通过',
  REJECT: '审核驳回',
  BIND_LEGACY: '认领绑定',
  REQUEST_MATERIAL: '要求补材料',
  UNBIND: '解绑/回退',
  CREATE_ACCOUNT: '创建账号',
  ROLE_CHANGE: '账号角色变更',
  STATUS_CHANGE: '账号状态变更',
  MEMBER_UPDATE: '成员资料修改',
  TEAM_CREATE: '创建团队',
  TEAM_UPDATE: '更新团队',
  TEAM_DELETE: '删除团队',
  EXAM_CREATE: '创建考试',
  EXAM_UPDATE: '更新考试',
  EXAM_CONFIG: '更新考试配置',
  EXAM_PUBLISH: '发布考试',
  EXAM_CLOSE: '结束考试',
  EXAM_ARCHIVE: '归档考试',
  STUDENT_CREATE: '新增学生',
  STUDENT_UPDATE: '更新学生',
  STUDENT_DELETE: '归档学生',
  PAPER_CREATE: '创建整卷',
  PAPER_PAGE_ADD: '添加答题卡页',
  PAPER_QUESTION_BIND: '绑定题目图片',
  PAPER_READY: '整卷标记完成',
  PAPER_ARCHIVE: '归档整卷',
  ALLOCATION_CREATE: '创建分配批次',
  ALLOCATION_REVOKE: '撤销分配批次',
  BOT_CREATE: '创建机器人账号',
  BOT_TOKEN_ROTATE: '轮换机器人令牌',
  MARK_TASK_GRADE: '阅卷打分',
  ARBITRATION_CREATE: '创建仲裁任务',
  ARBITRATION_CLAIM: '认领仲裁任务',
  ARBITRATION_GRADE: '仲裁打分',
  RANKING_EXPORT: '导出成绩排名',
};

/** 字典类型（后台维护页签） */
export const DICT_KINDS = ['areas', 'schools', 'grades', 'prizes', 'topics'] as const;
export type DictKind = (typeof DICT_KINDS)[number];

export const DICT_KIND_LABELS: Record<DictKind, string> = {
  areas: '赛区',
  schools: '学校',
  grades: '年级',
  prizes: '奖项',
  topics: '题号',
};

/** API 错误码（稳定契约，前端据此处理） */
export const ERROR_CODES = {
  VALIDATION: 'VALIDATION',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  USER_DISABLED: 'USER_DISABLED',
  CODE_INVALID: 'CODE_INVALID',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_TOO_MANY_ATTEMPTS: 'CODE_TOO_MANY_ATTEMPTS',
  CODE_RATE_LIMITED: 'CODE_RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL: 'INTERNAL',
  APPLICATION_EXISTS: 'APPLICATION_EXISTS',
  APPLICATION_NOT_EDITABLE: 'APPLICATION_NOT_EDITABLE',
  ALREADY_REVIEWED: 'ALREADY_REVIEWED',
  LEGACY_ALREADY_CLAIMED: 'LEGACY_ALREADY_CLAIMED',
  DICT_IN_USE: 'DICT_IN_USE',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
