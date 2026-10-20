import React, { useState, useEffect } from 'react';
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
  App as AntdApp,
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
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import { DebouncedSearchInput } from '../../../components/DebouncedSearchInput.tsx';
import type {
  InventoryCategoryView,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../../types/inventory.types.ts';

const { Text, Paragraph } = Typography;

export const InventoryCategoriesTab: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategoryView | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Query categories
  const {
    data: categoriesRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'categories', page, pageSize, search, activeFilter],
    queryFn: () =>
      inventoryApi.getCategories({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      }),
  });

  const categoryList = categoriesRes?.data?.items || [];
  const total = categoriesRes?.data?.pagination?.total || 0;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateCategoryDto) => inventoryApi.createCategory(dto),
    onSuccess: () => {
      appMessage.success('Tạo danh mục vật tư mới thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'summary'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể tạo danh mục vật tư.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateCategoryDto }) =>
      inventoryApi.updateCategory(id, dto),
    onSuccess: () => {
      appMessage.success('Cập nhật thông tin danh mục thành công!');
      setIsEditModalOpen(false);
      setEditingCategory(null);
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'summary'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể cập nhật danh mục.'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deactivateCategory(id),
    onSuccess: () => {
      appMessage.success('Đã ngừng hoạt động danh mục thành công!');
      queryClient.invalidateQueries({ queryKey: ['inventory', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'summary'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể ngừng hoạt động danh mục.'));
    },
  });

  const handleOpenEdit = (category: InventoryCategoryView) => {
    setEditingCategory(category);
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    if (isEditModalOpen && editingCategory) {
      editForm.setFieldsValue({
        code: editingCategory.code,
        name: editingCategory.name,
        description: editingCategory.description,
        isActive: editingCategory.isActive,
      });
    }
  }, [isEditModalOpen, editingCategory, editForm]);

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      createMutation.mutate({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        description: values.description?.trim() || null,
      });
    } catch {
      // validation error
    }
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingCategory) return;
      updateMutation.mutate({
        id: editingCategory.id,
        dto: {
          code: values.code.trim().toUpperCase(),
          name: values.name.trim(),
          description: values.description !== undefined ? values.description?.trim() || null : undefined,
          isActive: values.isActive,
        },
      });
    } catch {
      // validation error
    }
  };

  const columns: ColumnsType<InventoryCategoryView> = [
    {
      title: 'Mã danh mục',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code) => <Text strong copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên danh mục vật tư',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (name) => (
        <Text strong ellipsis={{ tooltip: name }} style={{ display: 'block', maxWidth: 220 }}>
          {name}
        </Text>
      ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      width: 300,
      render: (desc) => (
        <Paragraph
          ellipsis={{ rows: 2, tooltip: desc }}
          style={{ margin: 0, fontSize: 13, color: '#475569' }}
        >
          {desc || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 160,
      align: 'center',
      render: (isActive) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ whiteSpace: 'nowrap' }}>
            Đang hoạt động
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default" style={{ whiteSpace: 'nowrap' }}>
            Ngừng hoạt động
          </Tag>
        ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center',
      fixed: screens.xs ? false : 'right',
      render: (_, record) => (
        <Space size={4} style={{ whiteSpace: 'nowrap' }}>
          {canManage ? (
            <>
              <Tooltip title="Chỉnh sửa danh mục">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#0284c7' }} />}
                  onClick={() => handleOpenEdit(record)}
                />
              </Tooltip>

              {record.isActive && (
                <Popconfirm
                  title="Ngừng hoạt động danh mục?"
                  description="Danh mục này sẽ không thể dùng để tạo vật tư mới. Vật tư đang thuộc danh mục phải được di chuyển trước."
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
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>Chỉ đọc</Text>
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
          <Space wrap size={12}>
            <DebouncedSearchInput
              placeholder="Tìm theo mã hoặc tên danh mục..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              style={{ width: 280 }}
              allowClear
            />

            <Select
              value={activeFilter}
              onChange={(val) => {
                setActiveFilter(val);
                setPage(1);
              }}
              style={{ width: 170 }}
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
              Thêm danh mục mới
            </Button>
          )}
        </Space>
      </Card>

      {/* Categories Table */}
      <Table<InventoryCategoryView>
        columns={columns}
        dataSource={categoryList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            setPageSize(newPageSize);
          },
          showTotal: (totalCount) => `Tổng số: ${totalCount} danh mục`,
        }}
        bordered
      />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1b4d3e' }} />
            <span>Thêm Danh mục Vật tư Mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateSubmit}
        okText="Tạo danh mục"
        cancelText="Hủy bỏ"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="code"
            label="Mã danh mục"
            rules={[
              { required: true, message: 'Vui lòng nhập mã danh mục' },
              { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
            ]}
            extra="Ví dụ: LINEN, AMENITIES, SPARE_PARTS, FOOD_BEV"
          >
            <Input placeholder="Nhập mã viết hoa, không dấu..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[
              { required: true, message: 'Vui lòng nhập tên danh mục' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Ví dụ: Đồ vải & Buồng phòng, Đồ tiêu hao, Linh kiện bảo trì" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả chi tiết">
            <Input.TextArea
              rows={3}
              placeholder="Mô tả nhóm phân loại mặt hàng này..."
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1b4d3e' }} />
            <span>Chỉnh sửa Danh mục: {editingCategory?.name}</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingCategory(null);
        }}
        onOk={handleEditSubmit}
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="code"
            label="Mã danh mục"
            rules={[
              { required: true, message: 'Vui lòng nhập mã danh mục' },
              { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
            ]}
          >
            <Input placeholder="Nhập mã danh mục..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên danh mục"
            rules={[
              { required: true, message: 'Vui lòng nhập tên danh mục' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Nhập tên danh mục..." />
          </Form.Item>

          <Form.Item name="description" label="Mô tả chi tiết">
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Trạng thái hoạt động"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Đang hoạt động', value: true },
                { label: 'Ngừng hoạt động', value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
