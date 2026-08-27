import type { AccountRole, MemberRole, UserStatus } from './enums.js';

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
