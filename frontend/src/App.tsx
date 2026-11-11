import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import viVN from 'antd/locale/vi_VN';
import { pmsTheme } from './theme/themeConfig.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AppRoutes } from './routes/AppRoutes.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider theme={pmsTheme} locale={viVN}>
          <AntdApp>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AntdApp>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};


export default App;
