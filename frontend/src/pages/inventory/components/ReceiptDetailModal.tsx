import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Button, Space, Grid } from 'antd';
import { FileDoneOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { StockReceiptView, StockReceiptItemView } from '../../../types/inventory.types.ts';

const { Text } = Typography;

interface ReceiptDetailModalProps {
  open: boolean;
  receipt: StockReceiptView | null;
  onClose: () => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  open,
  receipt,
  onClose,
}) => {
  const screens = Grid.useBreakpoint();
  if (!receipt) return null;

  const columns: ColumnsType<StockReceiptItemView> = [
    {
      title: 'Mã VT',
      dataIndex: ['item', 'code'],
      key: 'code',
      width: 110,
      render: (code) => <Text copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: ['item', 'name'],
      key: 'name',
      width: 200,
      render: (name) => <span style={{ whiteSpace: 'nowrap' }}>{name}</span>,
    },
    {
      title: 'Đơn vị',
      dataIndex: ['item', 'unit'],
      key: 'unit',
      width: 80,
      align: 'center',
      render: (unit) => <span style={{ whiteSpace: 'nowrap' }}>{unit}</span>,
    },
    {
      title: 'Số lượng nhập',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'right',
      render: (qty, record) => (
        <Text strong style={{ whiteSpace: 'nowrap' }}>
          {qty} {record.item?.unit}
        </Text>
      ),
    },
    {
      title: 'Đơn giá (VNĐ)',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 130,
      align: 'right',
      render: (price) => <span style={{ whiteSpace: 'nowrap' }}>{Number(price).toLocaleString('vi-VN')}</span>,
    },
    {
      title: 'Thành tiền (VNĐ)',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      width: 140,
      align: 'right',
      render: (total) => (
        <Text strong style={{ color: '#1b4d3e', whiteSpace: 'nowrap' }}>
          {Number(total).toLocaleString('vi-VN')}
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 160,
      render: (notes) => <span style={{ whiteSpace: 'nowrap' }}>{notes || '-'}</span>,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileDoneOutlined style={{ color: '#1b4d3e', fontSize: 20 }} />
          <span>Chi tiết Phiếu Nhập kho: {receipt.receiptNumber}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose} style={{ backgroundColor: '#1b4d3e' }}>
          Đóng
        </Button>,
      ]}
      width={screens.xs ? '100%' : 850}
    >
      <Descriptions
        bordered
        size="small"
        column={2}
        style={{ marginTop: 12, marginBottom: 16 }}
        items={[
          {
            key: 'receiptNumber',
            label: 'Mã số phiếu',
            children: <Text strong copyable>{receipt.receiptNumber}</Text>,
          },
          {
            key: 'receiptDate',
            label: 'Ngày nhập kho',
            children: dayjs(receipt.receiptDate).format('DD/MM/YYYY'),
          },
          {
            key: 'supplier',
            label: 'Nhà cung cấp',
            children: receipt.supplier ? (
              <Tag color="blue">{receipt.supplier.name} ({receipt.supplier.code})</Tag>
            ) : (
              <Text type="secondary">Nhập trực tiếp / Không có NCC</Text>
            ),
          },
          {
            key: 'totalAmount',
            label: 'Tổng giá trị nhập',
            children: (
              <Text strong style={{ fontSize: 16, color: '#1b4d3e' }}>
                {Number(receipt.totalAmount).toLocaleString('vi-VN')} VNĐ
              </Text>
            ),
          },
          {
            key: 'creator',
            label: 'Người lập phiếu',
            children: receipt.creator?.fullName || receipt.creator?.username || 'Hệ thống',
          },
          {
            key: 'createdAt',
            label: 'Thời gian tạo',
            children: dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm'),
          },
          {
            key: 'notes',
            label: 'Ghi chú phiếu',
            span: 2,
            children: receipt.notes || <Text type="secondary">Không có ghi chú</Text>,
          },
        ]}
      />

      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ fontSize: 14 }}>
          Danh sách mặt hàng nhập kho ({receipt.items?.length || 0} dòng)
        </Text>
      </div>

      <Table<StockReceiptItemView>
        columns={columns}
        dataSource={receipt.items || []}
        rowKey="id"
        size="small"
        pagination={false}
        bordered
        scroll={{ x: 940 }}
      />
    </Modal>
  );
};
