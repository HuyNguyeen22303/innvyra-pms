import React, { useState, useMemo } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Modal,
  Form,
  InputNumber,
  Radio,
  Checkbox,
  Table,
  Tabs,
  Alert,
  Tooltip,
  message,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DollarOutlined,
  FileTextOutlined,
  PrinterOutlined,
  RollbackOutlined,
  FormOutlined,
  LockOutlined,
  UnlockOutlined,
  SearchOutlined,
  ReloadOutlined,
  LeftOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { billingApi, createIdempotencyKey } from '../../../api/billing.api.ts';
import { reservationsApi } from '../../../api/reservations.api.ts';
import { roomsApi } from '../../../api/rooms.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import type { ReservationStatus, ReservationSummaryItem } from '../../../types/reservations.types.ts';
import type {
  FolioDetailItem,
  FolioItemRecord,
  PaymentRecord,
  CreatePaymentDto,
  CreateRefundDto,
  CreateAdjustmentDto,
} from '../../../types/billing.types.ts';
import { useStaffDirectory } from '../../../utils/staffDirectory.ts';
import { ReceiptModal } from './ReceiptModal.tsx';

const { Text } = Typography;

const getApiErrorMessage = (err: any, fallback: string): string => {
  const errData = err.response?.data;
  const details = errData?.error?.details || errData?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((d: any) => `${d.path ? d.path + ': ' : ''}${d.message}`).join('; ');
  }
  return errData?.error?.message || errData?.message || fallback;
};

