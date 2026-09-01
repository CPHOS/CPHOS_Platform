import type { ThemeConfig } from 'antd';

/** GitHub 风格字体栈 */
const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

/** 三端主题（New API 式浅色布局）：平台蓝 / CPHOS 紫 / 管理红 */
export const SHELL_THEMES = {
  platform: { brand: 'CPHOS 联考平台', colorPrimary: '#0969da' },
  cphos: { brand: 'CPHOS 工作台', colorPrimary: '#8250df' },
  admin: { brand: '管理后台', colorPrimary: '#cf222e' },
} as const;

export type ShellKind = keyof typeof SHELL_THEMES;

/** 基础主题（全局）：浅色，GitHub 克制配色（浅灰背景 + 细边框） */
export const baseTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0969da',
    colorInfo: '#0969da',
    colorLink: '#0969da',
    colorBgLayout: '#f6f8fa',
    colorBgContainer: '#ffffff',
    colorBorder: '#d0d7de',
    colorBorderSecondary: '#d8dee4',
    colorSplit: '#eaeef2',
    colorText: '#1f2328',
    colorTextSecondary: '#59636e',
    colorTextTertiary: '#59636e',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: FONT,
  },
  components: {
    Layout: {
      siderBg: '#ffffff',
      headerBg: '#ffffff',
      bodyBg: '#f6f8fa',
      headerHeight: 56,
    },
    Menu: {
      itemColor: '#1f2328',
      itemHoverBg: '#f6f8fa',
      itemHoverColor: '#1f2328',
      itemBorderRadius: 6,
      itemHeight: 36,
      activeBarBorderWidth: 0,
    },
    Table: {
      headerBg: '#f6f8fa',
      headerColor: '#59636e',
      borderColor: '#d8dee4',
      headerSplitColor: 'transparent',
    },
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Card: {
      headerFontSize: 14,
    },
  },
};

/** 各端主题：主色 + 菜单选中态（主色淡底 + 主色文字） */
export function shellTheme(kind: ShellKind): ThemeConfig {
  const { colorPrimary } = SHELL_THEMES[kind];
  return {
    token: {
      colorPrimary,
      colorInfo: colorPrimary,
      colorLink: colorPrimary,
    },
    components: {
      Menu: {
        itemSelectedBg: `${colorPrimary}14`,
        itemSelectedColor: colorPrimary,
      },
    },
  };
}
