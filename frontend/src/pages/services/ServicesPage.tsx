import React, { useState } from 'react';
import { Tabs, Typography, Space } from 'antd';
import {
  CustomerServiceOutlined,
  ShoppingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { ServiceOrdersTab } from './components/ServiceOrdersTab.tsx';
import { ServiceCatalogTab } from './components/ServiceCatalogTab.tsx';

const { Title, Text } = Typography;

export const ServicesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'orders';
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Space align="center" size={10}>
          <CustomerServiceOutlined style={{ fontSize: 26, color: '#1b4d3e' }} />
          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            Quản lý Dịch vụ Khách sạn (Hotel Services)
          </Title>
        </Space>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Tiếp nhận, xử lý và theo dõi các yêu cầu dịch vụ phòng (minibar, ẩm thực, giặt ủi, vận chuyển...) và quản lý bảng giá danh mục dịch vụ.
          </Text>
        </div>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
        style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
        items={[
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
