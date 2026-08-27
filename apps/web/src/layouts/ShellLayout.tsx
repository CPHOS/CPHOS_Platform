import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SHELL_THEMES, type ShellKind } from '../theme';
import { useAuthStore } from '../stores/auth';

export interface ShellNavItem {
  key: string;
  label: string;
}

interface ShellLayoutProps {
  kind: ShellKind;
  nav: ShellNavItem[];
}

/** 通用三端壳：Sider 导航 + Header（用户信息/退出）+ Content */
export function ShellLayout({ kind, nav }: ShellLayoutProps) {
  const meta = SHELL_THEMES[kind];
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = useMemo(() => {
    const hit = [...nav].sort((a, b) => b.key.length - a.key.length).find((n) => location.pathname.startsWith(n.key));
    return hit?.key ?? nav[0]?.key ?? '';
  }, [location.pathname, nav]);

  const handleMenuClick = ({ key }: { key: string }) => navigate(key);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider breakpoint="lg" collapsedWidth={64}>
        <div style={{ color: '#fff', fontWeight: 700, padding: '16px 20px', fontSize: 16, whiteSpace: 'nowrap' }}>
          {meta.brand}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={nav as MenuProps['items']}
          onClick={handleMenuClick}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingInline: 24,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Dropdown
            menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => void logout().then(() => navigate('/login')) },
              ],
            }}
          >
            <span style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <Typography.Text>
                {user?.displayName ?? user?.profile?.realName ?? user?.email ?? user?.loginName}
              </Typography.Text>
            </span>
          </Dropdown>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
