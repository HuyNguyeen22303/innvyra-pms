import type { ThemeConfig } from 'antd';

export const pmsTheme: ThemeConfig = {
  token: {
    // Primary: Deep Boutique Emerald
    colorPrimary: '#1b4d3e',
    colorSuccess: '#15803d',
    colorWarning: '#d97706',
    colorError: '#b91c1c',
    colorInfo: '#1d4ed8',

    // High Contrast Typography & Surfaces
    colorTextHeading: '#0f172a',    // Slate 900 (Deep, crisp)
    colorText: '#1e293b',           // Slate 800 (Very clear, sharp)
    colorTextSecondary: '#475569',  // Slate 600 (High contrast secondary, passes WCAG AA)
    colorTextTertiary: '#64748b',   // Slate 500

    colorBgLayout: '#f8fafc',       // Slate 50 (Clean, modern light background)
    colorBgContainer: '#ffffff',    // Crisp white surfaces
    colorBorder: '#e2e8f0',         // Slate 200 (Clean hairline borders)
    colorBorderSecondary: '#f1f5f9',

    borderRadius: 8,
    fontSize: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#0f2922',           // Deep Forest Slate (Rich, high-end hotel vibe)
      headerBg: '#ffffff',
      bodyBg: '#f8fafc',
    },
    Menu: {
      darkItemBg: '#0f2922',
      darkItemSelectedBg: '#1b4d3e',
      darkItemHoverBg: '#16382e',
      darkItemSelectedColor: '#ffffff',
      darkItemColor: '#cbd5e1',     // Slate 300 (Much brighter than muddy olive)
      fontSize: 13,
      itemBorderRadius: 6,
    },
    Button: {
      borderRadius: 6,
      controlHeight: 38,
      fontWeight: 500,
      defaultBorderColor: '#cbd5e1',
    },
    Card: {
      borderRadiusLG: 12,
      headerFontSize: 15,
      colorBorderSecondary: '#e2e8f0',
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#334155',
      headerSplitColor: 'transparent',
      borderColor: '#f1f5f9',
      rowHoverBg: '#f8fafc',
    },
    Input: {
      controlHeight: 38,
      colorBorder: '#cbd5e1',
    },
    Select: {
      controlHeight: 38,
    },
    Tag: {
      borderRadiusSM: 4,
    },
  },
};
