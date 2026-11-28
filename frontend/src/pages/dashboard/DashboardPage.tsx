import { ResponsiveTabs as Tabs } from '../../components/responsive/ResponsiveTabs.tsx';
import { ResponsiveTable as Table } from '../../components/responsive/ResponsiveTable.tsx';
import { SupplyCashSummary } from '../reports/components/SupplyCashSummary.tsx';
import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Button,
  DatePicker,
  Alert,
  Spin,
  Tooltip,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HomeOutlined,
  LoginOutlined,
  ToolOutlined,
  SyncOutlined,
  DollarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { reportConfigKey, reportsApi } from '../../api/reports.api.ts';
import { reservationsApi } from '../../api/reservations.api.ts';
import { staysApi } from '../../api/stays.api.ts';
import type { ReservationSummaryItem } from '../../types/reservations.types.ts';
import type { StaySummaryItem } from '../../types/stays.types.ts';
import { useHotelClock } from '../../hooks/useHotelClock.ts';
import { formatVnd } from '../reports/reports.utils.ts';
import { RoomSchedule, TodayTasks } from './FrontDeskOverview.tsx';

const { Title, Text, Paragraph } = Typography;
const dashboardPageSize = 5;
const scheduleMaxDays = 7;

export const DashboardPage: React.FC = () => {
  const clock = useHotelClock();
  if (!clock) return <Alert type="error" title="Chưa xác định được múi giờ khách sạn" showIcon />;
  return <Dashboard hotelDate={clock.date} />;
};

