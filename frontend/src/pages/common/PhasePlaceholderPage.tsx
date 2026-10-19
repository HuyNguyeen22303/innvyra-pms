import React from 'react';
import { Result, Button, Tag, Space } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface PhasePlaceholderProps {
  title: string;
  phase: string;
  description: string;
}

export const PhasePlaceholderPage: React.FC<PhasePlaceholderProps> = ({
  title,
  phase,
  description,
}) => {
  const navigate = useNavigate();

  return (
    <Result
      icon={<RocketOutlined style={{ color: '#0f4c81', fontSize: 64 }} />}
      title={
        <Space orientation="vertical" align="center">
          <span>{title}</span>
          <Tag color="blue">{phase}</Tag>
        </Space>
      }
      subTitle={description}
      extra={
        <Button type="primary" onClick={() => navigate('/dashboard')}>
          Quay lại Tổng quan
        </Button>
      }
    />
  );
};
