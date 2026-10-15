import type { ThemeConfig } from 'antd';

export const pmsTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0f4c81', // Classic Navy / PMS Hospitality Blue
    colorSuccess: '#2a9d8f',
    colorWarning: '#e76f51',
    colorError: '#e63946',
    colorInfo: '#0f4c81',
    borderRadius: 8,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#0b2545',
      headerBg: '#ffffff',
    },
    Menu: {
      darkItemBg: '#0b2545',
      darkItemSelectedBg: '#134074',
      darkItemHoverBg: '#13315c',
    },
    Button: {
      borderRadius: 6,
    },
    Card: {
      borderRadiusLG: 10,
    },
  },
};
