import React, { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Drawer,
  Input,
  Select,
  Typography,
  message,
  Card,
  Tooltip,
  Row,
  Col,
  Alert,
  Descriptions,
  Badge,
  Tabs,
  Empty,
  Spin,
  Timeline,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SwapOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  HomeOutlined,
  LogoutOutlined,
  LoginOutlined,
  CalendarOutlined,
  FileTextOutlined,
  WarningOutlined,
  RightOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { staysApi } from '../../api/stays.api.ts';
import { reservationsApi } from '../../api/reservations.api.ts';
import { roomsApi } from '../../api/rooms.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type {
  StaySummaryItem,
  StayDetailItem,
  StayStatus,
  CheckinDto,
  CheckoutDto,
  TransferRoomDto,
} from '../../types/stays.types.ts';
import type {
  ReservationSummaryItem,
  ReservationDetailItem,
} from '../../types/reservations.types.ts';
import type { RoomItem } from '../../types/rooms.types.ts';

const { Title, Text, Paragraph } = Typography;

// Helper: Format Day of Week in Vietnamese
const formatDayOfWeek = (dateStr: string): string => {
  const d = dayjs(dateStr).day();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[d] || '';
};

// Helper: Stay Status Mapping
const STAY_STATUS_CONFIG: Record<
  StayStatus,
  { text: string; color: string; badgeStatus: 'processing' | 'success' | 'default' }
> = {
  CHECKED_IN: { text: 'Đang lưu trú', color: 'green', badgeStatus: 'success' },
  CHECKED_OUT: { text: 'Đã trả phòng', color: 'purple', badgeStatus: 'default' },
};

