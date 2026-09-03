import { Navigate, Route, Routes } from 'react-router-dom';
import { ApartmentOutlined, AppstoreOutlined, AuditOutlined, CloudUploadOutlined, DatabaseOutlined, FileTextOutlined, HistoryOutlined, HomeOutlined, IdcardOutlined, ScheduleOutlined, SolutionOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { RequireAuth } from './components/RequireAuth';
import { ShellLayout } from './layouts/ShellLayout';
import { AdminHome } from './pages/admin/Home';
import { AuditList } from './pages/admin/audit/List';
import { AuditDetail } from './pages/admin/audit/Detail';
import { AccountsList } from './pages/admin/accounts/List';
import { MembersList } from './pages/admin/members/List';
import { TeamsList } from './pages/admin/teams/List';
import { AuditLogsList } from './pages/admin/logs/List';
import { DictAdminPage } from './pages/admin/dict/List';
import { ExamsAdminPage } from './pages/admin/exams/List';
import { AdminStudentsPage } from './pages/admin/students/List';
import { AdminPapersPage } from './pages/admin/papers/List';
import { LoginPage } from './pages/auth/Login';
import { RegisterPage } from './pages/auth/Register';
import { ForgotPasswordPage } from './pages/auth/ForgotPassword';
import { VerifyEmailPage } from './pages/auth/VerifyEmail';
import { CphosHome } from './pages/cphos/Home';
import { ArbitrationPage } from './pages/cphos/Arbitration';
import { PlatformHome } from './pages/platform/Home';
import { ProfilePage } from './pages/Profile';
import { StudentsPage } from './pages/platform/Students';
import { PapersPage } from './pages/platform/Papers';
import { TasksPage } from './pages/platform/Tasks';
import { ResultsPage } from './pages/platform/Results';

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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

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
                { key: '/app/students', label: '学生名册', icon: <SolutionOutlined /> },
                { key: '/app/papers', label: '整卷上传', icon: <CloudUploadOutlined /> },
                { key: '/app/tasks', label: '阅卷任务', icon: <AuditOutlined /> },
                { key: '/app/results', label: '成绩查询', icon: <ScheduleOutlined /> },
                { key: '/app/profile', label: '个人信息', icon: <IdcardOutlined /> },
              ]}
            />
          </RequireAuth>
        }
      >
        <Route index element={<PlatformHome />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="results" element={<ResultsPage />} />
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
                { key: '/cphos/arbitration', label: '仲裁任务', icon: <AuditOutlined /> },
                { key: '/cphos/profile', label: '个人信息', icon: <IdcardOutlined /> },
              ]}
            />
          </RequireAuth>
        }
      >
        <Route index element={<CphosHome />} />
        <Route path="arbitration" element={<ArbitrationPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth kind="admin">
            <ShellLayout
              kind="admin"
              nav={[
                {
                  type: 'group',
                  label: '常用',
                  children: [
                    { key: '/admin', label: '概览', icon: <AppstoreOutlined /> },
                    { key: '/admin/profile', label: '个人信息', icon: <IdcardOutlined /> },
                  ],
                },
                {
                  type: 'group',
                  label: '审核与组织',
                  children: [
                    { key: '/admin/audit', label: '用户审核', icon: <AuditOutlined /> },
                    { key: '/admin/members', label: '成员管理', icon: <TeamOutlined /> },
                    { key: '/admin/teams', label: '团队管理', icon: <ApartmentOutlined /> },
                  ],
                },
                {
                  type: 'group',
                  label: '考试',
                  children: [
                    { key: '/admin/exams', label: '考试管理', icon: <ScheduleOutlined /> },
                    { key: '/admin/students', label: '学生名册', icon: <SolutionOutlined /> },
                    { key: '/admin/papers', label: '整卷管理', icon: <FileTextOutlined /> },
                  ],
                },
                {
                  type: 'group',
                  label: '系统',
                  children: [
                    { key: '/admin/accounts', label: '账号管理', icon: <UserOutlined /> },
                    { key: '/admin/dict', label: '字典维护', icon: <DatabaseOutlined /> },
                    { key: '/admin/logs', label: '审计日志', icon: <HistoryOutlined /> },
                  ],
                },
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
        <Route path="exams" element={<ExamsAdminPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="papers" element={<AdminPapersPage />} />
        <Route path="accounts" element={<AccountsList />} />
        <Route path="dict" element={<DictAdminPage />} />
        <Route path="logs" element={<AuditLogsList />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
