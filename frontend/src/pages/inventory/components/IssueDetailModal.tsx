import { ResponsiveTable as Table } from '../../../components/responsive/ResponsiveTable.tsx';
import React from 'react';
import { Modal, Descriptions, Tag, Typography, Button, Space, Grid, Alert } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../../store/authStore.ts';
import { formatHotelDate } from '../../../utils/hotelDate.ts';
import type { StockIssueView, StockIssueItemView } from '../../../types/inventory.types.ts';
import { formatInventoryQuantity } from '../../../utils/inventoryQuantity.ts';

const { Text } = Typography;

interface IssueDetailModalProps {
  open: boolean;
  issue: StockIssueView | null;
  onClose: () => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  open,
  issue,
  onClose,
}) => {
  const screens = Grid.useBreakpoint();
  const timezone = useAuthStore((state) => state.user?.hotel?.timezone);
  if (!issue) return null;

  const columns: ColumnsType<StockIssueItemView> = [
    {
      title: 'Mã VT',
      dataIndex: ['item', 'code'],
      key: 'code',
      width: 120,
      render: (code) => <Text copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: ['item', 'name'],
      key: 'name',
      width: 220,
      render: (name) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
    },
    {
      title: 'Đơn vị',
      dataIndex: ['item', 'unit'],
      key: 'unit',
      width: 90,
      align: 'center',
      render: (unit) => <span style={{ whiteSpace: 'nowrap' }}>{unit}</span>,
    },
    {
      title: 'Số lượng xuất',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 140,
      align: 'right',
      render: (qty, record) => (
        <Text strong style={{ color: '#d97706', whiteSpace: 'nowrap' }}>
          {formatInventoryQuantity(qty)} {record.item?.unit}
        </Text>
      ),
    },
    {
      title: 'Ghi chú dòng',
      dataIndex: 'notes',
      key: 'notes',
      width: 180,
      render: (notes) => <span style={{ whiteSpace: 'nowrap' }}>{notes || '-'}</span>,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ExportOutlined style={{ color: '#1b4d3e', fontSize: 20 }} />
          <span>Chi tiết Phiếu Xuất kho: {issue.issueNumber}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ backgroundColor: '#1b4d3e' }}>
          Đóng
        </Button>,
      ]}
      width={screens.xs ? '100%' : 780}
    >
      {issue.housekeepingCompletionId&&<Alert type="info" showIcon style={{marginTop:12,marginBottom:12}} title="Phiếu xuất theo lượt dọn phòng" description="Vật tư của lượt này đã được trừ kho khi gửi nghiệm thu. Không lập lại phiếu xuất thủ công cho cùng lượng sử dụng."/>}
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 1, md: 2 }}
        style={{ marginTop: 12, marginBottom: 16 }}
        items={[
          {
            key: 'issueNumber',
            label: 'Mã số phiếu',
            children: <Text strong copyable>{issue.issueNumber}</Text>,
          },
          {
            key: 'issueDate',
            label: 'Ngày xuất kho',
            children: formatHotelDate(issue.issueDate, timezone),
          },
          {
            key: 'department',
            label: 'Bộ phận nhận',
            children: <Tag color="purple">{issue.department}</Tag>,
          },
          {
            key: 'purpose',
            label: 'Mục đích sử dụng',
            children: issue.purpose || <Text type="secondary">Chưa xác định</Text>,
          },
          {
            key: 'creator',
            label: 'Người xuất kho',
            children: issue.creator?.fullName || issue.creator?.username || 'Hệ thống',
          },
          {
            key: 'createdAt',
            label: 'Thời gian tạo',
            children: formatHotelDate(issue.createdAt, timezone, true),
          },
          {
            key: 'notes',
            label: 'Ghi chú',
            span: 'filled',
            children: issue.notes || <Text type="secondary">Không có ghi chú</Text>,
          },
        ]}
      />

      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 14 }}>
          Danh sách mặt hàng xuất kho ({issue.items?.length || 0} dòng)
        </Text>
      </div>

      <Table<StockIssueItemView>
        columns={columns}
        dataSource={issue.items || []}
        rowKey="id"
        size="small"
        pagination={false}
        bordered
        scroll={{ x: 750 }}
      />
    </Modal>
  );
};
