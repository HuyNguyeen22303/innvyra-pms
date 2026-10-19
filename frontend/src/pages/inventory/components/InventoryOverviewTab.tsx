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

const { Title, Text } = Typography;

interface InventoryOverviewTabProps {
  onNavigateTab?: (tabKey: string) => void;
}

export const InventoryOverviewTab: React.FC<InventoryOverviewTabProps> = ({
  onNavigateTab,
}) => {
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
      render: (code) => <Text strong>{code}</Text>,
    },
    {
      title: 'Tên danh mục vật tư',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Tổng mặt hàng',
      dataIndex: 'totalItems',
      key: 'totalItems',
      align: 'right',
      render: (val) => <Tag color="blue">{val} mặt hàng</Tag>,
    },
    {
      title: 'Dưới định mức',
      dataIndex: 'lowStockItems',
      key: 'lowStockItems',
      align: 'right',
      render: (val) =>
        val > 0 ? (
          <Tag color="error">{val} mặt hàng</Tag>
        ) : (
          <Tag color="success">An toàn</Tag>
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
      render: (code) => <Text copyable>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          {record.category && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.category.name}
              </Text>
            </div>
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
    },
    {
      title: 'Tình trạng',
      key: 'status',
      align: 'center',
      width: 130,
      render: (_, record) =>
        record.isOutOfStock ? (
          <Tag color="error" icon={<CloseCircleOutlined />}>
            Hết hàng
          </Tag>
        ) : (
          <Tag color="warning" icon={<WarningOutlined />}>
            Sắp hết hàng
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'center',
      width: 90,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
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
          message="Không thể tải dữ liệu tổng quan kho"
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
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              borderLeft: '4px solid #1b4d3e',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={
                  <Space>
                    <InboxOutlined style={{ color: '#1b4d3e' }} />
                    <span>Vật tư đang quản lý</span>
                  </Space>
                }
                value={summary?.totalActiveItems ?? 0}
                suffix="mặt hàng"
                valueStyle={{ color: '#0f172a', fontWeight: 700 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              borderLeft: '4px solid #d97706',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#d97706' }} />
                    <span>Vật tư sắp hết (Dưới mức tối thiểu)</span>
                  </Space>
                }
                value={summary?.lowStockItemsCount ?? 0}
                suffix="mặt hàng"
                valueStyle={{ color: '#d97706', fontWeight: 700 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              borderLeft: '4px solid #b91c1c',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={
                  <Space>
                    <CloseCircleOutlined style={{ color: '#b91c1c' }} />
                    <span>Vật tư đã hết tồn kho</span>
                  </Space>
                }
                value={summary?.outOfStockItemsCount ?? 0}
                suffix="mặt hàng"
                valueStyle={{ color: '#b91c1c', fontWeight: 700 }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 8,
              borderLeft: '4px solid #0284c7',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {isSummaryLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={
                  <Space>
                    <DollarOutlined style={{ color: '#0284c7' }} />
                    <span>Giá trị tồn kho ước tính</span>
                  </Space>
                }
                value={Number(summary?.totalInventoryEstimatedValue || 0).toLocaleString('vi-VN')}
                suffix="VNĐ"
                valueStyle={{ color: '#0f172a', fontWeight: 700, fontSize: 20 }}
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
              <Space>
                <AlertOutlined style={{ color: '#d97706' }} />
                <span>Cảnh báo vật tư dưới ngưỡng tối thiểu ({lowStockTotal})</span>
              </Space>
            }
            extra={
              onNavigateTab && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => onNavigateTab('receipts')}
                  style={{ color: '#1b4d3e', padding: 0 }}
                >
                  Tạo phiếu nhập kho &rarr;
                </Button>
              )
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
              <Space>
                <AppstoreOutlined style={{ color: '#1b4d3e' }} />
                <span>Thống kê theo Nhóm Danh mục ({summary?.totalCategories ?? 0})</span>
              </Space>
            }
            extra={
              onNavigateTab && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => onNavigateTab('items')}
                  style={{ color: '#1b4d3e', padding: 0 }}
                >
                  Xem bảng vật tư &rarr;
                </Button>
              )
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
