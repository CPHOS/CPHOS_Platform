import type { AccountRole, AuditStatus, MemberRole, UserStatus } from './enums.js';

/** 当前登录用户（/api/auth/me 返回，BigInt 序列化为字符串） */
export interface UserDto {
  id: string;
  /** 邮箱（仅平台用户有；内部账号为 null，用 loginName 登录） */
  email: string | null;
  /** 内部账号用户名（平台用户为 null） */
  loginName: string | null;
  /** 显示名称（内部账号建档时填写；平台用户为 null，用资料姓名） */
  displayName: string | null;
  status: UserStatus;
  /** 账号层级（决定界面入口） */
  role: AccountRole;
  /** 受保护账号（唯一超级管理员）：不可删除/禁用/降级 */
  protected: boolean;
  emailVerified: boolean;
  legacyMemberId: string | null;
  createdAt: string;
  /** 平台用户审核通过后才有业务资料 */
  profile: {
    realName: string | null;
    schoolId: string | null;
    schoolName: string | null;
    role: MemberRole;
    defaultSlot: number | null;
    uploadLimit: number;
  } | null;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

// ---------- 审核与认领 ----------

export interface AuditApplicationDto {
  id: string;
  status: AuditStatus;
  realName: string;
  schoolId: string | null;
  schoolName: string | null;
  wechatNickname: string | null;
  contact: string | null;
  applyNote: string | null;
  claimLegacy: boolean;
  matchedLegacyMemberId: string | null;
  reviewRemark: string | null;
  reviewedAt: string | null;
  /** 管理员要求补材料的时刻（非空表示待补材料，用户需修改资料后重提） */
  materialRequestedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 申请归属用户（平台用户=邮箱） */
  user: { id: string; email: string | null; loginName: string | null };
}

export interface AuditApplicationListDto {
  items: AuditApplicationDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** 老用户认领候选（来自 LegacyMemberRef 快照，无数据时为空数组） */
export interface LegacyMemberCandidateDto {
  id: string;
  realName: string | null;
  wechatNickname: string | null;
  wechatAvatar: string | null;
  schoolId: string | null;
  schoolName: string | null;
  auditStatus: number | null;
  roleType: number | null;
  defaultTopicId: number | null;
  uploadLimit: number | null;
  /** 匹配得分（前端仅展示排序，不依赖） */
  score: number;
}

export interface AuditLogDto {
  id: string;
  applicationId: string | null;
  action: string;
  operatorId: string;
  operatorName: string | null;
  legacyMemberId: string | null;
  /** 账号管理类操作的目标账号 */
  targetUserId: string | null;
  remark: string | null;
  createdAt: string;
}

export interface SchoolDto {
  id: string;
  name: string;
  areaId: string;
  areaName: string | null;
}

// ---------- 成员与账号管理（功能块③） ----------

export interface MemberDto {
  userId: string;
  realName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  role: MemberRole;
  defaultSlot: number | null;
  team: { id: string; name: string | null; uploadLimit: number } | null;
  account: { email: string | null; loginName: string | null; status: UserStatus };
}

export interface MemberListDto {
  items: MemberDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AccountDto {
  id: string;
  email: string | null;
  loginName: string | null;
  displayName: string | null;
  role: AccountRole;
  status: UserStatus;
  protected: boolean;
  createdAt: string;
  profile: { realName: string | null; schoolName: string | null; role: MemberRole } | null;
}

export interface AccountListDto {
  items: AccountDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- 团队管理（功能块③ C3） ----------

export interface TeamMemberDto {
  userId: string;
  realName: string | null;
  schoolName: string | null;
  role: MemberRole;
  email: string | null;
  loginName: string | null;
}

export interface TeamDto {
  id: string;
  name: string | null;
  uploadLimit: number;
  leader: { userId: string; realName: string | null };
  memberCount: number;
  createdAt: string;
}

export interface TeamDetailDto extends TeamDto {
  members: TeamMemberDto[];
}

export interface TeamListDto {
  items: TeamDto[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- 字典维护（管理域） ----------

export interface AreaDto {
  id: string;
  name: string;
  schoolCount: number;
}

export interface ManagedSchoolDto {
  id: string;
  name: string;
  areaId: string;
  areaName: string | null;
  memberCount: number;
}

export interface ManagedSchoolListDto {
  items: ManagedSchoolDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DictEntryDto {
  id: string;
  name: string;
}
