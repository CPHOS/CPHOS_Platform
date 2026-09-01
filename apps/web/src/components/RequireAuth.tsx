import { Button, Result, Spin } from 'antd';
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuthStore } from '../stores/auth';

interface RequireAuthProps {
  kind: 'platform' | 'cphos' | 'admin';
  children: React.ReactNode;
}

const PUBLIC_PATHS = ['/login', '/register', '/verify-email'];

/**
 * 登录与角色守卫：
 * - 会话恢复中 → 全屏加载
 * - 未登录 → /login（带回跳地址）
 * - 已登录但邮箱未验证 → /verify-email
 * - 待审核用户 → 进入其归属工作台（审核状态面板在工作台内展示）
 * - 角色与界面不匹配 → 跳转到其归属首页
 */
export function RequireAuth({ kind, children }: RequireAuthProps) {
  const user = useAuthStore((s) => s.user);
  const booting = useAuthStore((s) => s.booting);
  const bootError = useAuthStore((s) => s.bootError);
  const loadMe = useAuthStore((s) => s.loadMe);
  const location = useLocation();

  useEffect(() => {
    if (!user) void loadMe();
  }, [user, loadMe]);

  if (booting) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="正在恢复会话…" />
      </div>
    );
  }

  if (!user) {
    if (PUBLIC_PATHS.includes(location.pathname)) return <>{children}</>;
    if (bootError) {
      return (
        <Result
          status="warning"
          title="无法连接服务器"
          subTitle="会话恢复失败，请检查网络后重试。"
          extra={
            <Button type="primary" onClick={() => void loadMe()}>
              重试
            </Button>
          }
        />
      );
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 邮箱验证仅约束普通用户（内部账号/管理员由建档流程创建，无需验证）
  if (user.role === 'PLATFORM_USER' && !user.emailVerified) {
    if (location.pathname === '/verify-email') return <>{children}</>;
    return <Navigate to="/verify-email" replace />;
  }

  const expected = homeFor(user);
  if (location.pathname !== expected && !location.pathname.startsWith(`${expected}/`)) {
    return <Navigate to={expected} replace />;
  }

  return <>{children}</>;
}