export const StaysPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'stays' | 'arrivals'>('stays');

  // RBAC permissions
  // read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']
  // write: ['ADMIN', 'MANAGER', 'RECEPTIONIST']
  const canWrite =
    user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const isAccountant = user?.role === 'ACCOUNTANT';

  // ----------------------------------------------------
  // TAB 1: STAYS LIST STATE & FILTERS
  // ----------------------------------------------------
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StayStatus | undefined>(undefined);

  // Modals & Drawer State
  const [selectedStayId, setSelectedStayId] = useState<string | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Check-out Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutStay, setCheckoutStay] = useState<StaySummaryItem | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState<string>('');

  // Transfer Room Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferStay, setTransferStay] = useState<StaySummaryItem | null>(null);
  const [transferToRoomId, setTransferToRoomId] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState<string>('');

  // ----------------------------------------------------
  // TAB 2: ARRIVALS / CHECK-IN MODAL STATE
  // ----------------------------------------------------
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [checkinReservation, setCheckinReservation] = useState<ReservationDetailItem | null>(null);
  const [checkinRoomItem, setCheckinRoomItem] = useState<{
    id: string; // reservationRoomId
    roomType: { id: string; code: string; name: string };
    adults: number;
    children: number;
  } | null>(null);
  const [checkinSelectedRoomId, setCheckinSelectedRoomId] = useState<string | null>(null);
  const [checkinNotes, setCheckinNotes] = useState<string>('');

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------

  // 1. Fetch Stays List
  const {
    data: staysRes,
    isLoading: isLoadingStays,
    refetch: refetchStays,
  } = useQuery({
    queryKey: ['stays', searchKeyword, statusFilter],
    queryFn: () =>
      staysApi.getAll({
        search: searchKeyword.trim() || undefined,
        status: statusFilter,
        sortBy: 'actualCheckinAt',
        sortOrder: 'desc',
      }),
  });

  const rawStaysData = staysRes?.data;
  const stays: StaySummaryItem[] = Array.isArray(rawStaysData)
    ? rawStaysData
    : rawStaysData?.items || [];

  // 2. Fetch Stay Detail for Drawer
  const { data: stayDetailRes, isLoading: isLoadingStayDetail } = useQuery({
    queryKey: ['stayDetail', selectedStayId],
    queryFn: () => (selectedStayId ? staysApi.getById(selectedStayId) : null),
    enabled: !!selectedStayId && isDetailDrawerOpen,
  });
  const stayDetail: StayDetailItem | null = stayDetailRes?.data || null;

  // 3. Fetch All Rooms (to filter READY rooms for Check-in & Transfer)
  const { data: allRoomsRes } = useQuery({
    queryKey: ['allRoomsForStayOperations'],
    queryFn: () => roomsApi.getAll({ limit: 100 }),
    enabled: canWrite,
  });
  const allRoomsList: RoomItem[] = Array.isArray(allRoomsRes?.data)
    ? allRoomsRes.data
    : allRoomsRes?.data?.items || [];

  // 4. Fetch Pending Arrivals (Reservations with status CONFIRMED or PARTIALLY_CHECKED_IN)
  const {
    data: confirmedReservationsRes,
    isLoading: isLoadingArrivals,
    refetch: refetchArrivals,
  } = useQuery({
    queryKey: ['arrivalReservations'],
    queryFn: async () => {
      const [resConfirmed, resPartial] = await Promise.all([
        reservationsApi.getAll({ status: 'CONFIRMED', limit: 100 }),
        reservationsApi.getAll({ status: 'PARTIALLY_CHECKED_IN', limit: 100 }),
      ]);
      const confirmedItems = Array.isArray(resConfirmed.data)
        ? resConfirmed.data
        : resConfirmed.data?.items || [];
      const partialItems = Array.isArray(resPartial.data)
        ? resPartial.data
        : resPartial.data?.items || [];
      return [...confirmedItems, ...partialItems];
    },
    enabled: activeTab === 'arrivals' || isCheckinModalOpen,
  });
  const arrivalReservations: ReservationSummaryItem[] = confirmedReservationsRes || [];

  // ----------------------------------------------------
  // MUTATIONS
  // ----------------------------------------------------

  // Check-in Mutation
  const checkinMutation = useMutation({
    mutationFn: ({
      reservationId,
      reservationRoomId,
      data,
    }: {
      reservationId: string;
      reservationRoomId: string;
      data: CheckinDto;
    }) => staysApi.checkin(reservationId, reservationRoomId, data),
    onSuccess: (res) => {
      const roomNum = res.data?.room?.roomNumber || '';
      message.success(`Check-in thành công cho phòng #${roomNum}!`, 5);
      queryClient.invalidateQueries({ queryKey: ['stays'] });
      queryClient.invalidateQueries({ queryKey: ['arrivalReservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['allRoomsForStayOperations'] });
      setIsCheckinModalOpen(false);
      setCheckinReservation(null);
      setCheckinRoomItem(null);
      setCheckinSelectedRoomId(null);
      setCheckinNotes('');
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể thực hiện check-in. Vui lòng kiểm tra lại trạng thái phòng.';
      message.error(errorMsg);
    },
  });

  // Check-out Mutation
  const checkoutMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CheckoutDto }) =>
      staysApi.checkout(id, data),
    onSuccess: (res) => {
      const roomNum = res.data?.room?.roomNumber || '';
      message.success(`Trả phòng #${roomNum} thành công! Phòng đã chuyển sang trạng thái DIRTY chờ dọn dẹp.`, 5);
      queryClient.invalidateQueries({ queryKey: ['stays'] });
      queryClient.invalidateQueries({ queryKey: ['stayDetail', checkoutStay?.stayId] });
      queryClient.invalidateQueries({ queryKey: ['allRoomsForStayOperations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setIsCheckoutModalOpen(false);
      setCheckoutStay(null);
      setCheckoutNotes('');
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể thực hiện trả phòng. Vui lòng kiểm tra lại.';
      message.error(errorMsg);
    },
  });

  // Transfer Room Mutation
  const transferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransferRoomDto }) =>
      staysApi.transfer(id, data),
    onSuccess: (res) => {
      const newRoom = res.data?.room?.roomNumber || '';
      message.success(`Đổi phòng sang #${newRoom} thành công! Phòng cũ đã chuyển sang trạng thái DIRTY.`, 5);
      queryClient.invalidateQueries({ queryKey: ['stays'] });
      queryClient.invalidateQueries({ queryKey: ['stayDetail', transferStay?.stayId] });
      queryClient.invalidateQueries({ queryKey: ['allRoomsForStayOperations'] });
      setIsTransferModalOpen(false);
      setTransferStay(null);
      setTransferToRoomId(null);
      setTransferReason('');
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể chuyển phòng. Vui lòng kiểm tra lại trạng thái phòng đích.';
      message.error(errorMsg);
    },
  });

  // ----------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------

  // Open Check-in Modal for a specific room of a reservation
  const handleOpenCheckinModal = async (reservationSummary: ReservationSummaryItem) => {
    try {
      // Fetch full reservation detail to see individual rooms and their stay status
      const res = await reservationsApi.getById(reservationSummary.id);
      const detail = res.data;
      setCheckinReservation(detail);

      // Find the first room that has not been checked in yet
      const firstUncheckedRoom = detail.rooms.find((r) => !r.stay);
      if (firstUncheckedRoom) {
        setCheckinRoomItem(firstUncheckedRoom);
      } else {
        setCheckinRoomItem(detail.rooms[0] || null);
      }
      setCheckinSelectedRoomId(null);
      setCheckinNotes('');
      setIsCheckinModalOpen(true);
    } catch {
      message.error('Không thể lấy chi tiết đơn đặt phòng!');
    }
  };

  const handleConfirmCheckin = () => {
    if (!checkinReservation || !checkinRoomItem) return;
    if (!checkinSelectedRoomId) {
      message.warning('Vui lòng chọn phòng vật lý sẵn sàng (READY) để gán cho khách!');
      return;
    }
    checkinMutation.mutate({
      reservationId: checkinReservation.id,
      reservationRoomId: checkinRoomItem.id,
      data: {
        roomId: checkinSelectedRoomId,
        notes: checkinNotes.trim() || null,
      },
    });
  };

  const handleOpenCheckoutModal = (record: StaySummaryItem) => {
    setCheckoutStay(record);
    setCheckoutNotes('');
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = () => {
    if (!checkoutStay) return;
    checkoutMutation.mutate({
      id: checkoutStay.stayId,
      data: { notes: checkoutNotes.trim() || null },
    });
  };

  const handleOpenTransferModal = (record: StaySummaryItem) => {
    setTransferStay(record);
    setTransferToRoomId(null);
    setTransferReason('');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = () => {
    if (!transferStay) return;
    if (!transferToRoomId) {
      message.warning('Vui lòng chọn phòng vật lý đích để chuyển khách!');
      return;
    }
    if (!transferReason.trim()) {
      message.warning('Vui lòng nhập lý do chuyển phòng!');
      return;
    }
    transferMutation.mutate({
      id: transferStay.stayId,
      data: {
        toRoomId: transferToRoomId,
        reason: transferReason.trim(),
      },
    });
  };

  // ----------------------------------------------------
  // COMPUTED STATS & FILTERED LISTS
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const total = stays.length;
    const inHouse = stays.filter((s) => s.status === 'CHECKED_IN').length;
    const checkedOut = stays.filter((s) => s.status === 'CHECKED_OUT').length;
    return { total, inHouse, checkedOut };
  }, [stays]);

  // Eligible READY rooms for Check-in (must match checkinRoomItem.roomType.id and be READY & ACTIVE)
  const eligibleRoomsForCheckin = useMemo(() => {
    if (!checkinRoomItem) return [];
    return allRoomsList.filter(
      (r) =>
        r.roomType.id === checkinRoomItem.roomType.id &&
        r.housekeepingStatus === 'READY' &&
        r.physicalStatus === 'ACTIVE'
    );
  }, [allRoomsList, checkinRoomItem]);

  // Eligible READY rooms for Transfer (must match transferStay.roomType.id, different room, and be READY & ACTIVE)
  const eligibleRoomsForTransfer = useMemo(() => {
    if (!transferStay) return [];
    return allRoomsList.filter(
      (r) =>
        r.roomType.id === transferStay.roomType.id &&
        r.id !== transferStay.room.id &&
        r.housekeepingStatus === 'READY' &&
        r.physicalStatus === 'ACTIVE'
    );
  }, [allRoomsList, transferStay]);

  // ----------------------------------------------------
  // TABLE COLUMNS CONFIG
  // ----------------------------------------------------
  const stayColumns: ColumnsType<StaySummaryItem> = [
    {
      title: 'Số phòng',
      key: 'roomNumber',
      width: 130,
      render: (_, record) => (
        <Space size={6}>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 6,
              background: '#f0f5ff',
              border: '1px solid #adc6ff',
              fontWeight: 700,
              fontSize: 14,
              color: '#1d39c4',
            }}
          >
            #{record.room.roomNumber}
          </div>
        </Space>
      ),
    },
    {
      title: 'Hạng phòng',
      key: 'roomType',
      width: 170,
      render: (_, record) => (
        <div>
          <Text strong>{record.roomType?.name}</Text>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.roomType?.code}</div>
        </div>
      ),
    },
    {
      title: 'Khách lưu trú',
      key: 'guest',
      render: (_, record) => (
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1677ff',
              fontWeight: 600,
            }}
          >
            <UserOutlined />
          </div>
          <div>
            <Text strong>{record.bookerGuest?.fullName || 'Khách lưu trú'}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Mã đơn đặt',
      dataIndex: 'confirmationCode',
      key: 'confirmationCode',
      width: 170,
      render: (code: string) => (
        <Text copyable style={{ color: '#1677ff', fontWeight: 600 }}>
          {code}
        </Text>
      ),
    },
    {
      title: 'Thời gian nhận phòng',
      dataIndex: 'actualCheckinAt',
      key: 'actualCheckinAt',
      width: 170,
      render: (time: string) => (
        <div>
          <Text>{dayjs(time).format('DD/MM/YYYY HH:mm')}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {formatDayOfWeek(time)}
          </div>
        </div>
      ),
    },
    {
      title: 'Thời gian trả phòng',
      dataIndex: 'actualCheckoutAt',
      key: 'actualCheckoutAt',
      width: 170,
      render: (time: string | null) =>
        time ? (
          <div>
            <Text>{dayjs(time).format('DD/MM/YYYY HH:mm')}</Text>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              {formatDayOfWeek(time)}
            </div>
          </div>
        ) : (
          <Text type="secondary" italic>
            Đang lưu trú
          </Text>
        ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: StayStatus) => {
        const conf = STAY_STATUS_CONFIG[status] || {
          text: status,
          color: 'default',
          badgeStatus: 'default',
        };
        return <Badge status={conf.badgeStatus} text={<Text strong>{conf.text}</Text>} />;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      fixed: 'right',
      render: (_, record) => {
        const isInHouse = record.status === 'CHECKED_IN';
        return (
          <Space orientation="horizontal" size="small">
            <Tooltip title="Xem chi tiết lượt lưu trú">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedStayId(record.stayId);
                  setIsDetailDrawerOpen(true);
                }}
              />
            </Tooltip>
            {canWrite && isInHouse && (
              <>
                <Tooltip title="Đổi phòng (Room Transfer)">
                  <Button
                    type="text"
                    icon={<SwapOutlined style={{ color: '#fa8c16' }} />}
                    onClick={() => handleOpenTransferModal(record)}
                  />
                </Tooltip>
                <Tooltip title="Trả phòng (Check-out)">
                  <Button
                    type="text"
                    danger
                    icon={<LogoutOutlined />}
                    onClick={() => handleOpenCheckoutModal(record)}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  // Arrival Reservations Columns
  const arrivalColumns: ColumnsType<ReservationSummaryItem> = [
    {
      title: 'Mã đơn đặt',
      dataIndex: 'confirmationCode',
      key: 'confirmationCode',
      width: 170,
      render: (code: string) => (
        <Text strong style={{ color: '#1677ff' }}>
          {code}
        </Text>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'guest',
      render: (_, record) => (
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1677ff',
              fontWeight: 600,
            }}
          >
            <UserOutlined />
          </div>
          <div>
            <Text strong>{record.bookerGuest?.fullName}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Lịch trình nhận - trả',
      key: 'dates',
      width: 220,
      render: (_, record) => {
        const isTodayArrival =
          dayjs(record.checkInDate).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD');
        return (
          <div>
            <Space size={4}>
              <CalendarOutlined style={{ color: '#8c8c8c' }} />
              <Text strong={isTodayArrival}>
                {dayjs(record.checkInDate).format('DD/MM/YYYY')}
              </Text>
              <RightOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />
              <Text>{dayjs(record.checkOutDate).format('DD/MM/YYYY')}</Text>
            </Space>
            <div style={{ marginTop: 2 }}>
              {isTodayArrival ? (
                <Tag color="green" style={{ fontSize: 11, margin: 0 }}>
                  Đến hôm nay
                </Tag>
              ) : (
                <Tag color="default" style={{ fontSize: 11, margin: 0 }}>
                  {dayjs(record.checkInDate).diff(dayjs().startOf('day'), 'day')} ngày nữa
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Quy mô',
      key: 'size',
      width: 140,
      render: (_, record) => (
        <div>
          <Tag color="cyan">
            {record.totalRooms} phòng • {record.totalNights} đêm
          </Tag>
        </div>
      ),
    },
    {
      title: 'Trạng thái đơn',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) =>
        status === 'PARTIALLY_CHECKED_IN' ? (
          <Badge status="processing" text={<Text strong style={{ color: '#0958d9' }}>Nhận 1 phần</Text>} />
        ) : (
          <Badge status="warning" text={<Text strong style={{ color: '#d46b08' }}>Chờ nhận phòng</Text>} />
        ),
    },
    {
      title: 'Thao tác Check-in',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="primary"
          icon={<LoginOutlined />}
          size="middle"
          onClick={() => handleOpenCheckinModal(record)}
          disabled={!canWrite}
        >
          Làm thủ tục
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700 }}>
            Quản lý Lưu trú & Check-in / Check-out (Stays)
          </Title>
          <Text type="secondary">
            Gán phòng vật lý READY khi khách nhận phòng, theo dõi khách đang lưu trú, đổi phòng và trả phòng
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchStays();
              refetchArrivals();
            }}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'stays' | 'arrivals')}
        items={[
          {
            key: 'stays',
            label: (
              <span>
                <HomeOutlined /> Danh sách Đang lưu trú & Lịch sử ({stats.inHouse} đang ở)
              </span>
            ),
            children: (
              <>
                {/* KPI Stat Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col xs={12} sm={8} md={8}>
                    <Card
                      size="small"
                      bordered
                      style={{
                        borderRadius: 8,
                        borderColor: '#b7eb8f',
                        background: '#f6ffed',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#389e0d' }}>
                        Khách đang lưu trú (In-house)
                      </Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#389e0d' }}>
                        {stats.inHouse}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={12} sm={8} md={8}>
                    <Card
                      size="small"
                      bordered
                      style={{
                        borderRadius: 8,
                        borderColor: '#d3adf7',
                        background: '#f9f0ff',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: '#531dab' }}>
                        Đã trả phòng (Checked-out)
                      </Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#531dab' }}>
                        {stats.checkedOut}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8} md={8}>
                    <Card size="small" bordered style={{ borderRadius: 8, background: '#fafafa' }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Tổng lượt lưu trú ghi nhận
                      </Text>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1f1f1f' }}>
                        {stats.total}
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* Filter Bar */}
                <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
                  <Row gutter={[12, 12]} align="middle">
                    <Col xs={24} sm={14} md={10}>
                      <Input
                        placeholder="Tìm theo số phòng, mã đơn đặt phòng..."
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={10} md={6}>
                      <Select
                        placeholder="Trạng thái lưu trú"
                        style={{ width: '100%' }}
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val)}
                        allowClear
                        options={[
                          { label: 'Tất cả trạng thái', value: undefined },
                          { label: 'Đang lưu trú (CHECKED_IN)', value: 'CHECKED_IN' },
                          { label: 'Đã trả phòng (CHECKED_OUT)', value: 'CHECKED_OUT' },
                        ]}
                      />
                    </Col>
                  </Row>
                </Card>

                {isAccountant && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Quyền Kế toán (ACCOUNTANT)"
                    description="Bạn đang xem danh sách lượt lưu trú phục vụ đối soát công nợ & tài chính. Quyền check-in nhận phòng, đổi phòng và trả phòng được giới hạn cho bộ phận Lễ tân và Quản lý."
                  />
                )}

                {/* Stays Table */}
                <Card bodyStyle={{ padding: 0 }} bordered style={{ borderRadius: 8 }}>
                  <Table
                    columns={stayColumns}
                    dataSource={stays}
                    rowKey="stayId"
                    loading={isLoadingStays}
                    pagination={{
                      pageSize: 15,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '15', '30', '50'],
                      showTotal: (total) => `Tổng cộng ${total} lượt lưu trú`,
                    }}
                    locale={{
                      emptyText: (
                        <Empty description="Chưa có lượt lưu trú nào phù hợp điều kiện lọc." />
                      ),
                    }}
                    scroll={{ x: 1050 }}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'arrivals',
            label: (
              <span>
                <LoginOutlined /> Quầy làm thủ tục Check-in ({arrivalReservations.length} đơn chờ)
              </span>
            ),
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  icon={<ClockCircleOutlined />}
                  style={{ marginBottom: 16 }}
                  message="Quy trình Nhận phòng (Check-in Arrival SOP)"
                  description="Khi khách đến nhận phòng, chọn 'Làm thủ tục' để gán phòng vật lý đang ở trạng thái READY (Đã vệ sinh sạch sẽ). Hệ thống chỉ kích hoạt check-in vào đúng ngày nhận phòng đã đăng ký theo chính sách của khách sạn."
                />

                <Card bodyStyle={{ padding: 0 }} bordered style={{ borderRadius: 8 }}>
                  <Table
                    columns={arrivalColumns}
                    dataSource={arrivalReservations}
                    rowKey="id"
                    loading={isLoadingArrivals}
                    pagination={{
                      pageSize: 10,
                      showTotal: (total) => `Tổng cộng ${total} đơn chờ nhận phòng`,
                    }}
                    locale={{
                      emptyText: (
                        <Empty description="Hiện không có đơn đặt phòng nào đang chờ check-in." />
                      ),
                    }}
                    scroll={{ x: 1000 }}
                  />
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* ---------------------------------------------------- */}
      {/* CHECK-IN MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <LoginOutlined style={{ color: '#1677ff' }} />
            <span>Thủ tục Nhận phòng (Check-in)</span>
          </Space>
        }
        open={isCheckinModalOpen}
        onCancel={() => {
          setIsCheckinModalOpen(false);
          setCheckinReservation(null);
          setCheckinRoomItem(null);
          setCheckinSelectedRoomId(null);
          setCheckinNotes('');
        }}
        onOk={handleConfirmCheckin}
        confirmLoading={checkinMutation.isPending}
        okText="Xác nhận Check-in & Gán phòng"
        cancelText="Đóng"
        width={650}
      >
        {checkinReservation && checkinRoomItem && (
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
            {/* Reservation Summary */}
            <Card size="small" style={{ borderRadius: 8, background: '#f8fafc' }}>
              <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered={false}>
                <Descriptions.Item label="Mã đặt phòng">
                  <Text strong style={{ color: '#1677ff' }}>
                    {checkinReservation.confirmationCode}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  <Text strong>{checkinReservation.bookerGuest?.fullName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày nhận phòng">
                  <Text strong>{dayjs(checkinReservation.checkInDate).format('DD/MM/YYYY')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày trả phòng">
                  <Text strong>{dayjs(checkinReservation.checkOutDate).format('DD/MM/YYYY')}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* If reservation has multiple rooms, allow selecting which room to check-in */}
            {checkinReservation.rooms.length > 1 && (
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  Chọn phòng cần làm thủ tục check-in trong đơn ({checkinReservation.rooms.length} phòng):
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={checkinRoomItem.id}
                  onChange={(roomId) => {
                    const found = checkinReservation.rooms.find((r) => r.id === roomId);
                    if (found) {
                      setCheckinRoomItem(found);
                      setCheckinSelectedRoomId(null);
                    }
                  }}
                  options={checkinReservation.rooms.map((r, idx) => ({
                    value: r.id,
                    label: `Phòng ${idx + 1}: ${r.roomType.name} (${r.adults} NL, ${r.children} TE) ${
                      r.stay ? '● [ĐÃ NHẬN]' : '○ [CHỜ CHECK-IN]'
                    }`,
                    disabled: !!r.stay,
                  }))}
                />
              </div>
            )}

            {/* Targeted room information */}
            <div style={{ background: '#e6f4ff', padding: '10px 14px', borderRadius: 6 }}>
              <Row justify="space-between" align="middle">
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Hạng phòng cần gán:
                  </Text>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0958d9' }}>
                    {checkinRoomItem.roomType.name} ({checkinRoomItem.roomType.code})
                  </div>
                </div>
                <Tag color="blue">
                  {checkinRoomItem.adults} Người lớn • {checkinRoomItem.children} Trẻ em
                </Tag>
              </Row>
            </div>

            {/* Select physical room */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Chọn Phòng vật lý sẵn sàng (READY): <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              {eligibleRoomsForCheckin.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message="Không có phòng nào sẵn sàng!"
                  description={`Hiện không có phòng vật lý nào thuộc hạng "${checkinRoomItem.roomType.name}" đang ở trạng thái Sẵn sàng (READY). Vui lòng thông báo cho bộ phận Buồng phòng kiểm tra và dọn phòng trước khi làm thủ tục.`}
                />
              ) : (
                <Select
                  placeholder="Chọn số phòng vật lý..."
                  style={{ width: '100%' }}
                  value={checkinSelectedRoomId}
                  onChange={(val) => setCheckinSelectedRoomId(val)}
                  options={eligibleRoomsForCheckin.map((r) => ({
                    value: r.id,
                    label: `Phòng #${r.roomNumber} (Tầng ${r.floorNumber}) — [READY: Sạch sẽ]`,
                  }))}
                />
              )}
            </div>

            {/* Arrival Date Warning if not today */}
            {dayjs(checkinReservation.checkInDate).format('YYYY-MM-DD') !==
              dayjs().format('YYYY-MM-DD') && (
              <Alert
                type="warning"
                showIcon
                message="Lưu ý ngày nhận phòng"
                description={`Đơn đặt phòng này có ngày nhận phòng là ${dayjs(
                  checkinReservation.checkInDate
                ).format(
                  'DD/MM/YYYY'
                )}. Theo chính sách hệ thống, check-in chỉ được phép thực hiện vào đúng ngày khách đến đã đặt.`}
              />
            )}

            {/* Check-in Notes */}
            <div style={{ paddingBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Ghi chú khi nhận phòng:
              </Text>
              <Input.TextArea
                rows={2}
                placeholder="VD: Khách gửi hành lý tại lễ tân, bàn giao 2 chìa khóa thẻ từ..."
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                maxLength={2000}
                showCount
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* CHECK-OUT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <LogoutOutlined style={{ color: '#cf1322' }} />
            <span>Xác nhận Trả phòng (Check-out) - Phòng #{checkoutStay?.room.roomNumber}</span>
          </Space>
        }
        open={isCheckoutModalOpen}
        onCancel={() => {
          setIsCheckoutModalOpen(false);
          setCheckoutStay(null);
          setCheckoutNotes('');
        }}
        onOk={handleConfirmCheckout}
        confirmLoading={checkoutMutation.isPending}
        okText="Xác nhận Trả phòng"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        {checkoutStay && (
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
            <Alert
              type="warning"
              showIcon
              message="Quy trình dọn buồng phòng"
              description={`Khi xác nhận trả phòng, phòng #${checkoutStay.room.roomNumber} sẽ tự động chuyển sang trạng thái DIRTY (Chờ dọn dẹp) để bộ phận Buồng phòng tiến hành vệ sinh và thiết lập lại vật tư cho khách kế tiếp.`}
            />

            <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}>
              <Descriptions size="small" column={1} bordered={false}>
                <Descriptions.Item label="Khách lưu trú">
                  <Text strong>{checkoutStay.bookerGuest?.fullName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Hạng phòng">
                  {checkoutStay.roomType.name}
                </Descriptions.Item>
                <Descriptions.Item label="Giờ nhận phòng">
                  {dayjs(checkoutStay.actualCheckinAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div style={{ paddingBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Ghi chú khi trả phòng:
              </Text>
              <Input.TextArea
                rows={3}
                placeholder="VD: Kiểm tra mini-bar đầy đủ, khách hoàn trả đủ 2 thẻ phòng, không có hư hỏng..."
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                maxLength={2000}
                showCount
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* TRANSFER ROOM MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <SwapOutlined style={{ color: '#fa8c16' }} />
            <span>Đổi phòng (Room Transfer) - Phòng hiện tại: #{transferStay?.room.roomNumber}</span>
          </Space>
        }
        open={isTransferModalOpen}
        onCancel={() => {
          setIsTransferModalOpen(false);
          setTransferStay(null);
          setTransferToRoomId(null);
          setTransferReason('');
        }}
        onOk={handleConfirmTransfer}
        confirmLoading={transferMutation.isPending}
        okText="Xác nhận Đổi phòng"
        cancelText="Đóng"
      >
        {transferStay && (
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
            <Alert
              type="info"
              showIcon
              message="Quy định đổi phòng giữa kỳ"
              description={`Phòng mới bắt buộc phải cùng hạng phòng (${transferStay.roomType.name}) và đang ở trạng thái READY. Phòng cũ #${transferStay.room.roomNumber} sẽ tự động chuyển sang trạng thái DIRTY để buồng phòng dọn dẹp.`}
            />

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Chọn Phòng đích sẵn sàng (READY): <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              {eligibleRoomsForTransfer.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Không có phòng thay thế!"
                  description={`Hiện không có phòng vật lý nào khác cùng hạng "${transferStay.roomType.name}" đang ở trạng thái READY.`}
                />
              ) : (
                <Select
                  placeholder="Chọn số phòng mới..."
                  style={{ width: '100%' }}
                  value={transferToRoomId}
                  onChange={(val) => setTransferToRoomId(val)}
                  options={eligibleRoomsForTransfer.map((r) => ({
                    value: r.id,
                    label: `Phòng #${r.roomNumber} (Tầng ${r.floorNumber}) — [READY: Sạch sẽ]`,
                  }))}
                />
              )}
            </div>

            <div style={{ paddingBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Lý do đổi phòng: <span style={{ color: '#ff4d4f' }}>*</span>
              </Text>
              <Input.TextArea
                rows={3}
                placeholder="Vui lòng nhập rõ lý do đổi phòng (VD: Điều hòa kêu to, khách yêu cầu đổi tầng cao, sự cố kỹ thuật...)"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                maxLength={2000}
                showCount
              />
            </div>
          </Space>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* STAY DETAIL DRAWER */}
      {/* ---------------------------------------------------- */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 24 }}>
            <Space>
              <FileTextOutlined style={{ color: '#1677ff' }} />
              <span>Chi tiết Lượt lưu trú</span>
            </Space>
            {stayDetail && (
              <Badge
                status={STAY_STATUS_CONFIG[stayDetail.status]?.badgeStatus || 'default'}
                text={<Text strong>{STAY_STATUS_CONFIG[stayDetail.status]?.text || stayDetail.status}</Text>}
              />
            )}
          </div>
        }
        width={720}
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedStayId(null);
        }}
      >
        {isLoadingStayDetail || !stayDetail ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin tip="Đang tải thông tin lưu trú..." />
          </div>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Room Banner */}
            <Card
              size="small"
              style={{
                borderRadius: 8,
                background: stayDetail.status === 'CHECKED_IN' ? '#f6ffed' : '#f9f0ff',
                borderColor: stayDetail.status === 'CHECKED_IN' ? '#b7eb8f' : '#d3adf7',
              }}
            >
              <Row justify="space-between" align="middle">
                <div>
                  <Text type="secondary">Phòng vật lý hiện tại:</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>
                    Phòng #{stayDetail.room.roomNumber}
                  </div>
                  <div style={{ fontSize: 13, color: '#595959' }}>
                    {stayDetail.roomType.name} ({stayDetail.roomType.code})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">Trạng thái vệ sinh:</Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag color="cyan">{stayDetail.room.housekeepingStatus}</Tag>
                  </div>
                </div>
              </Row>
            </Card>

            {/* Guest & Reservation */}
            <Descriptions title="1. Thông tin Đơn đặt & Khách hàng" bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Khách lưu trú">
                <Text strong>{stayDetail.bookerGuest?.fullName || 'Khách lưu trú'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Mã xác nhận">
                <Text strong style={{ color: '#1677ff' }}>
                  {stayDetail.confirmationCode}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt đến">
                {dayjs(stayDetail.reservation.checkInDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày đặt đi">
                {dayjs(stayDetail.reservation.checkOutDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
            </Descriptions>

            {/* Check-in & Check-out Metadata */}
            <Descriptions title="2. Thời gian thực tế & Nhân viên phụ trách" bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Giờ nhận phòng">
                <Text strong>{dayjs(stayDetail.actualCheckinAt).format('DD/MM/YYYY HH:mm:ss')}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Nhân viên check-in">
                {stayDetail.checkinStaff?.fullName || 'Hệ thống'}
              </Descriptions.Item>
              <Descriptions.Item label="Giờ trả phòng">
                {stayDetail.actualCheckoutAt ? (
                  <Text strong>{dayjs(stayDetail.actualCheckoutAt).format('DD/MM/YYYY HH:mm:ss')}</Text>
                ) : (
                  <Tag color="green">Đang lưu trú</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Nhân viên check-out">
                {stayDetail.checkoutStaff?.fullName || '—'}
              </Descriptions.Item>
            </Descriptions>

            {/* Notes */}
            {(stayDetail.checkinNotes || stayDetail.checkoutNotes) && (
              <div>
                <Title level={5} style={{ marginBottom: 8, fontSize: 14 }}>
                  3. Ghi chú nghiệp vụ
                </Title>
                {stayDetail.checkinNotes && (
                  <Card size="small" title="Ghi chú Check-in" style={{ marginBottom: 8, borderRadius: 6 }}>
                    <Paragraph style={{ margin: 0 }}>{stayDetail.checkinNotes}</Paragraph>
                  </Card>
                )}
                {stayDetail.checkoutNotes && (
                  <Card size="small" title="Ghi chú Check-out" style={{ borderRadius: 6 }}>
                    <Paragraph style={{ margin: 0 }}>{stayDetail.checkoutNotes}</Paragraph>
                  </Card>
                )}
              </div>
            )}

            {/* Transfer History */}
            {stayDetail.transfers && stayDetail.transfers.length > 0 && (
              <div>
                <Title level={5} style={{ marginBottom: 12, fontSize: 14 }}>
                  4. Lịch sử đổi phòng ({stayDetail.transfers.length} lần đổi)
                </Title>
                <Timeline
                  items={stayDetail.transfers.map((t) => ({
                    color: 'orange',
                    children: (
                      <div>
                        <div>
                          <strong>
                            Đổi từ phòng #{t.fromRoom.roomNumber} sang phòng #{t.toRoom.roomNumber}
                          </strong>
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                          Thời gian: {dayjs(t.transferredAt).format('DD/MM/YYYY HH:mm')} • Thực hiện bởi:{' '}
                          <strong>{t.transferredBy.fullName}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: '#262626', marginTop: 4 }}>
                          Lý do: <em>{t.reason}</em>
                        </div>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default StaysPage;
