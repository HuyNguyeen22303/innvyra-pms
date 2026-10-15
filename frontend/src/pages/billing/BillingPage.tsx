import React, { useState } from 'react';
import { Tabs, Typography, Space } from 'antd';
import {
  DollarOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { FolioTab } from './components/FolioTab.tsx';
import { ServiceOrdersTab } from './components/ServiceOrdersTab.tsx';
import { ServiceCatalogTab } from './components/ServiceCatalogTab.tsx';

const { Title, Text } = Typography;

export const BillingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('folio');

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

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
        items={[
          {
            key: 'folio',
            label: (
              <Space>
                <DollarOutlined />
                <span>Sổ công nợ Folio & Thu/Hoàn tiền</span>
              </Space>
            ),
            children: <FolioTab />,
          },
          {
            key: 'orders',
            label: (
              <Space>
                <ShoppingOutlined />
                <span>Yêu cầu Dịch vụ (Service Orders)</span>
              </Space>
            ),
            children: <ServiceOrdersTab />,
          },
          {
            key: 'catalog',
            label: (
              <Space>
                <AppstoreOutlined />
                <span>Danh mục Dịch vụ (Catalog)</span>
              </Space>
            ),
            children: <ServiceCatalogTab />,
          },
        ]}
      />
    </div>
  );
};
