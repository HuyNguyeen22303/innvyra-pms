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
  Switch,
  App as AntdApp,
  Popconfirm,
  Typography,
  Card,
  Row,
  Col,
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { billingApi } from '../../../api/billing.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import { DebouncedSearchInput } from '../../../components/DebouncedSearchInput.tsx';
import type {
  ServiceItem,
  CreateServiceDto,
  UpdateServiceDto,
} from '../../../types/billing.types.ts';

const { Text, Paragraph } = Typography;

export const ServiceCatalogTab: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManageCatalog = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Filter States
  const [search, setSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Query Services
  const {
    data: servicesRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['billing-services', search, activeFilter, page, pageSize],
    queryFn: () =>
      billingApi.getServices({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        isActive: activeFilter === 'all' ? undefined : (activeFilter as any),
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const serviceList: ServiceItem[] = servicesRes?.data?.items || [];
  const total = servicesRes?.data?.pagination?.total || 0;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateServiceDto) => billingApi.createService(dto),
    onSuccess: () => {
      appMessage.success('Đã tạo dịch vụ mới thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-services'] });
    },
    onError: (err: any) => {
      const details = err.response?.data?.details;
      const detailMsg = Array.isArray(details) && details.length > 0 ? details[0].message : null;
      appMessage.error(detailMsg || err.response?.data?.message || 'Không thể tạo dịch vụ.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateServiceDto }) =>
      billingApi.updateService(id, dto),
    onSuccess: () => {
      appMessage.success('Đã cập nhật dịch vụ thành công!');
      setIsEditModalOpen(false);
      setEditingService(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-services'] });
    },
    onError: (err: any) => {
      const details = err.response?.data?.details;
      const detailMsg = Array.isArray(details) && details.length > 0 ? details[0].message : null;
      appMessage.error(detailMsg || err.response?.data?.message || 'Không thể cập nhật dịch vụ.');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => billingApi.deactivateService(id),
    onSuccess: () => {
      appMessage.success('Đã ngưng kích hoạt dịch vụ thành công!');
      queryClient.invalidateQueries({ queryKey: ['billing-services'] });
    },
    onError: (err: any) => {
      appMessage.error(err.response?.data?.message || 'Không thể ngưng kích hoạt dịch vụ.');
    },
  });

  const formatVND = (amount: string | number | null | undefined): string => {
    if (!amount) return '0 ₫';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? '0 ₫' : num.toLocaleString('vi-VN') + ' ₫';
  };

  const columns: ColumnsType<ServiceItem> = [
    {
      title: 'Mã dịch vụ',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (
        <Tag color="#1b4d3e" style={{ fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {code}
        </Tag>
      ),
    },
    {
      title: 'Tên dịch vụ',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ fontSize: 14 }}>{name}</Text>
          {record.description && (
            <Paragraph
              ellipsis={{ rows: 1 }}
              type="secondary"
              style={{ fontSize: 12, margin: 0 }}
            >
              {record.description}
            </Paragraph>
          )}
        </div>
      ),
    },
    {
      title: 'Đơn vị tính',
      dataIndex: 'unit',
      key: 'unit',
      width: 120,
      render: (unit: string) => <Tag color="blue" style={{ whiteSpace: 'nowrap' }}>{unit}</Tag>,
    },
    {
      title: 'Đơn giá niêm yết',
      dataIndex: 'price',
      key: 'price',
      width: 160,
      render: (price: string) => (
        <Text strong style={{ color: '#1b4d3e', fontSize: 14, whiteSpace: 'nowrap' }}>
          {formatVND(price)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 140,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'} style={{ whiteSpace: 'nowrap' }}>
          {isActive ? 'Đang áp dụng' : 'Đã ngưng'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {dayjs(date).format('DD/MM/YYYY HH:mm')}
        </span>
      ),
    },
    ...(canManageCatalog
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 140,
            fixed: (screens.xs ? false : 'right') as 'right' | false,
            render: (_: any, record: ServiceItem) => (
              <Space size={4} style={{ whiteSpace: 'nowrap' }}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingService(record);
                    editForm.setFieldsValue({
                      code: record.code,
                      name: record.name,
                      unit: record.unit,
                      price: parseFloat(record.price),
                      description: record.description,
                      isActive: record.isActive,
                    });
                    setIsEditModalOpen(true);
                  }}
                >
                  Sửa
                </Button>
                {record.isActive && (
                  <Popconfirm
                    title="Ngưng kích hoạt dịch vụ này?"
                    description="Dịch vụ bị ngưng sẽ không thể chọn khi tạo order mới."
                    onConfirm={() => deactivateMutation.mutate(record.id)}
                    okText="Đồng ý ngưng"
                    cancelText="Hủy"
                  >
                    <Button size="small" danger icon={<StopOutlined />} />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      {/* Filter and Action Header */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col xs={24} sm={16} md={12}>
            <Space wrap size={10} style={{ width: '100%' }}>
              <DebouncedSearchInput
                placeholder="Tìm theo mã hoặc tên dịch vụ..."
                prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                value={search}
                onChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                style={{ width: 260 }}
                allowClear
              />
              <Select
                value={activeFilter}
                onChange={(val) => {
                  setActiveFilter(val);
                  setPage(1);
                }}
                style={{ width: 150 }}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'true', label: 'Đang áp dụng' },
                  { value: 'false', label: 'Đã ngưng' },
                ]}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                Làm mới
              </Button>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={12} style={{ textAlign: 'right' }}>
            {canManageCatalog && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                onClick={() => {
                  createForm.resetFields();
                  setIsCreateModalOpen(true);
                }}
              >
                Thêm dịch vụ mới
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* Services Table */}
      <Table
        columns={columns}
        dataSource={serviceList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: 1080 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
          showTotal: (tot) => `Tổng cộng ${tot} dịch vụ`,
        }}
      />

      {/* CREATE SERVICE MODAL */}
      <Modal
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1b4d3e' }} />
            <span>Thêm Dịch vụ Mới vào Danh mục</span>
          </Space>
        }
        open={isCreateModalOpen}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Tạo dịch vụ"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ isActive: true }}
          onFinish={(values) => {
            createMutation.mutate({
              code: values.code.trim().toUpperCase(),
              name: values.name.trim(),
              unit: values.unit.trim(),
              price: `${Math.round(values.price)}.00`,
              description: values.description?.trim() || null,
              isActive: values.isActive,
            });
          }}
        >
          <Form.Item
            name="code"
            label="Mã dịch vụ (Code)"
            rules={[
              { required: true, message: 'Vui lòng nhập mã dịch vụ' },
              {
                pattern: /^[A-Z0-9][A-Z0-9_-]{0,39}$/,
                message: 'Mã gồm chữ hoa, số, gạch dưới/nối (VD: LAUNDRY, MINIBAR_01)',
              },
            ]}
          >
            <Input placeholder="VD: LAUNDRY, SPA, TOUR_DANANG..." style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập tên dịch vụ' }]}
          >
            <Input placeholder="VD: Dịch vụ giặt là tiêu chuẩn, Nước ép cam tươi..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="unit"
                label="Đơn vị tính"
                rules={[{ required: true, message: 'Vui lòng nhập đơn vị tính' }]}
              >
                <Input placeholder="VD: cái, chai, lượt, set..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Đơn giá niêm yết (VND)"
                rules={[
                  { required: true, message: 'Vui lòng nhập đơn giá' },
                  {
                    type: 'number',
                    min: 1,
                    message: 'Giá dịch vụ phải lớn hơn 0',
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                  placeholder="50,000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả dịch vụ (tùy chọn)">
            <Input.TextArea rows={3} placeholder="Mô tả quy cách, thời gian phục vụ, phụ thu..." />
          </Form.Item>

          <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
            <Switch checkedChildren="Đang áp dụng" unCheckedChildren="Đã ngưng" />
          </Form.Item>
        </Form>
      </Modal>

      {/* EDIT SERVICE MODAL */}
      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: '#1b4d3e' }} />
            <span>Chỉnh sửa Dịch vụ #{editingService?.code}</span>
          </Space>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingService(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={updateMutation.isPending}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingService) return;
            updateMutation.mutate({
              id: editingService.id,
              dto: {
                code: values.code ? values.code.trim().toUpperCase() : undefined,
                name: values.name ? values.name.trim() : undefined,
                unit: values.unit ? values.unit.trim() : undefined,
                price: values.price ? `${Math.round(values.price)}.00` : undefined,
                description: values.description?.trim() || null,
                isActive: values.isActive,
              },
            });
          }}
        >
          <Form.Item
            name="code"
            label="Mã dịch vụ (Code)"
            rules={[
              { required: true, message: 'Vui lòng nhập mã dịch vụ' },
              {
                pattern: /^[A-Z0-9][A-Z0-9_-]{0,39}$/,
                message: 'Mã gồm chữ hoa, số, gạch dưới/nối',
              },
            ]}
          >
            <Input style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên dịch vụ"
            rules={[{ required: true, message: 'Vui lòng nhập tên dịch vụ' }]}
          >
            <Input />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="unit"
                label="Đơn vị tính"
                rules={[{ required: true, message: 'Vui lòng nhập đơn vị tính' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price"
                label="Đơn giá niêm yết (VND)"
                rules={[{ required: true, message: 'Vui lòng nhập đơn giá' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Mô tả dịch vụ">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
            <Switch checkedChildren="Đang áp dụng" unCheckedChildren="Đã ngưng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
