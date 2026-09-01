import { QueryCache, QueryClient } from '@tanstack/react-query';
import { message } from 'antd';

function errorMessage(error: unknown): string {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? '请求失败，请稍后重试';
}

/** 全应用共享 QueryClient：登录/登出必须 clear，避免跨账号缓存泄漏 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // 统一查询错误提示，避免 5xx/断网被伪装成空数据
      message.error(errorMessage(error));
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
