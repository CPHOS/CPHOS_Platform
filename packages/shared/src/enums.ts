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
export const ACCOUNT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CPHOS_MEMBER', 'PLATFORM_USER'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_ROLE_LABELS: Record<AccountRole, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  CPHOS_MEMBER: 'CPHOS 成员',
  PLATFORM_USER: '平台用户',
};

export const AUDIT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  LEADER: '负责人',
  COACH: '附属教练',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PENDING: '待审核',
  ACTIVE: '正常',
  DISABLED: '已禁用',
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
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
