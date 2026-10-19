import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Empty,
  Skeleton,
  Alert,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  InboxOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  AppstoreOutlined,
  DollarOutlined,
  ReloadOutlined,
  EyeOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { inventoryApi } from '../../../api/inventory.api.ts';
import type {
  InventoryItemView,
  InventorySummaryCategory,
} from '../../../types/inventory.types.ts';
import { ItemDetailModal } from './ItemDetailModal.tsx';
import { useAuthStore } from '../../../store/authStore.ts';

const { Title, Text, Paragraph } = Typography;

interface InventoryOverviewTabProps {
  onNavigateTab?: (tabKey: string) => void;
}

export const InventoryOverviewTab: React.FC<InventoryOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const screens = Grid.useBreakpoint();
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Detail Modal state
  const [selectedItem, setSelectedItem] = useState<InventoryItemView | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Queries
  const {
    data: summaryRes,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['inventory', 'summary'],
    queryFn: () => inventoryApi.getSummary(),
  });

  const {
    data: lowStockRes,
    isLoading: isLowStockLoading,
    isError: isLowStockError,
    refetch: refetchLowStock,
  } = useQuery({
    queryKey: ['inventory', 'low-stock', 1, 20],
    queryFn: () => inventoryApi.getLowStock({ page: 1, limit: 20 }),
  });

  const summary = summaryRes?.data;
  const lowStockItems = lowStockRes?.data?.items || [];
  const lowStockTotal = lowStockRes?.data?.pagination?.total || 0;

  const handleRefresh = () => {
    refetchSummary();
    refetchLowStock();
  };

  const handleViewItem = (item: InventoryItemView) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  // Category statistics table columns
  const categoryColumns: ColumnsType<InventorySummaryCategory> = [
    {
      title: 'Mã nhóm',
      dataIndex: 'code',
      key: 'code',
      width: 100,
      render: (code) => <Text strong style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên danh mục vật tư',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
    },
    {
      title: 'Tổng mặt hàng',
      dataIndex: 'totalItems',
      key: 'totalItems',
      width: 130,
      align: 'right',
      render: (val) => <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>{val} mặt hàng</Tag>,
    },
    {
      title: 'Dưới định mức',
      dataIndex: 'lowStockItems',
      key: 'lowStockItems',
      width: 130,
      align: 'right',
      render: (val) =>
        val > 0 ? (
          <Tag color="error" style={{ whiteSpace: 'nowrap' }}>{val} mặt hàng</Tag>
        ) : (
          <Tag color="success" style={{ whiteSpace: 'nowrap' }}>An toàn</Tag>
        ),
    },
  ];

  // Low stock items table columns
  const lowStockColumns: ColumnsType<InventoryItemView> = [
    {
      title: 'Mã VT',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code) => <Text copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (name, record) => (
        <div>
          <Paragraph
            ellipsis={{ rows: 2, tooltip: name }}
            strong
            style={{ margin: 0, color: '#0f172a' }}
          >
            {name}
          </Paragraph>
          {record.category && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.category.name}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (unit) => <span style={{ whiteSpace: 'nowrap' }}>{unit}</span>,
    },
    {
      title: 'Tồn hiện tại',
      dataIndex: 'currentStock',
      key: 'currentStock',
      align: 'right',
      width: 120,
      render: (stock, record) => (
        <Text
          strong
          style={{
            color: record.isOutOfStock ? '#b91c1c' : '#d97706',
            fontSize: 14,
            whiteSpace: 'nowrap',
          }}
        >
          {stock}
        </Text>
      ),
    },
    {
      title: 'Tồn tối thiểu',
      dataIndex: 'minStockLevel',
      key: 'minStockLevel',
      align: 'right',
      width: 110,
      render: (minStock) => <span style={{ whiteSpace: 'nowrap' }}>{minStock}</span>,
    },
    {
      title: 'Tình trạng',
      key: 'status',
      align: 'center',
      width: 130,
      render: (_, record) =>
        record.isOutOfStock ? (
          <Tag color="error" icon={<CloseCircleOutlined />} style={{ whiteSpace: 'nowrap' }}>
            Hết hàng
          </Tag>
        ) : (
          <Tag color="warning" icon={<WarningOutlined />} style={{ whiteSpace: 'nowrap' }}>
            Sắp hết hàng
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'center',
      width: 90,
      fixed: screens.xs ? false : 'right',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          style={{ whiteSpace: 'nowrap' }}
          onClick={() => handleViewItem(record)}
        >
          Xem
        </Button>
      ),
    },
  ];

  if (isSummaryError || isLowStockError) {
    return (
      <Card style={{ borderRadius: 8, marginTop: 12 }}>
        <Alert
          title="Không thể tải dữ liệu tổng quan kho"
          description="Đã xảy ra lỗi khi kết nối máy chủ hoặc hệ thống đang đồng bộ dữ liệu. Vui lòng thử lại."
          type="error"
          showIcon
          action={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              style={{ backgroundColor: '#1b4d3e' }}
            >
              Tải lại
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      {/* Top action bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            Báo cáo Tồn kho & Định mức Vật tư
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Theo dõi nhanh số lượng mặt hàng, các vật tư chạm ngưỡng cảnh báo và ước tính giá trị tồn.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          Làm mới
        </Button>
      </div>

      {/* KPI Statistic Cards */}
      <Row gutter={[16, 16]} className="pms-kpi-row">
        <Col xs={24} sm={12} lg={6}>
          <Card
            variant="outlined"
            className="pms-kpi-card"
            style={{
              height: '100%',
              borderRadius: 8,
              borderLeft: '4px solid #1b4d3e',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                title={
                  <Space>
                    <InboxOutlined style={{ color: '#1b4d3e' }} />
                    <span>Vật tư đang quản lý</span>
                  </Space>
                }
                value={summary?.totalActiveItems ?? 0}
                suffix="mặt hàng"
                styles={{ content: { color: '#0f172a', fontWeight: 700 } }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            variant="outlined"
            className="pms-kpi-card"
            style={{
              height: '100%',
              borderRadius: 8,
              borderLeft: '4px solid #d97706',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#d97706' }} />
                    <span>Vật tư sắp hết (Dưới mức tối thiểu)</span>
                  </Space>
                }
                value={summary?.lowStockItemsCount ?? 0}
                suffix="mặt hàng"
                styles={{ content: { color: '#d97706', fontWeight: 700 } }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            variant="outlined"
            className="pms-kpi-card"
            style={{
              height: '100%',
              borderRadius: 8,
              borderLeft: '4px solid #b91c1c',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                title={
                  <Space>
                    <CloseCircleOutlined style={{ color: '#b91c1c' }} />
                    <span>Vật tư đã hết tồn kho</span>
                  </Space>
                }
                value={summary?.outOfStockItemsCount ?? 0}
                suffix="mặt hàng"
                styles={{ content: { color: '#b91c1c', fontWeight: 700 } }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            variant="outlined"
            className="pms-kpi-card"
            style={{
              height: '100%',
              borderRadius: 8,
              borderLeft: '4px solid #0284c7',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                title={
                  <Space>
                    <DollarOutlined style={{ color: '#0284c7' }} />
                    <span>Giá trị tồn kho ước tính</span>
                  </Space>
                }
                value={Number(summary?.totalInventoryEstimatedValue || 0).toLocaleString('vi-VN')}
                suffix="VNĐ"
                styles={{ content: { color: '#0f172a', fontWeight: 700, fontSize: 20 } }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Main Content: Category Summary & Low Stock List */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        {/* Left Column: Low Stock Warning Items */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  width: '100%',
                }}
              >
                <Space size={6}>
                  <AlertOutlined style={{ color: '#d97706' }} />
                  <span style={{ fontSize: screens.xs ? 13 : 14 }}>
                    Cảnh báo vật tư dưới ngưỡng tối thiểu ({lowStockTotal})
                  </span>
                </Space>
                {onNavigateTab && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => onNavigateTab('receipts')}
                    style={{ color: '#1b4d3e', padding: 0, fontSize: 12, whiteSpace: 'nowrap' }}
                  >
                    Tạo phiếu nhập kho &rarr;
                  </Button>
                )}
              </div>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            {lowStockItems.length === 0 && !isLowStockLoading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tất cả vật tư hiện đang có mức tồn an toàn trên ngưỡng tối thiểu."
              />
            ) : (
              <Table<InventoryItemView>
                columns={lowStockColumns}
                dataSource={lowStockItems}
                rowKey="id"
                loading={isLowStockLoading}
                scroll={{ x: 880 }}
                pagination={{ pageSize: 5, size: 'small', showTotal: (t) => `Tổng ${t} mặt hàng` }}
                size="middle"
              />
            )}
          </Card>
        </Col>

        {/* Right Column: Categories Summary */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  width: '100%',
                }}
              >
                <Space size={6}>
                  <AppstoreOutlined style={{ color: '#1b4d3e' }} />
                  <span style={{ fontSize: screens.xs ? 13 : 14 }}>
                    Thống kê theo Nhóm Danh mục ({summary?.totalCategories ?? 0})
                  </span>
                </Space>
                {onNavigateTab && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => onNavigateTab('items')}
                    style={{ color: '#1b4d3e', padding: 0, fontSize: 12, whiteSpace: 'nowrap' }}
                  >
                    Xem bảng vật tư &rarr;
                  </Button>
                )}
              </div>
            }
            style={{ borderRadius: 8, height: '100%' }}
          >
            {(!summary?.categories || summary.categories.length === 0) && !isSummaryLoading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có dữ liệu phân loại danh mục vật tư."
              />
            ) : (
              <Table<InventorySummaryCategory>
                columns={categoryColumns}
                dataSource={summary?.categories || []}
                rowKey="id"
                loading={isSummaryLoading}
                scroll={{ x: 560 }}
                pagination={{ pageSize: 5, size: 'small' }}
                size="middle"
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Item Detail Modal */}
      <ItemDetailModal
        open={detailModalOpen}
        item={selectedItem}
        canManage={canManage}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedItem(null);
        }}
        onAdjustStock={() => {
          // Can navigate to items tab or trigger adjustment
          onNavigateTab?.('items');
        }}
      />
    </div>
  );
};
