import { QueryClient } from '@tanstack/react-query';

/** 全应用共享 QueryClient：登录/登出必须 clear，避免跨账号缓存泄漏 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
