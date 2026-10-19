import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Button,
  Space,
  Tag,
  Select,
  DatePicker,
  Typography,
  Card,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { inventoryApi } from '../../../api/inventory.api.ts';
import type {
  InventoryMovementView,
  InventoryMovementType,
} from '../../../types/inventory.types.ts';

const { Text } = Typography;
const { RangePicker } = DatePicker;

export const InventoryMovementsTab: React.FC = () => {
  // Filter States
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<InventoryMovementType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Query Items for filter select
  const { data: itemsRes } = useQuery({
    queryKey: ['inventory', 'items', 'for-movement-filter'],
    queryFn: () => inventoryApi.getItems({ page: 1, limit: 100 }),
  });
  const allItems = itemsRes?.data?.items || [];

  // Query Movements
  const startDate = dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined;
  const endDate = dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined;

  const {
    data: movementsRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'movements', page, pageSize, itemFilter, typeFilter, startDate, endDate],
    queryFn: () =>
      inventoryApi.getMovements({
        page,
        limit: pageSize,
        itemId: itemFilter || undefined,
        type: typeFilter || undefined,
        startDate,
        endDate,
      }),
  });

  const movementList = movementsRes?.data?.items || [];
  const total = movementsRes?.data?.pagination?.total || 0;

  const columns: ColumnsType<InventoryMovementView> = [
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 155,
      render: (date) => (
        <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
          {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </span>
      ),
    },
    {
      title: 'Mã VT',
      dataIndex: ['item', 'code'],
      key: 'itemCode',
      width: 120,
      render: (code) => <Text copyable strong style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: ['item', 'name'],
      key: 'itemName',
      width: 220,
      render: (name) => <Text strong style={{ whiteSpace: 'nowrap' }}>{name}</Text>,
    },
    {
      title: 'Loại biến động',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      align: 'center',
      render: (type: InventoryMovementType) => {
        switch (type) {
          case 'RECEIPT':
            return (
              <Tag color="success" icon={<ArrowUpOutlined />} style={{ whiteSpace: 'nowrap' }}>
                Nhập kho
              </Tag>
            );
          case 'ISSUE':
            return (
              <Tag color="volcano" icon={<ArrowDownOutlined />} style={{ whiteSpace: 'nowrap' }}>
                Xuất kho
              </Tag>
            );
          case 'ADJUSTMENT':
            return (
              <Tag color="purple" icon={<SwapOutlined />} style={{ whiteSpace: 'nowrap' }}>
                Kiểm kê / Đ/chỉnh
              </Tag>
            );
          default:
            return <Tag style={{ whiteSpace: 'nowrap' }}>{type}</Tag>;
        }
      },
    },
    {
      title: 'Số lượng biến động',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 150,
      align: 'right',
      render: (qty, record) => {
        const num = parseFloat(qty) || 0;
        const unit = record.item?.unit || '';
        if (record.type === 'RECEIPT') {
          return (
            <Text strong style={{ color: '#15803d', whiteSpace: 'nowrap' }}>
              +{Math.abs(num).toFixed(2)} {unit}
            </Text>
          );
        }
        if (record.type === 'ISSUE') {
          return (
            <Text strong style={{ color: '#b91c1c', whiteSpace: 'nowrap' }}>
              -{Math.abs(num).toFixed(2)} {unit}
            </Text>
          );
        }
        // ADJUSTMENT
        if (num > 0) {
          return (
            <Text strong style={{ color: '#15803d', whiteSpace: 'nowrap' }}>
              +{num.toFixed(2)} {unit}
            </Text>
          );
        }
        if (num < 0) {
          return (
            <Text strong style={{ color: '#b91c1c', whiteSpace: 'nowrap' }}>
              {num.toFixed(2)} {unit}
            </Text>
          );
        }
        return (
          <Text strong style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
            0.00 {unit}
          </Text>
        );
      },
    },
    {
      title: 'Tồn trước',
      dataIndex: 'previousStock',
      key: 'previousStock',
      width: 100,
      align: 'right',
      render: (val, record) => <span style={{ whiteSpace: 'nowrap' }}>{`${val} ${record.item?.unit || ''}`}</span>,
    },
    {
      title: 'Tồn sau',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 110,
      align: 'right',
      render: (val, record) => (
        <Text strong style={{ color: '#0f172a', whiteSpace: 'nowrap' }}>
          {val} {record.item?.unit || ''}
        </Text>
      ),
    },
    {
      title: 'Số chứng từ',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      width: 160,
      render: (refNum, record) =>
        refNum ? (
          <Tooltip title={`Tham chiếu: ${record.referenceType}`}>
            <Tag color="default" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {refNum}
            </Tag>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>-</Text>
        ),
    },
    {
      title: 'Người thực hiện',
      key: 'creator',
      width: 140,
      render: (_, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {record.creator?.fullName || record.creator?.username || '-'}
        </span>
      ),
    },
    {
      title: 'Diễn giải / Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      render: (notes) => <span style={{ whiteSpace: 'nowrap' }}>{notes || '-'}</span>,
    },
  ];

  return (
    <div>
      {/* Filter and Action bar */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={10}>
            <Select
              placeholder="Lọc theo Vật tư"
              value={itemFilter}
              onChange={(val) => {
                setItemFilter(val);
                setPage(1);
              }}
              style={{ width: 230 }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={allItems.map((item) => ({
                label: `${item.name} (${item.code})`,
                value: item.id,
              }))}
            />

            <Select
              placeholder="Loại biến động"
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
              allowClear
              options={[
                { label: 'Tất cả loại giao dịch', value: undefined },
                { label: 'Nhập kho (RECEIPT)', value: 'RECEIPT' },
                { label: 'Xuất kho (ISSUE)', value: 'ISSUE' },
                { label: 'Kiểm kê (ADJUSTMENT)', value: 'ADJUSTMENT' },
              ]}
            />

            <RangePicker
              value={dateRange}
              onChange={(dates) => {
                setDateRange(dates);
                setPage(1);
              }}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              style={{ width: 250 }}
            />

            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Movements Table */}
      <Table<InventoryMovementView>
        columns={columns}
        dataSource={movementList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1500 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
          showTotal: (totalCount) => `Tổng số: ${totalCount} bản ghi biến động`,
        }}
        bordered
      />
    </div>
  );
};