const Dashboard: React.FC<{ hotelDate: string }> = ({ hotelDate }) => {
  const screens = Grid.useBreakpoint();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const userRole = user?.role || '';
  const isFrontDesk = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(userRole);
  const isAccountant = userRole === 'ACCOUNTANT';
  const isHousekeeping = userRole === 'HOUSEKEEPING';
  const isTechnician = userRole === 'TECHNICIAN';

  // Selected date for Front Desk Dashboard (default today)
  const [dateOverride, setSelectedDate] = useState<Dayjs | null>(null);
  const selectedDate = dateOverride ?? dayjs(hotelDate);
  const isSelectedDateToday = selectedDate.format('YYYY-MM-DD') === hotelDate;
  const dateStr = selectedDate.format('YYYY-MM-DD');
  const [arrivalsPage, setArrivalsPage] = useState(1);
  const [inHousePage, setInHousePage] = useState(1);

  // Period for Accountant/Operations
  const todayStr = hotelDate;
  const thirtyDaysAgoStr = dayjs(hotelDate).subtract(30, 'day').format('YYYY-MM-DD');

  // ----------------------------------------------------
  // 1. FRONT DESK DASHBOARD QUERY (/reports/dashboard)
  // ----------------------------------------------------
  const todayDashboard = useQuery({
    queryKey: ['report-dashboard', todayStr],
    queryFn: () => reportsApi.getDashboard({ date: todayStr }),
    enabled: isFrontDesk,
    staleTime: 30000,
  });
  const selectedDashboard = useQuery({
    queryKey: ['report-dashboard', dateStr],
    queryFn: () => reportsApi.getDashboard({ date: dateStr }),
    enabled: isFrontDesk && !isSelectedDateToday,
    staleTime: 30000,
  });
  const dashboard = isSelectedDateToday ? todayDashboard : selectedDashboard;
  const dashboardData = dashboard.data?.data;

  const dueStays = useQuery({
    queryKey: ['stays', 'dashboard-due', todayStr],
    queryFn: ({ signal }) => staysApi.getAll({
      status: 'CHECKED_IN',
      scheduledCheckOutDate: todayStr,
      limit: dashboardPageSize,
    }, signal),
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  const reportConfig = useQuery({
    queryKey: reportConfigKey,
    queryFn: ({ signal }) => reportsApi.getConfig(signal),
    enabled: isFrontDesk,
  });
  const scheduleDays = reportConfig.data && Math.min(scheduleMaxDays, reportConfig.data.maxDays);
  const scheduleEnd = scheduleDays ? dayjs(todayStr).add(scheduleDays, 'day').format('YYYY-MM-DD') : todayStr;
  const schedule = useQuery({
    queryKey: ['report-reservations', todayStr, scheduleEnd, 'day'],
    queryFn: () => reportsApi.getReservations({ startDate: todayStr, endDate: scheduleEnd, groupBy: 'day' }),
    enabled: isFrontDesk && Boolean(scheduleDays),
    staleTime: 30000,
  });

  const refreshSchedule = async () => {
    const next = await reportConfig.refetch();
    if (!next.isError && next.data && Math.min(scheduleMaxDays, next.data.maxDays) === scheduleDays) {
      await schedule.refetch();
    }
  };

  // Pending orders for the selected arrival date; one order can contain several rooms.
  const {
    data: arrivalsList = [],
    isFetching: isArrivalsLoading,
    error: arrivalsError,
    refetch: refetchArrivals,
  } = useQuery({
    queryKey: ['dashboard-arrivals', dateStr],
    queryFn: () => reservationsApi.getPendingArrivals(dateStr),
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  // Real In-House Stays List (Checked-in Stays)
  const {
    data: inHouseRes,
    isFetching: isInHouseLoading,
    isPlaceholderData: isInHousePlaceholder,
    error: inHouseError,
    refetch: refetchInHouse,
  } = useQuery({
    queryKey: ['stays', 'dashboard-in-house', inHousePage],
    queryFn: ({ signal }) => staysApi.getAll({ status: 'CHECKED_IN', page: inHousePage, limit: dashboardPageSize }, signal),
    placeholderData: keepPreviousData,
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  const inHouseList: StaySummaryItem[] = inHouseRes?.data.items ?? [];
  const inHouseTotal = inHouseRes?.data.pagination.total;
  const lastInHousePage = Math.max(1, inHouseRes?.data.pagination.totalPages ?? 1);
  if (inHouseRes && !isInHousePlaceholder && inHousePage > lastInHousePage) {
    setInHousePage(lastInHousePage);
  }

  // ----------------------------------------------------
  // 2. ACCOUNTANT QUERIES (/reports/revenue & /reports/outstanding)
  // ----------------------------------------------------
  const { data: accountantRevRes, isLoading: isAccRevLoading } = useQuery({
    queryKey: ['dashboard-accountant-revenue', thirtyDaysAgoStr, todayStr],
    queryFn: () => reportsApi.getRevenue({ startDate: thirtyDaysAgoStr, endDate: todayStr }),
    enabled: isAccountant,
    staleTime: 60000,
  });

  const { data: accountantOutRes, isLoading: isAccOutLoading } = useQuery({
    queryKey: ['dashboard-accountant-outstanding', thirtyDaysAgoStr, todayStr],
    queryFn: () => reportsApi.getOutstanding({ startDate: thirtyDaysAgoStr, endDate: todayStr, limit: 10 }),
    enabled: isAccountant,
    staleTime: 60000,
  });

  // ----------------------------------------------------
  // 3. HOUSEKEEPING & TECHNICIAN QUERY (/reports/operations)
  // ----------------------------------------------------
  const { data: operationsRes, isLoading: isOpsLoading } = useQuery({
    queryKey: ['dashboard-operations', thirtyDaysAgoStr, todayStr],
    queryFn: () => reportsApi.getOperations({ startDate: thirtyDaysAgoStr, endDate: todayStr }),
    enabled: isHousekeeping || isTechnician,
    staleTime: 60000,
  });

  // ----------------------------------------------------
  // TABLE COLUMNS FOR REAL ARRIVALS & IN-HOUSE
  // ----------------------------------------------------
  const arrivalColumns: ColumnsType<ReservationSummaryItem> = [
    {
      title: 'Khách hàng',
      key: 'guest',
      width: 170,
      render: (_, r) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#0f172a', fontSize: 13, whiteSpace: 'nowrap' }}>
            {r.bookerGuest?.fullName}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>#{r.confirmationCode}</div>
        </div>
      ),
    },
    {
      title: 'Khoảng thời gian',
      key: 'dates',
      width: 170,
      render: (_, r) => (
        <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {dayjs(r.checkInDate).format('DD/MM')} ➔ {dayjs(r.checkOutDate).format('DD/MM')}
          <span style={{ color: '#64748b', marginLeft: 6 }}>({r.totalNights} đêm)</span>
        </div>
      ),
    },
    {
      title: 'Số phòng',
      dataIndex: 'totalRooms',
      key: 'totalRooms',
      width: 100,
      render: (rooms) => <Tag color="blue">{rooms} phòng</Tag>,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      render: (val) => <Text strong style={{ color: '#1b4d3e', whiteSpace: 'nowrap' }}>{formatVnd(val)}</Text>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 110,
      render: (_, r) => (
        <Button
          type="primary"
          size="small"
          icon={<LoginOutlined />}
          style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e', fontSize: 12 }}
          onClick={() => navigate(`/stays?tab=arrivals&reservationId=${r.id}`)}
        >
          Check-in
        </Button>
      ),
    },
  ];

  const inHouseColumns: ColumnsType<StaySummaryItem> = [
    {
      title: 'Phòng',
      key: 'room',
      width: 110,
      render: (_, s) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#1b4d3e', fontSize: 14 }}>
            #{s.room?.roomNumber}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>{s.roomType?.name}</div>
        </div>
      ),
    },
    {
      title: 'Khách lưu trú',
      key: 'guest',
      width: 180,
      render: (_, s) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Text strong style={{ color: '#0f172a', fontSize: 13, whiteSpace: 'nowrap' }}>
            {s.bookerGuest?.fullName || 'Khách lưu trú'}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>#{s.confirmationCode}</div>
        </div>
      ),
    },
    {
      title: 'Nhận phòng lúc',
      dataIndex: 'actualCheckinAt',
      key: 'checkinAt',
      width: 160,
      render: (val) => <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{dayjs(val).format('DD/MM/YYYY HH:mm')}</Text>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      render: () => <Tag color="success">Đang lưu trú</Tag>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_, stay) => (
        <Link to={`/stays?stayId=${stay.stayId}`}>
          Xem chi tiết
        </Link>
      ),
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            Tổng Quan Điều Hành Khách Sạn
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Chỉ số vận hành thời gian thực, tồn phòng và tình hình kinh doanh Innvyra PMS.
          </Text>
        </div>

        <Space wrap>
          {isFrontDesk && (
            <DatePicker
              aria-label="Ngày xem chi tiết vận hành"
              value={selectedDate}
              onChange={(val) => {
                if (val) {
                  setSelectedDate(val.format('YYYY-MM-DD') === todayStr ? null : val.startOf('day'));
                  setArrivalsPage(1);
                }
              }}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (isFrontDesk) {
                void Promise.all([
                  todayDashboard.refetch(),
                  ...(!isSelectedDateToday ? [selectedDashboard.refetch()] : []),
                  dueStays.refetch(),
                  refetchArrivals(),
                  refetchInHouse(),
                  refreshSchedule(),
                ]);
              }
            }}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {isFrontDesk && (
        <>
          <TodayTasks
            date={todayStr}
            snapshot={todayDashboard.isError ? undefined : todayDashboard.data?.data}
            snapshotPending={todayDashboard.isPending}
            snapshotFailed={todayDashboard.isError}
            stays={dueStays.data?.data.items ?? []}
            stayTotal={dueStays.isError ? undefined : dueStays.data?.data.pagination.total}
            staysFailed={dueStays.isError}
            onRetrySnapshot={() => void todayDashboard.refetch()}
            onRetryStays={() => void dueStays.refetch()}
          />
          <RoomSchedule
            days={scheduleDays}
            series={schedule.data?.data.series}
            failed={reportConfig.isError || schedule.isError}
            onRetry={() => void refreshSchedule()}
          />
        </>
      )}

      {isFrontDesk && !isSelectedDateToday && (
        <Alert
          type="info"
          showIcon
          title={`Chi tiết ngày ${selectedDate.format('DD/MM/YYYY')}`}
          description={(
            <>
              <div>Danh sách khách đến và số liệu tài chính bên dưới theo ngày được chọn. Việc hôm nay và danh sách đang lưu trú theo ngày hiện tại của khách sạn.</div>
              {dashboardData && (
                <div>
                  Chờ nhận {dashboardData.reservations.expectedArrivals} phòng
                  {' · '}
                  Dự kiến trả {dashboardData.reservations.expectedDepartures} phòng
                </div>
              )}
            </>
          )}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. FRONT DESK VIEW (ADMIN, MANAGER, RECEPTIONIST)   */}
      {/* ---------------------------------------------------- */}
      {isFrontDesk && (
        <>
          {!isSelectedDateToday && dashboard.isError && (
            <Alert
              type="error"
              title="Chưa tải được số liệu ngày đã chọn"
              showIcon
              style={{ marginBottom: 16 }}
              action={<Button size="small" onClick={() => void dashboard.refetch()}>Thử lại</Button>}
            />
          )}
          {dashboard.isLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" description="Đang tải dữ liệu vận hành từ máy chủ..." />
            </div>
          ) : (
            <>
              {/* Operational Breakdown Bar */}
              {dashboardData?.rooms && <Card
                size="small"
                style={{
                  marginBottom: 20,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                }}
                styles={{ body: { padding: screens.xs ? '10px 12px' : undefined } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <Space size={6}>
                    <HomeOutlined style={{ color: '#1b4d3e' }} />
                    <Text strong style={{ fontSize: 13, color: '#334155' }}>
                      Hiện trạng buồng phòng & kỹ thuật:
                    </Text>
                  </Space>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Tooltip title="Phòng trống (Không có khách lưu trú). Lưu ý: phòng trống có thể đang bẩn hoặc đang bảo trì nên chưa chắc bán được ngay.">
                      <Tag color="cyan">
                        <strong>Trống:</strong> {dashboardData?.rooms?.vacant ?? '-'}
                      </Tag>
                    </Tooltip>
                    <Tag color="green">
                      <strong>Đang có khách:</strong> {dashboardData.rooms.occupied}
                    </Tag>
                    <Tag color="processing">
                      <strong>Đang dọn:</strong> {dashboardData?.rooms?.cleaning ?? '-'}
                    </Tag>
                    <Tag color="purple">
                      <strong>Chờ duyệt:</strong> {dashboardData?.rooms?.awaitingInspection ?? '-'}
                    </Tag>
                    <Tag color="volcano">
                      <strong>Bảo trì:</strong> {dashboardData?.rooms?.underMaintenance ?? '-'}
                    </Tag>
                    <Tag color="default">
                      <strong>Ngừng PV:</strong> {dashboardData?.rooms?.outOfService ?? '-'}
                    </Tag>
                  </div>
                </div>
              </Card>}

              {/* Finance summary if role has permission (ADMIN, MANAGER) */}
              {dashboardData?.finance && (
                <Row gutter={[12, 12]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
                  <Col xs={12} sm={12} lg={6}>
                    <Card
                      size="small"
                      className="pms-kpi-card"
                      style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thực thu trong ngày
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#15803d' }}>
                        {formatVnd(dashboardData.finance.netCashCollected)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card
                      size="small"
                      className="pms-kpi-card"
                      style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thu tiền mặt
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#1b4d3e' }}>
                        {formatVnd(dashboardData.finance.cashPayments)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card
                      size="small"
                      className="pms-kpi-card"
                      style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thu chuyển khoản
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#096dd9' }}>
                        {formatVnd(dashboardData.finance.bankTransferPayments)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card
                      size="small"
                      className="pms-kpi-card"
                      style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                      styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                    >
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Dư nợ Folio chưa thu
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#cf1322' }}>
                        {formatVnd(dashboardData.finance.outstandingBalance)}
                      </Title>
                    </Card>
                  </Col>
                </Row>
              )}

              {/* Real Arrivals & Departures Lists */}
              <Card
                style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                styles={{ body: { padding: screens.xs ? '8px 8px' : '8px 16px' } }}
              >
                <Tabs
                  defaultActiveKey="arrivals"
                  items={[
                    {
                      key: 'arrivals',
                      label: (
                        <Space size={4}>
                          <LoginOutlined />
                          <span>Khách Đến ({arrivalsError ? '—' : arrivalsList.length} đơn)</span>
                        </Space>
                      ),
                      children: arrivalsError ? (
                        <Alert type="error" showIcon title="Không tải được danh sách khách đến. Vui lòng thử Làm mới." />
                      ) : (
                        <Table
                          columns={arrivalColumns}
                          dataSource={arrivalsList}
                          rowKey="id"
                          loading={isArrivalsLoading}
                          pagination={{
                            current: arrivalsPage,
                            pageSize: dashboardPageSize,
                            onChange: setArrivalsPage,
                            showSizeChanger: false,
                            showTotal: (total) => `${total} đơn chờ nhận phòng trong ngày`,
                          }}
                          size="small"
                          scroll={{ x: 680 }}
                        />
                      ),
                    },
                    {
                      key: 'in-house',
                      label: (
                        <Space size={4}>
                          <HomeOutlined />
                          <span>Đang Lưu Trú ({inHouseError ? '—' : inHouseTotal ?? '—'} lượt)</span>
                        </Space>
                      ),
                      children: inHouseError ? (
                        <Alert type="error" showIcon title="Không tải được danh sách lưu trú. Vui lòng thử Làm mới." />
                      ) : (
                        <Table
                          columns={inHouseColumns}
                          dataSource={inHouseList}
                          rowKey="stayId"
                          loading={isInHouseLoading}
                          pagination={{
                            current: inHousePage,
                            pageSize: dashboardPageSize,
                            total: inHouseTotal ?? 0,
                            onChange: setInHousePage,
                            showSizeChanger: false,
                            showTotal: (total) => `${total} lượt đang lưu trú`,
                          }}
                          size="small"
                          scroll={{ x: 700 }}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </>
          )}
        </>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. ACCOUNTANT VIEW                                   */}
      {/* ---------------------------------------------------- */}
      {isAccountant && (
        <Spin spinning={isAccRevLoading || isAccOutLoading}>
          <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8} md={8}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Doanh số phòng ghi nợ (30 ngày)
                </Text>
                <Title level={3} style={{ margin: '8px 0 0', color: '#1b4d3e' }}>
                  {formatVnd(accountantRevRes?.data?.summary?.roomCharges)}
                </Title>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Thực thu tiền mặt & chuyển khoản
                </Text>
                <Title level={3} style={{ margin: '8px 0 0', color: '#15803d' }}>
                  {formatVnd(accountantRevRes?.data?.summary?.netCashCollected)}
                </Title>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Tổng dư nợ chưa quyết toán
                </Text>
                <Title level={3} style={{ margin: '8px 0 0', color: '#cf1322' }}>
                  {formatVnd(accountantRevRes?.data?.balance?.outstandingBalance)}
                </Title>
              </Card>
            </Col>
          </Row>

          <SupplyCashSummary
            paid={accountantRevRes?.data?.summary?.netSupplierPaid}
            net={accountantRevRes?.data?.summary?.netCashAfterSupplies}
            label="30 ngày"
          />
          <Card
            title={
              <Space>
                <DollarOutlined style={{ color: '#1b4d3e' }} />
                <span>Danh Sách Sổ Công Nợ Cần Quyết Toán (Outstanding Folios)</span>
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/folios')}>
                Đến trang Thu ngân / Folio ➔
              </Button>
            }
            style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
          >
            <Table
              dataSource={accountantOutRes?.data?.items || []}
              rowKey="folioId"
              loading={isAccOutLoading}
              pagination={false}
              size="small"
              scroll={{ x: 500 }}
              columns={[
                {
                  title: 'Mã Sổ Folio',
                  dataIndex: 'folioId',
                  key: 'folioId',
                  render: (id) => <Tag color="blue">Folio #{id}</Tag>,
                },
                {
                  title: 'Số dư công nợ',
                  dataIndex: 'outstandingBalance',
                  key: 'balance',
                  render: (b) => {
                    const num = parseFloat(b);
                    return (
                      <Text strong style={{ color: num > 0 ? '#cf1322' : '#389e0d' }}>
                        {formatVnd(b)}
                      </Text>
                    );
                  },
                },
                {
                  title: 'Thao tác',
                  key: 'action',
                  render: (_, record: any) => (
                    <Button
                      size="small"
                      onClick={() => navigate(`/folios?folioId=${record.folioId}`)}
                    >
                      Xử lý
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </Spin>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. HOUSEKEEPING VIEW                                 */}
      {/* ---------------------------------------------------- */}
      {isHousekeeping && (
        <Spin spinning={isOpsLoading}>
          <Row gutter={[12, 12]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Cần dọn (Dirty)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#cf1322' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.dirtyRooms ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đang làm vệ sinh
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#096dd9' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.cleaningRooms ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Chờ duyệt (Inspection)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#722ed1' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.roomsAwaitingInspection ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đạt chuẩn (Ready)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#389e0d' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.readyRooms ?? '-'}
                </Title>
              </Card>
            </Col>
          </Row>

          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center', padding: screens.xs ? '20px 12px' : '30px 0' }}>
            <Title level={5}>Bảng Công Việc Buồng Phòng</Title>
            <Paragraph type="secondary">
              Xem chi tiết hàng đợi phòng bẩn, nhận nhiệm vụ và báo hoàn thành trên bảng Kanban.
            </Paragraph>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
              onClick={() => navigate('/housekeeping')}
            >
              Chuyển đến Bảng Buồng Phòng (Kanban)
            </Button>
          </Card>
        </Spin>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. TECHNICIAN VIEW                                   */}
      {/* ---------------------------------------------------- */}
      {isTechnician && (
        <Spin spinning={isOpsLoading}>
          <Row gutter={[12, 12]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Phòng đang bảo trì
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#cf1322' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.roomsUnderMaintenance ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Sự cố mới báo (Open)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#d46b08' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.openMaintenanceTickets ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đang xử lý (In-progress)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#096dd9' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.inProgressMaintenanceTickets ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Lệnh khóa phòng (Blocks)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '8px 0 0', color: '#722ed1' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.activeMaintenanceBlocks ?? '-'}
                </Title>
              </Card>
            </Col>
          </Row>

          <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center', padding: screens.xs ? '20px 12px' : '30px 0' }}>
            <Title level={5}>Hệ Thống Bảo Trì Kỹ Thuật</Title>
            <Paragraph type="secondary">
              Xem các phiếu sự cố được phân công, cập nhật tiến độ khắc phục và báo cáo sự cố phát sinh.
            </Paragraph>
            <Button
              type="primary"
              icon={<ToolOutlined />}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
              onClick={() => navigate('/maintenance')}
            >
              Chuyển đến Quản Lý Bảo Trì
            </Button>
          </Card>
        </Spin>
      )}
    </div>
  );
};
