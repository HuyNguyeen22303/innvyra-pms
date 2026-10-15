import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404 - Không tìm thấy trang"
      subTitle="Trang bạn đang tìm kiếm không tồn tại hoặc đã được thay đổi đường dẫn."
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Về Trang Chủ
        </Button>
      }
    />
  );
};
