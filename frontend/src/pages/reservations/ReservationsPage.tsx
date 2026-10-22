import React, { useState, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Drawer,
  Input,
  Select,
  DatePicker,
  Typography,
  App as AntdApp,
  Card,
  Row,
  Col,
  Alert,
  Divider,
  Descriptions,
  InputNumber,
  Badge,
  Tabs,
  Empty,
  Spin,
  Tooltip,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  UserOutlined,
  HomeOutlined,
  FileTextOutlined,
  RightOutlined,
  ShoppingCartOutlined,
  StopOutlined,
  LoginOutlined,
  UserDeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { DebouncedSearchInput } from '../../components/DebouncedSearchInput.tsx';

interface BookingNotesInputProps {
  initialValue?: string;
  resetKey: number;
  onChange: (val: string) => void;
}

const BookingNotesInput: React.FC<BookingNotesInputProps> = React.memo(
  ({ initialValue = '', resetKey, onChange }) => {
    const [value, setValue] = useState<string>(initialValue);
    const [prevResetKey, setPrevResetKey] = useState<number>(resetKey);

    if (resetKey !== prevResetKey) {
      setPrevResetKey(resetKey);
      setValue(initialValue);
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      setValue(newVal);
      onChange(newVal);
    };

    return (
      <Input.TextArea
        rows={3}
        value={value}
        onChange={handleChange}
        placeholder="VD: Khách yêu cầu tầng cao, check-in muộn sau 19:00, xuất hóa đơn công ty..."
        maxLength={1000}
        showCount
      />
    );
  }
);

interface CancelReservationModalProps {
  open: boolean;
  reservation: ReservationSummaryItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const CancelReservationModal: React.FC<CancelReservationModalProps> = React.memo(
  ({ open, reservation, confirmLoading, onCancel, onConfirm }) => {
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
        appMessage.warning('Vui lòng nhập lý do hủy đặt phòng!');
        return;
      }
      onConfirm(reason.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <StopOutlined style={{ color: '#ff4d4f' }} />
            <span>Hủy Đơn Đặt Phòng: {reservation?.confirmationCode}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        confirmLoading={confirmLoading}
        okText="Xác nhận Hủy Đơn"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            title="Cảnh báo quy trình khách sạn"
            description="Khi xác nhận hủy đơn, toàn bộ các đêm phòng đã giữ chỗ cho khách hàng sẽ được giải phóng ngay lập tức trên hệ thống và quay lại trạng thái phòng trống cho khách khác đặt. Thao tác này KHÔNG thể hoàn tác."
          />

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Lý do hủy đặt phòng: <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="Vui lòng nêu rõ lý do hủy (VD: Khách báo hủy chuyến bay, thay đổi lịch công tác, khách đổi ngày sang tháng sau...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  }
);

interface NoShowReservationModalProps {
  open: boolean;
  reservation: ReservationSummaryItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const NoShowReservationModal: React.FC<NoShowReservationModalProps> = React.memo(
  ({ open, reservation, confirmLoading, onCancel, onConfirm }) => {
    const { message: appMessage } = AntdApp.useApp();
    const [reason, setReason] = useState<string>('');
    const [prevOpen, setPrevOpen] = useState(open);

    if (open && !prevOpen) {
      setPrevOpen(true);
      setReason('');
    } else if (!open && prevOpen) {
      setPrevOpen(false);
    }

    const isFutureCheckIn =
      !!reservation?.checkInDate &&
      dayjs(reservation.checkInDate).startOf('day').isAfter(dayjs().startOf('day'));

    const handleOk = () => {
      if (!reason.trim()) {
        appMessage.warning('Vui lòng nhập lý do khách không đến!');
        return;
      }
      onConfirm(reason.trim());
    };

    return (
      <Modal
        title={
          <Space>
            <UserDeleteOutlined style={{ color: '#fa8c16' }} />
            <span>Khách Không Đến (No-Show): {reservation?.confirmationCode}</span>
          </Space>
        }
        open={open}
        onCancel={onCancel}
        onOk={handleOk}
        confirmLoading={confirmLoading}
        okText="Xác nhận Khách Không Đến"
        cancelText="Đóng"
        okButtonProps={{ danger: true }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
          <Alert
            type="warning"
            showIcon
            title="Đơn sẽ được chuyển sang trạng thái Vắng mặt (NO_SHOW)"
            description="Đơn đặt phòng sẽ không bị hủy mà được ghi nhận là khách không đến. Toàn bộ đêm phòng đã giữ chỗ sẽ được giải phóng ngay lập tức để phục vụ khách khác. Thao tác này KHÔNG thể hoàn tác."
          />

          {isFutureCheckIn && (
            <Alert
              type="info"
              showIcon
              title={`Ngày nhận phòng là ${dayjs(reservation?.checkInDate).format('DD/MM/YYYY')} (chưa tới)`}
              description="Hãy chắc chắn khách đã xác nhận không đến trước khi đánh dấu No-Show cho đơn đặt phòng trong tương lai."
            />
          )}

          <div style={{ paddingBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              Lý do khách không đến: <span style={{ color: '#ff4d4f' }}>*</span>
            </Text>
            <Input.TextArea
              rows={3}
              placeholder="VD: Khách không đến nhận phòng, không liên hệ được sau nhiều lần gọi, khách báo hủy chuyến..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              showCount
            />
          </div>
        </Space>
      </Modal>
    );
  }
);
import dayjs, { type Dayjs } from 'dayjs';
import { reservationsApi } from '../../api/reservations.api.ts';
import { guestsApi } from '../../api/guests.api.ts';
import { roomTypesApi, roomsApi } from '../../api/rooms.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type {
  ReservationSummaryItem,
  ReservationDetailItem,
  ReservationStatus,
  BookingSource,
  RoomAvailabilityItem,
  CreateReservationDto,
} from '../../types/reservations.types.ts';
import type { GuestSummary } from '../../types/guests.types.ts';
import type { RoomTypeItem, RoomItem } from '../../types/rooms.types.ts';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

interface ReservationsTableProps {
  columns: ColumnsType<ReservationSummaryItem>;
  data: ReservationSummaryItem[];
  loading: boolean | { spinning: boolean; delay?: number };
  canWrite: boolean;
}

const ReservationsTable: React.FC<ReservationsTableProps> = React.memo(
  ({ columns, data, loading, canWrite }) => {
    const [pageSize, setPageSize] = useState<number>(15);

    return (
      <Card styles={{ body: { padding: 0 } }} variant="outlined" style={{ borderRadius: 8 }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '30', '50'],
            onChange: (_page, size) => setPageSize(size),
            showTotal: (total) => `Tổng cộng ${total} đơn đặt phòng`,
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span>
                    Chưa có đơn đặt phòng nào phù hợp điều kiện lọc.
                    {canWrite && ' Bạn có thể bấm "Tạo Đặt phòng Mới" để bắt đầu.'}
                  </span>
                }
              />
            ),
          }}
          scroll={{ x: 1350 }}
        />
      </Card>
    );
  }
);

// Helper: Format Currency to VND
// The formatter is created once: building an Intl.NumberFormat per table cell
// is expensive when a full page of reservations is rendered.
const VND_FORMATTER = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const formatCurrency = (amount: string | number): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0 ₫';
  return VND_FORMATTER.format(num);
};

// Helper: Format Day of Week in Vietnamese
const formatDayOfWeek = (dateStr: string): string => {
  const d = dayjs(dateStr).day();
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[d] || '';
};

// Helper: Booking Source Vietnamese Mapping
const BOOKING_SOURCE_LABELS: Record<BookingSource, { text: string; color: string }> = {
  DIRECT: { text: 'Trực tiếp', color: 'blue' },
  PHONE: { text: 'Điện thoại', color: 'cyan' },
  EMAIL: { text: 'Email', color: 'geekblue' },
  WALK_IN: { text: 'Khách vãng lai', color: 'gold' },
  AGENT: { text: 'Đại lý / OTA', color: 'purple' },
  OTHER: { text: 'Nguồn khác', color: 'default' },
};

// Helper: Reservation Status Vietnamese Mapping
const STATUS_CONFIG: Record<
  ReservationStatus,
  { text: string; color: string; badgeStatus: 'processing' | 'success' | 'error' | 'default' | 'warning' }
> = {
  CONFIRMED: { text: 'Đã xác nhận', color: 'processing', badgeStatus: 'processing' },
  CHECKED_IN: { text: 'Đang lưu trú', color: 'success', badgeStatus: 'success' },
  PARTIALLY_CHECKED_IN: { text: 'Nhận 1 phần', color: 'cyan', badgeStatus: 'processing' },
  CHECKED_OUT: { text: 'Đã trả phòng', color: 'purple', badgeStatus: 'default' },
  CANCELLED: { text: 'Đã hủy', color: 'error', badgeStatus: 'error' },
  NO_SHOW: { text: 'Vắng mặt (No-Show)', color: 'warning', badgeStatus: 'warning' },
};

interface ReservationFilterBarProps {
  isAccountant: any;
  onCodePendingChange: (pending: boolean) => void;
  onGuestPendingChange: (pending: boolean) => void;
  searchCode: any;
  setSearchCode: any;
  guestSearch: any;
  setGuestSearch: any;
  statusFilter: any;
  setStatusFilter: any;
  sourceFilter: any;
  setSourceFilter: any;
  dateRangeFilter: any;
  setDateRangeFilter: any;
}

const ReservationFilterBar: React.FC<ReservationFilterBarProps> = React.memo(({ isAccountant, onCodePendingChange, onGuestPendingChange, searchCode, setSearchCode, guestSearch, setGuestSearch, statusFilter, setStatusFilter, sourceFilter, setSourceFilter, dateRangeFilter, setDateRangeFilter }) => (
  <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
  <Row gutter={[12, 12]} align="middle">
  <Col xs={24} sm={12} md={6}>
  <DebouncedSearchInput
  placeholder="Mã đặt phòng (VD: RES-...)"
  prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
  value={searchCode}
  onChange={(val) => setSearchCode(val)}
  onPendingChange={onCodePendingChange}
  clearImmediately
  allowClear
  />
  </Col>
  {!isAccountant && (
  <Col xs={24} sm={12} md={5}>
  <DebouncedSearchInput
  placeholder="Tên khách hàng"
  prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
  value={guestSearch}
  onChange={(val) => setGuestSearch(val)}
  onPendingChange={onGuestPendingChange}
  clearImmediately
  allowClear
  />
  </Col>
  )}
  <Col xs={24} sm={12} md={isAccountant ? 6 : 4}>
  <Select
  placeholder="Trạng thái"
  style={{ width: '100%' }}
  value={statusFilter}
  onChange={(val: any) => setStatusFilter(!val || val === 'ALL' ? undefined : val)}
  allowClear
  options={[
  { label: 'Tất cả trạng thái', value: 'ALL' },
  { label: 'Đã xác nhận (CONFIRMED)', value: 'CONFIRMED' },
  { label: 'Đang lưu trú (CHECKED_IN)', value: 'CHECKED_IN' },
  { label: 'Nhận 1 phần (PARTIALLY)', value: 'PARTIALLY_CHECKED_IN' },
  { label: 'Đã trả phòng (CHECKED_OUT)', value: 'CHECKED_OUT' },
  { label: 'Đã hủy (CANCELLED)', value: 'CANCELLED' },
  { label: 'Vắng mặt (NO_SHOW)', value: 'NO_SHOW' },
  ]}
  />
  </Col>
  <Col xs={24} sm={12} md={isAccountant ? 6 : 4}>
  <Select
  placeholder="Kênh đặt"
  style={{ width: '100%' }}
  value={sourceFilter}
  onChange={(val: any) => setSourceFilter(!val || val === 'ALL' ? undefined : val)}
  allowClear
  options={[
  { label: 'Tất cả nguồn', value: 'ALL' },
  { label: 'Trực tiếp (DIRECT)', value: 'DIRECT' },
  { label: 'Điện thoại (PHONE)', value: 'PHONE' },
  { label: 'Email (EMAIL)', value: 'EMAIL' },
  { label: 'Khách vãng lai (WALK_IN)', value: 'WALK_IN' },
  { label: 'Đại lý / OTA (AGENT)', value: 'AGENT' },
  { label: 'Khác (OTHER)', value: 'OTHER' },
  ]}
  />
  </Col>
  <Col xs={24} sm={12} md={5}>
  <RangePicker
  placeholder={['Check-in từ', 'đến']}
  style={{ width: '100%' }}
  value={dateRangeFilter}
  onChange={(dates) => setDateRangeFilter(dates)}
  format="DD/MM/YYYY"
  />
  </Col>
  </Row>
  </Card>
));

export const ReservationsPage: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // RBAC permissions
  // write: ['ADMIN', 'MANAGER', 'RECEPTIONIST']
  // read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']
  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const isAccountant = user?.role === 'ACCOUNTANT';

  // ----------------------------------------------------
  // TAB 1: LIST RESERVATIONS STATE & FILTERS
  // ----------------------------------------------------
  const [searchCode, setSearchCode] = useState<string>('');
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<BookingSource | undefined>(undefined);
  const [dateRangeFilter, setDateRangeFilter] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  // Tracks a search that is still waiting for its debounce, so the page can say
  // that the result list is being refreshed instead of silently showing the
  // previous rows.
  const [pendingSearches, setPendingSearches] = useState<{ code: boolean; guest: boolean }>({
    code: false,
    guest: false,
  });

  const handleCodePendingChange = useCallback((pending: boolean) => {
    setPendingSearches((prev) => (prev.code === pending ? prev : { ...prev, code: pending }));
  }, []);

  const handleGuestPendingChange = useCallback((pending: boolean) => {
    setPendingSearches((prev) => (prev.guest === pending ? prev : { ...prev, guest: pending }));
  }, []);

  // Detail Drawer state
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Cancel Modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellingReservation, setCancellingReservation] = useState<ReservationSummaryItem | null>(null);

  // No-Show Modal state
  const [noShowModalVisible, setNoShowModalVisible] = useState(false);
  const [noShowReservation, setNoShowReservation] = useState<ReservationSummaryItem | null>(null);

  // Fetch Reservations
  const {
    data: reservationsRes,
    isLoading: isLoadingReservations,
    isFetching: isFetchingReservations,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: [
      'reservations',
      searchCode,
      guestSearch,
      statusFilter,
      sourceFilter,
      dateRangeFilter?.[0]?.format('YYYY-MM-DD'),
      dateRangeFilter?.[1]?.format('YYYY-MM-DD'),
    ],
    queryFn: () =>
      reservationsApi.getAll({
        search: searchCode.trim() || undefined,
        // Backend restricts guestSearch from ACCOUNTANT (returns 403)
        guestSearch: !isAccountant && guestSearch.trim() ? guestSearch.trim() : undefined,
        status: statusFilter,
        bookingSource: sourceFilter,
        checkInDate: dateRangeFilter?.[0]?.format('YYYY-MM-DD'),
        checkOutDate: dateRangeFilter?.[1]?.format('YYYY-MM-DD'),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    // Keep the previous result on screen while the new one is loading: the list
    // no longer blanks out between two searches, and the header indicator tells
    // the user that the rows shown are being refreshed.
    placeholderData: keepPreviousData,
  });

  const rawResData = reservationsRes?.data;
  const reservations: ReservationSummaryItem[] = useMemo(() => {
    return Array.isArray(rawResData)
      ? rawResData
      : rawResData?.items || [];
  }, [rawResData]);

  // Defer only the grid payload (the KPI counters below use the fresh rows) so a
  // keydown arriving mid-render can interrupt the table. The fallback keeps the
  // very first payload from flashing the empty state.
  const deferredReservations = useDeferredValue(reservations);
  const tableReservations =
    deferredReservations.length > 0 ? deferredReservations : reservations;

  // True from the first keystroke (or filter change) until the refreshed rows
  // are on screen: the debounce wait plus the request plus the re-render.
  const isUpdating = pendingSearches.code || pendingSearches.guest || isFetchingReservations;

  // Fetch Reservation Details when drawer opens
  const { data: reservationDetailRes, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['reservationDetail', selectedReservationId],
    queryFn: () => (selectedReservationId ? reservationsApi.getById(selectedReservationId) : null),
    enabled: !!selectedReservationId && isDrawerOpen,
  });
  const reservationDetail: ReservationDetailItem | null = reservationDetailRes?.data ?? null;

  // Cancel Reservation Mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reservationsApi.cancel(id, { reason }),
    onSuccess: () => {
      appMessage.success('Đã hủy đơn đặt phòng thành công!');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservationDetail', cancellingReservation?.id] });
      setCancelModalVisible(false);
      setCancellingReservation(null);
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể hủy đơn đặt phòng. Vui lòng kiểm tra lại.';
      appMessage.error(errorMsg);
    },
  });

  // Handle Cancel Click
  const handleOpenCancelModal = useCallback((record: ReservationSummaryItem) => {
    setCancellingReservation(record);
    setCancelModalVisible(true);
  }, []);

  const handleConfirmCancel = (reason: string) => {
    if (!cancellingReservation) return;
    cancelMutation.mutate({
      id: cancellingReservation.id,
      reason,
    });
  };

  // No-Show Mutation: close the booking with the NO_SHOW status so the audit
  // trail records "guest did not arrive" instead of a regular cancellation.
  const noShowMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reservationsApi.markNoShow(id, { reason }),
    onSuccess: () => {
      appMessage.success('Đã đánh dấu khách không đến (No-Show) và giải phóng phòng!');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservationDetail', noShowReservation?.id] });
      setNoShowModalVisible(false);
      setNoShowReservation(null);
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể đánh dấu khách không đến. Vui lòng kiểm tra lại.';
      appMessage.error(errorMsg);
    },
  });

  const handleOpenNoShowModal = useCallback((record: ReservationSummaryItem) => {
    setNoShowReservation(record);
    setNoShowModalVisible(true);
  }, []);

  const handleConfirmNoShow = (reason: string) => {
    if (!noShowReservation) return;
    noShowMutation.mutate({
      id: noShowReservation.id,
      reason,
    });
  };

  // ----------------------------------------------------
  // TAB 2: CHECK AVAILABILITY & CREATE RESERVATION STATE
  // ----------------------------------------------------
  const [availDateRange, setAvailDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().add(1, 'day'),
    dayjs().add(2, 'day'),
  ]);
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [hasSearchedAvail, setHasSearchedAvail] = useState<boolean>(false);

  // Selected rooms for the new reservation: Record<roomTypeId, { quantity: number; adults: number; children: number }>
  const [selectedRoomsMap, setSelectedRoomsMap] = useState<
    Record<string, { quantity: number; adults: number; children: number }>
  >({});

  // Booker Guest and Extra fields
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<BookingSource>('DIRECT');
  const bookingNotesRef = useRef<string>('');
  const [bookingNotesResetKey, setBookingNotesResetKey] = useState<number>(0);

  // Fetch Guest list for Guest Selector Dropdown
  const { data: guestsRes, isLoading: isLoadingGuests } = useQuery({
    queryKey: ['guestsForBooking'],
    queryFn: () => guestsApi.getAll({ limit: 100 }),
    enabled: canWrite,
  });
  const guestsList: GuestSummary[] = useMemo(
    () =>
      Array.isArray(guestsRes?.data)
        ? guestsRes.data
        : guestsRes?.data?.items || [],
    [guestsRes]
  );

  // Fetch Room Types to know max occupancy and base details
  const { data: roomTypesRes } = useQuery({
    queryKey: ['roomTypesForBooking'],
    queryFn: () => roomTypesApi.getAll({ limit: 100 }),
    enabled: canWrite,
  });
  const roomTypesList: RoomTypeItem[] = useMemo(
    () =>
      Array.isArray(roomTypesRes?.data)
        ? roomTypesRes.data
        : roomTypesRes?.data?.items || [],
    [roomTypesRes]
  );

  // Fetch physical rooms to map roomId to real physical roomNumber (e.g. 101, 102, 201...)
  const { data: allRoomsRes } = useQuery({
    queryKey: ['allRoomsForLookup'],
    queryFn: () => roomsApi.getAll({ limit: 100 }),
    staleTime: 60000,
  });
  const allRoomsList: RoomItem[] = useMemo(() => {
    const raw = allRoomsRes?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  }, [allRoomsRes]);

  const getPhysicalRoomNumber = (roomId: string | null | undefined): string => {
    if (!roomId) return '';
    const found = allRoomsList.find((r) => String(r.id) === String(roomId));
    return found ? found.roomNumber : roomId;
  };

  // Check Availability Query
  const {
    data: availabilityRes,
    isLoading: isLoadingAvailability,
    refetch: refetchAvailability,
  } = useQuery({
    queryKey: [
      'roomAvailability',
      availDateRange[0].format('YYYY-MM-DD'),
      availDateRange[1].format('YYYY-MM-DD'),
      adultsCount,
      childrenCount,
    ],
    queryFn: () =>
      reservationsApi.checkAvailability({
        checkInDate: availDateRange[0].format('YYYY-MM-DD'),
        checkOutDate: availDateRange[1].format('YYYY-MM-DD'),
        adults: adultsCount,
        children: childrenCount,
      }),
    enabled: false, // Triggered on manual click
  });

  const rawAvailability = availabilityRes?.data;
  const availableRoomsList: RoomAvailabilityItem[] = useMemo(() => {
    return Array.isArray(rawAvailability) ? rawAvailability : [];
  }, [rawAvailability]);

  const handleSearchAvailability = useCallback(() => {
    if (!availDateRange || !availDateRange[0] || !availDateRange[1]) {
      appMessage.warning('Vui lòng chọn khoảng thời gian nhận và trả phòng!');
      return;
    }
    if (availDateRange[1].isSame(availDateRange[0], 'day') || availDateRange[1].isBefore(availDateRange[0])) {
      appMessage.error('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm!');
      return;
    }
    setHasSearchedAvail(true);
    setSelectedRoomsMap({});
    refetchAvailability();
  }, [appMessage, availDateRange, refetchAvailability]);

  // Calculate estimated total price in Tab 2
  const totalNightsStay = useMemo(() => {
    if (!availDateRange[0] || !availDateRange[1]) return 1;
    return Math.max(1, availDateRange[1].diff(availDateRange[0], 'day'));
  }, [availDateRange]);

  const calculatedTotalAmount = useMemo(() => {
    let total = 0;
    Object.entries(selectedRoomsMap).forEach(([typeId, config]) => {
      if (config.quantity > 0) {
        const item = availableRoomsList.find((r) => r.roomTypeId === typeId);
        if (item) {
          const pricePerRoom = parseFloat(item.estimatedTotalPerRoom) || 0;
          total += pricePerRoom * config.quantity;
        }
      }
    });
    return total;
  }, [selectedRoomsMap, availableRoomsList]);

  const totalSelectedRoomsCount = useMemo(() => {
    return Object.values(selectedRoomsMap).reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [selectedRoomsMap]);

  // Create Reservation Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateReservationDto) => reservationsApi.create(data),
    onSuccess: (res) => {
      const code = res?.data?.confirmationCode || 'Thành công';
      appMessage.success(`Đặt phòng thành công! Mã xác nhận: ${code}`, 6);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      // Reset form
      setSelectedRoomsMap({});
      setSelectedGuestId(null);
      bookingNotesRef.current = '';
      setBookingNotesResetKey((k) => k + 1);
      // Switch to list tab
      setActiveTab('list');
    },
    onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'Không thể tạo đặt phòng. Vui lòng kiểm tra lại tính khả dụng của phòng.';
      appMessage.error(errorMsg);
    },
  });

  // Stable mutate/pending handles so memoized panes are not invalidated by the
  // mutation observer object changing identity on every render.
  const { mutate: createReservation, isPending: isCreatingReservation } = createMutation;

  const handleCreateReservation = useCallback(() => {
    if (!selectedGuestId) {
      appMessage.warning('Vui lòng chọn khách hàng đặt phòng!');
      return;
    }
    if (totalSelectedRoomsCount === 0) {
      appMessage.warning('Vui lòng chọn ít nhất 1 phòng còn trống!');
      return;
    }

    const roomsPayload = Object.entries(selectedRoomsMap)
      .filter(([, config]) => config.quantity > 0)
      .map(([roomTypeId, config]) => ({
        roomTypeId,
        quantity: config.quantity,
        adults: config.adults,
        children: config.children,
      }));

    if (roomsPayload.length === 0) {
      appMessage.warning('Vui lòng chọn phòng để đặt!');
      return;
    }

    createReservation({
      guestId: selectedGuestId,
      checkInDate: availDateRange[0].format('YYYY-MM-DD'),
      checkOutDate: availDateRange[1].format('YYYY-MM-DD'),
      rooms: roomsPayload,
      bookingSource: selectedSource,
      notes: bookingNotesRef.current.trim() || null,
    });
  }, [
    appMessage,
    availDateRange,
    createReservation,
    selectedGuestId,
    selectedRoomsMap,
    selectedSource,
    totalSelectedRoomsCount,
  ]);

  // ----------------------------------------------------
  // KPI STATS COMPUTATION
  // ----------------------------------------------------
  const stats = useMemo(() => {
    const total = reservations.length;
    const confirmed = reservations.filter((r) => r.status === 'CONFIRMED').length;
    const inHouse = reservations.filter(
      (r) => r.status === 'CHECKED_IN' || r.status === 'PARTIALLY_CHECKED_IN'
    ).length;
    const checkedOut = reservations.filter((r) => r.status === 'CHECKED_OUT').length;
    const cancelled = reservations.filter((r) => r.status === 'CANCELLED').length;
    const noShow = reservations.filter((r) => r.status === 'NO_SHOW').length;
    return { total, confirmed, inHouse, checkedOut, cancelled, noShow };
  }, [reservations]);

  // ----------------------------------------------------
  // TABLE COLUMNS CONFIG
  // ----------------------------------------------------
  const columns = useMemo<ColumnsType<ReservationSummaryItem>>(() => [
    {
      title: 'Mã đặt phòng',
      dataIndex: 'confirmationCode',
      key: 'confirmationCode',
      width: 170,
      render: (code: string) => (
        <Space orientation="vertical" size={2}>
          <Text strong style={{ color: '#1677ff', letterSpacing: 0.5 }}>
            {code}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'guest',
      width: 220,
      render: (_, record) => (
        <Space style={{ whiteSpace: 'nowrap' }}>
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
              flexShrink: 0,
            }}
          >
            <UserOutlined />
          </div>
          <div>
            <Text strong style={{ whiteSpace: 'nowrap' }}>
              {record.bookerGuest?.fullName || 'Chưa cập nhật'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Khoảng thời gian lưu trú',
      key: 'stayDates',
      width: 220,
      render: (_, record) => {
        const checkIn = dayjs(record.checkInDate).format('DD/MM/YYYY');
        const checkOut = dayjs(record.checkOutDate).format('DD/MM/YYYY');
        return (
          <div style={{ whiteSpace: 'nowrap' }}>
            <Space size={4}>
              <CalendarOutlined style={{ color: '#8c8c8c' }} />
              <Text>{checkIn}</Text>
              <RightOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />
              <Text>{checkOut}</Text>
            </Space>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
              {record.totalNights} đêm • {record.totalRooms} phòng
            </div>
          </div>
        );
      },
    },
    {
      title: 'Kênh đặt',
      dataIndex: 'bookingSource',
      key: 'bookingSource',
      width: 140,
      render: (source: BookingSource) => {
        const item = BOOKING_SOURCE_LABELS[source] || { text: source, color: 'default' };
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount: string) => (
        <Text strong style={{ color: '#389e0d', fontSize: 14, whiteSpace: 'nowrap' }}>
          {formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: ReservationStatus) => {
        const conf = STATUS_CONFIG[status] || {
          text: status,
          color: 'default',
          badgeStatus: 'default',
        };
        return <Badge status={conf.badgeStatus} text={<Text strong style={{ whiteSpace: 'nowrap' }}>{conf.text}</Text>} />;
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (createdAt: string) => (
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {dayjs(createdAt).format('DD/MM/YYYY HH:mm')}
        </Text>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 175,
      fixed: screens.xs ? false : 'right',
      render: (_, record) => {
        const isConfirmed = record.status === 'CONFIRMED';
        return (
          <Space size="small">
            <Tooltip title="Xem chi tiết đơn đặt phòng">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedReservationId(record.id);
                  setIsDrawerOpen(true);
                }}
              />
            </Tooltip>
            {canWrite && (record.status === 'CONFIRMED' || record.status === 'PARTIALLY_CHECKED_IN') && (
              <Tooltip title="Làm thủ tục nhận phòng (Check-in)">
                <Button
                  type="text"
                  icon={<LoginOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => navigate(`/stays?tab=arrivals&reservationId=${record.id}`)}
                />
              </Tooltip>
            )}
            {canWrite && isConfirmed && (
              <Tooltip title="Đánh dấu khách không đến (No-Show)">
                <Button
                  type="text"
                  icon={<UserDeleteOutlined style={{ color: '#fa8c16' }} />}
                  onClick={() => handleOpenNoShowModal(record)}
                />
              </Tooltip>
            )}
            {canWrite && isConfirmed && (
              <Tooltip title="Hủy đơn đặt phòng này">
                <Button
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleOpenCancelModal(record)}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ], [canWrite, screens.xs, navigate, handleOpenCancelModal, handleOpenNoShowModal]);

  // Memoized tab pane: the element identity only changes when the values it
  // actually reads change, so unrelated page state (other tab, filters,
  // modals) no longer re-renders this subtree.
  const reservationCreatePane = useMemo(
    () => (
                      <div>
                        {/* Step 1: Availability Search Filter */}
                        <Card
                          title={
                            <Space>
                              <SearchOutlined style={{ color: '#1677ff' }} />
                              <span>1. Tra cứu tình trạng phòng trống thời gian thực</span>
                            </Space>
                          }
                          style={{ marginBottom: 16, borderRadius: 8 }}
                        >
                          <Row gutter={[16, 16]} align="bottom">
                            <Col xs={24} sm={12} md={8}>
                              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                Khoảng ngày lưu trú (Check-in - Check-out):
                              </Text>
                              <RangePicker
                                style={{ width: '100%' }}
                                value={availDateRange}
                                onChange={(dates) => {
                                  if (dates && dates[0] && dates[1]) {
                                    setAvailDateRange([dates[0], dates[1]]);
                                  }
                                }}
                                format="DD/MM/YYYY"
                                allowClear={false}
                                disabledDate={(current) => current && current < dayjs().startOf('day')}
                              />
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                Người lớn / phòng:
                              </Text>
                              <InputNumber
                                min={1}
                                max={10}
                                value={adultsCount}
                                onChange={(val) => setAdultsCount(val || 1)}
                                style={{ width: '100%' }}
                              />
                            </Col>
                            <Col xs={12} sm={6} md={4}>
                              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                Trẻ em / phòng:
                              </Text>
                              <InputNumber
                                min={0}
                                max={10}
                                value={childrenCount}
                                onChange={(val) => setChildrenCount(val || 0)}
                                style={{ width: '100%' }}
                              />
                            </Col>
                            <Col xs={24} sm={12} md={8}>
                              <Button
                                type="primary"
                                icon={<SearchOutlined />}
                                onClick={handleSearchAvailability}
                                loading={isLoadingAvailability}
                                style={{ width: '100%' }}
                              >
                                Kiểm tra Tồn phòng ({totalNightsStay} đêm)
                              </Button>
                            </Col>
                          </Row>
                        </Card>

                        {/* Step 2: Room Selection Cards */}
                        {hasSearchedAvail && (
                          <Card
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                  <HomeOutlined style={{ color: '#52c41a' }} />
                                  <span>
                                    2. Chọn hạng phòng ({availDateRange[0].format('DD/MM/YYYY')} -{' '}
                                    {availDateRange[1].format('DD/MM/YYYY')} • {totalNightsStay} đêm)
                                  </span>
                                </Space>
                                <Tag color="blue">Đã chọn: {totalSelectedRoomsCount} phòng</Tag>
                              </div>
                            }
                            style={{ marginBottom: 16, borderRadius: 8 }}
                          >
                            {isLoadingAvailability ? (
                              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                <Spin size="large" description="Đang kiểm tra dữ liệu phòng trống..." />
                              </div>
                            ) : availableRoomsList.length === 0 ? (
                              <Empty description="Rất tiếc, không còn hạng phòng nào phù hợp trong khoảng thời gian này hoặc đã vượt quá sức chứa!" />
                            ) : (
                              <Row gutter={[16, 16]}>
                                {availableRoomsList.map((item) => {
                                  const selected = selectedRoomsMap[item.roomTypeId] || {
                                    quantity: 0,
                                    adults: adultsCount,
                                    children: childrenCount,
                                  };
                                  const isAvailable = item.availableRooms > 0;
                                  const matchingType = roomTypesList.find((t) => t.id === item.roomTypeId);

                                  return (
                                    <Col xs={24} md={12} lg={8} key={item.roomTypeId}>
                                      <Card
                                        size="small"
                                        variant="outlined"
                                        style={{
                                          borderRadius: 8,
                                          borderColor: selected.quantity > 0 ? '#1677ff' : '#f0f0f0',
                                          backgroundColor: selected.quantity > 0 ? '#f0f7ff' : '#fff',
                                          transition: 'all 0.3s ease',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                          }}
                                        >
                                          <div>
                                            <Text strong style={{ fontSize: 16 }}>
                                              {item.roomTypeName}
                                            </Text>
                                            {matchingType && (
                                              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                                                Tối đa {matchingType.maxAdults} người lớn,{' '}
                                                {matchingType.maxChildren} trẻ em
                                              </div>
                                            )}
                                          </div>
                                          {isAvailable ? (
                                            <Tag color="green">Còn {item.availableRooms} phòng</Tag>
                                          ) : (
                                            <Tag color="red">Hết phòng</Tag>
                                          )}
                                        </div>

                                        <Divider style={{ margin: '10px 0' }} />

                                        <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                                          <Text type="secondary" style={{ fontSize: 12 }}>
                                            Giá gốc / đêm:
                                          </Text>
                                          <Text strong>{formatCurrency(item.basePrice)}</Text>
                                        </Row>

                                        <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                          <Text type="secondary" style={{ fontSize: 12 }}>
                                            Dự toán ({totalNightsStay} đêm / phòng):
                                          </Text>
                                          <Text strong style={{ color: '#389e0d' }}>
                                            {formatCurrency(item.estimatedTotalPerRoom)}
                                          </Text>
                                        </Row>

                                        {isAvailable ? (
                                          <div
                                            style={{
                                              background: selected.quantity > 0 ? '#e6f4ff' : '#fafafa',
                                              padding: 10,
                                              borderRadius: 6,
                                            }}
                                          >
                                            <Row gutter={8} align="middle">
                                              <Col span={12}>
                                                <Text style={{ fontSize: 12 }}>Số lượng phòng:</Text>
                                              </Col>
                                              <Col span={12}>
                                                <InputNumber
                                                  min={0}
                                                  max={item.availableRooms}
                                                  value={selected.quantity}
                                                  onChange={(qty) => {
                                                    setSelectedRoomsMap((prev) => ({
                                                      ...prev,
                                                      [item.roomTypeId]: {
                                                        ...selected,
                                                        quantity: qty || 0,
                                                      },
                                                    }));
                                                  }}
                                                  style={{ width: '100%' }}
                                                />
                                              </Col>
                                            </Row>
                                            {selected.quantity > 0 && (
                                              <>
                                                <Row gutter={8} align="middle" style={{ marginTop: 8 }}>
                                                  <Col span={12}>
                                                    <Text style={{ fontSize: 12 }}>Người lớn / phòng:</Text>
                                                  </Col>
                                                  <Col span={12}>
                                                    <InputNumber
                                                      min={1}
                                                      max={matchingType?.maxAdults || 10}
                                                      value={selected.adults}
                                                      onChange={(ad) => {
                                                        setSelectedRoomsMap((prev) => ({
                                                          ...prev,
                                                          [item.roomTypeId]: {
                                                            ...selected,
                                                            adults: ad || 1,
                                                          },
                                                        }));
                                                      }}
                                                      style={{ width: '100%' }}
                                                    />
                                                  </Col>
                                                </Row>
                                                <Row gutter={8} align="middle" style={{ marginTop: 8 }}>
                                                  <Col span={12}>
                                                    <Text style={{ fontSize: 12 }}>Trẻ em / phòng:</Text>
                                                  </Col>
                                                  <Col span={12}>
                                                    <InputNumber
                                                      min={0}
                                                      max={matchingType?.maxChildren || 10}
                                                      value={selected.children}
                                                      onChange={(ch) => {
                                                        setSelectedRoomsMap((prev) => ({
                                                          ...prev,
                                                          [item.roomTypeId]: {
                                                            ...selected,
                                                            children: ch || 0,
                                                          },
                                                        }));
                                                      }}
                                                      style={{ width: '100%' }}
                                                    />
                                                  </Col>
                                                </Row>
                                              </>
                                            )}
                                          </div>
                                        ) : (
                                          <Alert
                                            type="warning"
                                            showIcon
                                            title="Hạng phòng này hiện đã kín chỗ cho các đêm đã chọn."
                                          />
                                        )}
                                      </Card>
                                    </Col>
                                  );
                                })}
                              </Row>
                            )}
                          </Card>
                        )}

                        {/* Step 3: Guest & Reservation Confirmation */}
                        {hasSearchedAvail && (
                          <Card
                            title={
                              <Space>
                                <UserOutlined style={{ color: '#fa8c16' }} />
                                <span>3. Thông tin người đặt & Xác nhận đặt phòng</span>
                              </Space>
                            }
                            style={{ borderRadius: 8 }}
                          >
                            <Row gutter={[24, 16]}>
                              <Col xs={24} md={12}>
                                <div style={{ marginBottom: 16 }}>
                                  <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                    Khách hàng đặt phòng (Booker Guest): <span style={{ color: '#ff4d4f' }}>*</span>
                                  </Text>
                                  <Select
                                    showSearch
                                    placeholder="Tìm kiếm theo họ tên hoặc số điện thoại khách hàng"
                                    value={selectedGuestId}
                                    onChange={(val) => setSelectedGuestId(val)}
                                    loading={isLoadingGuests}
                                    style={{ width: '100%' }}
                                    filterOption={(input, option) =>
                                      (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={guestsList.map((g) => ({
                                      value: g.id,
                                      label: `${g.fullName} - ${g.phone || 'Không có SĐT'} (${g.nationality || 'VN'})`,
                                    }))}
                                  />
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                  <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                    Nguồn đặt phòng (Booking Source):
                                  </Text>
                                  <Select
                                    value={selectedSource}
                                    onChange={(val) => setSelectedSource(val)}
                                    style={{ width: '100%' }}
                                    options={[
                                      { label: 'Trực tiếp (DIRECT)', value: 'DIRECT' },
                                      { label: 'Điện thoại (PHONE)', value: 'PHONE' },
                                      { label: 'Email (EMAIL)', value: 'EMAIL' },
                                      { label: 'Khách vãng lai (WALK_IN)', value: 'WALK_IN' },
                                      { label: 'Đại lý / OTA (AGENT)', value: 'AGENT' },
                                      { label: 'Khác (OTHER)', value: 'OTHER' },
                                    ]}
                                  />
                                </div>

                                <div style={{ paddingBottom: 16 }}>
                                  <Text strong style={{ display: 'block', marginBottom: 6 }}>
                                    Ghi chú đặt phòng (Yêu cầu đặc biệt):
                                  </Text>
                                  <BookingNotesInput
                                    initialValue=""
                                    resetKey={bookingNotesResetKey}
                                    onChange={(val) => {
                                      bookingNotesRef.current = val;
                                    }}
                                  />
                                </div>
                              </Col>

                              <Col xs={24} md={12}>
                                <div
                                  style={{
                                    background: '#fafafa',
                                    padding: 16,
                                    borderRadius: 8,
                                    border: '1px solid #f0f0f0',
                                  }}
                                >
                                  <Title level={5} style={{ marginTop: 0 }}>
                                    Tóm tắt chi phí đặt phòng
                                  </Title>
                                  <Descriptions column={1} size="small" bordered={false}>
                                    <Descriptions.Item label="Thời gian nhận/trả">
                                      {availDateRange[0].format('DD/MM/YYYY')} -{' '}
                                      {availDateRange[1].format('DD/MM/YYYY')} ({totalNightsStay} đêm)
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Tổng số phòng">
                                      <Text strong>{totalSelectedRoomsCount} phòng</Text>
                                    </Descriptions.Item>
                                  </Descriptions>

                                  <Divider style={{ margin: '12px 0' }} />

                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'baseline',
                                      marginBottom: 16,
                                    }}
                                  >
                                    <Text strong style={{ fontSize: 16 }}>
                                      TỔNG TIỀN DỰ TOÁN:
                                    </Text>
                                    <Text strong style={{ fontSize: 22, color: '#389e0d' }}>
                                      {formatCurrency(calculatedTotalAmount)}
                                    </Text>
                                  </div>

                                  <Button
                                    type="primary"
                                    size="large"
                                    block
                                    icon={<CheckCircleOutlined />}
                                    disabled={totalSelectedRoomsCount === 0 || !selectedGuestId}
                                    loading={isCreatingReservation}
                                    onClick={handleCreateReservation}
                                  >
                                    Xác nhận Tạo Đặt phòng
                                  </Button>
                                  {totalSelectedRoomsCount === 0 && (
                                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 8, fontSize: 12 }}>
                                      Vui lòng chọn số lượng phòng từ bước 2
                                    </Text>
                                  )}
                                </div>
                              </Col>
                            </Row>
                          </Card>
                        )}
                      </div>
    ),
    [adultsCount, availDateRange, availableRoomsList, bookingNotesRef, bookingNotesResetKey, calculatedTotalAmount, childrenCount, guestsList, handleCreateReservation, handleSearchAvailability, hasSearchedAvail, isCreatingReservation, isLoadingAvailability, isLoadingGuests, roomTypesList, selectedGuestId, selectedRoomsMap, selectedSource, setAdultsCount, setAvailDateRange, setChildrenCount, setSelectedGuestId, setSelectedRoomsMap, setSelectedSource, totalNightsStay, totalSelectedRoomsCount]
  );

  // Memoized tab pane: the element identity only changes when the values it
  // actually reads change, so unrelated page state (other tab, filters,
  // modals) no longer re-renders this subtree.
  const reservationListPane = useMemo(
    () => (
                <>
                  {/* KPI Stat Cards */}
                  <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 16 }}>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{ height: '100%', borderRadius: 8, background: '#fafafa' }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Tổng số đơn
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1f1f1f', marginTop: 4 }}>
                          {stats.total}
                        </div>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{
                          height: '100%',
                          borderRadius: 8,
                          borderColor: '#91caff',
                          background: '#e6f4ff',
                        }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text style={{ fontSize: 12, color: '#0958d9' }}>
                          Đã xác nhận (CONFIRMED)
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#0958d9', marginTop: 4 }}>
                          {stats.confirmed}
                        </div>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{
                          height: '100%',
                          borderRadius: 8,
                          borderColor: '#b7eb8f',
                          background: '#f6ffed',
                        }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text style={{ fontSize: 12, color: '#389e0d' }}>
                          Đang lưu trú (CHECKED_IN)
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#389e0d', marginTop: 4 }}>
                          {stats.inHouse}
                        </div>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{
                          height: '100%',
                          borderRadius: 8,
                          borderColor: '#d3adf7',
                          background: '#f9f0ff',
                        }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text style={{ fontSize: 12, color: '#531dab' }}>
                          Đã trả phòng (CHECKED_OUT)
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#531dab', marginTop: 4 }}>
                          {stats.checkedOut}
                        </div>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{
                          height: '100%',
                          borderRadius: 8,
                          borderColor: '#ffa39e',
                          background: '#fff1f0',
                        }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text style={{ fontSize: 12, color: '#cf1322' }}>
                          Đã hủy (CANCELLED)
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#cf1322', marginTop: 4 }}>
                          {stats.cancelled}
                        </div>
                      </Card>
                    </Col>
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        size="small"
                        variant="outlined"
                        className="pms-kpi-card"
                        style={{
                          height: '100%',
                          borderRadius: 8,
                          borderColor: '#ffd591',
                          background: '#fff7e6',
                        }}
                        styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                      >
                        <Text style={{ fontSize: 12, color: '#d46b08' }}>
                          Không đến (NO_SHOW)
                        </Text>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#d46b08', marginTop: 4 }}>
                          {stats.noShow}
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Filter Bar */}
                  <ReservationFilterBar
                    isAccountant={isAccountant}
                    onCodePendingChange={handleCodePendingChange}
                    onGuestPendingChange={handleGuestPendingChange}
                    searchCode={searchCode}
                    setSearchCode={setSearchCode}
                    guestSearch={guestSearch}
                    setGuestSearch={setGuestSearch}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    sourceFilter={sourceFilter}
                    setSourceFilter={setSourceFilter}
                    dateRangeFilter={dateRangeFilter}
                    setDateRangeFilter={setDateRangeFilter}
                  />

                  {/* Accountant notice if applicable */}
                  {isAccountant && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title="Quyền Kế toán (ACCOUNTANT)"
                      description="Bạn đang xem danh sách đơn đặt phòng phục vụ đối soát tài chính. Tính năng tạo mới, hủy đơn và tra cứu định danh khách lưu trú được giới hạn cho bộ phận Lễ tân."
                    />
                  )}

                  {/* Reservations Table */}
                  <ReservationsTable
                    columns={columns}
                    data={tableReservations}
                    loading={isLoadingReservations}
                    canWrite={canWrite}
                  />
                </>
    ),
    [canWrite, columns, dateRangeFilter, guestSearch, handleCodePendingChange, handleGuestPendingChange, isAccountant, isLoadingReservations, searchCode, setDateRangeFilter, setGuestSearch, setSearchCode, setSourceFilter, setStatusFilter, sourceFilter, stats, statusFilter, tableReservations]
  );

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
            Quản lý Đặt phòng (Reservations)
          </Title>
          <Text type="secondary">
            Tra cứu tình trạng phòng trống thời gian thực, tạo đơn đặt phòng mới và quản lý vòng đời đơn
          </Text>
        </div>
        <Space>
          {isUpdating && (
            <Space size={6} role="status" aria-live="polite">
              <Spin size="small" spinning />
              <Text type="secondary" style={{ fontSize: 12 }}>Đang cập nhật kết quả…</Text>
            </Space>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchReservations();
              if (hasSearchedAvail) refetchAvailability();
            }}
          >
            Làm mới
          </Button>
          {canWrite && (
            <Button
              type="primary"
              icon={activeTab === 'list' ? <PlusOutlined /> : <CalendarOutlined />}
              onClick={() => setActiveTab(activeTab === 'list' ? 'create' : 'list')}
            >
              {activeTab === 'list' ? 'Tạo Đặt phòng Mới' : 'Quay lại Danh sách'}
            </Button>
          )}
        </Space>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'list' | 'create')}
        items={[
          {
            key: 'list',
            label: (
              <span>
                <CalendarOutlined /> Danh sách Đơn đặt phòng ({stats.total})
              </span>
            ),
            children: reservationListPane,
          },
          ...(canWrite
            ? [
                {
                  key: 'create',
                  label: (
                    <span>
                      <ShoppingCartOutlined /> Tra cứu Phòng trống & Đặt phòng Mới
                    </span>
                  ),
                  children: reservationCreatePane,
                },
              ]
            : []),
        ]}
      />

      {/* ---------------------------------------------------- */}
      {/* RESERVATION DETAIL DRAWER */}
      {/* ---------------------------------------------------- */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 24 }}>
            <Space>
              <FileTextOutlined style={{ color: '#1677ff' }} />
              <span>Chi tiết Đơn đặt phòng</span>
            </Space>
            {reservationDetail && (
              <Badge
                status={STATUS_CONFIG[reservationDetail.status]?.badgeStatus || 'default'}
                text={<Text strong>{STATUS_CONFIG[reservationDetail.status]?.text || reservationDetail.status}</Text>}
              />
            )}
          </div>
        }
        size={screens.xs ? '100%' : screens.sm ? 560 : 720}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedReservationId(null);
        }}
        extra={
          canWrite && reservationDetail && (reservationDetail.status === 'CONFIRMED' || reservationDetail.status === 'PARTIALLY_CHECKED_IN') ? (
            <Space>
              {reservationDetail.status === 'CONFIRMED' && (
                <Button
                  danger
                  size="small"
                  icon={<UserDeleteOutlined />}
                  onClick={() => handleOpenNoShowModal(reservationDetail)}
                >
                  No-Show
                </Button>
              )}
              <Button
                type="primary"
                size="small"
                icon={<LoginOutlined />}
                style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate(`/stays?tab=arrivals&reservationId=${reservationDetail.id}`);
                }}
              >
                Làm thủ tục Check-in
              </Button>
            </Space>
          ) : null
        }
      >
        {isLoadingDetail || !reservationDetail ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin description="Đang tải thông tin chi tiết đơn..." />
          </div>
        ) : (
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            {/* Summary card */}
            <Card size="small" style={{ borderRadius: 8, background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Row justify="space-between" align="middle">
                <div>
                  <Text type="secondary">Mã xác nhận (Confirmation Code):</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff', letterSpacing: 0.5 }}>
                    {reservationDetail.confirmationCode}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text type="secondary">Tổng thanh toán:</Text>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#389e0d' }}>
                    {formatCurrency(reservationDetail.totalAmount)}
                  </div>
                </div>
              </Row>
            </Card>

            {/* Guest & Reservation Metadata */}
            <Descriptions title="1. Thông tin Người đặt & Kênh bán" bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Khách hàng">
                <Text strong>{reservationDetail.bookerGuest?.fullName}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Kênh đặt phòng">
                <Tag color={BOOKING_SOURCE_LABELS[reservationDetail.bookingSource]?.color || 'default'}>
                  {BOOKING_SOURCE_LABELS[reservationDetail.bookingSource]?.text || reservationDetail.bookingSource}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người tạo đơn">
                {reservationDetail.createdBy?.fullName || 'Hệ thống'}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian tạo">
                {dayjs(reservationDetail.createdAt).format('DD/MM/YYYY HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {/* Stay Dates */}
            <div>
              <Title level={5} style={{ marginBottom: 8, fontSize: 14 }}>
                2. Lịch trình lưu trú
              </Title>
              <Card
                size="small"
                style={{
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                  {/* Check-in */}
                  <Col xs={24} sm={10}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: '#e6f4ff',
                          color: '#0958d9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        }}
                      >
                        <CalendarOutlined />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Nhận phòng (Check-in):
                        </Text>
                        <Text strong style={{ fontSize: 16, color: '#0958d9', whiteSpace: 'nowrap' }}>
                          {dayjs(reservationDetail.checkInDate).format('DD/MM/YYYY')}
                        </Text>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {formatDayOfWeek(reservationDetail.checkInDate)} • Sau 14:00
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* Middle Duration Badge */}
                  <Col xs={24} sm={4} style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <Tag
                        color="blue"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '2px 10px',
                          borderRadius: 12,
                          margin: 0,
                        }}
                      >
                        {reservationDetail.totalNights} đêm
                      </Tag>
                      <RightOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
                      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {reservationDetail.totalRooms} phòng
                      </Text>
                    </div>
                  </Col>

                  {/* Check-out */}
                  <Col xs={24} sm={10}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          backgroundColor: '#f6ffed',
                          color: '#389e0d',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 20,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                        }}
                      >
                        <CalendarOutlined />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                          Trả phòng (Check-out):
                        </Text>
                        <Text strong style={{ fontSize: 16, color: '#389e0d', whiteSpace: 'nowrap' }}>
                          {dayjs(reservationDetail.checkOutDate).format('DD/MM/YYYY')}
                        </Text>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {formatDayOfWeek(reservationDetail.checkOutDate)} • Trước 12:00
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card>
            </div>

            {/* Room breakdown & Nightly Rates */}
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                3. Danh sách phòng & Bảng giá từng đêm ({reservationDetail.rooms?.length || 0} phòng)
              </Title>
              {reservationDetail.rooms?.map((room, index) => (
                <Card
                  key={room.id}
                  size="small"
                  style={{ marginBottom: 12, borderRadius: 8 }}
                  title={
                    <Space>
                      <HomeOutlined style={{ color: '#1677ff' }} />
                      <span>
                        Phòng {index + 1}: {room.roomType?.name} ({room.roomType?.code})
                      </span>
                    </Space>
                  }
                  extra={
                    <Space>
                      <Tag color="blue">{room.adults} Người lớn</Tag>
                      {room.children > 0 && <Tag color="green">{room.children} Trẻ em</Tag>}
                      {room.roomId ? (
                        <Tag color="purple">Phòng #{getPhysicalRoomNumber(room.roomId)}</Tag>
                      ) : (
                        <Tag color="default">Chưa gán phòng vật lý</Tag>
                      )}
                    </Space>
                  }
                >
                  <Table
                    size="small"
                    pagination={false}
                    dataSource={room.nights}
                    rowKey="stayDate"
                    columns={[
                      {
                        title: 'Ngày lưu trú (Stay Date)',
                        dataIndex: 'stayDate',
                        key: 'stayDate',
                        render: (date: string) => `${dayjs(date).format('DD/MM/YYYY')} (${formatDayOfWeek(date)})`,
                      },
                      {
                        title: 'Giá phòng / đêm (VND)',
                        dataIndex: 'nightlyRate',
                        key: 'nightlyRate',
                        align: 'right',
                        render: (rate: string) => (
                          <Text strong style={{ color: '#389e0d' }}>
                            {formatCurrency(rate)}
                          </Text>
                        ),
                      },
                    ]}
                  />
                </Card>
              ))}
            </div>

            {/* Notes */}
            {reservationDetail.notes && (
              <Card size="small" title="4. Ghi chú yêu cầu đặc biệt" style={{ borderRadius: 8 }}>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  {reservationDetail.notes}
                </Paragraph>
              </Card>
            )}

            {/* Cancellation / No-Show info (if the booking is closed) */}
            {reservationDetail.cancellation && (
              <Alert
                type={reservationDetail.status === 'NO_SHOW' ? 'warning' : 'error'}
                showIcon
                icon={
                  reservationDetail.status === 'NO_SHOW' ? <UserDeleteOutlined /> : <StopOutlined />
                }
                title={
                  reservationDetail.status === 'NO_SHOW'
                    ? `Khách không đến (No-Show) — ghi nhận lúc ${dayjs(
                        reservationDetail.cancellation.cancelledAt
                      ).format('DD/MM/YYYY HH:mm:ss')}`
                    : `Đơn đặt phòng đã bị hủy vào ${dayjs(
                        reservationDetail.cancellation.cancelledAt
                      ).format('DD/MM/YYYY HH:mm:ss')}`
                }
                description={
                  <div>
                    {reservationDetail.cancellation.cancelledBy && (
                      <div>
                        {reservationDetail.status === 'NO_SHOW'
                          ? 'Nhân viên ghi nhận: '
                          : 'Người thực hiện hủy: '}
                        <strong>{reservationDetail.cancellation.cancelledBy.fullName}</strong>
                      </div>
                    )}
                    {reservationDetail.cancellation.reason && (
                      <div style={{ marginTop: 4 }}>
                        {reservationDetail.status === 'NO_SHOW'
                          ? 'Lý do khách không đến: '
                          : 'Lý do hủy: '}
                        <em>{reservationDetail.cancellation.reason}</em>
                      </div>
                    )}
                  </div>
                }
              />
            )}
          </Space>
        )}
      </Drawer>

      {/* ---------------------------------------------------- */}
      {/* CANCEL RESERVATION MODAL */}
      {/* ---------------------------------------------------- */}
      <CancelReservationModal
        open={cancelModalVisible}
        reservation={cancellingReservation}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancellingReservation(null);
        }}
        onConfirm={handleConfirmCancel}
      />

      {/* ---------------------------------------------------- */}
      {/* NO-SHOW RESERVATION MODAL */}
      {/* ---------------------------------------------------- */}
      <NoShowReservationModal
        open={noShowModalVisible}
        reservation={noShowReservation}
        confirmLoading={noShowMutation.isPending}
        onCancel={() => {
          setNoShowModalVisible(false);
          setNoShowReservation(null);
        }}
        onConfirm={handleConfirmNoShow}
      />
    </div>
  );
};

export default ReservationsPage;
