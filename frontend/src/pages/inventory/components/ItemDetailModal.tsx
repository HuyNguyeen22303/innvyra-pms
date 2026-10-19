import React from 'react';
import { Modal, Descriptions, Tag, Typography, Button, Space } from 'antd';
import {
  InboxOutlined,
  FormOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { InventoryItemView } from '../../../types/inventory.types.ts';

const { Text } = Typography;

interface ItemDetailModalProps {
  open: boolean;
  item: InventoryItemView | null;
  canManage: boolean;
  onClose: () => void;
  onAdjustStock?: (item: InventoryItemView) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  open,
  item,
  canManage,
  onClose,
  onAdjustStock,
}) => {
  if (!item) return null;

  return (
    <Modal
      title={
        <Space>
          <InboxOutlined style={{ color: '#1b4d3e', fontSize: 20 }} />
          <span>Chi tiết Vật tư: {item.name}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        canManage && (
          <Button
            key="adjust"
            type="primary"
            icon={<FormOutlined />}
            onClick={() => {
              onClose();
              onAdjustStock?.(item);
            }}
            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
          >
            Kiểm kê / Điều chỉnh tồn
          </Button>
        ),
        <Button key="close" onClick={onClose}>
          Đóng
        </Button>,
      ]}
      width={640}
    >
      <Descriptions
        bordered
        size="middle"
        column={2}
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'code',
            label: 'Mã vật tư',
            children: <Text strong copyable>{item.code}</Text>,
          },
          {
            key: 'name',
            label: 'Tên vật tư',
            children: <Text strong>{item.name}</Text>,
          },
          {
            key: 'category',
            label: 'Danh mục',
            children: (
              <Tag color="cyan">
                {item.category?.name || item.category?.code || 'Chưa phân loại'}
              </Tag>
            ),
          },
          {
            key: 'unit',
            label: 'Đơn vị tính',
            children: <Tag>{item.unit}</Tag>,
          },
          {
            key: 'currentStock',
            label: 'Tồn kho hiện tại',
            children: (
              <Text
                strong
                style={{
                  fontSize: 16,
                  color: item.isOutOfStock
                    ? '#b91c1c'
                    : item.isLowStock
                    ? '#d97706'
                    : '#15803d',
                }}
              >
                {item.currentStock} {item.unit}
              </Text>
            ),
          },
          {
            key: 'minStockLevel',
            label: 'Định mức tồn tối thiểu',
            children: (
              <span>
                {item.minStockLevel} {item.unit}
              </span>
            ),
          },
          {
            key: 'stockStatus',
            label: 'Tình trạng tồn',
            children: item.isOutOfStock ? (
              <Tag color="error">Hết hàng</Tag>
            ) : item.isLowStock ? (
              <Tag color="warning">Sắp hết hàng</Tag>
            ) : (
              <Tag color="success">Đủ tồn kho</Tag>
            ),
          },
          {
            key: 'isActive',
            label: 'Trạng thái hoạt động',
            children: item.isActive ? (
              <Tag icon={<CheckCircleOutlined />} color="success">
                Đang sử dụng
              </Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="default">
                Ngừng hoạt động
              </Tag>
            ),
          },
          {
            key: 'description',
            label: 'Mô tả chi tiết',
            span: 2,
            children: item.description || <Text type="secondary">Chưa có mô tả</Text>,
          },
          {
            key: 'createdAt',
            label: 'Ngày tạo',
            children: dayjs(item.createdAt).format('DD/MM/YYYY HH:mm'),
          },
          {
            key: 'updatedAt',
            label: 'Cập nhật lần cuối',
            children: dayjs(item.updatedAt).format('DD/MM/YYYY HH:mm'),
          },
        ]}
      />
    </Modal>
  );
};
