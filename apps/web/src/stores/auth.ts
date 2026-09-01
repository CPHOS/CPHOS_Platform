import { create } from 'zustand';
import type { UserDto } from '@cphos/shared';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/http';
import { queryClient } from '../api/queryClient';

interface AuthState {
  user: UserDto | null;
  /** 正在从 /me 恢复会话 */
  booting: boolean;
  /** /me 网络/5xx 失败（非未登录），用于离线重试 */
  bootError: boolean;
  login: (account: string, password: string) => Promise<UserDto>;
  loadMe: () => Promise<UserDto | null>;
  logout: () => Promise<void>;
  setUser: (user: UserDto | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  booting: true,
  bootError: false,

  async login(account, password) {
    const { user, accessToken } = await authApi.login({ account, password });
    queryClient.clear();
    setAccessToken(accessToken);
    set({ user, booting: false, bootError: false });
    return user;
  },

  async loadMe() {
    set({ booting: true, bootError: false });
    try {
      const user = await authApi.me();
      set({ user, booting: false, bootError: false });
      return user;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setAccessToken(null);
        set({ user: null, booting: false, bootError: false });
      } else {
        // 网络/5xx 不应误登出；进入离线重试页
        set({ booting: false, bootError: true });
      }
      return null;
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } finally {
      queryClient.clear();
      setAccessToken(null);
      set({ user: null, booting: false, bootError: false });
    }
  },

  setUser(user) {
    set({ user });
  },
}));

/** 登录成功后按账号层级计算首页路径 */
export function homeFor(user: UserDto): string {
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'CPHOS_MEMBER':
      return '/cphos';
    default:
      return '/app';
  }
}
