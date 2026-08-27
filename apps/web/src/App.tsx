import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { ShellLayout } from './layouts/ShellLayout';
import { AdminHome } from './pages/admin/Home';
import { LoginPage } from './pages/auth/Login';
import { PendingPage } from './pages/auth/Pending';
import { RegisterPage } from './pages/auth/Register';
import { VerifyEmailPage } from './pages/auth/VerifyEmail';
import { CphosHome } from './pages/cphos/Home';
import { PlatformHome } from './pages/platform/Home';

/**
 * 三端路由：
 * - /app    平台用户（教练/个人参赛者）
 * - /cphos  CPHOS 成员（仲裁成员）
 * - /admin  管理员
 * 公开页：/login /register /verify-email /pending
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/verify-email"
        element={
          <RequireAuth kind="platform">
            <VerifyEmailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/pending"
        element={
          <RequireAuth kind="platform">
            <PendingPage />
          </RequireAuth>
        }
      />

      <Route
        path="/app"
        element={
          <RequireAuth kind="platform">
            <ShellLayout kind="platform" nav={[{ key: '/app', label: '工作台' }]} />
          </RequireAuth>
        }
      >
        <Route index element={<PlatformHome />} />
      </Route>

      <Route
        path="/cphos"
        element={
          <RequireAuth kind="cphos">
            <ShellLayout kind="cphos" nav={[{ key: '/cphos', label: '工作台' }]} />
          </RequireAuth>
        }
      >
        <Route index element={<CphosHome />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth kind="admin">
            <ShellLayout kind="admin" nav={[{ key: '/admin', label: '概览' }]} />
          </RequireAuth>
        }
      >
        <Route index element={<AdminHome />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
