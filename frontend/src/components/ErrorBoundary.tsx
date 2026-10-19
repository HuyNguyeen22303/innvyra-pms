import React, { Component, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in PMS UI:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            padding: 24,
          }}
        >
          <Result
            status="500"
            title="Đã xảy ra lỗi giao diện"
            subTitle={
              this.state.error?.message ||
              'Hệ thống gặp sự cố không mong muốn khi hiển thị trang này.'
            }
            extra={[
              <Button
                type="primary"
                key="reload"
                onClick={() => window.location.reload()}
                style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
              >
                Tải lại trang
              </Button>,
              <Button key="home" onClick={() => (window.location.href = '/')}>
                Về trang chủ
              </Button>,
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
