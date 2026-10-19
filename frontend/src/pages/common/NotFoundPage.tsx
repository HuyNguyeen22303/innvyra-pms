import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px 16px', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <Result
        status="404"
        title="404 - Không tìm thấy trang"
        subTitle="Trang bạn đang tìm kiếm không tồn tại hoặc đã được thay đổi đường dẫn."
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
