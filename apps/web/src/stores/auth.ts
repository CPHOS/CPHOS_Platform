import { create } from 'zustand';
import type { UserDto } from '@cphos/shared';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/http';
import { queryClient } from '../api/queryClient';

interface AuthState {
  user: UserDto | null;
  /** 正在从 /me 恢复会话 */
  booting: boolean;
  login: (account: string, password: string) => Promise<UserDto>;
  loadMe: () => Promise<UserDto | null>;
  logout: () => Promise<void>;
  setUser: (user: UserDto | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  booting: true,

  async login(account, password) {
    const { user, accessToken } = await authApi.login({ account, password });
    queryClient.clear();
    setAccessToken(accessToken);
    set({ user, booting: false });
    return user;
  },

  async loadMe() {
    try {
      const user = await authApi.me();
      set({ user, booting: false });
      return user;
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setAccessToken(null);
        set({ user: null, booting: false });
      } else {
        // 网络/5xx 不应误登出；保留当前用户并结束 booting，由页面重试
        set({ booting: false });
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
      set({ user: null, booting: false });
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
