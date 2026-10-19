import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Button, Space } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { StockIssueView, StockIssueItemView } from '../../../types/inventory.types.ts';

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
  if (!issue) return null;

  const columns: ColumnsType<StockIssueItemView> = [
    {
      title: 'Mã VT',
      dataIndex: ['item', 'code'],
      key: 'code',
      width: 120,
      render: (code) => <Text copyable>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: ['item', 'name'],
      key: 'name',
    },
    {
      title: 'Đơn vị',
      dataIndex: ['item', 'unit'],
      key: 'unit',
      width: 90,
      align: 'center',
    },
    {
      title: 'Số lượng xuất',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 140,
      align: 'right',
      render: (qty, record) => (
        <Text strong style={{ color: '#d97706' }}>
          {qty} {record.item?.unit}
        </Text>
      ),
    },
    {
      title: 'Ghi chú dòng',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes) => notes || '-',
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
      width={780}
    >
      <Descriptions
        bordered
        size="small"
        column={2}
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
            children: dayjs(issue.issueDate).format('DD/MM/YYYY'),
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
            children: dayjs(issue.createdAt).format('DD/MM/YYYY HH:mm'),
          },
          {
            key: 'notes',
            label: 'Ghi chú',
            span: 2,
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
      />
    </Modal>
  );
};
