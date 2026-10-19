import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Tabs,
  Table,
  Button,
  DatePicker,
  Alert,
  Spin,
  Badge,
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
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { reportsApi } from '../../api/reports.api.ts';
import { reservationsApi } from '../../api/reservations.api.ts';
import { staysApi } from '../../api/stays.api.ts';
import type { ReservationSummaryItem } from '../../types/reservations.types.ts';
import type { StaySummaryItem } from '../../types/stays.types.ts';

const { Title, Text, Paragraph } = Typography;

export const DashboardPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const userRole = user?.role || '';
  const isFrontDesk = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(userRole);
  const isAccountant = userRole === 'ACCOUNTANT';
  const isHousekeeping = userRole === 'HOUSEKEEPING';
  const isTechnician = userRole === 'TECHNICIAN';

  // Selected date for Front Desk Dashboard (default today)
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs().startOf('day'));
  const isSelectedDateToday = selectedDate.isSame(dayjs(), 'day');
  const dateStr = selectedDate.format('YYYY-MM-DD');

  // Period for Accountant/Operations
  const todayStr = dayjs().format('YYYY-MM-DD');
  const thirtyDaysAgoStr = dayjs().subtract(30, 'day').format('YYYY-MM-DD');

  // ----------------------------------------------------
  // 1. FRONT DESK DASHBOARD QUERY (/reports/dashboard)
  // ----------------------------------------------------
  const {
    data: dashboardRes,
    isLoading: isDashboardLoading,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['report-dashboard', dateStr],
    queryFn: () => reportsApi.getDashboard({ date: dateStr }),
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  const dashboardData = dashboardRes?.data;

  // Real Expected Arrivals List (Confirmed Reservations)
  const { data: arrivalsRes, isLoading: isArrivalsLoading } = useQuery({
    queryKey: ['dashboard-arrivals'],
    queryFn: () => reservationsApi.getAll({ status: 'CONFIRMED', limit: 20 }),
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  const arrivalsList: ReservationSummaryItem[] = Array.isArray(arrivalsRes?.data)
    ? arrivalsRes.data
    : Array.isArray((arrivalsRes?.data as any)?.items)
    ? (arrivalsRes?.data as any).items
    : [];

  // Real In-House Stays List (Checked-in Stays)
  const { data: inHouseRes, isLoading: isInHouseLoading } = useQuery({
    queryKey: ['dashboard-in-house'],
    queryFn: () => staysApi.getAll({ status: 'CHECKED_IN', limit: 20 }),
    enabled: isFrontDesk,
    staleTime: 30000,
  });

  const inHouseList: StaySummaryItem[] = Array.isArray(inHouseRes?.data?.items)
    ? inHouseRes.data.items
    : [];

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
    queryKey: ['dashboard-accountant-outstanding'],
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

  const formatVnd = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num.toLocaleString('vi-VN')} ₫`;
  };

  // ----------------------------------------------------
  // TABLE COLUMNS FOR REAL ARRIVALS & IN-HOUSE
  // ----------------------------------------------------
  const arrivalColumns: ColumnsType<ReservationSummaryItem> = [
    {
      title: 'Khách hàng',
      key: 'guest',
      render: (_, r) => (
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
            {r.bookerGuest?.fullName}
          </Text>
          <div style={{ fontSize: 11, color: '#64748b' }}>#{r.confirmationCode}</div>
        </div>
      ),
    },
    {
      title: 'Khoảng thời gian',
      key: 'dates',
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
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
      render: (val) => <Text strong style={{ color: '#1b4d3e' }}>{formatVnd(val)}</Text>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 130,
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
        <div>
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
      render: (_, s) => (
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
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
      render: (val) => <Text style={{ fontSize: 12 }}>{dayjs(val).format('DD/MM/YYYY HH:mm')}</Text>,
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: () => <Tag color="success">Đang lưu trú</Tag>,
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: () => (
        <Button size="small" onClick={() => navigate('/stays')}>
          Xem chi tiết
        </Button>
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
              value={selectedDate}
              onChange={(val) => {
                if (val) setSelectedDate(val.startOf('day'));
              }}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (isFrontDesk) refetchDashboard();
            }}
          >
            Làm mới
          </Button>
        </Space>
      </div>

      {/* Snapshot Date Notice */}
      {isFrontDesk && !isSelectedDateToday && (
        <Alert
          type="warning"
          showIcon
          message="Xem báo cáo theo ngày quá khứ / tương lai"
          description="Ảnh chụp tình trạng buồng phòng (Room Snapshot) chỉ được tính toán cho ngày hiện tại của khách sạn. Các chỉ số về số lượt đến/đi và tài chính vẫn được tổng hợp theo ngày được chọn."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* 1. FRONT DESK VIEW (ADMIN, MANAGER, RECEPTIONIST)   */}
      {/* ---------------------------------------------------- */}
      {isFrontDesk && (
        <>
          {isDashboardLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin size="large" tip="Đang tải dữ liệu vận hành từ máy chủ..." />
            </div>
          ) : (
            <>
              {/* Primary KPI Metrics */}
              <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                <Col xs={12} sm={12} lg={6}>
                  <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                    <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12, textTransform: 'uppercase' }}>
                      Phòng đang có khách
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <Title level={screens.xs ? 4 : 3} style={{ margin: 0, color: '#1b4d3e' }}>
                        {dashboardData?.rooms?.occupied ?? '-'}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        / {dashboardData?.rooms?.active ?? '-'} phòng active
                      </Text>
                    </div>
                  </Card>
                </Col>

                <Col xs={12} sm={12} lg={6}>
                  <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                    <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12, textTransform: 'uppercase' }}>
                      Phòng sạch sẵn sàng
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <Title level={screens.xs ? 4 : 3} style={{ margin: 0, color: '#389e0d' }}>
                        {dashboardData?.rooms?.ready ?? '-'}
                      </Title>
                      <Badge status="success" text="Đón khách" style={{ fontSize: 11 }} />
                    </div>
                  </Card>
                </Col>

                <Col xs={12} sm={12} lg={6}>
                  <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                    <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12, textTransform: 'uppercase' }}>
                      Lượt khách đến dự kiến
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <Title level={screens.xs ? 4 : 3} style={{ margin: 0, color: '#096dd9' }}>
                        {dashboardData?.reservations?.expectedArrivals ?? 0}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        lượt
                      </Text>
                    </div>
                  </Card>
                </Col>

                <Col xs={12} sm={12} lg={6}>
                  <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                    <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12, textTransform: 'uppercase' }}>
                      Lượt khách đi dự kiến
                    </Text>
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <Title level={screens.xs ? 4 : 3} style={{ margin: 0, color: '#d46b08' }}>
                        {dashboardData?.reservations?.expectedDepartures ?? 0}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        lượt
                      </Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Operational Breakdown Bar */}
              <Card
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
                    <Tag color="error">
                      <strong>Cần dọn:</strong> {dashboardData?.rooms?.dirty ?? '-'}
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
              </Card>

              {/* Finance summary if role has permission (ADMIN, MANAGER) */}
              {dashboardData?.finance && (
                <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                  <Col xs={12} sm={12} lg={6}>
                    <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thực thu trong ngày
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#15803d' }}>
                        {formatVnd(dashboardData.finance.netCashCollected)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thu tiền mặt
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#1b4d3e' }}>
                        {formatVnd(dashboardData.finance.cashPayments)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Thu chuyển khoản
                      </Text>
                      <Title level={screens.xs ? 5 : 4} style={{ margin: '4px 0 0', color: '#096dd9' }}>
                        {formatVnd(dashboardData.finance.bankTransferPayments)}
                      </Title>
                    </Card>
                  </Col>
                  <Col xs={12} sm={12} lg={6}>
                    <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
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
                          <span>Khách Đến ({arrivalsList.length})</span>
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={arrivalColumns}
                          dataSource={arrivalsList}
                          rowKey="id"
                          loading={isArrivalsLoading}
                          pagination={{ pageSize: 5 }}
                          size="small"
                          scroll={{ x: 600 }}
                        />
                      ),
                    },
                    {
                      key: 'in-house',
                      label: (
                        <Space size={4}>
                          <HomeOutlined />
                          <span>Đang Lưu Trú ({inHouseList.length})</span>
                        </Space>
                      ),
                      children: (
                        <Table
                          columns={inHouseColumns}
                          dataSource={inHouseList}
                          rowKey="stayId"
                          loading={isInHouseLoading}
                          pagination={{ pageSize: 5 }}
                          size="small"
                          scroll={{ x: 600 }}
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
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8} md={8}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Doanh số phòng ghi nợ (30 ngày)
                </Text>
                <Title level={3} style={{ margin: '4px 0 0', color: '#1b4d3e' }}>
                  {formatVnd(accountantRevRes?.data?.summary?.roomCharges)}
                </Title>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Thực thu tiền mặt & chuyển khoản
                </Text>
                <Title level={3} style={{ margin: '4px 0 0', color: '#15803d' }}>
                  {formatVnd(accountantRevRes?.data?.summary?.netCashCollected)}
                </Title>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>
                  Tổng dư nợ chưa quyết toán
                </Text>
                <Title level={3} style={{ margin: '4px 0 0', color: '#cf1322' }}>
                  {formatVnd(accountantRevRes?.data?.balance?.outstandingBalance)}
                </Title>
              </Card>
            </Col>
          </Row>

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
                  render: () => (
                    <Button size="small" onClick={() => navigate('/folios')}>
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
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Cần dọn (Dirty)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#cf1322' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.dirtyRooms ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đang làm vệ sinh
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#096dd9' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.cleaningRooms ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Chờ duyệt (Inspection)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#722ed1' }}>
                  {operationsRes?.data?.housekeeping?.snapshot?.roomsAwaitingInspection ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đạt chuẩn (Ready)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#389e0d' }}>
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
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Phòng đang bảo trì
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#cf1322' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.roomsUnderMaintenance ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Sự cố mới báo (Open)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#d46b08' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.openMaintenanceTickets ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Đang xử lý (In-progress)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#096dd9' }}>
                  {operationsRes?.data?.maintenance?.snapshot?.inProgressMaintenanceTickets ?? '-'}
                </Title>
              </Card>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }}>
                <Text type="secondary" style={{ fontSize: screens.xs ? 11 : 12 }}>
                  Lệnh khóa phòng (Blocks)
                </Text>
                <Title level={screens.xs ? 4 : 3} style={{ margin: '4px 0 0', color: '#722ed1' }}>
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