export const FolioTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const userRole = user?.role || '';
  const canOpenOrPay = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'].includes(userRole);
  const canSettleOrAdjust = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);

  // Selected Reservation
  const [selectedReservationId, setSelectedReservationId] = useState<string>('');

  // Active Sub-tab in Folio
  const [activeLedgerTab, setActiveLedgerTab] = useState<string>('items');

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState<boolean>(false);
  const [isCloseFolioModalOpen, setIsCloseFolioModalOpen] = useState<boolean>(false);

  // Receipt Modal
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentRecord | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Target Payment for Refund
  const [targetPaymentForRefund, setTargetPaymentForRefund] = useState<PaymentRecord | null>(null);

  // Forms
  const [paymentForm] = Form.useForm();
  const [adjustmentForm] = Form.useForm();
  const [refundForm] = Form.useForm();

  // Watchers for Payment Form
  const paymentMethodWatch = Form.useWatch('paymentMethod', paymentForm);

  // Watchers for Adjustment Form
  const entryTypeWatch = Form.useWatch('entryType', adjustmentForm);

  // Pagination
  const [itemsPage, setItemsPage] = useState<number>(1);
  const [paymentsPage, setPaymentsPage] = useState<number>(1);

  // ----------------------------------------------------
  // QUERIES
  // ----------------------------------------------------

  // Reservation Table Filters (when viewing all reservations)
  const [resTableSearch, setResTableSearch] = useState<string>('');
  const [resTableStatus, setResTableStatus] = useState<ReservationStatus | undefined>(undefined);
  const [resTablePage, setResTablePage] = useState<number>(1);
  const [resTablePageSize, setResTablePageSize] = useState<number>(10);

  // Dynamic staff directory hook for instant name resolution
  const { getStaff } = useStaffDirectory();

  // 1. Reservations list with pagination & filters
  const {
    data: reservationsRes,
    isLoading: isReservationsLoading,
    refetch: refetchReservations,
  } = useQuery({
    queryKey: ['billing-reservations-list', resTablePage, resTablePageSize, resTableSearch, resTableStatus],
    queryFn: () =>
      reservationsApi.getAll({
        page: resTablePage,
        limit: resTablePageSize,
        search: resTableSearch.trim() || undefined,
        status: resTableStatus || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const reservationList = reservationsRes?.data?.items || [];
  const reservationTotal = reservationsRes?.data?.pagination?.total || 0;

  // Fetch physical rooms to map roomId to real physical roomNumber
  const { data: allRoomsRes } = useQuery({
    queryKey: ['allRoomsForLookup'],
    queryFn: () => roomsApi.getAll({ limit: 100 }),
    staleTime: 60000,
  });
  const allRoomsList = useMemo(() => {
    const raw = allRoomsRes?.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any)?.items)) return (raw as any).items;
    return [];
  }, [allRoomsRes]);

  const getPhysicalRoomNumber = (roomId: string | null | undefined): string => {
    if (!roomId) return '';
    const found = allRoomsList.find((r: any) => String(r.id) === String(roomId));
    return found ? found.roomNumber : roomId;
  };

  // Batch check Folio status for visible reservations on the current table page
  const folioQueries = useQueries({
    queries: reservationList.map((r) => ({
      queryKey: ['billing-folio-check', String(r.id)],
      queryFn: async () => {
        try {
          const res = await billingApi.getFolioByReservation(String(r.id));
          return {
            resId: String(r.id),
            status: res.data.status,
            folioId: res.data.id,
            closedAt: res.data.closedAt,
            balanceAmount: res.data.outstandingBalance,
          };
        } catch (err: any) {
          if (err.response?.status === 404) {
            return {
              resId: String(r.id),
              status: 'NOT_OPENED' as const,
              folioId: null,
              closedAt: null,
              balanceAmount: null,
            };
          }
          return {
            resId: String(r.id),
            status: 'UNKNOWN' as const,
            folioId: null,
            closedAt: null,
            balanceAmount: null,
          };
        }
      },
      staleTime: 15000,
      retry: false,
    })),
  });

  const folioStatusMap = useMemo(() => {
    const map: Record<
      string,
      {
        status: 'OPEN' | 'CLOSED' | 'NOT_OPENED' | 'UNKNOWN' | 'LOADING';
        folioId?: string | null;
        closedAt?: string | null;
        balanceAmount?: string | null;
      }
    > = {};
    reservationList.forEach((r, idx) => {
      const q = folioQueries[idx];
      if (!q || q.isLoading) {
        map[String(r.id)] = { status: 'LOADING' };
      } else if (q.data) {
        map[String(r.id)] = q.data;
      } else {
        map[String(r.id)] = { status: 'UNKNOWN' };
      }
    });
    return map;
  }, [folioQueries, reservationList]);

  // 2. Selected Reservation Detail
  const { data: reservationDetailRes } = useQuery({
    queryKey: ['billing-reservation-detail', selectedReservationId],
    queryFn: () =>
      selectedReservationId
        ? reservationsApi.getById(selectedReservationId)
        : Promise.resolve({ success: true, message: '', data: null as any }),
    enabled: !!selectedReservationId,
  });

  const reservationDetail = reservationDetailRes?.data;

  // 3. Folio Query for selected reservation
  const {
    data: folioRes,
    isLoading: isFolioLoading,
    error: folioError,
    refetch: refetchFolio,
  } = useQuery({
    queryKey: ['billing-folio', selectedReservationId],
    queryFn: () =>
      selectedReservationId
        ? billingApi.getFolioByReservation(selectedReservationId)
        : Promise.resolve({ success: true, message: '', data: null as any }),
    enabled: !!selectedReservationId,
    retry: false,
  });

  const folio: FolioDetailItem | null = folioRes?.data || null;
  const isFolioNotFound =
    (folioError as any)?.response?.status === 404 ||
    (folioError as any)?.response?.data?.error?.code === 'FOLIO_NOT_FOUND';

  // 4. Folio Items (Ledger) Query
  const {
    data: folioItemsRes,
    isLoading: isItemsLoading,
  } = useQuery({
    queryKey: ['billing-folio-items', folio?.id, itemsPage],
    queryFn: () =>
      folio?.id
        ? billingApi.getFolioItems(folio.id, { page: itemsPage, limit: 20 })
        : Promise.resolve({ success: true, message: '', data: { items: [], pagination: {} } as any }),
    enabled: !!folio?.id,
  });

  const folioItems: FolioItemRecord[] = folioItemsRes?.data?.items || [];
  const itemsTotal = folioItemsRes?.data?.pagination?.total || 0;

  // 5. Folio Payments Query
  const {
    data: paymentsRes,
    isLoading: isPaymentsLoading,
  } = useQuery({
    queryKey: ['billing-folio-payments', folio?.id, paymentsPage],
    queryFn: () =>
      folio?.id
        ? billingApi.getPayments(folio.id, { page: paymentsPage, limit: 20 })
        : Promise.resolve({ success: true, message: '', data: { items: [], pagination: {} } as any }),
    enabled: !!folio?.id,
  });

  const paymentList: PaymentRecord[] = paymentsRes?.data?.items || [];
  const paymentsTotal = paymentsRes?.data?.pagination?.total || 0;

  // ----------------------------------------------------
  // MUTATIONS
  // ----------------------------------------------------

  // 1. Open Folio
  const openFolioMutation = useMutation({
    mutationFn: (resId: string) => billingApi.openFolio(resId),
    onSuccess: () => {
      message.success('Đã mở Sổ công nợ Folio thành công! Toàn bộ tiền phòng đã được ghi nợ.');
      queryClient.invalidateQueries({ queryKey: ['billing-folio', selectedReservationId] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio-items'] });
    },
    onError: (err: any) => {
      message.error(getApiErrorMessage(err, 'Không thể mở Sổ công nợ Folio.'));
    },
  });

  // 2. Create Payment / Deposit
  const paymentMutation = useMutation({
    mutationFn: ({ folioId, dto }: { folioId: string; dto: CreatePaymentDto }) =>
      billingApi.createPayment(folioId, dto, createIdempotencyKey('pay')),
    onSuccess: () => {
      message.success('Ghi nhận giao dịch thu tiền thành công!');
      setIsPaymentModalOpen(false);
      paymentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-folio', selectedReservationId] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio-payments'] });
    },
    onError: (err: any) => {
      message.error(getApiErrorMessage(err, 'Không thể ghi nhận thu tiền.'));
    },
  });

  // 3. Create Adjustment
  const adjustmentMutation = useMutation({
    mutationFn: ({ folioId, dto }: { folioId: string; dto: CreateAdjustmentDto }) =>
      billingApi.createAdjustment(folioId, dto, createIdempotencyKey('adj')),
    onSuccess: () => {
      message.success('Điều chỉnh công nợ Folio thành công!');
      setIsAdjustmentModalOpen(false);
      adjustmentForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-folio', selectedReservationId] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio-items'] });
    },
    onError: (err: any) => {
      message.error(getApiErrorMessage(err, 'Không thể điều chỉnh công nợ.'));
    },
  });

  // 4. Create Refund
  const refundMutation = useMutation({
    mutationFn: ({ paymentId, dto }: { paymentId: string; dto: CreateRefundDto }) =>
      billingApi.createRefund(paymentId, dto, createIdempotencyKey('ref')),
    onSuccess: () => {
      message.success('Ghi nhận hoàn tiền thành công! Số dư nợ đã được cập nhật.');
      setIsRefundModalOpen(false);
      setTargetPaymentForRefund(null);
      refundForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['billing-folio', selectedReservationId] });
      queryClient.invalidateQueries({ queryKey: ['billing-folio-payments'] });
    },
    onError: (err: any) => {
      message.error(getApiErrorMessage(err, 'Không thể ghi nhận hoàn tiền.'));
    },
  });

  // 5. Close Folio
  const closeFolioMutation = useMutation({
    mutationFn: (folioId: string) => billingApi.closeFolio(folioId),
    onSuccess: () => {
      message.success('Đã đóng quyết toán Sổ công nợ Folio thành công! Trạng thái: CLOSED.');
      setIsCloseFolioModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['billing-folio', selectedReservationId] });
    },
    onError: (err: any) => {
      message.error(
        getApiErrorMessage(
          err,
          'Không thể đóng Folio. Vui lòng kiểm tra: số dư phải bằng 0, không còn order requested và khách đã check-out.'
        )
      );
    },
  });

  const formatVND = (amount: string | number | null | undefined): string => {
    if (!amount) return '0 ₫';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? '0 ₫' : num.toLocaleString('vi-VN') + ' ₫';
  };

  // ----------------------------------------------------
  // TABLE COLUMNS
  // ----------------------------------------------------

  // 1. Folio Items Columns
  const itemColumns: ColumnsType<FolioItemRecord> = [
    {
      title: 'Mã mục',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: string) => <Text style={{ fontFamily: 'monospace' }}>#{id}</Text>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Loại',
      dataIndex: 'entryType',
      key: 'entryType',
      width: 110,
      render: (type: string) => (
        <Tag color={type === 'DEBIT' ? 'volcano' : 'green'} style={{ fontWeight: 600 }}>
          {type === 'DEBIT' ? 'Ghi nợ (+)' : 'Ghi có (-)'}
        </Tag>
      ),
    },
    {
      title: 'Nguồn phát sinh',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 160,
      render: (source: string) => {
        switch (source) {
          case 'ROOM_NIGHT':
            return <Tag color="blue">Tiền phòng (Room Night)</Tag>;
          case 'SERVICE_ORDER_ITEM':
            return <Tag color="purple">Dịch vụ (Service)</Tag>;
          case 'MANUAL_ADJUSTMENT':
            return <Tag color="orange">Điều chỉnh thủ công</Tag>;
          default:
            return <Tag>{source}</Tag>;
        }
      },
    },
    {
      title: 'Diễn giải chi tiết',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <Text>{desc}</Text>,
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amt: string, record) => (
        <Text
          strong
          style={{
            fontSize: 14,
            color: record.entryType === 'DEBIT' ? '#cf1322' : '#389e0d',
          }}
        >
          {record.entryType === 'DEBIT' ? `+${formatVND(amt)}` : `-${formatVND(amt)}`}
        </Text>
      ),
    },
    {
      title: 'Người ghi',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 150,
      render: (staffId: string) => {
        const staff = getStaff(staffId);
        return (
          <span style={{ fontSize: 12 }}>
            <Text strong>{staff.fullName}</Text>{' '}
            <Tag color={staff.color} style={{ fontSize: 10, margin: 0 }}>{staff.roleTitle}</Tag>
          </span>
        );
      },
    },
  ];

  // 2. Payments Columns
  const paymentColumns: ColumnsType<PaymentRecord> = [
    {
      title: 'Mã GD',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: string) => <Text style={{ fontFamily: 'monospace' }}>#{id}</Text>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'processedAt',
      key: 'processedAt',
      width: 150,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Phân loại',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 140,
      render: (type: string) => {
        switch (type) {
          case 'PAYMENT':
            return <Tag color="success" style={{ fontWeight: 600 }}>Thanh toán (Payment)</Tag>;
          case 'DEPOSIT':
            return <Tag color="processing" style={{ fontWeight: 600 }}>Đặt cọc (Deposit)</Tag>;
          case 'REFUND':
            return <Tag color="error" style={{ fontWeight: 600 }}>Hoàn tiền (Refund)</Tag>;
          default:
            return <Tag>{type}</Tag>;
        }
      },
    },
    {
      title: 'Phương thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 150,
      render: (method: string) => (
        <Tag color={method === 'CASH' ? 'green' : 'blue'}>
          {method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
        </Tag>
      ),
    },
    {
      title: 'Mã tham chiếu / Lý do',
      key: 'refOrReason',
      render: (_, record) => (
        <div>
          {record.referenceNumber && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>Mã GD ngân hàng:</Text>{' '}
              <Text code style={{ fontSize: 12 }}>{record.referenceNumber}</Text>
            </div>
          )}
          {record.reason && (
            <div style={{ fontSize: 12, color: '#595959' }}>
              💬 {record.reason}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amt: string, record) => (
        <Text
          strong
          style={{
            fontSize: 14,
            color: record.paymentType === 'REFUND' ? '#cf1322' : '#389e0d',
          }}
        >
          {record.paymentType === 'REFUND' ? `-${formatVND(amt)}` : `+${formatVND(amt)}`}
        </Text>
      ),
    },
    {
      title: 'Người thu',
      dataIndex: 'processedBy',
      key: 'processedBy',
      width: 150,
      render: (staffId: string) => {
        const staff = getStaff(staffId);
        return (
          <span style={{ fontSize: 12 }}>
            <Text strong>{staff.fullName}</Text>{' '}
            <Tag color={staff.color} style={{ fontSize: 10, margin: 0 }}>{staff.roleTitle}</Tag>
          </span>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      render: (_, record) => {
        const canRefundThis =
          canSettleOrAdjust &&
          record.status === 'CONFIRMED' &&
          ['PAYMENT', 'DEPOSIT'].includes(record.paymentType) &&
          folio?.status === 'OPEN';

        return (
          <Space size={6}>
            <Tooltip title="Xem & In phiếu thu">
              <Button
                size="small"
                icon={<PrinterOutlined />}
                onClick={() => {
                  setSelectedPaymentForReceipt(record);
                  setIsReceiptModalOpen(true);
                }}
              />
            </Tooltip>
            {canRefundThis && (
              <Tooltip title="Ghi nhận hoàn trả tiền">
                <Button
                  size="small"
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    setTargetPaymentForRefund(record);
                    refundForm.setFieldsValue({
                      amount: parseFloat(record.amount),
                      reason: undefined,
                      referenceNumber: undefined,
                      confirmedRefunded: false,
                    });
                    setIsRefundModalOpen(true);
                  }}
                >
                  Hoàn tiền
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const renderReservationStatusTag = (status: ReservationStatus) => {
    switch (status) {
      case 'CHECKED_IN':
        return <Tag color="success">Đang ở (CHECKED_IN)</Tag>;
      case 'PARTIALLY_CHECKED_IN':
        return <Tag color="processing">Nhận phòng 1 phần</Tag>;
      case 'CONFIRMED':
        return <Tag color="blue">Đã xác nhận (CONFIRMED)</Tag>;
      case 'CHECKED_OUT':
        return <Tag color="default">Đã trả phòng (CHECKED_OUT)</Tag>;
      case 'CANCELLED':
        return <Tag color="error">Đã hủy (CANCELLED)</Tag>;
      case 'NO_SHOW':
        return <Tag color="warning">Không đến (NO_SHOW)</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const reservationColumns: ColumnsType<ReservationSummaryItem> = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id: string, record) => (
        <div>
          <Text strong style={{ color: '#1b4d3e', fontFamily: 'monospace', fontSize: 13 }}>
            #{id}
          </Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.confirmationCode}</div>
        </div>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'bookerGuest',
      render: (_, record) => (
        <div>
          <Text strong>{record.bookerGuest?.fullName || 'Khách đặt'}</Text>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>Nguồn: {record.bookingSource}</div>
        </div>
      ),
    },
    {
      title: 'Thời gian lưu trú',
      key: 'stayDates',
      render: (_, record) => (
        <div>
          <span>{dayjs(record.checkInDate).format('DD/MM/YYYY')} ➔ {dayjs(record.checkOutDate).format('DD/MM/YYYY')}</span>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
            {record.totalNights} đêm • {record.totalRooms} phòng
          </div>
        </div>
      ),
    },
    {
      title: 'Tổng dự tính',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: string) => (
        <Text strong style={{ color: '#1b4d3e' }}>
          {formatVND(amount)}
        </Text>
      ),
    },
    {
      title: 'Trạng thái Đặt phòng',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status: ReservationStatus) => renderReservationStatusTag(status),
    },
    {
      title: 'Sổ công nợ Folio',
      key: 'folioStatus',
      width: 175,
      render: (_, record) => {
        const info = folioStatusMap[String(record.id)];
        if (!info || info.status === 'LOADING') {
          return <Tag>Đang kiểm tra...</Tag>;
        }
        if (info.status === 'CLOSED') {
          return (
            <div>
              <Tag
                icon={<LockOutlined />}
                style={{
                  fontWeight: 600,
                  background: '#f5f5f5',
                  color: '#595959',
                  borderColor: '#d9d9d9',
                }}
              >
                ĐÃ QUYẾT TOÁN
              </Tag>
              {info.closedAt && (
                <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                  {dayjs(info.closedAt).format('DD/MM/YYYY HH:mm')}
                </div>
              )}
            </div>
          );
        }
        if (info.status === 'OPEN') {
          return (
            <div>
              <Tag icon={<UnlockOutlined />} color="success" style={{ fontWeight: 600 }}>
                ĐANG MỞ (OPEN)
              </Tag>
              {info.balanceAmount && (
                <div
                  style={{
                    fontSize: 11,
                    color: Number(info.balanceAmount) > 0 ? '#cf1322' : '#389e0d',
                    marginTop: 2,
                    fontWeight: 500,
                  }}
                >
                  Dư nợ: {formatVND(info.balanceAmount)}
                </div>
              )}
            </div>
          );
        }
        if (info.status === 'NOT_OPENED') {
          return (
            <Tag color="warning" style={{ fontStyle: 'italic' }}>
              Chưa mở Folio
            </Tag>
          );
        }
        return <Tag color="default">—</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      render: (_, record) => {
        const info = folioStatusMap[String(record.id)];
        const isClosed = info?.status === 'CLOSED';
        const isNotOpened = info?.status === 'NOT_OPENED';

        return (
          <Button
            type="primary"
            size="small"
            icon={isClosed ? <LockOutlined /> : isNotOpened ? <UnlockOutlined /> : <EyeOutlined />}
            style={{
              background: isClosed ? '#595959' : isNotOpened ? '#fa8c16' : '#1b4d3e',
              borderColor: isClosed ? '#595959' : isNotOpened ? '#fa8c16' : '#1b4d3e',
            }}
            onClick={() => {
              setSelectedReservationId(String(record.id));
              setItemsPage(1);
              setPaymentsPage(1);
            }}
          >
            {isClosed ? 'Xem (Đã đóng)' : isNotOpened ? 'Mở Folio' : 'Xem Folio'}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Navigation Bar when viewing a specific Folio */}
      {selectedReservationId && (
        <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
          <Row gutter={[16, 16]} align="middle" justify="space-between">
            <Col xs={24} md={16}>
              <Space wrap size={10}>
                <Button
                  icon={<LeftOutlined />}
                  onClick={() => {
                    setSelectedReservationId('');
                  }}
                >
                  ← Quay lại danh sách đơn
                </Button>
                <Text type="secondary">|</Text>
                <Text strong>Đang xem Folio:</Text>
                <Tag color="#1b4d3e" style={{ fontSize: 13, fontWeight: 600 }}>
                  Đơn #{selectedReservationId}
                </Tag>
                <Select
                  showSearch
                  placeholder="Chuyển nhanh sang đơn khác..."
                  style={{ width: 320 }}
                  value={selectedReservationId}
                  onChange={(val) => {
                    setSelectedReservationId(val);
                    setItemsPage(1);
                    setPaymentsPage(1);
                  }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={reservationList.map((r) => ({
                    value: String(r.id),
                    label: `Đơn #${r.id} - ${r.bookerGuest?.fullName || 'Khách'} (${r.status} - ${r.totalRooms || 1} phòng)`,
                  }))}
                />
              </Space>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchFolio()}>
                Cập nhật số liệu Folio
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Folio Content Area */}
      {!selectedReservationId ? (
        <Card
          title={
            <Space>
              <FileTextOutlined style={{ color: '#1b4d3e' }} />
              <span>Danh sách Đơn đặt phòng — Chọn đơn để quản lý Sổ công nợ Folio</span>
            </Space>
          }
          style={{ borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}
          extra={
            <Space wrap>
              <Select
                placeholder="Lọc trạng thái..."
                allowClear
                style={{ width: 190 }}
                value={resTableStatus}
                onChange={(val: any) => {
                  setResTableStatus(!val || val === 'ALL' ? undefined : val);
                  setResTablePage(1);
                }}
                options={[
                  { value: 'ALL', label: 'Tất cả trạng thái' },
                  { value: 'CHECKED_IN', label: 'Đang ở (CHECKED_IN)' },
                  { value: 'CONFIRMED', label: 'Đã xác nhận (CONFIRMED)' },
                  { value: 'CHECKED_OUT', label: 'Đã trả phòng (CHECKED_OUT)' },
                  { value: 'CANCELLED', label: 'Đã hủy (CANCELLED)' },
                ]}
              />
              <Input
                placeholder="Tìm mã đơn, tên khách..."
                prefix={<SearchOutlined />}
                style={{ width: 220 }}
                value={resTableSearch}
                onChange={(e) => setResTableSearch(e.target.value)}
                onPressEnter={() => setResTablePage(1)}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetchReservations()}>
                Làm mới
              </Button>
            </Space>
          }
        >
          <Alert
            type="info"
            showIcon
            message="Quản lý Sổ công nợ Folio theo từng Đơn đặt phòng"
            description="Trong hệ thống khách sạn, mỗi đơn đặt phòng được liên kết trực tiếp với một Sổ công nợ Folio để theo dõi tiền phòng, phí dịch vụ, đặt cọc và thanh toán. Bấm nút 'Xem Folio' ở cột Thao tác trên từng dòng để kiểm tra chi tiết hoặc mở Folio mới."
            style={{ marginBottom: 16 }}
          />

          <Table
            columns={reservationColumns}
            dataSource={reservationList}
            rowKey="id"
            loading={isReservationsLoading}
            pagination={{
              current: resTablePage,
              pageSize: resTablePageSize,
              total: reservationTotal,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              onChange: (p, ps) => {
                setResTablePage(p);
                setResTablePageSize(ps);
              },
              showTotal: (tot) => `Tổng cộng ${tot} đơn đặt phòng`,
            }}
          />
        </Card>
      ) : isFolioLoading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#8c8c8c' }}>Đang tải thông tin Sổ công nợ Folio...</div>
        </div>
      ) : isFolioNotFound ? (
        <Card style={{ borderRadius: 8, textAlign: 'center', padding: '50px 20px' }}>
          <Alert
            type="warning"
            showIcon
            message="Chưa mở Sổ công nợ Folio cho Đơn đặt phòng này"
            description="Theo quy trình khách sạn, khi mở Folio, toàn bộ tiền phòng theo hợp đồng của các đêm lưu trú sẽ được tính toán và ghi nhận thành công nợ hợp đồng. Sau khi mở, bạn có thể nhận tiền đặt cọc, thanh toán và ghi nhận chi phí dịch vụ."
            style={{ maxWidth: 700, margin: '0 auto 24px auto', textAlign: 'left' }}
          />

          <Space size={16}>
            {canOpenOrPay && (
              <Button
                type="primary"
                size="large"
                icon={<UnlockOutlined />}
                style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                loading={openFolioMutation.isPending}
                onClick={() => openFolioMutation.mutate(selectedReservationId)}
              >
                Mở Sổ công nợ Folio (Open Folio)
              </Button>
            )}
          </Space>
        </Card>
      ) : folio ? (
        <div>
          {/* Folio Header & Financial KPI Cards */}
          <Card
            size="small"
            style={{
              marginBottom: 16,
              borderRadius: 8,
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              borderTop: '3px solid #1b4d3e',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space size={10} wrap>
                <Tag color="#1b4d3e" style={{ fontSize: 15, fontWeight: 700, padding: '3px 10px' }}>
                  FOLIO #{folio.id}
                </Tag>
                <Text strong style={{ fontSize: 14 }}>
                  Đơn đặt phòng #{folio.reservationId}
                </Text>
                {reservationDetail?.bookerGuest && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    Khách: <Text strong>{reservationDetail.bookerGuest.fullName}</Text>
                  </Text>
                )}
                <Tag color={folio.status === 'OPEN' ? 'success' : 'default'} style={{ fontWeight: 600 }}>
                  {folio.status === 'OPEN' ? 'ĐANG MỞ (OPEN)' : 'ĐÃ QUYẾT TOÁN (CLOSED)'}
                </Tag>
              </Space>

              <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                Mở: {dayjs(folio.openedAt).format('DD/MM/YYYY HH:mm')}
                {folio.closedAt && ` | Đóng: ${dayjs(folio.closedAt).format('DD/MM/YYYY HH:mm')}`}
              </div>
            </div>

            {/* Prominent Settlement Banner when CLOSED */}
            {folio.status === 'CLOSED' && (
              <Alert
                type="success"
                showIcon
                icon={<LockOutlined style={{ fontSize: 18, color: '#389e0d' }} />}
                style={{
                  marginBottom: 16,
                  border: '1px solid #b7eb8f',
                  background: '#f6ffed',
                }}
                message={
                  <Text strong style={{ color: '#237804', fontSize: 14 }}>
                    SỔ CÔNG NỢ ĐÃ ĐƯỢC QUYẾT TOÁN & KHÓA SỔ HOÀN TẤT
                  </Text>
                }
                description={
                  <div style={{ fontSize: 13, marginTop: 4, color: '#262626' }}>
                    <div>
                      • <strong>Thời điểm đóng sổ:</strong>{' '}
                      <Text style={{ color: '#092b00', fontWeight: 600 }}>
                        {folio.closedAt ? dayjs(folio.closedAt).format('HH:mm ngày DD/MM/YYYY') : '—'}
                      </Text>{' '}
                      <span style={{ color: '#8c8c8c' }}>
                        (Kỳ ghi nợ: {dayjs(folio.openedAt).format('DD/MM/YYYY HH:mm')} ➔{' '}
                        {dayjs(folio.closedAt || folio.updatedAt).format('DD/MM/YYYY HH:mm')})
                      </span>
                    </div>
                    {paymentList.length > 0 && (
                      <div style={{ marginTop: 3 }}>
                        • <strong>Giao dịch thanh toán chốt gần nhất:</strong>{' '}
                        <span>
                          {paymentList[0].paymentType} ({formatVND(paymentList[0].amount)}) thực hiện bởi{' '}
                          <strong>
                            {getStaff(paymentList[0].processedBy).fullName} (
                            {getStaff(paymentList[0].processedBy).roleTitle})
                          </strong>{' '}
                          lúc {dayjs(paymentList[0].processedAt).format('HH:mm ngày DD/MM/YYYY')}
                        </span>
                      </div>
                    )}
                    <div style={{ marginTop: 3, color: '#595959' }}>
                      • <strong>Tình trạng:</strong> Số dư công nợ đã cân bằng (0 ₫). Toàn bộ quyền ghi nhận phí dịch vụ, thanh toán và điều chỉnh đã được khóa an toàn.
                    </div>
                  </div>
                }
              />
            )}

            {/* 4 Financial Metric Cards */}
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={6}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Tổng phát sinh (Charges)</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322', marginTop: 2 }}>
                    {formatVND(folio.totalCharges)}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                    Tiền phòng + Dịch vụ
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Tổng giảm trừ (Credits)</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a', marginTop: 2 }}>
                    {formatVND(folio.totalCredits)}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                    Chiết khấu / Điều chỉnh
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Đã thực thu (Net Paid)</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff', marginTop: 2 }}>
                    {formatVND(folio.netPaid)}
                  </div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
                    Cọc: {formatVND(folio.totalDeposits)} | Thu: {formatVND(folio.totalPayments)}
                  </div>
                </div>
              </Col>
              <Col xs={12} sm={6}>
                <div
                  style={{
                    padding: 12,
                    background:
                      parseFloat(folio.outstandingBalance) > 0
                        ? '#fff7e6'
                        : parseFloat(folio.outstandingBalance) === 0
                        ? '#f6ffed'
                        : '#f9f0ff',
                    borderRadius: 6,
                    border: `1px solid ${
                      parseFloat(folio.outstandingBalance) > 0
                        ? '#ffd591'
                        : parseFloat(folio.outstandingBalance) === 0
                        ? '#b7eb8f'
                        : '#d3adf7'
                    }`,
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 12 }}>Số dư còn phải thu</Text>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        parseFloat(folio.outstandingBalance) > 0
                          ? '#d46b08'
                          : parseFloat(folio.outstandingBalance) === 0
                          ? '#389e0d'
                          : '#531dab',
                      marginTop: 2,
                    }}
                  >
                    {formatVND(folio.outstandingBalance)}
                  </div>
                  <div style={{ fontSize: 11, color: '#595959', marginTop: 2 }}>
                    {parseFloat(folio.outstandingBalance) > 0
                      ? 'Chưa thanh toán hết'
                      : parseFloat(folio.outstandingBalance) === 0
                      ? 'Đã cân bằng (0 ₫)'
                      : 'Dư tiền cần hoàn'}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Quick Actions Bar */}
            <div
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <Space wrap size={10}>
                {canOpenOrPay && folio.status === 'OPEN' && (
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                    onClick={() => {
                      paymentForm.resetFields();
                      const balance = parseFloat(folio.outstandingBalance);
                      paymentForm.setFieldsValue({
                        paymentType: 'PAYMENT',
                        paymentMethod: 'CASH',
                        amount: balance > 0 ? balance : undefined,
                        confirmedReceived: false,
                      });
                      setIsPaymentModalOpen(true);
                    }}
                  >
                    Thu tiền / Đặt cọc
                  </Button>
                )}

                {canSettleOrAdjust && folio.status === 'OPEN' && (
                  <Button
                    icon={<FormOutlined />}
                    onClick={() => {
                      adjustmentForm.resetFields();
                      adjustmentForm.setFieldsValue({
                        entryType: 'DEBIT',
                      });
                      setIsAdjustmentModalOpen(true);
                    }}
                  >
                    Điều chỉnh nợ / có
                  </Button>
                )}
              </Space>

              <Space wrap size={10}>
                {canSettleOrAdjust && folio.status === 'OPEN' && (
                  <Tooltip
                    title={
                      parseFloat(folio.outstandingBalance) !== 0
                        ? 'Chỉ có thể đóng khi số dư đã thanh toán hết (0 ₫)'
                        : 'Quyết toán và đóng Sổ công nợ Folio'
                    }
                  >
                    <Button
                      danger
                      icon={<LockOutlined />}
                      disabled={parseFloat(folio.outstandingBalance) !== 0}
                      onClick={() => setIsCloseFolioModalOpen(true)}
                    >
                      Đóng Sổ Folio (Close)
                    </Button>
                  </Tooltip>
                )}
              </Space>
            </div>
          </Card>

          {/* Sub-tabs: Ledger Items vs Payments */}
          <Card size="small" style={{ borderRadius: 8 }}>
            <Tabs
              activeKey={activeLedgerTab}
              onChange={setActiveLedgerTab}
              items={[
                {
                  key: 'items',
                  label: (
                    <Space>
                      <FileTextOutlined />
                      <span>Sổ cái chi phí & điều chỉnh ({itemsTotal})</span>
                    </Space>
                  ),
                  children: (
                    <Table
                      columns={itemColumns}
                      dataSource={folioItems}
                      rowKey="id"
                      loading={isItemsLoading}
                      pagination={{
                        current: itemsPage,
                        pageSize: 20,
                        total: itemsTotal,
                        onChange: setItemsPage,
                        showTotal: (tot) => `Tổng cộng ${tot} mục ghi nợ/có`,
                      }}
                    />
                  ),
                },
                {
                  key: 'payments',
                  label: (
                    <Space>
                      <DollarOutlined />
                      <span>Lịch sử Thanh toán & Hoàn tiền ({paymentsTotal})</span>
                    </Space>
                  ),
                  children: (
                    <Table
                      columns={paymentColumns}
                      dataSource={paymentList}
                      rowKey="id"
                      loading={isPaymentsLoading}
                      pagination={{
                        current: paymentsPage,
                        pageSize: 20,
                        total: paymentsTotal,
                        onChange: setPaymentsPage,
                        showTotal: (tot) => `Tổng cộng ${tot} giao dịch thanh toán`,
                      }}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {/* ---------------------------------------------------- */}
      {/* PAYMENT & DEPOSIT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#1b4d3e' }} />
            <span>Ghi nhận Thu tiền / Nhận đặt cọc</span>
          </Space>
        }
        open={isPaymentModalOpen}
        onCancel={() => {
          setIsPaymentModalOpen(false);
          paymentForm.resetFields();
        }}
        onOk={() => paymentForm.submit()}
        okText="Xác nhận thu tiền"
        cancelText="Hủy"
        confirmLoading={paymentMutation.isPending}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={(values) => {
            if (!folio) return;
            paymentMutation.mutate({
              folioId: folio.id,
              dto: {
                paymentType: values.paymentType,
                paymentMethod: values.paymentMethod,
                amount: `${Math.round(values.amount)}.00`,
                referenceNumber: values.referenceNumber?.trim() || null,
                confirmedReceived: true,
              },
            });
          }}
        >
          <Form.Item name="paymentType" label="Loại giao dịch" rules={[{ required: true }]}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="PAYMENT">Thanh toán công nợ (PAYMENT)</Radio.Button>
              <Radio.Button value="DEPOSIT">Nhận tiền đặt cọc (DEPOSIT)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="paymentMethod" label="Phương thức thanh toán" rules={[{ required: true }]}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="CASH">💵 Tiền mặt (Cash)</Radio.Button>
              <Radio.Button value="BANK_TRANSFER">💳 Chuyển khoản (Bank Transfer)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Số tiền thực thu (VND)"
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền' },
              {
                type: 'number',
                min: 1,
                message: 'Số tiền phải lớn hơn 0',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
              placeholder="Nhập số tiền VND..."
            />
          </Form.Item>

          {paymentMethodWatch === 'BANK_TRANSFER' && (
            <Form.Item
              name="referenceNumber"
              label="Mã tham chiếu ngân hàng (Bank Reference Code)"
              rules={[{ required: true, message: 'Bắt buộc nhập mã tham chiếu giao dịch chuyển khoản' }]}
              extra="Bắt buộc đối với thanh toán chuyển khoản để phục vụ đối soát kế toán."
            >
              <Input placeholder="VD: FT261015099238, MB_TRANS_8892..." />
            </Form.Item>
          )}

          <Form.Item
            name="confirmedReceived"
            valuePropName="checked"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) {
                    return Promise.reject(new Error('Nhân viên phải cam kết xác nhận đã thực nhận tiền vào quỹ'));
                  }
                },
              },
            ]}
          >
            <Checkbox>
              <Text strong style={{ color: '#1b4d3e' }}>
                Tôi cam kết đã thực nhận đủ số tiền trên vào tài khoản hoặc két tiền của khách sạn.
              </Text>
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* ADJUSTMENT MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <FormOutlined style={{ color: '#1b4d3e' }} />
            <span>Điều chỉnh Công nợ Folio (Manual Adjustment)</span>
          </Space>
        }
        open={isAdjustmentModalOpen}
        onCancel={() => {
          setIsAdjustmentModalOpen(false);
          adjustmentForm.resetFields();
        }}
        onOk={() => adjustmentForm.submit()}
        okText="Áp dụng điều chỉnh"
        cancelText="Hủy"
        confirmLoading={adjustmentMutation.isPending}
      >
        <Alert
          type="info"
          showIcon
          message="Chính sách điều chỉnh công nợ"
          description="Ghi nợ (DEBIT) làm tăng số tiền khách phải trả (phụ thu, đền bù đồ vỡ). Ghi có (CREDIT) làm giảm số tiền phải trả (chiết khấu, bồi thường dịch vụ). Lưu ý: Không cho phép tạo CREDIT làm số dư âm."
          style={{ marginBottom: 16 }}
        />

        <Form
          form={adjustmentForm}
          layout="vertical"
          onFinish={(values) => {
            if (!folio) return;
            adjustmentMutation.mutate({
              folioId: folio.id,
              dto: {
                entryType: values.entryType,
                amount: `${Math.round(values.amount)}.00`,
                reason: values.reason.trim(),
                relatedItemId: values.relatedItemId || undefined,
              },
            });
          }}
        >
          <Form.Item name="entryType" label="Loại điều chỉnh" rules={[{ required: true }]}>
            <Radio.Group buttonStyle="solid">
              <Radio.Button value="DEBIT">Ghi nợ phát sinh (+) (DEBIT)</Radio.Button>
              <Radio.Button value="CREDIT">Ghi có giảm trừ (-) (CREDIT)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Số tiền điều chỉnh (VND)"
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền' },
              { type: 'number', min: 1, message: 'Số tiền phải lớn hơn 0' },
              ...(entryTypeWatch === 'CREDIT' && folio
                ? [
                    {
                      validator: async (_: any, val: number) => {
                        const maxCredit = parseFloat(folio.outstandingBalance);
                        if (val && maxCredit >= 0 && val > maxCredit) {
                          return Promise.reject(
                            new Error(`Khoản giảm trừ không được vượt quá số dư còn lại (${formatVND(maxCredit)})`)
                          );
                        }
                      },
                    },
                  ]
                : []),
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do điều chỉnh (bắt buộc)"
            rules={[{ required: true, message: 'Vui lòng nhập lý do điều chỉnh' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Chiết khấu phòng theo chương trình VIP, Phụ thu đồ vỡ trong phòng #102..."
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item name="relatedItemId" label="Liên kết mục phí gốc (tùy chọn)">
            <Select
              allowClear
              placeholder="Chọn mục phí liên quan trong Folio nếu có..."
              options={folioItems.map((it) => ({
                value: it.id,
                label: `Mục #${it.id} - ${it.description} (${it.entryType === 'DEBIT' ? '+' : '-'}${formatVND(it.amount)})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* REFUND MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <RollbackOutlined style={{ color: '#cf1322' }} />
            <span>Ghi nhận Hoàn tiền — Giao dịch #{targetPaymentForRefund?.id}</span>
          </Space>
        }
        open={isRefundModalOpen}
        onCancel={() => {
          setIsRefundModalOpen(false);
          setTargetPaymentForRefund(null);
          refundForm.resetFields();
        }}
        onOk={() => refundForm.submit()}
        okText="Xác nhận Hoàn tiền"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={refundMutation.isPending}
      >
        <Alert
          type="warning"
          showIcon
          message="Quy tắc hoàn tiền"
          description="Hoàn tiền là thao tác trả lại tiền cho khách và làm TĂNG số dư nợ trên Folio. Số tiền hoàn không được vượt quá số tiền của giao dịch gốc."
          style={{ marginBottom: 16 }}
        />

        <Form
          form={refundForm}
          layout="vertical"
          onFinish={(values) => {
            if (!targetPaymentForRefund) return;
            refundMutation.mutate({
              paymentId: targetPaymentForRefund.id,
              dto: {
                amount: `${Math.round(values.amount)}.00`,
                reason: values.reason.trim(),
                referenceNumber: values.referenceNumber?.trim() || null,
                confirmedRefunded: true,
              },
            });
          }}
        >
          <Form.Item
            name="amount"
            label={`Số tiền hoàn trả (Tối đa: ${formatVND(targetPaymentForRefund?.amount)})`}
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền hoàn trả' },
              {
                type: 'number',
                min: 1,
                max: targetPaymentForRefund ? parseFloat(targetPaymentForRefund.amount) : undefined,
                message: 'Số tiền hoàn không hợp lệ hoặc vượt quá giao dịch gốc',
              },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do hoàn trả (bắt buộc)"
            rules={[{ required: true, message: 'Vui lòng nhập lý do hoàn tiền' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Trả lại tiền đặt cọc thừa cho khách, hoàn tiền do hủy dịch vụ..."
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="referenceNumber"
            label="Mã tham chiếu ngân hàng chuyển khoản đi (nếu hoàn qua bank)"
          >
            <Input placeholder="VD: REF_MB_883921..." />
          </Form.Item>

          <Form.Item
            name="confirmedRefunded"
            valuePropName="checked"
            rules={[
              {
                validator: async (_, value) => {
                  if (!value) {
                    return Promise.reject(new Error('Bắt buộc xác nhận tiền đã được hoàn trả thực tế'));
                  }
                },
              },
            ]}
          >
            <Checkbox>
              <Text strong style={{ color: '#cf1322' }}>
                Tôi xác nhận đã chi tiền hoàn trả thực tế cho khách hàng.
              </Text>
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* CLOSE FOLIO MODAL */}
      {/* ---------------------------------------------------- */}
      <Modal
        title={
          <Space>
            <LockOutlined style={{ color: '#cf1322' }} />
            <span>Quyết toán và Đóng Sổ công nợ Folio #{folio?.id}</span>
          </Space>
        }
        open={isCloseFolioModalOpen}
        onCancel={() => setIsCloseFolioModalOpen(false)}
        onOk={() => {
          if (folio) closeFolioMutation.mutate(folio.id);
        }}
        okText="Xác nhận Đóng Folio"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        confirmLoading={closeFolioMutation.isPending}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Điều kiện bắt buộc để đóng Folio"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Số dư còn lại phải đúng bằng 0 ₫ (đã thanh toán hết).</li>
                <li>Không còn yêu cầu dịch vụ nào đang ở trạng thái REQUESTED.</li>
                <li>Tất cả các phòng trong đơn đặt phòng đã thực hiện Check-out hoặc đơn đã hủy.</li>
              </ul>
            }
          />
          <Text>
            Khi Sổ công nợ Folio đã đóng (CLOSED), hệ thống sẽ khóa toàn bộ và không cho phép ghi nhận thêm bất kỳ khoản phí hoặc thanh toán nào nữa.
          </Text>
        </Space>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* RECEIPT MODAL */}
      {/* ---------------------------------------------------- */}
      <ReceiptModal
        open={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedPaymentForReceipt(null);
        }}
        payment={selectedPaymentForReceipt}
        folio={folio}
        guestName={reservationDetail?.bookerGuest?.fullName}
        roomNumber={
          reservationDetail?.rooms?.[0]?.roomId
            ? `#${getPhysicalRoomNumber(reservationDetail.rooms[0].roomId)}`
            : reservationDetail?.rooms?.[0]?.roomType?.name
        }
      />
    </div>
  );
};
