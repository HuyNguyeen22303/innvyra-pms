import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px 16px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <Result
        status="403"
        title="403 - Không có quyền truy cập"
        subTitle="Tài khoản hoặc vai trò của bạn không được cấp phép thao tác chức năng này."
        extra={
          <Button
            type="primary"
            onClick={() => navigate('/dashboard')}
            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
          >
            Về Trang Chủ
          </Button>
        }
      />
    </div>
  );
};
