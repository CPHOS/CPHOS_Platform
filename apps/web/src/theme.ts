import type { ThemeConfig } from 'antd';

/** 三端主题：平台用户（蓝）/ CPHOS 成员（紫）/ 管理员（红褐） */
export const SHELL_THEMES = {
  platform: {
    brand: 'CPHOS 联考平台',
    colorPrimary: '#1677ff',
  },
  cphos: {
    brand: 'CPHOS 工作台',
    colorPrimary: '#722ed1',
  },
  admin: {
    brand: '管理后台',
    colorPrimary: '#d4380d',
  },
} as const;

export type ShellKind = keyof typeof SHELL_THEMES;

export function shellTheme(kind: ShellKind): ThemeConfig {
  const meta = SHELL_THEMES[kind];
  return {
    token: {
      colorPrimary: meta.colorPrimary,
      borderRadius: 6,
    },
    components: {
      Layout: {
        siderBg: '#001529',
      },
    },
  };
}
