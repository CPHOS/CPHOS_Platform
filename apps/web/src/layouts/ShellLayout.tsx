import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, ConfigProvider, Dropdown, Layout, Menu, Space, Typography, theme as antdTheme } from 'antd';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ACCOUNT_ROLE_LABELS } from '@cphos/shared';
import logo from '../assets/logo.png';
import { useAuthStore } from '../stores/auth';
import { SHELL_THEMES, shellTheme, type ShellKind } from '../theme';

export interface ShellNavItem {
  key: string;
  label: string;
  icon?: ReactNode;
  /** 侧栏分组标题（同一 group 的条目归到一组） */
  group?: string;
}

interface ShellLayoutProps {
  kind: ShellKind;
  nav: ShellNavItem[];
}

/** 通用三端壳：顶部导航（品牌/用户）+ 左侧分组 Sider + 内容区（页标题在内容顶部） */
export function ShellLayout({ kind, nav }: ShellLayoutProps) {
  const meta = SHELL_THEMES[kind];
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = antdTheme.useToken();
  const [collapsed, setCollapsed] = useState(false);

  const selectedKey = useMemo(() => {
    const hit = [...nav].sort((a, b) => b.key.length - a.key.length).find((n) => location.pathname.startsWith(n.key));
    return hit?.key ?? nav[0]?.key ?? '';
  }, [location.pathname, nav]);

  const current = nav.find((n) => n.key === selectedKey);
  const displayName = user?.displayName ?? user?.profile?.realName ?? user?.email ?? user?.loginName;

  // 按 group 归类生成菜单：无 group 的条目置顶，有 group 的按分组标题折叠
  const menuItems: MenuProps['items'] = useMemo(() => {
    const groups = new Map<string | undefined, ShellNavItem[]>();
    for (const n of nav) {
      const list = groups.get(n.group) ?? [];
      list.push(n);
      groups.set(n.group, list);
    }
    const items: MenuProps['items'] = [];
    for (const [group, groupItems] of groups) {
      const children = groupItems.map((n) => ({ key: n.key, icon: n.icon, label: n.label }));
      if (group) items.push({ type: 'group', label: group, children });
      else items.push(...children);
    }
    return items;
  }, [nav]);

  return (
    <ConfigProvider theme={shellTheme(kind)}>
      <Layout style={{ height: '100vh' }}>
        <Layout.Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingInline: 16,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img src={logo} alt={meta.brand} style={{ height: 24, width: 'auto', flexShrink: 0 }} />
            <span
              className="shell-brand"
              style={{ fontWeight: 600, fontSize: 15, color: token.colorText }}
            >
              {meta.brand}
            </span>
          </div>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'role',
                  label: (
                    <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
                      {user ? ACCOUNT_ROLE_LABELS[user.role] : ''}
                    </span>
                  ),
                  disabled: true,
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => void logout().then(() => navigate('/login')),
                },
              ],
            }}
          >
            <Space size={8} style={{ cursor: 'pointer' }}>
              <Avatar size={28} style={{ background: meta.colorPrimary }} icon={<UserOutlined />} />
              <Typography.Text className="shell-user-name">{displayName}</Typography.Text>
            </Space>
          </Dropdown>
        </Layout.Header>

        <Layout style={{ overflow: 'hidden' }}>
          <Layout.Sider
            width={220}
            breakpoint="lg"
            collapsedWidth={64}
            collapsed={collapsed}
            onBreakpoint={setCollapsed}
            trigger={null}
            style={{ borderRight: `1px solid ${token.colorBorderSecondary}`, overflowY: 'auto' }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              onClick={({ key }) => navigate(key)}
              style={{ border: 'none', padding: '8px 8px 0' }}
            />
          </Layout.Sider>

          <Layout.Content className="shell-scroll">
            <div className="shell-inner">
              <div style={{ fontSize: 20, fontWeight: 600, color: token.colorText, marginBottom: 24 }}>
                {current?.label ?? ''}
              </div>
              <Outlet />
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
