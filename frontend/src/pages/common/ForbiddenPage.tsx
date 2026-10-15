import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="403 - Không có quyền truy cập"
      subTitle="Tài khoản hoặc vai trò của bạn không được cấp phép thao tác chức năng này."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Về Trang Chủ
        </Button>
      }
    />
  );
};
