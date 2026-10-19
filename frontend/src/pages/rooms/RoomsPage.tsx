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
  Select,
  Typography,
  message,
  Popconfirm,
  Card,
  Tooltip,
  Radio,
  Row,
  Col,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  CheckCircleOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi, roomTypesApi } from '../../api/rooms.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type {
  RoomItem,
  RoomTypeItem,
  CreateRoomDto,
  PhysicalStatus,
  HousekeepingStatus,
} from '../../types/rooms.types.ts';


const { Title, Text, Paragraph } = Typography;

export const RoomsPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();

  // View mode: 'grid' or 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Filters state
  const [selectedFloor, setSelectedFloor] = useState<number | undefined>(undefined);
  const [selectedRoomType, setSelectedRoomType] = useState<string | undefined>(undefined);
  const [selectedHK, setSelectedHK] = useState<HousekeepingStatus | undefined>(undefined);
  const [selectedPhysical, setSelectedPhysical] = useState<PhysicalStatus | undefined>(undefined);
  const [searchNumber, setSearchNumber] = useState<string>('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusTargetRoom, setStatusTargetRoom] = useState<RoomItem | null>(null);

  // RBAC check: Only ADMIN and MANAGER have write permissions
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fetch Room Types for dropdowns & labels
  const { data: roomTypesRes } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: () => roomTypesApi.getAll(),
  });
  const rawTypes = roomTypesRes?.data;
  const roomTypes: RoomTypeItem[] = Array.isArray(rawTypes)
    ? rawTypes
    : Array.isArray((rawTypes as any)?.items)
    ? (rawTypes as any).items
    : [];


  // Fetch Rooms with filters
  const {
    data: roomsRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      'rooms',
      selectedFloor,
      selectedRoomType,
      selectedHK,
      selectedPhysical,
      searchNumber,
    ],
    queryFn: () =>
      roomsApi.getAll({
        floorNumber: selectedFloor,
        roomTypeId: selectedRoomType,
        housekeepingStatus: selectedHK,
        physicalStatus: selectedPhysical,
        search: searchNumber.trim() || undefined,
      }),
  });

  const rawRooms = roomsRes?.data;
  const rooms: RoomItem[] = Array.isArray(rawRooms)
    ? rawRooms
    : Array.isArray((rawRooms as any)?.items)
    ? (rawRooms as any).items
    : [];


  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRoomDto) => roomsApi.create(data),
    onSuccess: () => {
      message.success('Tạo phòng mới thành công!');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-count'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Không thể tạo phòng.';
      message.error(msg);
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRoomDto> }) =>
      roomsApi.update(id, data),
    onSuccess: () => {
      message.success('Cập nhật phòng thành công!');
      setIsModalOpen(false);
      setIsStatusModalOpen(false);
      setEditingRoom(null);
      setStatusTargetRoom(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-count'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Cập nhật thất bại.';
      message.error(msg);
    },
  });

  // Toggle Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, currentActive }: { id: string; currentActive: boolean }) =>
      currentActive ? roomsApi.deactivate(id) : roomsApi.update(id, { isActive: true }),
    onSuccess: (_, vars) => {
      message.success(
        vars.currentActive ? 'Đã vô hiệu hóa phòng!' : 'Đã kích hoạt lại phòng!'
      );
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms-count'] });
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
    setEditingRoom(null);
    form.resetFields();
    form.setFieldsValue({
      floorNumber: 1,
      physicalStatus: 'ACTIVE',
      housekeepingStatus: 'DIRTY',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record: RoomItem) => {
    setEditingRoom(record);
    form.setFieldsValue({
      roomNumber: record.roomNumber,
      floorNumber: record.floorNumber,
      roomTypeId: record.roomTypeId,
      physicalStatus: record.physicalStatus,
      housekeepingStatus: record.housekeepingStatus,
      notes: record.notes,
      isActive: record.isActive,
    });
    setIsModalOpen(true);
  };

  const handleOpenQuickStatus = (record: RoomItem) => {
    if (!canManage) return;
    setStatusTargetRoom(record);
    statusForm.setFieldsValue({
      physicalStatus: record.physicalStatus,
      housekeepingStatus: record.housekeepingStatus,
      notes: record.notes,
    });
    setIsStatusModalOpen(true);
  };

  const handleSubmit = (values: any) => {
    if (editingRoom) {
      updateMutation.mutate({
        id: editingRoom.id,
        data: {
          floorNumber: Number(values.floorNumber),
          roomTypeId: values.roomTypeId,
          physicalStatus: values.physicalStatus,
          notes: values.notes,
          isActive: values.isActive,
        },
      });
    } else {
      createMutation.mutate({
        roomNumber: values.roomNumber.trim(),
        floorNumber: Number(values.floorNumber),
        roomTypeId: values.roomTypeId,
        physicalStatus: values.physicalStatus || 'ACTIVE',
        housekeepingStatus: 'DIRTY', // Strictly enforced by hotel SOP & backend invariant
        notes: values.notes,
        isActive: values.isActive ?? true,
      });
    }
  };


  const handleQuickStatusSubmit = (values: any) => {
    if (!statusTargetRoom) return;
    updateMutation.mutate({
      id: statusTargetRoom.id,
      data: {
        physicalStatus: values.physicalStatus,
        housekeepingStatus: values.housekeepingStatus,
        notes: values.notes,
      },
    });
  };

  // Status Badge Rendering Helper
  const renderHKTag = (status: HousekeepingStatus) => {
    const meta: Record<HousekeepingStatus, { color: string; label: string }> = {
      READY: { color: 'green', label: 'READY • Sẵn sàng' },
      DIRTY: { color: 'volcano', label: 'DIRTY • Chờ dọn' },
      CLEANING: { color: 'processing', label: 'CLEANING • Đang dọn' },
      INSPECTION: { color: 'purple', label: 'INSPECTION • Kiểm tra' },
    };
    return <Tag color={meta[status]?.color || 'default'}>{meta[status]?.label || status}</Tag>;
  };

  const renderPhysicalTag = (status: PhysicalStatus) => {
    if (status === 'ACTIVE') return null;
    const meta: Record<PhysicalStatus, { color: string; label: string }> = {
      ACTIVE: { color: 'default', label: 'Bình thường' },
      MAINTENANCE: { color: 'error', label: 'Đang bảo trì' },
      OUT_OF_SERVICE: { color: 'warning', label: 'Ngừng vận hành' },
    };
    return (
      <Tag icon={<ToolOutlined />} color={meta[status]?.color}>
        {meta[status]?.label}
      </Tag>
    );
  };

  // Table Columns
  const columns: ColumnsType<RoomItem> = [
    {
      title: 'Số phòng',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      width: 120,
      render: (num: string) => (
        <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
          P.{num}
        </span>
      ),
    },
    {
      title: 'Tầng',
      dataIndex: 'floorNumber',
      key: 'floorNumber',
      width: 90,
      render: (floor: number) => <Tag color="blue">Tầng {floor}</Tag>,
    },
    {
      title: 'Hạng phòng',
      key: 'roomType',
      width: 180,
      render: (_: unknown, record: RoomItem) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#0f172a' }}>
            {record.roomType?.name}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {record.roomType?.code}
          </div>
        </div>
      ),
    },
    {
      title: 'Lưu trú',
      dataIndex: 'occupancyStatus',
      key: 'occupancyStatus',
      width: 150,
      render: (status: string) =>
        status === 'OCCUPIED' ? (
          <Tag color="cyan" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            ĐANG CÓ KHÁCH
          </Tag>
        ) : (
          <Tag color="default" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            Phòng trống
          </Tag>
        ),
    },
    {
      title: 'Trạng thái vệ sinh',
      dataIndex: 'housekeepingStatus',
      key: 'housekeepingStatus',
      width: 160,
      render: (status: HousekeepingStatus) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          {renderHKTag(status)}
        </div>
      ),
    },
    {
      title: 'Vận hành / Kỹ thuật',
      dataIndex: 'physicalStatus',
      key: 'physicalStatus',
      width: 180,
      render: (status: PhysicalStatus, record: RoomItem) => (
        <Space size={4} style={{ whiteSpace: 'nowrap' }}>
          {renderPhysicalTag(status)}
          {record.notes && (
            <Tooltip title={record.notes}>
              <Text type="secondary" style={{ fontSize: 11, cursor: 'help' }}>
                (Ghi chú)
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_: unknown, record: RoomItem) => {
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
              title={record.isActive ? 'Vô hiệu hóa phòng này?' : 'Kích hoạt lại phòng này?'}
              description={
                record.isActive
                  ? 'Phòng sẽ không còn khả dụng để phân phòng.'
                  : 'Phòng sẽ được đưa trở lại hoạt động.'
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

  // Group rooms by floor for Grid View
  const floors = Array.from(new Set(rooms.map((r) => r.floorNumber))).sort((a, b) => a - b);

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
              Quản lý Phòng vật lý
            </Title>
            <Tag color="cyan">{rooms.length} phòng</Tag>
          </Space>
          <Paragraph style={{ marginTop: 4, marginBottom: 0, color: '#475569', fontSize: 13 }}>
            Theo dõi trạng thái buồng phòng (READY, DIRTY), lưu trú khách thực tế và bảo trì kỹ thuật.
          </Paragraph>
        </div>

        <Space wrap>
          {/* View mode toggle */}
          <Radio.Group
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="grid">
              <AppstoreOutlined /> Lưới phòng
            </Radio.Button>
            <Radio.Button value="table">
              <UnorderedListOutlined /> Bảng danh sách
            </Radio.Button>
          </Radio.Group>

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
              Thêm phòng mới
            </Button>
          )}
        </Space>
      </div>

      {/* Filter Toolbar */}
      <Card
        bordered
        style={{
          borderRadius: 12,
          borderColor: '#e2e8f0',
          backgroundColor: '#ffffff',
          boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
        }}
        styles={{ body: { padding: '14px 18px' } }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Tìm số phòng (VD: 101, 302)..."
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              allowClear
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Chọn Tầng"
              allowClear
              style={{ width: '100%' }}
              value={selectedFloor}
              onChange={(val: any) => setSelectedFloor(!val || val === 'ALL' ? undefined : Number(val))}
              options={[
                { label: 'Tất cả tầng', value: 'ALL' },
                { label: 'Tầng 1', value: 1 },
                { label: 'Tầng 2', value: 2 },
                { label: 'Tầng 3', value: 3 },
                { label: 'Tầng 4', value: 4 },
                { label: 'Tầng 5', value: 5 },
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="Loại phòng"
              allowClear
              style={{ width: '100%' }}
              value={selectedRoomType}
              onChange={(val: any) => setSelectedRoomType(!val || val === 'ALL' ? undefined : val)}
              options={[
                { label: 'Tất cả loại phòng', value: 'ALL' },
                ...roomTypes.map((t) => ({ label: `${t.code} - ${t.name}`, value: t.id })),
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Vệ sinh"
              allowClear
              style={{ width: '100%' }}
              value={selectedHK}
              onChange={(val: any) => setSelectedHK(!val || val === 'ALL' ? undefined : val)}
              options={[
                { label: 'Tất cả trạng thái vệ sinh', value: 'ALL' },
                { label: 'READY (Sẵn sàng)', value: 'READY' },
                { label: 'DIRTY (Chờ dọn)', value: 'DIRTY' },
                { label: 'CLEANING (Đang dọn)', value: 'CLEANING' },
                { label: 'INSPECTION (Kiểm tra)', value: 'INSPECTION' },
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Select
              placeholder="Vận hành"
              allowClear
              style={{ width: '100%' }}
              value={selectedPhysical}
              onChange={(val: any) => setSelectedPhysical(!val || val === 'ALL' ? undefined : val)}
              options={[
                { label: 'Tất cả trạng thái vận hành', value: 'ALL' },
                { label: 'ACTIVE (Bình thường)', value: 'ACTIVE' },
                { label: 'MAINTENANCE (Bảo trì)', value: 'MAINTENANCE' },
                { label: 'OUT_OF_SERVICE (Khóa)', value: 'OUT_OF_SERVICE' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* VIEW MODE 1: GRID VIEW (Match Innvyra-PMS.html) */}
      {viewMode === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {floors.map((floor) => {
            const floorRooms = rooms.filter((r) => r.floorNumber === floor);
            return (
              <div key={floor}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                    Tầng {floor}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ({floorRooms.length} phòng)
                  </Text>
                  <div style={{ height: 1, backgroundColor: '#e2e8f0', flex: 1 }} />
                </div>

                <Row gutter={[14, 14]}>
                  {floorRooms.map((room) => {
                    const isOccupied = room.occupancyStatus === 'OCCUPIED';
                    const isMaintenance = room.physicalStatus === 'MAINTENANCE';

                    let borderColor = '#cbd5e1';
                    let bgColor = '#ffffff';

                    if (isMaintenance) {
                      borderColor = '#f59e0b';
                      bgColor = '#fffbeb';
                    } else if (isOccupied) {
                      borderColor = '#38bdf8';
                      bgColor = '#f0f9ff';
                    } else if (room.housekeepingStatus === 'DIRTY') {
                      borderColor = '#fb7185';
                      bgColor = '#fff1f2';
                    }

                    return (
                      <Col xs={12} sm={8} md={6} lg={4} key={room.id}>
                        <Card
                          bordered
                          hoverable
                          onClick={() => handleOpenQuickStatus(room)}
                          style={{
                            borderRadius: 10,
                            borderColor,
                            backgroundColor: bgColor,
                            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                            transition: 'all 0.2s',
                          }}
                          styles={{ body: { padding: '14px 14px' } }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                              Tầng {room.floorNumber}
                            </span>
                            {isOccupied && (
                              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                                ĐANG Ở
                              </Tag>
                            )}
                            {isMaintenance && (
                              <Tag color="warning" style={{ fontSize: 10, margin: 0 }}>
                                BẢO TRÌ
                              </Tag>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 800,
                              color: '#0f172a',
                              lineHeight: 1.1,
                            }}
                          >
                            {room.roomNumber}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: '#334155',
                              marginTop: 4,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {room.roomType?.name}
                          </div>

                          <div
                            style={{
                              marginTop: 12,
                              paddingTop: 8,
                              borderTop: '1px solid rgba(0,0,0,0.06)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 11, fontWeight: 600 }}>
                              {room.housekeepingStatus === 'READY' && (
                                <span style={{ color: '#16a34a' }}>● READY</span>
                              )}
                              {room.housekeepingStatus === 'DIRTY' && (
                                <span style={{ color: '#dc2626' }}>● DIRTY</span>
                              )}
                              {room.housekeepingStatus === 'CLEANING' && (
                                <span style={{ color: '#0284c7' }}>● CLEANING</span>
                              )}
                              {room.housekeepingStatus === 'INSPECTION' && (
                                <span style={{ color: '#9333ea' }}>● INSPECT</span>
                              )}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {room.isActive ? 'Mở bán' : 'Khóa'}
                            </span>
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TABLE VIEW */}
      {viewMode === 'table' && (
        <Card
          bordered
          style={{
            borderRadius: 12,
            borderColor: '#cbd5e1',
            boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
          }}
        >
          <Table
            dataSource={rooms}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            pagination={{ pageSize: 12, showSizeChanger: true }}
            size="middle"
            scroll={{ x: 1000 }}
          />
        </Card>
      )}

      {/* Create / Edit Room Modal */}
      <Modal
        title={
          <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
            {editingRoom ? `Chỉnh sửa phòng P.${editingRoom.roomNumber}` : 'Thêm phòng vật lý mới'}
          </Text>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingRoom(null);
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
          <div style={{ display: 'grid', gridTemplateColumns: screens.xs ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="roomNumber"
              label={<Text strong>Số phòng (VD: 101, 202)</Text>}
              rules={[{ required: true, message: 'Vui lòng nhập số phòng!' }]}
            >
              <Input placeholder="VD: 101" disabled={!!editingRoom} />
            </Form.Item>

            <Form.Item
              name="floorNumber"
              label={<Text strong>Số tầng</Text>}
              rules={[{ required: true, message: 'Nhập số tầng!' }]}
            >
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="roomTypeId"
            label={<Text strong>Hạng / Loại phòng</Text>}
            rules={[{ required: true, message: 'Vui lòng chọn loại phòng!' }]}
          >
            <Select
              placeholder="Chọn loại phòng"
              options={roomTypes
                .filter((t) => t.isActive || editingRoom?.roomTypeId === t.id)
                .map((t) => ({
                  label: `${t.code} - ${t.name} (${Number(t.basePrice).toLocaleString('vi-VN')} ₫)`,
                  value: t.id,
                }))}
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: screens.xs ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="housekeepingStatus"
              label={<Text strong>Trạng thái vệ sinh ban đầu</Text>}
              rules={[{ required: true, message: 'Chọn trạng thái!' }]}
              extra={
                !editingRoom && (
                  <div style={{ fontSize: 11, color: '#0284c7', marginTop: 4 }}>
                    ℹ️ <strong>Quy chuẩn:</strong> Phòng mới tạo luôn là <strong>DIRTY (Chờ dọn dẹp)</strong> để buồng phòng setup trước khi đón khách.
                  </div>
                )
              }
            >
              <Select
                disabled={!editingRoom}
                options={[
                  { label: 'DIRTY (Chờ dọn dẹp ban đầu)', value: 'DIRTY' },
                  ...(editingRoom
                    ? [
                        { label: 'READY (Sẵn sàng nhận khách)', value: 'READY' },
                        { label: 'CLEANING (Đang dọn)', value: 'CLEANING' },
                        { label: 'INSPECTION (Chờ kiểm tra)', value: 'INSPECTION' },
                      ]
                    : []),
                ]}
              />
            </Form.Item>

            <Form.Item
              name="physicalStatus"
              label={<Text strong>Tình trạng vận hành</Text>}
              rules={[{ required: true, message: 'Chọn tình trạng!' }]}
            >
              <Select
                options={[
                  { label: 'ACTIVE (Vận hành bình thường)', value: 'ACTIVE' },
                  { label: 'OUT_OF_SERVICE (Ngừng vận hành)', value: 'OUT_OF_SERVICE' },
                  ...(editingRoom
                    ? [{ label: 'MAINTENANCE (Đang bảo trì)', value: 'MAINTENANCE' }]
                    : []),
                ]}
              />
            </Form.Item>
          </div>


          <Form.Item name="notes" label={<Text strong>Ghi chú sự cố / tiện ích phòng</Text>}>
            <Input.TextArea rows={2} placeholder="VD: Máy lạnh hơi kêu, view sân vườn đẹp..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button
              onClick={() => {
                setIsModalOpen(false);
                setEditingRoom(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              {editingRoom ? 'Lưu thay đổi' : 'Tạo mới'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Quick Status Update Modal (When clicking room card in grid) */}
      <Modal
        title={
          <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
            ⚡ Cập nhật nhanh trạng thái: Phòng {statusTargetRoom?.roomNumber}
          </Text>
        }
        open={isStatusModalOpen}
        onCancel={() => {
          setIsStatusModalOpen(false);
          setStatusTargetRoom(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={statusForm}
          layout="vertical"
          onFinish={handleQuickStatusSubmit}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="housekeepingStatus"
            label={<Text strong>Trạng thái dọn phòng (Housekeeping)</Text>}
          >
            <Select
              options={[
                { label: 'READY • Đã dọn xong & Sẵn sàng đón khách', value: 'READY' },
                { label: 'DIRTY • Phòng bẩn sau khi khách trả', value: 'DIRTY' },
                { label: 'CLEANING • Nhân viên buồng phòng đang dọn', value: 'CLEANING' },
                { label: 'INSPECTION • Đang chờ Giám sát kiểm tra', value: 'INSPECTION' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="physicalStatus"
            label={<Text strong>Tình trạng kỹ thuật (Physical Status)</Text>}
          >
            <Select
              options={[
                { label: 'ACTIVE • Hoạt động bình thường', value: 'ACTIVE' },
                { label: 'MAINTENANCE • Đang khóa để sửa chữa kỹ thuật', value: 'MAINTENANCE' },
                { label: 'OUT_OF_SERVICE • Ngừng kinh doanh', value: 'OUT_OF_SERVICE' },
              ]}
            />
          </Form.Item>

          <Form.Item name="notes" label={<Text strong>Ghi chú bảo trì / buồng phòng</Text>}>
            <Input.TextArea rows={2} placeholder="Nội dung cần lưu ý..." />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setIsStatusModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={updateMutation.isPending}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Cập nhật ngay
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
