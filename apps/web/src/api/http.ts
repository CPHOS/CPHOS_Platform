import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthResponse } from '@cphos/shared';

export const http = axios.create({ baseURL: '/api' });

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

http.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// 401 时用 httpOnly 刷新令牌换取新访问令牌并重试一次
let refreshing: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = axios
      .post<AuthResponse>('/api/auth/refresh', {}, { withCredentials: true })
      .then((r) => {
        setAccessToken(r.data.accessToken);
        return r.data.accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

http.interceptors.response.use(
  (resp) => resp,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';
    if (status === 401 && config && !config._retried && !url.includes('/auth/refresh')) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return http(config);
      } catch {
        // 刷新失败（未登录/过期）→ 交由页面跳转登录
      }
    }
    return Promise.reject(error);
  },
);

/** 从 Axios 错误中提取后端统一错误信息 */
export function apiErrorMessage(error: unknown, fallback = '请求失败，请稍后再试'): string {
  const body = (error as AxiosError<ApiErrorBody>)?.response?.data;
  return body?.message ?? fallback;
}
