import React, { useMemo, useCallback } from 'react';
import { Tabs, Typography, Space } from 'antd';
import {
  InboxOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  ShopOutlined,
  FileDoneOutlined,
  ExportOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { InventoryOverviewTab } from './components/InventoryOverviewTab.tsx';
import { InventoryItemsTab } from './components/InventoryItemsTab.tsx';
import { InventoryCategoriesTab } from './components/InventoryCategoriesTab.tsx';
import { InventorySuppliersTab } from './components/InventorySuppliersTab.tsx';
import { InventoryReceiptsTab } from './components/InventoryReceiptsTab.tsx';
import { InventoryIssuesTab } from './components/InventoryIssuesTab.tsx';
import { InventoryMovementsTab } from './components/InventoryMovementsTab.tsx';

const { Title, Text } = Typography;

export const InventoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const userRole = user?.role || '';

  // Determine allowed tabs based on user role
  const isManagementOrAccountant = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);
  const isStaffRole = ['HOUSEKEEPING', 'TECHNICIAN'].includes(userRole);

  const handleTabChange = useCallback(
    (key: string) => {
      setSearchParams({ tab: key }, { replace: true });
    },
    [setSearchParams]
  );

  const availableTabItems = useMemo(() => {
    const tabs = [];

    // Overview Tab (ADMIN, MANAGER, ACCOUNTANT)
    if (isManagementOrAccountant) {
      tabs.push({
        key: 'overview',
        label: (
          <Space>
            <DashboardOutlined />
            <span>Tổng quan & Định mức</span>
          </Space>
        ),
        children: <InventoryOverviewTab onNavigateTab={(key) => handleTabChange(key)} />,
      });
    }

    // Items Tab (ALL ALLOWED ROLES)
    tabs.push({
      key: 'items',
      label: (
        <Space>
          <InboxOutlined />
          <span>Vật tư kho</span>
        </Space>
      ),
      children: <InventoryItemsTab />,
    });

    // Categories Tab (ALL ALLOWED ROLES)
    tabs.push({
      key: 'categories',
      label: (
        <Space>
          <AppstoreOutlined />
          <span>Nhóm danh mục</span>
        </Space>
      ),
      children: <InventoryCategoriesTab />,
    });

    // Suppliers Tab (ADMIN, MANAGER, ACCOUNTANT)
    if (isManagementOrAccountant) {
      tabs.push({
        key: 'suppliers',
        label: (
          <Space>
            <ShopOutlined />
            <span>Nhà cung cấp</span>
          </Space>
        ),
        children: <InventorySuppliersTab />,
      });
    }

    // Receipts Tab (ADMIN, MANAGER, ACCOUNTANT)
    if (isManagementOrAccountant) {
      tabs.push({
        key: 'receipts',
        label: (
          <Space>
            <FileDoneOutlined />
            <span>Phiếu Nhập kho</span>
          </Space>
        ),
        children: <InventoryReceiptsTab />,
      });
    }

    // Issues Tab (ALL ALLOWED ROLES)
    tabs.push({
      key: 'issues',
      label: (
        <Space>
          <ExportOutlined />
          <span>Phiếu Xuất kho</span>
        </Space>
      ),
      children: <InventoryIssuesTab />,
    });

    // Movements Tab (ADMIN, MANAGER, ACCOUNTANT)
    if (isManagementOrAccountant) {
      tabs.push({
        key: 'movements',
        label: (
          <Space>
            <HistoryOutlined />
            <span>Sổ kho & Biến động</span>
          </Space>
        ),
        children: <InventoryMovementsTab />,
      });
    }

    return tabs;
  }, [isManagementOrAccountant, handleTabChange]);

  // Valid tab keys
  const validKeys = useMemo(
    () => availableTabItems.map((tab) => tab.key),
    [availableTabItems],
  );

  const defaultKey = isStaffRole ? 'items' : 'overview';
  const paramTab = searchParams.get('tab');
  const activeTab = paramTab && validKeys.includes(paramTab) ? paramTab : defaultKey;

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Space align="center" size={12}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#e6f4ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InboxOutlined style={{ fontSize: 26, color: '#1b4d3e' }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Quản lý Vật tư & Kho (Supplies & Warehouse)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kiểm soát quy trình nhập - xuất - tồn, phân loại danh mục, định mức tồn kho tối thiểu và kiểm kê vật tư khách sạn.
            </Text>
          </div>
        </Space>
      </div>

      {/* Main Tabs Container */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={availableTabItems}
      />
    </div>
  );
};
