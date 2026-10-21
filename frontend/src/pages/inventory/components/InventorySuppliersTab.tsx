import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
  ShopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { inventoryApi, getInventoryErrorMessage } from '../../../api/inventory.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import { DebouncedSearchInput } from '../../../components/DebouncedSearchInput.tsx';
import type {
  SupplierView,
  CreateSupplierDto,
  UpdateSupplierDto,
} from '../../../types/inventory.types.ts';

const { Text, Paragraph } = Typography;

export const InventorySuppliersTab: React.FC = () => {
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
  const [editingSupplier, setEditingSupplier] = useState<SupplierView | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Query Suppliers
  const {
    data: suppliersRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['inventory', 'suppliers', page, pageSize, search, activeFilter],
    queryFn: () =>
      inventoryApi.getSuppliers({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        isActive: activeFilter === 'all' ? undefined : activeFilter === 'active',
      }),
    // Keep the current page while the next search request is in flight so the
    // table never blanks out and remounts its rows mid-typing.
    placeholderData: keepPreviousData,
  });

  const supplierList = suppliersRes?.data?.items || [];
  const total = suppliersRes?.data?.pagination?.total || 0;

  // Defer the grid payload so a keydown arriving mid-render can interrupt it.
  const deferredSupplierList = useDeferredValue(supplierList);
  const tableSupplierList =
    deferredSupplierList.length > 0 ? deferredSupplierList : supplierList;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateSupplierDto) => inventoryApi.createSupplier(dto),
    onSuccess: () => {
      appMessage.success('Đã thêm nhà cung cấp mới thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể tạo nhà cung cấp.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateSupplierDto }) =>
      inventoryApi.updateSupplier(id, dto),
    onSuccess: () => {
      appMessage.success('Đã cập nhật nhà cung cấp thành công!');
      setIsEditModalOpen(false);
      setEditingSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể cập nhật nhà cung cấp.'));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deactivateSupplier(id),
    onSuccess: () => {
      appMessage.success('Đã ngừng hoạt động nhà cung cấp!');
      queryClient.invalidateQueries({ queryKey: ['inventory', 'suppliers'] });
    },
    onError: (err: any) => {
      appMessage.error(getInventoryErrorMessage(err, 'Không thể ngừng hoạt động nhà cung cấp.'));
    },
  });
  // Stable handles: the mutation observer object changes identity on every
  // render, which would invalidate memoized table columns.
  const { mutate: deactivateSupplier, isPending: deactivateSupplierPending } = deactivateMutation;


  const handleOpenEdit = useCallback((sup: SupplierView) => {
    setEditingSupplier(sup);
    editForm.setFieldsValue({
    code: sup.code,
    name: sup.name,
    contactPerson: sup.contactPerson,
    phone: sup.phone,
    email: sup.email,
    address: sup.address,
    notes: sup.notes,
    isActive: sup.isActive,
    });
    setIsEditModalOpen(true);
  }, [editForm]);


  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      createMutation.mutate({
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        contactPerson: values.contactPerson?.trim() || null,
        phone: values.phone?.trim() || null,
        email: values.email?.trim() || null,
        address: values.address?.trim() || null,
        notes: values.notes?.trim() || null,
      });
    } catch {
      // validation error
    }
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingSupplier) return;
      updateMutation.mutate({
        id: editingSupplier.id,
        dto: {
          code: values.code.trim().toUpperCase(),
          name: values.name.trim(),
          contactPerson: values.contactPerson !== undefined ? values.contactPerson?.trim() || null : undefined,
          phone: values.phone !== undefined ? values.phone?.trim() || null : undefined,
          email: values.email !== undefined ? values.email?.trim() || null : undefined,
          address: values.address !== undefined ? values.address?.trim() || null : undefined,
          notes: values.notes !== undefined ? values.notes?.trim() || null : undefined,
          isActive: values.isActive,
        },
      });
    } catch {
      // validation error
    }
  };

  const columns = useMemo<ColumnsType<SupplierView>>(() => [
    {
      title: 'Mã NCC',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code) => <Text strong copyable style={{ whiteSpace: 'nowrap' }}>{code}</Text>,
    },
    {
      title: 'Tên nhà cung cấp',
      dataIndex: 'name',
      key: 'name',
      width: 260,
      render: (name) => (
        <Paragraph
          ellipsis={{ rows: 2, tooltip: name }}
          strong
          style={{ margin: 0, color: '#0f172a' }}
        >
          {name}
        </Paragraph>
      ),
    },
    {
      title: 'Người liên hệ',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 160,
      render: (contact) => <span style={{ whiteSpace: 'nowrap' }}>{contact || '-'}</span>,
    },
    {
      title: 'Liên lạc',
      key: 'contactInfo',
      width: 190,
      render: (_, record) => (
        <Space orientation="vertical" size={2} style={{ whiteSpace: 'nowrap' }}>
          {record.phone && (
            <Space size={4}>
              <PhoneOutlined style={{ color: '#16a34a', fontSize: 12 }} />
              <span>{record.phone}</span>
            </Space>
          )}
          {record.email && (
            <Space size={4}>
              <MailOutlined style={{ color: '#0284c7', fontSize: 12 }} />
              <span>{record.email}</span>
            </Space>
          )}
          {!record.phone && !record.email && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      width: 260,
      render: (addr) => (
        <Paragraph
          ellipsis={{ rows: 2, tooltip: addr }}
          style={{ margin: 0, fontSize: 13, color: '#475569' }}
        >
          {addr || '-'}
        </Paragraph>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 150,
      align: 'center',
      render: (isActive) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ whiteSpace: 'nowrap' }}>
            Đang hợp tác
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default" style={{ whiteSpace: 'nowrap' }}>
            Ngừng hoạt động
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      align: 'center',
      fixed: screens.xs ? false : 'right',
      render: (_, record) => (
        <Space size={4} style={{ whiteSpace: 'nowrap' }}>
          {canManage ? (
            <>
              <Tooltip title="Chỉnh sửa nhà cung cấp">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ color: '#0284c7' }} />}
                  onClick={() => handleOpenEdit(record)}
                />
              </Tooltip>

              {record.isActive && (
                <Popconfirm
                  title="Ngừng hoạt động nhà cung cấp?"
                  description="Nhà cung cấp này sẽ không thể chọn khi lập phiếu nhập kho mới."
                  onConfirm={() => deactivateSupplier(record.id)}
                  okText="Ngừng hoạt động"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deactivateSupplierPending }}
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
  ], [canManage, deactivateSupplier, deactivateSupplierPending, handleOpenEdit, screens]);

  return (
    <div>
      {/* Filter and Action bar */}
      <Card style={{ marginBottom: 16, borderRadius: 8 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={12}>
            <DebouncedSearchInput
              placeholder="Tìm theo mã, tên hoặc liên hệ NCC..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
              style={{ width: 300 }}
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
                { label: 'Đang hợp tác', value: 'active' },
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
              Thêm nhà cung cấp
            </Button>
          )}
        </Space>
      </Card>

      {/* Suppliers Table */}
      <Table<SupplierView>
        columns={columns}
        dataSource={tableSupplierList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1250 }}
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
          showTotal: (totalCount) => `Tổng số: ${totalCount} nhà cung cấp`,
        }}
        bordered
      />

      {/* Create Modal */}
      <Modal
        title={
          <Space>
            <ShopOutlined style={{ color: '#1b4d3e' }} />
            <span>Thêm Nhà Cung Cấp Mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={handleCreateSubmit}
        okText="Thêm mới"
        cancelText="Hủy bỏ"
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="code"
            label="Mã nhà cung cấp"
            rules={[
              { required: true, message: 'Vui lòng nhập mã nhà cung cấp' },
              { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
            ]}
            extra="Ví dụ: NCC-LINEN-01, NCC-DIENMAY, NCC-HOACHAT"
          >
            <Input placeholder="Nhập mã NCC viết hoa..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên nhà cung cấp"
            rules={[
              { required: true, message: 'Vui lòng nhập tên nhà cung cấp' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Ví dụ: Công ty TNHH Dệt May Việt Nam" />
          </Form.Item>

          <Form.Item name="contactPerson" label="Người liên hệ đại diện">
            <Input placeholder="Ví dụ: Nguyễn Văn A (Phòng Kinh Doanh)" maxLength={150} />
          </Form.Item>

          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              style={{ flex: 1 }}
              rules={[{ max: 50, message: 'Số điện thoại tối đa 50 ký tự' }]}
            >
              <Input placeholder="Ví dụ: 0912345678" />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email liên hệ"
              style={{ flex: 1 }}
              rules={[
                { type: 'email', message: 'Email không đúng định dạng' },
                { max: 191, message: 'Email tối đa 191 ký tự' },
              ]}
            >
              <Input placeholder="contact@supplier.vn" />
            </Form.Item>
          </Space>

          <Form.Item name="address" label="Địa chỉ văn phòng / kho">
            <Input placeholder="Địa chỉ trụ sở công ty..." maxLength={255} />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Điều khoản thanh toán, giao nhận, v.v." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1b4d3e' }} />
            <span>Chỉnh sửa Nhà Cung Cấp: {editingSupplier?.name}</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingSupplier(null);
        }}
        onOk={handleEditSubmit}
        okText="Lưu thay đổi"
        cancelText="Hủy bỏ"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="code"
            label="Mã nhà cung cấp"
            rules={[
              { required: true, message: 'Vui lòng nhập mã nhà cung cấp' },
              { max: 50, message: 'Mã không được vượt quá 50 ký tự' },
            ]}
          >
            <Input placeholder="Nhập mã nhà cung cấp..." />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên nhà cung cấp"
            rules={[
              { required: true, message: 'Vui lòng nhập tên nhà cung cấp' },
              { max: 191, message: 'Tên không được vượt quá 191 ký tự' },
            ]}
          >
            <Input placeholder="Nhập tên nhà cung cấp..." />
          </Form.Item>

          <Form.Item name="contactPerson" label="Người liên hệ đại diện">
            <Input maxLength={150} />
          </Form.Item>

          <Space style={{ display: 'flex', width: '100%' }} size={12}>
            <Form.Item name="phone" label="Số điện thoại" style={{ flex: 1 }}>
              <Input maxLength={50} />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              style={{ flex: 1 }}
              rules={[{ type: 'email', message: 'Email không đúng định dạng' }]}
            >
              <Input maxLength={191} />
            </Form.Item>
          </Space>

          <Form.Item name="address" label="Địa chỉ">
            <Input maxLength={255} />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} maxLength={500} showCount />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Trạng thái hoạt động"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { label: 'Đang hợp tác', value: true },
                { label: 'Ngừng hoạt động', value: false },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
