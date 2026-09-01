import { Navigate, Route, Routes } from 'react-router-dom';
import { AppstoreOutlined, AuditOutlined, HomeOutlined, IdcardOutlined, TeamOutlined, UsergroupAddOutlined, UserOutlined } from '@ant-design/icons';
import { RequireAuth } from './components/RequireAuth';
import { ShellLayout } from './layouts/ShellLayout';
import { AdminHome } from './pages/admin/Home';
import { AuditList } from './pages/admin/audit/List';
import { AuditDetail } from './pages/admin/audit/Detail';
import { AccountsList } from './pages/admin/accounts/List';
import { MembersList } from './pages/admin/members/List';
import { TeamsList } from './pages/admin/teams/List';
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';
import { VerifyEmailPage } from './pages/auth/VerifyEmail';
import { CphosHome } from './pages/cphos/Home';
import { PlatformHome } from './pages/platform/Home';
import { ProfilePage } from './pages/Profile';

/**
 * 三端路由：
 * - /app    平台用户（教练/个人参赛者，待审核状态在此展示审核面板）
 * - /cphos  CPHOS 成员（仲裁成员）
 * - /admin  管理员
 * 公开页：/login /register /verify-email
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
        path="/app"
        element={
          <RequireAuth kind="platform">
            <ShellLayout
              kind="platform"
              nav={[
                { key: '/app', label: '工作台', icon: <HomeOutlined /> },
                { key: '/app/profile', label: '个人信息', icon: <IdcardOutlined /> },
              ]}
            />
          </RequireAuth>
        }
      >
        <Route index element={<PlatformHome />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route
        path="/cphos"
        element={
          <RequireAuth kind="cphos">
            <ShellLayout
              kind="cphos"
              nav={[
                { key: '/cphos', label: '工作台', icon: <HomeOutlined /> },
                { key: '/cphos/profile', label: '个人信息', icon: <IdcardOutlined /> },
              ]}
            />
          </RequireAuth>
        }
      >
        <Route index element={<CphosHome />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth kind="admin">
            <ShellLayout
              kind="admin"
              nav={[
                { key: '/admin', label: '概览', icon: <AppstoreOutlined /> },
                { key: '/admin/audit', label: '用户审核', icon: <AuditOutlined /> },
                { key: '/admin/members', label: '成员管理', icon: <TeamOutlined /> },
                { key: '/admin/teams', label: '团队管理', icon: <UsergroupAddOutlined /> },
                { key: '/admin/accounts', label: '账号管理', icon: <UserOutlined /> },
                { key: '/admin/profile', label: '个人信息', icon: <IdcardOutlined /> },
              ]}
            />
          </RequireAuth>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="audit" element={<AuditList />} />
        <Route path="audit/:id" element={<AuditDetail />} />
        <Route path="members" element={<MembersList />} />
        <Route path="teams" element={<TeamsList />} />
        <Route path="accounts" element={<AccountsList />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
