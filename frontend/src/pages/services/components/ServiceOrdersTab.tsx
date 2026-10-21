import React, { useState, useMemo, useEffect } from 'react';
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
  App as AntdApp,
  Typography,
  Card,
  Row,
  Col,
  Alert,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  SearchOutlined,
  ReloadOutlined,
  ShoppingOutlined,
  MinusCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { billingApi } from '../../../api/billing.api.ts';
import { reservationsApi } from '../../../api/reservations.api.ts';
import { staysApi } from '../../../api/stays.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import { DebouncedSearchInput } from '../../../components/DebouncedSearchInput.tsx';
import type {
  ServiceOrderItem,
  CreateServiceOrderDto,
  ServiceOrderStatus,
} from '../../../types/billing.types.ts';
import { useStaffDirectory } from '../../../utils/staffDirectory.ts';

const { Text } = Typography;

const getApiErrorMessage = (err: any, fallback: string): string => {
  const errData = err.response?.data;
  const details = errData?.error?.details || errData?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d: any) => `${d.path ? d.path + ': ' : ''}${d.message}`).join('; ');
  }
  return errData?.error?.message || errData?.message || fallback;
};

// ---------------------------------------------------------
// ISOLATED MODAL: Cancel Order Modal
// ---------------------------------------------------------
interface CancelOrderModalProps {
  open: boolean;
  order: ServiceOrderItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = React.memo(({
  open,
  order,
  confirmLoading,
  onCancel,
  onConfirm,
}) => {
  const { message: appMessage } = AntdApp.useApp();
  const [reason, setReason] = useState<string>('');
  const [prevOpen, setPrevOpen] = useState(open);

  if (open && !prevOpen) {
    setPrevOpen(true);
    setReason('');
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const handleOk = () => {
    if (!reason.trim()) {
      appMessage.error('Vui lòng nhập lý do hủy yêu cầu dịch vụ!');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal
      title={
        <Space>
          <CloseOutlined style={{ color: '#ff4d4f' }} />
          <span>Hủy Yêu cầu Dịch vụ #{order?.id}</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Xác nhận Hủy"
      cancelText="Quay lại"
      okButtonProps={{ danger: true }}
      confirmLoading={confirmLoading}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size={12}>
        <Text>
          Bạn có chắc chắn muốn hủy yêu cầu dịch vụ này? Hành động này không thể hoàn tác.
        </Text>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            Lý do hủy yêu cầu: <span style={{ color: '#ff4d4f' }}>*</span>
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="VD: Khách báo hủy order, hết nguyên liệu pha chế, đổi món khác..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            showCount
          />
        </div>
      </Space>
    </Modal>
  );
});
CancelOrderModal.displayName = 'CancelOrderModal';

const formatVND = (amount: string | number | null | undefined): string => {
  if (!amount) return '0 ₫';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return isNaN(num) ? '0 ₫' : num.toLocaleString('vi-VN') + ' ₫';
};

const renderStatusTag = (status: ServiceOrderStatus) => {
  switch (status) {
    case 'REQUESTED':
      return <Tooltip title="Yêu cầu đang chờ nhân viên cung cấp dịch vụ"><Tag color="warning">Chờ cung cấp</Tag></Tooltip>;
    case 'COMPLETED':
      return <Tooltip title="Dịch vụ đã hoàn thành"><Tag color="success">Đã hoàn thành</Tag></Tooltip>;
    case 'CANCELLED':
      return <Tooltip title="Yêu cầu dịch vụ đã bị hủy"><Tag color="default">Đã hủy</Tag></Tooltip>;
    default:
      return <Tag>{status}</Tag>;
  }
};

export const ServiceOrdersTab: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManageOrders = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(user?.role || '');

  // Filter States
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | undefined>(undefined);
  const [reservationSearch, setReservationSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<ServiceOrderItem | null>(null);

  const [createForm] = Form.useForm();

  // Query Service Orders
  const {
    data: ordersRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['billing-orders', statusFilter, reservationSearch, page, pageSize],
    queryFn: () =>
      billingApi.getServiceOrders({
        page,
        limit: pageSize,
        reservationId: reservationSearch.trim() || undefined,
        status: statusFilter,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  // Query Active Services for Order Creation
  const { data: activeServicesRes } = useQuery({
    queryKey: ['active-services-lookup'],
    queryFn: () => billingApi.getServices({ isActive: 'true', limit: 100 }),
    enabled: isCreateModalOpen,
  });

  // Dynamic Staff Directory for instant employee names & roles
  const { getStaff } = useStaffDirectory();

  // Query Stays & Reservations (cached for table lookups & modal)
  const { data: activeStaysRes } = useQuery({
    queryKey: ['active-stays-lookup'],
    queryFn: () => staysApi.getAll({ limit: 100 }),
    staleTime: 30000,
  });

  const { data: activeReservationsRes } = useQuery({
    queryKey: ['active-reservations-lookup'],
    queryFn: () => reservationsApi.getAll({ limit: 100 }),
    staleTime: 30000,
  });

  const orderList: ServiceOrderItem[] = ordersRes?.data?.items || [];
  const total = ordersRes?.data?.pagination?.total || 0;
  const activeServices = activeServicesRes?.data?.items || [];

  const rawStays = activeStaysRes?.data;
  const activeStays: any[] = useMemo(() => {
    return Array.isArray(rawStays)
      ? rawStays
      : Array.isArray((rawStays as any)?.items)
      ? (rawStays as any).items
      : [];
  }, [rawStays]);

  const rawReservations = activeReservationsRes?.data;
  const allReservations: any[] = useMemo(() => {
    return Array.isArray(rawReservations)
      ? rawReservations
      : Array.isArray((rawReservations as any)?.items)
      ? (rawReservations as any).items
      : [];
  }, [rawReservations]);

  // Lookup maps for fast access in table rows
  const staysMap = useMemo(() => {
    const map = new Map<string, any>();
    activeStays.forEach((s: any) => {
      if (s.stayId) map.set(String(s.stayId), s);
      if (s.id) map.set(String(s.id), s);
    });
    return map;
  }, [activeStays]);

  const reservationsMap = useMemo(() => {
    const map = new Map<string, any>();
    allReservations.forEach((r: any) => {
      if (r.id) map.set(String(r.id), r);
    });
    return map;
  }, [allReservations]);

  // Backend requires active stay (CHECKED_IN or PARTIALLY_CHECKED_IN) for service orders
  const activeReservations = useMemo(() => {
    return allReservations.filter((r) =>
      ['CHECKED_IN', 'PARTIALLY_CHECKED_IN'].includes(r.status)
    );
  }, [allReservations]);

  const formReservationId = Form.useWatch('reservationId', createForm);

  const availableStays = useMemo(() => {
    if (!formReservationId) return activeStays;
    return activeStays.filter((s: any) => String(s.reservationId) === String(formReservationId));
  }, [activeStays, formReservationId]);

  useEffect(() => {
    if (!formReservationId) return;
    const currentStayId = createForm.getFieldValue('stayId');
    if (currentStayId && !availableStays.some((s: any) => String(s.stayId) === String(currentStayId))) {
      createForm.setFieldValue('stayId', undefined);
    }
    if (availableStays.length === 1 && !currentStayId) {
      createForm.setFieldValue('stayId', String(availableStays[0].stayId));
    }
  }, [formReservationId, availableStays, createForm]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateServiceOrderDto) => billingApi.createServiceOrder(dto),
    onSuccess: () => {
      appMessage.success('Đã tạo yêu cầu dịch vụ thành công!');
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio'] });
    },
    onError: (err: any) => {
      appMessage.error(getApiErrorMessage(err, 'Không thể tạo yêu cầu dịch vụ.'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => billingApi.completeServiceOrder(id),
    onSuccess: () => {
      appMessage.success('Đã hoàn thành yêu cầu dịch vụ! Tiền dịch vụ đã được ghi nợ vào Folio.');
      queryClient.invalidateQueries({ queryKey: ['billing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio'] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio-items'] });
    },
    onError: (err: any) => {
      appMessage.error(getApiErrorMessage(err, 'Không thể hoàn thành dịch vụ.'));
    },
  });
  // Stable handles: the mutation observer object changes identity on every
  // render, which would invalidate memoized table columns.
  const { mutate: completeOrder, isPending: completeOrderPending } = completeMutation;


  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      billingApi.cancelServiceOrder(id, { reason }),
    onSuccess: () => {
      appMessage.info('Đã hủy yêu cầu dịch vụ.');
      setIsCancelModalOpen(false);
      setSelectedOrderForCancel(null);
      queryClient.invalidateQueries({ queryKey: ['billing-orders'] });
    },
    onError: (err: any) => {
      appMessage.error(getApiErrorMessage(err, 'Không thể hủy yêu cầu dịch vụ.'));
    },
  });



  const columns = useMemo<ColumnsType<ServiceOrderItem>>(() => [
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>Mã yêu cầu</span>,
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#1b4d3e', fontFamily: 'monospace' }}>
            #{id}
          </Text>
        </span>
      ),
    },
    {
      title: 'Phòng & Khách hàng',
      key: 'resInfo',
      width: 200,
      render: (_, record) => {
        const stay = record.stayId ? staysMap.get(String(record.stayId)) : undefined;
        const res = reservationsMap.get(String(record.reservationId));
        const roomNumber = stay?.room?.roomNumber;
        const roomTypeName = stay?.roomType?.name;
        const guestName = stay?.bookerGuest?.fullName || res?.bookerGuest?.fullName;
        const confirmationCode = stay?.confirmationCode || res?.confirmationCode;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {roomNumber ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                <Tag color="geekblue" style={{ fontSize: 13, fontWeight: 700, padding: '1px 8px', margin: 0 }}>
                  Phòng #{roomNumber}
                </Tag>
                {roomTypeName && (
                  <Text type="secondary" style={{ fontSize: 11, overflowWrap: 'anywhere' }}>
                    ({roomTypeName})
                  </Text>
                )}
              </div>
            ) : (
              <Tag color="orange" style={{ width: 'fit-content', margin: 0, fontSize: 11 }}>
                Đơn #{record.reservationId}
              </Tag>
            )}

            {guestName && (
              <div style={{ fontSize: 12 }}>
                <Text strong style={{ color: '#0f172a', overflowWrap: 'anywhere' }}>
                  {guestName}
                </Text>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#64748b' }}>
              Mã đặt: <Text code style={{ fontSize: 10, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>#{confirmationCode || record.reservationId}</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Chi tiết dịch vụ',
      key: 'items',
      width: 320,
      render: (_, record) => (
        <Space orientation="vertical" size={6} style={{ width: '100%', minWidth: 0 }}>
          {record.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '6px 8px',
                background: '#fafafa',
                borderRadius: 4,
                border: '1px solid #f0f0f0',
                gap: 2,
                width: '100%',
                minWidth: 0,
              }}
            >
              <Text strong style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.nameSnapshot}</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 11 }}>
                <span style={{ color: '#64748b' }}>
                  x{item.quantity} {item.unitSnapshot}
                </span>
                <span style={{ color: '#595959' }}>
                  Đơn giá: {formatVND(item.unitPriceSnapshot)}
                </span>
              </div>
            </div>
          ))}
          {record.notes && (
            <div style={{ fontSize: 11, color: '#8c8c8c', fontStyle: 'italic', marginTop: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              💬 Ghi chú: {record.notes}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Tổng tiền',
      key: 'totalOrder',
      width: 120,
      render: (_, record) => {
        const orderTotal = record.items.reduce((sum, item) => sum + parseFloat(item.lineTotal || '0'), 0);
        return (
          <Text strong style={{ fontSize: 14, color: '#1b4d3e', whiteSpace: 'nowrap' }}>
            {formatVND(orderTotal)}
          </Text>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 155,
      render: (status: ServiceOrderStatus, record) => (
        <div style={{ minWidth: 0 }}>
          {renderStatusTag(status)}
          {record.cancellationReason && (
            <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
              Lý do: {record.cancellationReason}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Nhân viên & Thời gian',
      key: 'meta',
      width: 185,
      render: (_, record) => {
        const creator = getStaff(record.createdBy);
        const completer = record.completedBy ? getStaff(record.completedBy) : null;
        const canceller = record.cancelledBy ? getStaff(record.cancelledBy) : null;

        return (
          <div style={{ fontSize: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
              <Text strong style={{ color: '#0f172a', overflowWrap: 'anywhere' }}>{creator.fullName}</Text>
              <Tag color={creator.color} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                {creator.roleTitle}
              </Tag>
            </div>
            <div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap' }}>
              {dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}
            </div>

            {record.status === 'COMPLETED' && completer && (
              <div style={{ fontSize: 11, color: '#389e0d', marginTop: 4, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                ✓ Đã giao: {completer.fullName} ({completer.roleTitle})
              </div>
            )}

            {record.status === 'CANCELLED' && canceller && (
              <div style={{ fontSize: 11, color: '#cf1322', marginTop: 4, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                ✕ Hủy bởi: {canceller.fullName}
              </div>
            )}
          </div>
        );
      },
    },
    ...(canManageOrders
      ? [
          {
            title: 'Thao tác',
            key: 'actions',
            width: 165,
            render: (_: any, record: ServiceOrderItem) => {
              if (record.status !== 'REQUESTED') return null;
              return (
                <Space size={4} style={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Hoàn thành order (tự động ghi nợ vào Folio)">
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                      loading={completeOrderPending}
                      onClick={() => completeOrder(record.id)}
                    >
                      Xong
                    </Button>
                  </Tooltip>
                  <Tooltip title="Hủy yêu cầu">
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => {
                        setSelectedOrderForCancel(record);
                        setIsCancelModalOpen(true);
                      }}
                    >
                      Hủy
                    </Button>
                  </Tooltip>
                </Space>
              );
            },
          },
        ]
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [canManageOrders, completeOrder, completeOrderPending, formatVND, getStaff, renderStatusTag, reservationsMap, staysMap]);

  return (
    <div>
      {/* Filter and Action Header */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 16]} justify="space-between" align="middle">
          <Col xs={24} sm={16} md={12}>
            <Space wrap size={10} style={{ width: '100%' }}>
              <DebouncedSearchInput
                placeholder="Mã đơn đặt phòng (VD: 1, 2)..."
                prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                value={reservationSearch}
                onChange={(val) => {
                  setReservationSearch(val);
                  setPage(1);
                }}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={(val: any) => {
                  setStatusFilter(!val || val === 'ALL' ? undefined : val);
                  setPage(1);
                }}
                placeholder="Lọc trạng thái..."
                style={{ width: 170 }}
                allowClear
                options={[
                  { value: 'ALL', label: 'Tất cả trạng thái' },
                  { value: 'REQUESTED', label: 'Chờ cung cấp' },
                  { value: 'COMPLETED', label: 'Đã hoàn thành' },
                  { value: 'CANCELLED', label: 'Đã hủy' },
                ]}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                Làm mới
              </Button>
            </Space>
          </Col>
          <Col xs={24} sm={8} md={12} style={{ textAlign: 'right' }}>
            {canManageOrders && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                onClick={() => {
                  createForm.resetFields();
                  setIsCreateModalOpen(true);
                }}
              >
                Tạo yêu cầu dịch vụ
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* Orders Table */}
      <Table
        columns={columns}
        dataSource={orderList}
        rowKey="id"
        loading={isLoading}
        scroll={{ x: canManageOrders ? 1250 : 1080 }}
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
          showTotal: (tot) => `Tổng cộng ${tot} đơn dịch vụ`,
        }}
      />

      {/* CREATE SERVICE ORDER MODAL */}
      <Modal
        title={
          <Space>
            <ShoppingOutlined style={{ color: '#1b4d3e' }} />
            <span>Ghi nhận Yêu cầu Dịch vụ mới</span>
          </Space>
        }
        open={isCreateModalOpen}
        width={680}
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Tạo yêu cầu"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
      >
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          title="Chính sách giá dịch vụ (Snapshot Pricing)"
          description="Đơn giá của từng dịch vụ được chụp (snapshot) cố định tại thời điểm tạo đơn. Khi bấm Hoàn thành, tiền dịch vụ sẽ tự động ghi nợ vào Sổ công nợ Folio."
          style={{ marginBottom: 16 }}
        />

        {activeReservations.length === 0 && (
          <Alert
            type="warning"
            showIcon
            title="Chưa có khách đang lưu trú (CHECKED_IN)"
            description="Dịch vụ chỉ có thể ghi nhận cho các đơn đặt phòng đang có khách lưu trú tại khách sạn."
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ items: [{ quantity: 1 }] }}
          onFinish={(values) => {
            const stayIdVal =
              values.stayId && values.stayId !== 'undefined'
                ? String(values.stayId).trim()
                : undefined;
            createMutation.mutate({
              reservationId: String(values.reservationId).trim(),
              stayId: stayIdVal || undefined,
              items: values.items.map((it: any) => ({
                serviceId: String(it.serviceId).trim(),
                quantity: Number(it.quantity),
              })),
              notes: values.notes?.trim() || null,
            });
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="reservationId"
                label="Đơn đặt phòng"
                rules={[{ required: true, message: 'Vui lòng chọn đơn đặt phòng' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn đơn đặt phòng..."
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={activeReservations.map((r: any) => ({
                    value: String(r.id),
                    label: `${r.bookerGuest?.fullName || 'Khách'} - Mã đặt: #${r.confirmationCode || r.id} (${r.status})`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="stayId" label="Phòng nhận dịch vụ (tùy chọn)">
                <Select
                  showSearch
                  allowClear
                  placeholder={
                    formReservationId
                      ? availableStays.length > 0
                        ? 'Gắn theo phòng lưu trú...'
                        : 'Không có phòng nào đang check-in'
                      : 'Chọn đơn đặt phòng trước...'
                  }
                  disabled={!formReservationId || availableStays.length === 0}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={availableStays.map((s: any) => ({
                    value: String(s.stayId || s.id),
                    label: `Phòng #${s.room?.roomNumber} - ${s.roomType?.name || ''} (${s.bookerGuest?.fullName || 'Khách lưu trú'})`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            Danh sách món / dịch vụ:
          </Text>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={12} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={20} sm={14}>
                      <Form.Item
                        {...restField}
                        name={[name, 'serviceId']}
                        rules={[{ required: true, message: 'Chọn dịch vụ' }]}
                        style={{ margin: 0 }}
                      >
                        <Select
                          showSearch
                          placeholder="Chọn dịch vụ từ danh mục..."
                          filterOption={(input, option) =>
                            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={activeServices.map((svc) => ({
                            value: String(svc.id),
                            label: `${svc.name} (${formatVND(svc.price)} / ${svc.unit})`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={20} sm={7}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: 'Nhập SL' }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber min={1} max={1000} placeholder="Số lượng" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={4} sm={3}>
                      {fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        />
                      )}
                    </Col>
                  </Row>
                ))}
                <Form.Item style={{ marginTop: 8 }}>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Thêm dịch vụ khác vào đơn
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item name="notes" label="Ghi chú yêu cầu dịch vụ">
            <Input.TextArea rows={2} placeholder="VD: Giao lên phòng lúc 19:30, ít đá, ủi gấp đồ trước 18:00..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* CANCEL SERVICE ORDER MODAL */}
      <CancelOrderModal
        open={isCancelModalOpen}
        order={selectedOrderForCancel}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => {
          setIsCancelModalOpen(false);
          setSelectedOrderForCancel(null);
        }}
        onConfirm={(reason) => {
          if (selectedOrderForCancel) {
            cancelMutation.mutate({
              id: selectedOrderForCancel.id,
              reason,
            });
          }
        }}
      />
    </div>
  );
};
