import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  message,
  Popconfirm,
  Card,
  Tooltip,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomTypesApi } from '../../api/rooms.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type { RoomTypeItem, CreateRoomTypeDto } from '../../types/rooms.types.ts';

const { Title, Text, Paragraph } = Typography;

export const RoomTypesPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoomTypeItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Check RBAC: Only ADMIN and MANAGER can create, edit, deactivate room types
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fetch Room Types
  const {
    data: response,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: () => roomTypesApi.getAll(),
  });

  const rawData = response?.data;
  const roomTypes: RoomTypeItem[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.items)
    ? (rawData as any).items
    : [];

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRoomTypeDto) => roomTypesApi.create(data),
    onSuccess: () => {
      message.success('Tạo hạng phòng mới thành công!');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Không thể tạo hạng phòng.';
      message.error(msg);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoomTypeDto> }) =>
      roomTypesApi.update(id, data),
    onSuccess: () => {
      message.success('Cập nhật hạng phòng thành công!');
      setIsModalOpen(false);
      setEditingItem(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Cập nhật thất bại.';
      message.error(msg);
    },
  });

  // Deactivate Mutation (toggle status)
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, currentActive }: { id: string; currentActive: boolean }) =>
      currentActive
        ? roomTypesApi.deactivate(id)
        : roomTypesApi.update(id, { isActive: true }),
    onSuccess: (_, vars) => {
      message.success(
        vars.currentActive ? 'Đã vô hiệu hóa loại phòng!' : 'Đã kích hoạt lại loại phòng!'
      );
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Thao tác không thành công.';
      message.error(msg);
    },
  });


  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      maxAdults: 2,
      maxChildren: 0,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record: RoomTypeItem) => {
    setEditingItem(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      description: record.description,
      maxAdults: record.maxAdults,
      maxChildren: record.maxChildren,
      basePrice: Number(record.basePrice),
      isActive: record.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: {
          name: values.name,
          description: values.description,
          maxAdults: values.maxAdults,
          maxChildren: values.maxChildren,
          basePrice: values.basePrice,
          isActive: values.isActive,
        },
      });
    } else {
      createMutation.mutate({
        code: values.code.toUpperCase(),
        name: values.name,
        description: values.description,
        maxAdults: values.maxAdults,
        maxChildren: values.maxChildren || 0,
        basePrice: values.basePrice,
        isActive: values.isActive ?? true,
      });
    }
  };

  const columns: ColumnsType<RoomTypeItem> = [
    {
      title: 'Mã loại',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (code: string) => (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#1b4d3e',
            backgroundColor: '#ecfdf5',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid #a7f3d0',
          }}
        >
          {code}
        </span>
      ),
    },
    {
      title: 'Tên hạng phòng',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: RoomTypeItem) => (
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
            {name}
          </Text>
          {record.description && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {record.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Sức chứa',
      key: 'capacity',
      width: 160,
      render: (_: unknown, record: RoomTypeItem) => (
        <div style={{ fontSize: 12, color: '#334155' }}>
          <div>
            <Text strong>{record.maxAdults}</Text> Người lớn
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>
            Tối đa {record.maxChildren} Trẻ em
          </div>
        </div>
      ),
    },
    {
      title: 'Giá cơ bản / đêm',
      dataIndex: 'basePrice',
      key: 'basePrice',
      width: 180,
      align: 'right',
      render: (price: string) => (
        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
          {Number(price).toLocaleString('vi-VN')} ₫
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      align: 'center',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success" style={{ fontWeight: 600 }}>
            Đang kinh doanh
          </Tag>
        ) : (
          <Tag color="default" style={{ fontWeight: 600 }}>
            Tạm dừng
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_: unknown, record: RoomTypeItem) => {
        if (!canManage) {
          return (
            <Tooltip title="Chỉ Quản lý hoặc Quản trị viên mới có quyền thao tác">
              <Text type="secondary" style={{ fontSize: 12 }}>
                Chỉ xem
              </Text>
            </Tooltip>
          );
        }

        return (
          <Space size="small">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#1b4d3e' }} />}
              onClick={() => handleOpenEdit(record)}
            />
            <Popconfirm
              title={record.isActive ? 'Vô hiệu hóa loại phòng này?' : 'Kích hoạt lại loại phòng này?'}
              description={
                record.isActive
                  ? 'Loại phòng sẽ không xuất hiện để mở bán phòng mới.'
                  : 'Loại phòng sẽ có thể được dùng để tạo phòng mới.'
              }
              onConfirm={() =>
                toggleActiveMutation.mutate({
                  id: record.id,
                  currentActive: record.isActive,
                })
              }
              okText="Đồng ý"
              cancelText="Hủy"
            >
              <Button
                type="text"
                danger={record.isActive}
                icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined style={{ color: '#15803d' }} />}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Space align="center" size="middle">
            <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
              Danh mục Hạng / Loại phòng
            </Title>
            <Tag color="blue" icon={<AppstoreOutlined />}>
              {roomTypes.length} loại phòng
            </Tag>
          </Space>
          <Paragraph style={{ marginTop: 4, marginBottom: 0, color: '#475569', fontSize: 13 }}>
            Cấu hình các loại phòng, mức giá niêm yết cơ sở và giới hạn số lượng khách lưu trú tối đa.
          </Paragraph>
        </div>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            Làm mới
          </Button>

          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Thêm loại phòng
            </Button>
          )}
        </Space>
      </div>

      {/* Main Table */}
      <Card
        bordered
        style={{
          borderRadius: 12,
          borderColor: '#cbd5e1',
          boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
        }}
      >
        <Table
          dataSource={roomTypes}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['5', '8', '10', '20', '50'],
            showTotal: (total) => `Tổng cộng ${total} loại phòng`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          size="middle"
          scroll={{ x: 750 }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={
          <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
            {editingItem ? `Chỉnh sửa hạng phòng: ${editingItem.name}` : 'Thêm hạng phòng mới'}
          </Text>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="code"
            label={<Text strong>Mã loại phòng (Viết hoa, ký tự A-Z, 0-9, dấu gạch ngang)</Text>}
            rules={[
              { required: true, message: 'Vui lòng nhập mã loại phòng!' },
              {
                pattern: /^[A-Z0-9][A-Z0-9_-]*$/,
                message: 'Chỉ chấp nhận chữ hoa, số và gạch ngang (VD: DLX-DBL, STD-SGL)',
              },
            ]}
          >
            <Input
              placeholder="VD: DLX-SEA, SUP-TWN"
              disabled={!!editingItem} // Code cannot be modified after creation
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label={<Text strong>Tên hạng phòng</Text>}
            rules={[{ required: true, message: 'Vui lòng nhập tên hạng phòng!' }]}
          >
            <Input placeholder="VD: Deluxe Sea View, Standard Double" />
          </Form.Item>

          <Form.Item name="description" label={<Text strong>Mô tả tiện ích / đặc điểm</Text>}>
            <Input.TextArea
              rows={3}
              placeholder="VD: Phòng hướng biển, ban công riêng, giường King size..."
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: screens.xs ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="maxAdults"
              label={<Text strong>Số người lớn tối đa</Text>}
              rules={[{ required: true, message: 'Nhập số người lớn!' }]}
            >
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="maxChildren"
              label={<Text strong>Số trẻ em tối đa</Text>}
              rules={[{ required: true, message: 'Nhập số trẻ em!' }]}
            >
              <InputNumber min={0} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="basePrice"
            label={<Text strong>Giá cơ bản niêm yết (VNĐ / đêm)</Text>}
            rules={[{ required: true, message: 'Vui lòng nhập giá phòng!' }]}
          >
            <InputNumber
              min={100000}
              step={50000}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : 0) as any}
              style={{ width: '100%' }}
              addonAfter="₫"
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button
              onClick={() => {
                setIsModalOpen(false);
                setEditingItem(null);
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              {editingItem ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
