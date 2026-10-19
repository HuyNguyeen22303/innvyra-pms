import React from 'react';
import { Typography, Space } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { FolioTab } from './components/FolioTab.tsx';

const { Title, Text } = Typography;

export const BillingPage: React.FC = () => {
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Space align="center" size={10}>
          <BankOutlined style={{ fontSize: 26, color: '#1b4d3e' }} />
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            Thu ngân & Quản lý Sổ công nợ Folio (Billing Management)
          </Title>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Theo dõi chi phí tiền phòng, ghi nhận dịch vụ, thu tiền, đặt cọc, hoàn trả, điều chỉnh và quyết toán Folio theo chuẩn khách sạn quốc tế.
          </Text>
        </div>
      </div>

      <FolioTab />
    </div>
  );
};
