import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  message,
  Popconfirm,
  Typography,
  Card,
  Tooltip,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  InboxOutlined,
  FormOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import type {
  InventoryItemView,
  CreateItemDto,
  UpdateItemDto,
  StockStatusFilter,
} from '../../../types/inventory.types.ts';
import { ItemDetailModal } from './ItemDetailModal.tsx';
import { StockAdjustmentModal } from './StockAdjustmentModal.tsx';

const { Text } = Typography;

export const InventoryItemsTab: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemView | null>(null);

  // Detail & Adjustment Modal States
  const [detailItem, setDetailItem] = useState<InventoryItemView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItemView | null>(null);
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Query Categories for filter and form selection
  const { data: categoriesRes } = useQuery({
    queryKey: ['inventory', 'categories', 'active-options'],
    queryFn: () => inventoryApi.getCategories({ page: 1, limit: 100, isActive: true }),
  });
  const categories = categoriesRes?.data?.items || [];

  // Query Items
  const {
    data: itemsRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'inventory',
      'items',
      page,
      pageSize,
      search,
      categoryFilter,
      activeFilter,
      stockStatusFilter,
    ],
    queryFn: () =>
      inventoryApi.getItems({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        categoryId: categoryFilter || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
        stockStatus: stockStatusFilter,
      }),
  });

  const itemList = itemsRes?.data?.items || [];
  const total = itemsRes?.data?.pagination?.total || 0;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateItemDto) => inventoryApi.createItem(dto),
    onSuccess: () => {
      message.success('Đã thêm mặt hàng vật tư mới thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(getInventoryErrorMessage(err, 'Không thể tạo vật tư mới.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateItemDto }) =>
      inventoryApi.updateItem(id, dto),
    onSuccess: () => {
      message.success('Đã cập nhật thông tin vật tư thành công!');
      setIsEditModalOpen(false);
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(getInventoryErrorMessage(err, 'Không thể cập nhật vật tư.'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deactivateItem(id),
    onSuccess: () => {
      message.success('Đã ngừng hoạt động vật tư thành công!');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(getInventoryErrorMessage(err, 'Không thể ngừng hoạt động vật tư.'));
    },
  });

  const handleOpenEdit = (item: InventoryItemView) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      code: item.code,
      name: item.name,
      categoryId: item.categoryId,
      unit: item.unit,
      minStockLevel: parseFloat(item.minStockLevel) || 0,
      description: item.description,
    });
    setIsEditModalOpen(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      createMutation.mutate({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        categoryId: values.categoryId,
        unit: values.unit.trim(),
        minStockLevel: Number(values.minStockLevel ?? 0).toFixed(2),
        description: values.description?.trim() || null,
      });
    } catch {
      // validation error
    }
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingItem) return;
      updateMutation.mutate({
        id: editingItem.id,
        dto: {
          code: values.code.trim().toUpperCase(),
          name: values.name.trim(),
          categoryId: values.categoryId,
          unit: values.unit.trim(),
          minStockLevel: Number(values.minStockLevel ?? 0).toFixed(2),
          description: values.description !== undefined ? values.description?.trim() || null : undefined,
        },
      });
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<InventoryItemView> = [
    {
      title: 'Mã VT',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code) => <Text strong copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên vật tư',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
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
      title: 'Danh mục',
      dataIndex: ['category', 'name'],
      key: 'categoryName',
      width: 160,
      render: (catName) => (
        <Tag color="cyan" style={{ whiteSpace: 'nowrap' }}>{catName || 'Chưa phân loại'}</Tag>
      ),
    },
    {
      title: 'ĐVT',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (unit) => <Tag style={{ whiteSpace: 'nowrap' }}>{unit}</Tag>,
    },
    {
      title: 'Tồn kho',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 130,
      align: 'right',
      render: (stock, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text
            strong
            style={{
              fontSize: 14,
              color: record.isOutOfStock
                ? '#b91c1c'
                : record.isLowStock
                ? '#d97706'
                : '#15803d',
            }}
          >
            {stock}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Tối thiểu: {record.minStockLevel}
          </div>
        </div>
      ),
    },
    {
      title: 'Tình trạng tồn',
      key: 'stockStatus',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {record.isOutOfStock ? (
            <Tag color="error">Hết hàng</Tag>
          ) : record.isLowStock ? (
            <Tag color="warning" icon={<WarningOutlined />}>
              Sắp hết hàng
            </Tag>
          ) : (
            <Tag color="success">Còn hàng</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      align: 'center',
      render: (isActive) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {isActive ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              Hoạt động
            </Tag>
          ) : (
            <Tag icon={<CloseCircleOutlined />} color="default">
              Ngừng HĐ
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      align: 'center',
      fixed: screens.xs ? false : 'right',
      render: (_, record) => (
        <Space size={4} style={{ whiteSpace: 'nowrap' }}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setDetailItem(record);
                setIsDetailOpen(true);
              }}
            />
          </Tooltip>

          {canManage && (
            <>
              <Tooltip title="Kiểm kê / Điều chỉnh tồn">
                <Button
                  type="text"
                  size="small"
                  icon={<FormOutlined style={{ color: '#1b4d3e' }} />}
                  onClick={() => {
                    setAdjustmentItem(record);
                    setIsAdjustmentOpen(true);
                  }}
                />
              </Tooltip>

              <Tooltip title="Chỉnh sửa vật tư">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#0284c7' }} />}
                  onClick={() => handleOpenEdit(record)}
                />
              </Tooltip>

              {record.isActive && (
                <Popconfirm
                  title="Ngừng hoạt động vật tư?"
                  description="Vật tư này sẽ không thể dùng cho các phiếu nhập/xuất kho mới."
                  onConfirm={() => deactivateMutation.mutate(record.id)}
                  okText="Ngừng hoạt động"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deactivateMutation.isPending }}
                >
                  <Tooltip title="Ngừng hoạt động">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<StopOutlined />}
                    />
                  </Tooltip>
                </Popconfirm>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Filter and Action bar */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={10}>
            <Input
              placeholder="Tìm theo mã hoặc tên vật tư..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ width: 240 }}
              allowClear
            />

            <Select
              placeholder="Lọc theo Danh mục"
              value={categoryFilter}
              onChange={(val) => {
                setCategoryFilter(val);
                setPage(1);
              }}
              style={{ width: 190 }}
              allowClear
              options={categories.map((c) => ({
                label: `${c.name} (${c.code})`,
                value: c.id,
              }))}
            />

            <Select
              value={stockStatusFilter}
              onChange={(val) => {
                setStockStatusFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
              options={[
                { label: 'Tất cả mức tồn', value: 'ALL' },
                { label: 'Còn hàng', value: 'IN_STOCK' },
                { label: 'Sắp hết hàng', value: 'LOW_STOCK' },
                { label: 'Đã hết hàng', value: 'OUT_OF_STOCK' },
              ]}
            />

            <Select
              value={activeFilter}
              onChange={(val) => {
                setActiveFilter(val);
                setPage(1);
              }}
              style={{ width: 150 }}
              options={[
                { label: 'Tất cả trạng thái', value: 'all' },
                { label: 'Đang hoạt động', value: 'active' },
                { label: 'Ngừng hoạt động', value: 'inactive' },
              ]}
            />

            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Làm mới
            </Button>
          </Space>

          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setIsCreateModalOpen(true);
              }}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Thêm vật tư mới
            </Button>
          )}
        </Space>
      </Card>

      {/* Items Table */}
      <Table<InventoryItemView>
        columns={columns}
        dataSource={itemList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1110 }}
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
          showTotal: (totalCount) => `Tổng số: ${totalCount} vật tư`,
        }}
        bordered
      />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <InboxOutlined style={{ color: '#1b4d3e' }} />
            <span>Thêm Mặt Hàng Vật Tư Mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateSubmit}
        okText="Tạo vật tư"
        cancelText="Hủy bỏ"
        confirmLoading={createMutation.isPending}
        destroyOnClose
        width={580}
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 12 }}
          initialValues={{ minStockLevel: 0 }}
        >
          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item
              name="code"
              label="Mã vật tư"
              style={{ flex: 1 }}
              rules={[
                { required: true, message: 'Vui lòng nhập mã vật tư' },
                { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
              ]}
              extra="Ví dụ: LINEN-TOWEL-01, AMEN-SOAP"
            >
              <Input placeholder="Nhập mã định danh..." />
            </Form.Item>

            <Form.Item
              name="unit"
              label="Đơn vị tính"
              style={{ flex: 1 }}
              rules={[
                { required: true, message: 'Vui lòng nhập đơn vị tính' },
                { max: 30, message: 'ĐVT tối đa 30 ký tự' },
              ]}
              extra="Cái, Bộ, Chai, Thùng, Hộp, Kg..."
            >
              <Input placeholder="Ví dụ: Cái" />
            </Form.Item>
          </Space>

          <Form.Item
            name="name"
            label="Tên vật tư"
            rules={[
              { required: true, message: 'Vui lòng nhập tên vật tư' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Ví dụ: Khăn tắm cotton trắng 70x140cm" />
          </Form.Item>

          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item
              name="categoryId"
              label="Danh mục phân loại"
              style={{ flex: 1 }}
              rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
            >
              <Select
                placeholder="Chọn nhóm danh mục"
                options={categories.map((c) => ({
                  label: `${c.name} (${c.code})`,
                  value: c.id,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="minStockLevel"
              label="Định mức tồn tối thiểu"
              style={{ flex: 1 }}
              rules={[{ required: true, message: 'Vui lòng nhập định mức tồn' }]}
              extra="Cảnh báo khi tồn kho <= mức này"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="0.00"
              />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="Mô tả / Thông số kỹ thuật">
            <Input.TextArea
              rows={3}
              placeholder="Quy cách đóng gói, xuất xứ, vị trí kệ lưu kho, v.v."
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f1f5f9',
              borderRadius: 6,
              fontSize: 12,
              color: '#475569',
            }}
          >
            💡 <strong>Quy định nghiệp vụ tồn kho:</strong> Vật tư tạo mới có số lượng tồn ban đầu là <strong>0.00</strong>. Để bổ sung tồn kho thực tế, vui lòng lập <strong>Phiếu nhập kho</strong> hoặc sử dụng chức năng <strong>Kiểm kê tồn kho</strong> sau khi tạo.
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1b4d3e' }} />
            <span>Chỉnh sửa Vật Tư: {editingItem?.name}</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }}
        onOk={handleEditSubmit}
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        confirmLoading={updateMutation.isPending}
        destroyOnClose
        width={580}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item
              name="code"
              label="Mã vật tư"
              style={{ flex: 1 }}
              rules={[
                { required: true, message: 'Vui lòng nhập mã vật tư' },
                { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
              ]}
            >
              <Input placeholder="Mã vật tư..." />
            </Form.Item>

            <Form.Item
              name="unit"
              label="Đơn vị tính"
              style={{ flex: 1 }}
              rules={[
                { required: true, message: 'Vui lòng nhập đơn vị tính' },
                { max: 30, message: 'ĐVT tối đa 30 ký tự' },
              ]}
            >
              <Input placeholder="Đơn vị tính..." />
            </Form.Item>
          </Space>

          <Form.Item
            name="name"
            label="Tên vật tư"
            rules={[
              { required: true, message: 'Vui lòng nhập tên vật tư' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Tên vật tư..." />
          </Form.Item>

          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item
              name="categoryId"
              label="Danh mục"
              style={{ flex: 1 }}
              rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
            >
              <Select
                placeholder="Chọn danh mục"
                options={categories.map((c) => ({
                  label: `${c.name} (${c.code})`,
                  value: c.id,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="minStockLevel"
              label="Định mức tồn tối thiểu"
              style={{ flex: 1 }}
              rules={[{ required: true, message: 'Vui lòng nhập định mức tồn' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} precision={2} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} maxLength={5000} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Item Detail Modal */}
      <ItemDetailModal
        open={isDetailOpen}
        item={detailItem}
        canManage={canManage}
        onClose={() => {
          setIsDetailOpen(false);
          setDetailItem(null);
        }}
        onAdjustStock={(item) => {
          setAdjustmentItem(item);
          setIsAdjustmentOpen(true);
        }}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        open={isAdjustmentOpen}
        item={adjustmentItem}
        onClose={() => {
          setIsAdjustmentOpen(false);
          setAdjustmentItem(null);
        }}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
};
