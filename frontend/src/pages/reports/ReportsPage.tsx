import React, { useState, useMemo } from 'react';
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
  Select,
  Radio,
  Statistic,
  message,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DollarOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  ToolOutlined,
  SyncOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BarChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { reportsApi } from '../../api/reports.api.ts';
import { roomTypesApi } from '../../api/rooms.api.ts';
import { BarComparisonChart, type BarComparisonItem } from '../../components/charts/BarComparisonChart.tsx';
import { DonutChart, type DonutSlice } from '../../components/charts/DonutChart.tsx';
import type {
  RevenueSeriesItem,
  PaymentSeriesItem,
  OccupancySeriesItem,
  ReservationSeriesItem,
  OutstandingItem,
} from '../../types/reports.types.ts';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ReportsPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const userRole = user?.role || '';

  // Role permissions
  const canViewFinancial = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);
  const canViewFrontDeskReports = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(userRole);
  const canExportCsv = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);

  // Available tabs calculation
  const availableTabs = useMemo(() => {
    const tabs: { key: string; label: string; icon: React.ReactNode }[] = [];
    if (canViewFinancial) {
      tabs.push({ key: 'revenue', label: 'Doanh thu & Bán phòng', icon: <DollarOutlined /> });
      tabs.push({ key: 'payments', label: 'Dòng tiền & Thu chi', icon: <CreditCardOutlined /> });
    }
    if (canViewFrontDeskReports) {
      tabs.push({ key: 'occupancy', label: 'Công suất & ADR / RevPAR', icon: <CalendarOutlined /> });
      tabs.push({ key: 'reservations', label: 'Đặt phòng & Nguồn khách', icon: <AppstoreOutlined /> });
    }
    // Operations available to all 6 roles
    tabs.push({ key: 'operations', label: 'Vận hành Buồng & Bảo trì', icon: <ToolOutlined /> });
    if (canViewFinancial) {
      tabs.push({ key: 'outstanding', label: 'Sổ theo dõi Công nợ', icon: <FileTextOutlined /> });
    }
    return tabs;
  }, [canViewFinancial, canViewFrontDeskReports]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<string>(() => availableTabs[0]?.key || 'operations');

  // Date Range state: default to 30 days up to end of today [today - 30 days, today + 1 day)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => [
    dayjs().subtract(30, 'day').startOf('day'),
    dayjs().add(1, 'day').startOf('day'),
  ]);

  const startDateStr = dateRange[0].format('YYYY-MM-DD');
  const endDateStr = dateRange[1].format('YYYY-MM-DD');

  // Aggregation group: 'day' | 'month'
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  // Filters for sub-tabs
  const [paymentMethod, setPaymentMethod] = useState<'ALL' | 'CASH' | 'BANK_TRANSFER'>('ALL');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | undefined>(undefined);

  // Outstanding pagination & sort state
  const [outstandingPage, setOutstandingPage] = useState<number>(1);
  const [outstandingLimit] = useState<number>(20);
  const [outstandingSort, setOutstandingSort] = useState<{
    sortBy: 'folioId' | 'outstandingBalance';
    sortOrder: 'asc' | 'desc';
  }>({ sortBy: 'outstandingBalance', sortOrder: 'desc' });

  // Export loading state
  const [exporting, setExporting] = useState<boolean>(false);

  // Fetch Room Types for filter
  const { data: roomTypesRes } = useQuery({
    queryKey: ['roomTypes-list'],
    queryFn: () => roomTypesApi.getAll({ limit: 100 }),
    enabled: activeTab === 'occupancy',
    staleTime: 60000,
  });
  const roomTypes = roomTypesRes?.data?.items || [];

  // Currency Formatter
  const formatVnd = (value: string | number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num.toLocaleString('vi-VN')}\u00A0₫`;
  };

  // ----------------------------------------------------
  // QUERIES FOR EACH TAB (Enabled conditionally)
  // ----------------------------------------------------

  // 1. Revenue Query
  const {
    data: revenueRes,
    isLoading: isLoadingRevenue,
    error: revenueError,
  } = useQuery({
    queryKey: ['report-revenue', startDateStr, endDateStr, groupBy],
    queryFn: () => reportsApi.getRevenue({ startDate: startDateStr, endDate: endDateStr, groupBy }),
    enabled: activeTab === 'revenue' && canViewFinancial,
    staleTime: 30000,
  });

  // 2. Payments Query
  const {
    data: paymentsRes,
    isLoading: isLoadingPayments,
    error: paymentsError,
  } = useQuery({
    queryKey: ['report-payments', startDateStr, endDateStr, groupBy, paymentMethod],
    queryFn: () =>
      reportsApi.getPayments({
        startDate: startDateStr,
        endDate: endDateStr,
        groupBy,
        paymentMethod: paymentMethod === 'ALL' ? undefined : paymentMethod,
      }),
    enabled: activeTab === 'payments' && canViewFinancial,
    staleTime: 30000,
  });

  // 3. Occupancy Query
  const {
    data: occupancyRes,
    isLoading: isLoadingOccupancy,
    error: occupancyError,
  } = useQuery({
    queryKey: ['report-occupancy', startDateStr, endDateStr, groupBy, selectedRoomTypeId],
    queryFn: () =>
      reportsApi.getOccupancy({
        startDate: startDateStr,
        endDate: endDateStr,
        groupBy,
        roomTypeId: selectedRoomTypeId,
      }),
    enabled: activeTab === 'occupancy' && canViewFrontDeskReports,
    staleTime: 30000,
  });

  // 4. Reservations Query
  const {
    data: reservationsRes,
    isLoading: isLoadingReservations,
    error: reservationsError,
  } = useQuery({
    queryKey: ['report-reservations', startDateStr, endDateStr, groupBy],
    queryFn: () => reportsApi.getReservations({ startDate: startDateStr, endDate: endDateStr, groupBy }),
    enabled: activeTab === 'reservations' && canViewFrontDeskReports,
    staleTime: 30000,
  });

  // 5. Operations Query
  const {
    data: operationsRes,
    isLoading: isLoadingOperations,
    error: operationsError,
  } = useQuery({
    queryKey: ['report-operations', startDateStr, endDateStr, groupBy],
    queryFn: () => reportsApi.getOperations({ startDate: startDateStr, endDate: endDateStr, groupBy }),
    enabled: activeTab === 'operations',
    staleTime: 30000,
  });

  // 6. Outstanding Query
  const {
    data: outstandingRes,
    isLoading: isLoadingOutstanding,
    error: outstandingError,
  } = useQuery({
    queryKey: [
      'report-outstanding',
      startDateStr,
      endDateStr,
      outstandingPage,
      outstandingLimit,
      outstandingSort.sortBy,
      outstandingSort.sortOrder,
    ],
    queryFn: () =>
      reportsApi.getOutstanding({
        startDate: startDateStr,
        endDate: endDateStr,
        page: outstandingPage,
        limit: outstandingLimit,
        sortBy: outstandingSort.sortBy,
        sortOrder: outstandingSort.sortOrder,
      }),
    enabled: activeTab === 'outstanding' && canViewFinancial,
    staleTime: 30000,
  });

  // ----------------------------------------------------
  // CSV EXPORT HANDLER
  // ----------------------------------------------------
  const handleExportCsv = async () => {
    if (!canExportCsv) {
      message.warning('Tài khoản của bạn không có quyền trích xuất dữ liệu báo cáo sang CSV.');
      return;
    }

    let exportType: 'revenue' | 'occupancy' | 'reservations' | 'payments' | null = null;
    if (activeTab === 'revenue') exportType = 'revenue';
    else if (activeTab === 'payments') exportType = 'payments';
    else if (activeTab === 'occupancy') exportType = 'occupancy';
    else if (activeTab === 'reservations') exportType = 'reservations';

    if (!exportType) {
      message.info('Báo cáo hiện tại không hỗ trợ tải file CSV trực tiếp.');
      return;
    }

    // Role check for Accountant
    if (userRole === 'ACCOUNTANT' && (exportType === 'occupancy' || exportType === 'reservations')) {
      message.warning('Kế toán chỉ được phép xuất dữ liệu Báo cáo Doanh thu và Dòng tiền.');
      return;
    }

    try {
      setExporting(true);
      const { blob, filename } = await reportsApi.exportCsv({
        type: exportType,
        startDate: startDateStr,
        endDate: endDateStr,
        groupBy,
        paymentMethod: exportType === 'payments' && paymentMethod !== 'ALL' ? paymentMethod : undefined,
        roomTypeId: exportType === 'occupancy' ? selectedRoomTypeId : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success(`Đã xuất báo cáo ${filename} thành công!`);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Có lỗi xảy ra khi xuất file CSV.');
    } finally {
      setExporting(false);
    }
  };

  // Quick period presets
  const handlePreset7Days = () => {
    setDateRange([
      dayjs().subtract(6, 'day').startOf('day'),
      dayjs().add(1, 'day').startOf('day'),
    ]);
    setGroupBy('day');
  };

  const handlePresetMonth = () => {
    setDateRange([
      dayjs().startOf('month'),
      dayjs().add(1, 'day').startOf('day'),
    ]);
    setGroupBy('day');
  };

  const handlePresetQuarter = () => {
    setDateRange([
      dayjs().subtract(89, 'day').startOf('day'),
      dayjs().add(1, 'day').startOf('day'),
    ]);
    setGroupBy('month');
  };

  const handlePresetYear = () => {
    setDateRange([
      dayjs().startOf('year'),
      dayjs().add(1, 'day').startOf('day'),
    ]);
    setGroupBy('month');
  };

  // ----------------------------------------------------
  // RENDER TAB 1: REVENUE
  // ----------------------------------------------------
  const renderRevenueTab = () => {
    const rev = revenueRes?.data;
    const summary = rev?.summary;
    const balance = rev?.balance;

    const revenueChartData: BarComparisonItem[] = (rev?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: Math.max(0, parseFloat(item.netBilledCharges || '0')),
      value2: Math.max(0, parseFloat(item.netCashCollected || '0')),
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Doanh thu Billed: ${formatVnd(item.netBilledCharges)} (Phòng: ${formatVnd(item.roomCharges)} | Dịch vụ: ${formatVnd(item.serviceCharges)})`,
      tooltipText2: `Thực thu ròng: ${formatVnd(item.netCashCollected)}`,
    }));

    const revenueDonutData: DonutSlice[] = [];
    const roomChargesNum = parseFloat(summary?.roomCharges || '0');
    const serviceChargesNum = parseFloat(summary?.serviceCharges || '0');
    if (roomChargesNum > 0) {
      revenueDonutData.push({ key: 'room', label: 'Tiền phòng', value: roomChargesNum, color: '#1b4d3e' });
    }
    if (serviceChargesNum > 0) {
      revenueDonutData.push({ key: 'service', label: 'Dịch vụ & Minibar', value: serviceChargesNum, color: '#1890ff' });
    }

    const columns: ColumnsType<RevenueSeriesItem> = [
      {
        title: 'Mốc thời gian',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        render: (d) => <Text strong>{d}</Text>,
      },
      {
        title: 'Tiền phòng (Billed)',
        dataIndex: 'roomCharges',
        key: 'roomCharges',
        align: 'right',
        render: (val) => <Text>{formatVnd(val)}</Text>,
      },
      {
        title: 'Dịch vụ & Minibar',
        dataIndex: 'serviceCharges',
        key: 'serviceCharges',
        align: 'right',
        render: (val) => <Text>{formatVnd(val)}</Text>,
      },
      {
        title: 'Điều chỉnh nợ / có',
        key: 'adjustments',
        align: 'right',
        render: (_, r) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            +{formatVnd(r.adjustmentDebits)} / -{formatVnd(r.adjustmentCredits)}
          </Text>
        ),
      },
      {
        title: 'Ghi nhận ròng (Net Billed)',
        dataIndex: 'netBilledCharges',
        key: 'netBilledCharges',
        align: 'right',
        render: (val) => <Text strong style={{ color: '#1b4d3e' }}>{formatVnd(val)}</Text>,
      },
      {
        title: 'Thực thu (Net Cash)',
        dataIndex: 'netCashCollected',
        key: 'netCashCollected',
        align: 'right',
        render: (val) => <Text strong style={{ color: '#1890ff' }}>{formatVnd(val)}</Text>,
      },
      {
        title: 'Biến động công nợ',
        dataIndex: 'balanceMovement',
        key: 'balanceMovement',
        align: 'right',
        render: (val) => {
          const num = parseFloat(val || '0');
          const color = num > 0 ? '#cf1322' : num < 0 ? '#389e0d' : '#595959';
          return <Text style={{ color }}>{formatVnd(val)}</Text>;
        },
      },
      {
        title: 'Giao dịch (Thu/Cọc/Hoàn)',
        key: 'counts',
        align: 'center',
        render: (_, r) => (
          <Space size="small">
            <Tag color="blue">{r.paymentCount} thu</Tag>
            <Tag color="cyan">{r.depositCount} cọc</Tag>
            {r.refundCount > 0 && <Tag color="volcano">{r.refundCount} hoàn</Tag>}
          </Space>
        ),
      },
    ];

    return (
      <Spin spinning={isLoadingRevenue}>
        {revenueError && (
          <Alert
            type="error"
            title="Không thể tải báo cáo doanh thu"
            description="Vui lòng kiểm tra lại quyền hạn hoặc kết nối mạng."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}


        {/* Financial KPI Summary Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Tiền phòng đã Billed</Text>}
                value={formatVnd(summary?.roomCharges)}
                styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ghi nhận từ tiền phòng theo đêm lưu trú
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1890ff' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Tiền dịch vụ phát sinh</Text>}
                value={formatVnd(summary?.serviceCharges)}
                styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Dịch vụ, minibar, giặt ủi, ẩm thực
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #52c41a' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Thực thu ròng kỳ này</Text>}
                value={formatVnd(summary?.netCashCollected)}
                styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                (Thanh toán + Đặt cọc) - Hoàn trả
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #fa8c16' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Biến động công nợ kỳ</Text>}
                value={formatVnd(summary?.balanceMovement)}
                styles={{ content: { color: '#fa8c16', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Net Billed trừ Net Cash trong khoảng thời gian
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Ledger Balance Snapshot */}
        {balance && (
          <Card
            title={
              <Space wrap size={6}>
                <DollarOutlined style={{ color: '#1b4d3e' }} />
                <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                  {screens.xs ? 'Số dư công nợ toàn hệ thống' : 'Tình trạng số dư công nợ toàn hệ thống (Cumulative Balance)'}
                </Text>
                <Tag color="geekblue" style={{ margin: 0 }}>{balance.folioCount} folios có số dư</Tag>
              </Space>
            }
            size="small"
            style={{ marginBottom: 20, borderRadius: 8, background: '#fafafa' }}
          >
            <Row gutter={[16, 8]}>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <Text type="secondary">Tổng số dư công nợ tích lũy:</Text>
                  <Text strong style={{ fontSize: 16, whiteSpace: 'nowrap' }}>
                    {formatVnd(balance.outstandingBalance)}
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <Text type="secondary">Phải thu từ khách (Nợ):</Text>
                  <Text strong style={{ color: '#cf1322', fontSize: 16, whiteSpace: 'nowrap' }}>
                    {formatVnd(balance.accountsReceivable)}
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                  <Text type="secondary">Khách trả thừa / Credit:</Text>
                  <Text strong style={{ color: '#389e0d', fontSize: 16, whiteSpace: 'nowrap' }}>
                    {formatVnd(balance.customerCredits)}
                  </Text>
                </div>
              </Col>
              <Col span={24}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  * Thời điểm chốt số dư: <Text code style={{ whiteSpace: 'nowrap' }}>{dayjs(balance.cutoffExclusive).format('DD/MM/YYYY HH:mm:ss')}</Text> (Gồm tất cả bút toán phát sinh trước thời điểm này).
                </Text>
              </Col>
            </Row>
          </Card>
        )}

        {/* Visual Charts: Comparison Bar & Revenue Breakdown Donut */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={15}>
            <Card
              title={
                <Space wrap size={6}>
                  <BarChartOutlined style={{ color: '#1b4d3e' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                    {screens.xs ? 'Doanh thu vs Thực thu' : `So sánh Doanh thu ghi nhận vs Dòng tiền thực thu (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
                  </Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <BarComparisonChart
                data={revenueChartData}
                series1Label="Doanh thu ghi nhận (Net Billed)"
                series2Label="Dòng tiền thực thu (Net Cash)"
                series1Color="#1b4d3e"
                series2Color="#1890ff"
                valueFormatter={(val) => formatVnd(val)}
                height={260}
              />
            </Card>
          </Col>
          <Col xs={24} lg={9}>
            <Card
              title={
                <Space wrap size={6}>
                  <PieChartOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>Cơ cấu doanh thu kỳ này</Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <div style={{ paddingTop: 12 }}>
                <DonutChart
                  data={revenueDonutData}
                  totalLabel="Tổng Billed"
                  valueFormatter={(val) => formatVnd(val)}
                  size={160}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Time series table */}
        <Card
          title={`Chi tiết chuỗi dữ liệu doanh thu (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
          size="small"
          style={{ borderRadius: 8 }}
        >
          <Table
            columns={columns}
            dataSource={rev?.series || []}
            rowKey="date"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 1000 }}
            size="middle"
          />
        </Card>
      </Spin>
    );
  };

  // ----------------------------------------------------
  // RENDER TAB 2: PAYMENTS
  // ----------------------------------------------------
  const renderPaymentsTab = () => {
    const pay = paymentsRes?.data;
    const summary = pay?.summary;

    const paymentChartData: BarComparisonItem[] = (pay?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: Math.max(0, parseFloat(item.cashPayments || '0')),
      value2: Math.max(0, parseFloat(item.bankTransferPayments || '0')),
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Tiền mặt (CASH): ${formatVnd(item.cashPayments)}`,
      tooltipText2: `Chuyển khoản (BANK): ${formatVnd(item.bankTransferPayments)}`,
    }));

    const paymentDonutData: DonutSlice[] = [];
    const cashNum = parseFloat(summary?.cashPayments || '0');
    const bankNum = parseFloat(summary?.bankTransferPayments || '0');
    if (cashNum > 0) paymentDonutData.push({ key: 'cash', label: 'Tiền mặt (CASH)', value: cashNum, color: '#389e0d' });
    if (bankNum > 0) paymentDonutData.push({ key: 'bank', label: 'Chuyển khoản (BANK)', value: bankNum, color: '#096dd9' });

    const columns: ColumnsType<PaymentSeriesItem> = [
      {
        title: 'Mốc thời gian',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        render: (d) => <Text strong>{d}</Text>,
      },
      {
        title: 'Tiền mặt (CASH)',
        dataIndex: 'cashPayments',
        key: 'cashPayments',
        align: 'right',
        render: (val) => <Text>{formatVnd(val)}</Text>,
      },
      {
        title: 'Chuyển khoản (BANK_TRANSFER)',
        dataIndex: 'bankTransferPayments',
        key: 'bankTransferPayments',
        align: 'right',
        render: (val) => <Text>{formatVnd(val)}</Text>,
      },
      {
        title: 'Tiền đặt cọc',
        dataIndex: 'successfulDeposits',
        key: 'successfulDeposits',
        align: 'right',
        render: (val) => <Text style={{ color: '#096dd9' }}>{formatVnd(val)}</Text>,
      },
      {
        title: 'Tiền hoàn trả (Refund)',
        dataIndex: 'successfulRefunds',
        key: 'successfulRefunds',
        align: 'right',
        render: (val) => <Text style={{ color: '#d4380d' }}>{formatVnd(val)}</Text>,
      },
      {
        title: 'Thực thu ròng',
        dataIndex: 'netCashCollected',
        key: 'netCashCollected',
        align: 'right',
        render: (val) => <Text strong style={{ color: '#1b4d3e' }}>{formatVnd(val)}</Text>,
      },
      {
        title: 'Số giao dịch',
        key: 'txCounts',
        align: 'center',
        render: (_, r) => (
          <Space>
            <Tag color="green">{r.paymentCount} TT</Tag>
            <Tag color="blue">{r.depositCount} cọc</Tag>
            {r.refundCount > 0 && <Tag color="volcano">{r.refundCount} hoàn</Tag>}
          </Space>
        ),
      },
    ];

    return (
      <Spin spinning={isLoadingPayments}>
        {paymentsError && (
          <Alert
            type="error"
            title="Không thể tải báo cáo thanh toán"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Text strong>Lọc phương thức:</Text>
            <Radio.Group
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="ALL">Tất cả phương thức</Radio.Button>
              <Radio.Button value="CASH">Tiền mặt (CASH)</Radio.Button>
              <Radio.Button value="BANK_TRANSFER">Chuyển khoản (BANK)</Radio.Button>
            </Radio.Group>
          </Space>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Thực thu ròng (Net Cash)</Text>}
                value={formatVnd(summary?.netCashCollected)}
                styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tổng tiền mặt & ngân hàng sau trừ hoàn trả
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #389e0d' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Thu tiền mặt (CASH)</Text>}
                value={formatVnd(summary?.cashPayments)}
                styles={{ content: { color: '#389e0d', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tiền mặt thu tại quầy lễ tân
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #096dd9' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Thu Chuyển khoản (BANK)</Text>}
                value={formatVnd(summary?.bankTransferPayments)}
                styles={{ content: { color: '#096dd9', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Chuyển khoản ngân hàng & QR
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #cf1322' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Tiền hoàn trả (Refunds)</Text>}
                value={formatVnd(summary?.successfulRefunds)}
                styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary?.refundCount || 0} lượt hoàn trả cho khách
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Payment Charts */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={15}>
            <Card
              title={
                <Space wrap size={6}>
                  <BarChartOutlined style={{ color: '#1b4d3e' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                    {screens.xs ? 'Tiền mặt vs Chuyển khoản' : `So sánh Tiền mặt vs Chuyển khoản (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
                  </Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <BarComparisonChart
                data={paymentChartData}
                series1Label="Tiền mặt (CASH)"
                series2Label="Chuyển khoản (BANK)"
                series1Color="#389e0d"
                series2Color="#096dd9"
                valueFormatter={(val) => formatVnd(val)}
                height={260}
              />
            </Card>
          </Col>
          <Col xs={24} lg={9}>
            <Card
              title={
                <Space wrap size={6}>
                  <PieChartOutlined style={{ color: '#096dd9' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>Tỷ trọng phương thức thanh toán</Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <div style={{ paddingTop: 12 }}>
                <DonutChart
                  data={paymentDonutData}
                  totalLabel="Tổng thanh toán"
                  valueFormatter={(val) => formatVnd(val)}
                  size={160}
                />
              </div>
            </Card>
          </Col>
        </Row>

        <Card
          title={`Chi tiết dòng tiền thanh toán (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
          size="small"
          style={{ borderRadius: 8 }}
        >
          <Table
            columns={columns}
            dataSource={pay?.series || []}
            rowKey="date"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 900 }}
            size="middle"
          />
        </Card>
      </Spin>
    );
  };

  // ----------------------------------------------------
  // RENDER TAB 3: OCCUPANCY & ADR / REVPAR
  // ----------------------------------------------------
  const renderOccupancyTab = () => {
    const occ = occupancyRes?.data;
    const summary = occ?.summary;
    const isReceptionist = userRole === 'RECEPTIONIST';

    // Aggregates computed on closed days in the current series as fallback for ongoing day periods
    const closedSeries = occ?.series?.filter((s) => s.unclosedDays === 0 && s.sellableRoomNights > 0) || [];
    const closedOccupied = closedSeries.reduce((acc, s) => acc + (s.occupiedRoomNights ?? 0), 0);
    const closedSellable = closedSeries.reduce((acc, s) => acc + s.sellableRoomNights, 0);
    const closedSales = closedSeries.reduce((acc, s) => acc + (s.roomSalesValue ? parseFloat(s.roomSalesValue) : 0), 0);
    const closedOccupancyRate = closedSellable > 0 ? Number(((closedOccupied / closedSellable) * 100).toFixed(2)) : null;
    const closedAdr = closedOccupied > 0 ? (closedSales / closedOccupied).toFixed(2) : null;
    const closedRevpar = closedSellable > 0 ? (closedSales / closedSellable).toFixed(2) : null;

    const displayOccupancyRate = summary?.occupancyRate ?? closedOccupancyRate;
    const displayAdr = summary?.operationalAdr ?? closedAdr;
    const displayRevpar = summary?.operationalRevpar ?? closedRevpar;

    const occupancyChartData: BarComparisonItem[] = (occ?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: item.occupiedRoomNights ?? 0,
      value2: item.sellableRoomNights ?? 0,
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Phòng có khách: ${item.occupiedRoomNights ?? 0} đêm (${item.occupancyRate !== null && item.occupancyRate !== undefined ? item.occupancyRate + '%' : 'Chưa chốt'})`,
      tooltipText2: `Phòng sẵn bán: ${item.sellableRoomNights} đêm`,
    }));

    const columns: ColumnsType<OccupancySeriesItem> = [
      {
        title: 'Mốc thời gian',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        render: (d) => <Text strong>{d}</Text>,
      },
      {
        title: 'Tổng phòng-đêm',
        dataIndex: 'totalRoomNights',
        key: 'totalRoomNights',
        align: 'center',
      },
      {
        title: 'Có thể bán',
        dataIndex: 'sellableRoomNights',
        key: 'sellableRoomNights',
        align: 'center',
      },
      {
        title: 'Có khách lưu trú',
        dataIndex: 'occupiedRoomNights',
        key: 'occupiedRoomNights',
        align: 'center',
        render: (val) => (val !== null && val !== undefined ? val : <Text type="secondary">-</Text>),
      },
      {
        title: 'Tỷ lệ lấp đầy',
        dataIndex: 'occupancyRate',
        key: 'occupancyRate',
        align: 'center',
        render: (val) => {
          if (val === null || val === undefined) {
            return <Tag color="default">Chưa chốt</Tag>;
          }
          const color = val >= 75 ? 'green' : val >= 50 ? 'blue' : 'orange';
          return <Tag color={color} style={{ fontWeight: 600 }}>{val}%</Tag>;
        },
      },
      ...(!isReceptionist
        ? [
            {
              title: 'Giá bình quân (ADR)',
              dataIndex: 'operationalAdr',
              key: 'operationalAdr',
              align: 'right' as const,
              render: (val: string | null | undefined) => (
                <Text>{val ? formatVnd(val) : <Text type="secondary">-</Text>}</Text>
              ),
            },
            {
              title: 'Doanh thu phòng (RevPAR)',
              dataIndex: 'operationalRevpar',
              key: 'operationalRevpar',
              align: 'right' as const,
              render: (val: string | null | undefined) => (
                <Text strong style={{ color: '#1b4d3e' }}>
                  {val ? formatVnd(val) : <Text type="secondary">-</Text>}
                </Text>
              ),
            },
          ]
        : []),
      {
        title: 'Chặn bảo trì (đêm)',
        dataIndex: 'maintenanceBlockedRoomNights',
        key: 'maintenanceBlockedRoomNights',
        align: 'center',
        render: (val) => (val > 0 ? <Tag color="volcano">{val}</Tag> : <Text type="secondary">0</Text>),
      },
    ];

    return (
      <Spin spinning={isLoadingOccupancy}>
        {occupancyError && (
          <Alert
            type="error"
            title="Không thể tải báo cáo công suất phòng"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {isReceptionist && (
          <Alert
            type="info"
            title="Lưu ý quyền hạn"
            description="Tài khoản Lễ tân được xem công suất phòng và các chỉ số buồng phòng, nhưng các chỉ số tài chính (ADR, RevPAR, Doanh số bán phòng) được ẩn theo chính sách bảo mật nội bộ."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {summary?.unclosedDays && summary.unclosedDays > 0 ? (
          <Alert
            type="warning"
            title={`Có ${summary.unclosedDays} ngày trong kỳ chưa hoàn tất chốt đêm (Night Audit - ngày hôm nay đang diễn ra)`}
            description={
              <Space orientation="vertical" style={{ width: '100%', marginTop: 4 }}>
                <Text>
                  Theo chuẩn kiểm toán khách sạn, ngày hôm nay đang mở và chỉ chốt đêm khi chạy Night Audit vào rạng sáng hôm sau. Thẻ tổng quan bên dưới phản ánh số liệu từ {closedSeries.length} ngày đã chốt xong đêm.
                </Text>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  onClick={() => setDateRange([dateRange[0], dayjs().startOf('day')])}
                >
                  Chỉ xem các đêm đã hoàn tất chốt đêm
                </Button>
              </Space>
            }
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {/* Room Type Filter */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Text strong>Hạng phòng:</Text>
            <Select
              style={{ width: 220 }}
              placeholder="Tất cả hạng phòng"
              allowClear
              value={selectedRoomTypeId}
              onChange={(val) => setSelectedRoomTypeId(val)}
              options={[
                { value: '', label: 'Tất cả hạng phòng' },
                ...roomTypes.map((rt) => ({ value: rt.id, label: `${rt.name} (${rt.code})` })),
              ]}
            />
          </Space>
        </div>

        {/* Occupancy KPI Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Tỷ lệ lấp đầy (Occupancy)</Text>}
                value={
                  displayOccupancyRate !== null && displayOccupancyRate !== undefined
                    ? `${displayOccupancyRate}%`
                    : 'Chưa đủ dữ liệu'
                }
                styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary?.occupiedRoomNights ?? closedOccupied} / {summary?.sellableRoomNights ?? closedSellable} phòng-đêm
              </Text>
            </Card>
          </Col>
          {!isReceptionist && (
            <>
              <Col xs={24} sm={12} lg={6}>
                <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1890ff' }}>
                  <Statistic
                    title={<Text strong style={{ color: '#595959' }}>Giá phòng bình quân (ADR)</Text>}
                    value={displayAdr ? formatVnd(displayAdr) : 'Chưa đủ dữ liệu'}
                    styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Doanh thu bình quân / phòng có khách
                  </Text>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #52c41a' }}>
                  <Statistic
                    title={<Text strong style={{ color: '#595959' }}>Doanh thu trên phòng sẵn có (RevPAR)</Text>}
                    value={displayRevpar ? formatVnd(displayRevpar) : 'Chưa đủ dữ liệu'}
                    styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Doanh thu bình quân / tổng phòng có thể bán
                  </Text>
                </Card>
              </Col>
            </>
          )}
          <Col xs={24} sm={12} lg={isReceptionist ? 12 : 6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #faad14' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Phòng bảo trì / OOS</Text>}
                value={summary?.maintenanceBlockedRoomNights || 0}
                styles={{ content: { color: '#d46b08', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Số phòng-đêm bị chặn do bảo trì sửa chữa
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Occupancy Chart */}
        <Card
          title={
            <Space wrap size={6}>
              <BarChartOutlined style={{ color: '#1b4d3e' }} />
              <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                {screens.xs ? 'Phòng có khách vs Sẵn bán' : `Biểu đồ so sánh Phòng có khách vs Phòng sẵn sàng bán (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
              </Text>
            </Space>
          }
          size="small"
          style={{ marginBottom: 20, borderRadius: 8 }}
        >
          <BarComparisonChart
            data={occupancyChartData}
            series1Label="Phòng có khách (Occupied)"
            series2Label="Phòng sẵn bán (Sellable)"
            series1Color="#1b4d3e"
            series2Color="#52c41a"
            valueFormatter={(val) => `${val} đêm`}
            height={260}
          />
        </Card>

        <Card
          title={`Chi tiết chuỗi công suất phòng (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
          size="small"
          style={{ borderRadius: 8 }}
        >
          <Table
            columns={columns}
            dataSource={occ?.series || []}
            rowKey="date"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 900 }}
            size="middle"
          />
        </Card>
      </Spin>
    );
  };

  // ----------------------------------------------------
  // RENDER TAB 4: RESERVATIONS
  // ----------------------------------------------------
  const renderReservationsTab = () => {
    const res = reservationsRes?.data;
    const summary = res?.summary;
    const sources = res?.bookingSources || [];

    const reservationChartData: BarComparisonItem[] = (res?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: item.reservationsCreated ?? 0,
      value2: item.actualCheckins ?? 0,
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Lượt đặt tạo mới: ${item.reservationsCreated} (${item.reservationRoomsCreated} phòng)`,
      tooltipText2: `Check-in thực tế: ${item.actualCheckins}`,
    }));

    const channelColors: Record<string, string> = {
      DIRECT: '#1b4d3e',
      WALK_IN: '#fa8c16',
      OTA: '#1890ff',
      ONLINE: '#1890ff',
      PHONE: '#722ed1',
      EMAIL: '#13c2c2',
      AGENT: '#eb2f96',
      CORPORATE: '#fa541c',
      OTHER: '#8c8c8c',
    };
    const defaultPalette = ['#1b4d3e', '#1890ff', '#fa8c16', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96'];
    const bookingSourcesDonutData: DonutSlice[] = sources.map((src, idx) => ({
      key: src.source,
      label: src.source,
      value: src.reservations,
      color: channelColors[src.source] || defaultPalette[idx % defaultPalette.length],
    }));

    const columns: ColumnsType<ReservationSeriesItem> = [
      {
        title: 'Mốc thời gian',
        dataIndex: 'date',
        key: 'date',
        fixed: 'left',
        render: (d) => <Text strong>{d}</Text>,
      },
      {
        title: 'Đặt tạo mới',
        dataIndex: 'reservationsCreated',
        key: 'reservationsCreated',
        align: 'center',
        render: (v) => <Text strong>{v}</Text>,
      },
      {
        title: 'Số phòng đặt',
        dataIndex: 'reservationRoomsCreated',
        key: 'reservationRoomsCreated',
        align: 'center',
      },
      {
        title: 'Đã xác nhận',
        dataIndex: 'confirmedReservationsInCreatedCohort',
        key: 'confirmedReservationsInCreatedCohort',
        align: 'center',
        render: (v) => <Tag color="blue">{v}</Tag>,
      },
      {
        title: 'Đã hủy',
        dataIndex: 'cancelledReservations',
        key: 'cancelledReservations',
        align: 'center',
        render: (v) => (v > 0 ? <Tag color="volcano">{v}</Tag> : <Text type="secondary">0</Text>),
      },
      {
        title: 'Khách không đến (No-show)',
        dataIndex: 'noShowReservationsInCreatedCohort',
        key: 'noShowReservationsInCreatedCohort',
        align: 'center',
        render: (v) => (v > 0 ? <Tag color="red">{v}</Tag> : <Text type="secondary">0</Text>),
      },
      {
        title: 'Check-in thực tế',
        dataIndex: 'actualCheckins',
        key: 'actualCheckins',
        align: 'center',
        render: (v) => <Tag color="green">{v}</Tag>,
      },
      {
        title: 'Check-out thực tế',
        dataIndex: 'actualCheckouts',
        key: 'actualCheckouts',
        align: 'center',
      },
    ];

    return (
      <Spin spinning={isLoadingReservations}>
        {reservationsError && (
          <Alert
            type="error"
            title="Không thể tải báo cáo đặt phòng"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Lượt đặt tạo mới trong kỳ</Text>}
                value={summary?.reservationsCreated || 0}
                styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tổng {summary?.reservationRoomsCreated || 0} phòng được đặt
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #52c41a' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Check-in thực tế</Text>}
                value={summary?.actualCheckins || 0}
                styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Lượt khách đã làm thủ tục nhận phòng
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1890ff' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Check-out thực tế</Text>}
                value={summary?.actualCheckouts || 0}
                styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Lượt khách đã thanh toán trả phòng
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #ff4d4f' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Đã hủy & No-show</Text>}
                value={(summary?.cancelledReservations || 0) + (summary?.noShowReservationsInCreatedCohort || 0)}
                styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {summary?.cancelledReservations || 0} đã hủy, {summary?.noShowReservationsInCreatedCohort || 0} no-show
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Visual Charts: Reservations vs Checkins Bar & Booking Channels Donut */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={15}>
            <Card
              title={
                <Space wrap size={6}>
                  <BarChartOutlined style={{ color: '#1b4d3e' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                    {screens.xs ? 'Đặt mới vs Check-in' : `So sánh Lượt đặt tạo mới vs Check-in thực tế (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
                  </Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <BarComparisonChart
                data={reservationChartData}
                series1Label="Lượt đặt mới"
                series2Label="Check-in thực tế"
                series1Color="#1b4d3e"
                series2Color="#52c41a"
                valueFormatter={(val) => `${val} lượt`}
                height={260}
              />
            </Card>
          </Col>
          <Col xs={24} lg={9}>
            <Card
              title={
                <Space wrap size={6}>
                  <PieChartOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>Cơ cấu nguồn đặt phòng</Text>
                </Space>
              }
              size="small"
              style={{ borderRadius: 8, height: '100%' }}
            >
              <div style={{ paddingTop: 12 }}>
                <DonutChart
                  data={bookingSourcesDonutData}
                  totalLabel="Tổng lượt đặt"
                  valueFormatter={(val) => `${val} lượt`}
                  size={160}
                />
              </div>
            </Card>
          </Col>
        </Row>

        {/* Time series */}
        <Card
          title={`Chi tiết diễn biến đặt phòng (${groupBy === 'day' ? 'Theo ngày' : 'Theo tháng'})`}
          size="small"
          style={{ borderRadius: 8 }}
        >
          <Table
            columns={columns}
            dataSource={res?.series || []}
            rowKey="date"
            pagination={{ pageSize: 15 }}
            scroll={{ x: 900 }}
            size="middle"
          />
        </Card>
      </Spin>
    );
  };

  // ----------------------------------------------------
  // RENDER TAB 5: OPERATIONS
  // ----------------------------------------------------
  const renderOperationsTab = () => {
    const ops = operationsRes?.data;
    const hk = ops?.housekeeping;
    const maint = ops?.maintenance;

    return (
      <Spin spinning={isLoadingOperations}>
        {operationsError && (
          <Alert
            type="error"
            title="Không thể tải báo cáo vận hành"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary">
            * Dữ liệu tức thời tại thời điểm chốt snapshot:{' '}
            <Text code>{ops?.snapshotAt ? dayjs(ops.snapshotAt).format('DD/MM/YYYY HH:mm:ss') : '-'}</Text>
          </Text>
          <Space>
            {hk && (
              <Button
                type="primary"
                ghost
                icon={<SyncOutlined />}
                onClick={() => navigate('/housekeeping')}
              >
                Đến Bảng Kanban Buồng phòng
              </Button>
            )}
            {maint && (
              <Button
                type="default"
                icon={<ToolOutlined />}
                onClick={() => navigate('/maintenance')}
              >
                Đến Quản lý Bảo trì
              </Button>
            )}
          </Space>
        </div>

        {/* HOUSEKEEPING SECTION */}
        {hk && (
          <Card
            title={
              <Space wrap size={6}>
                <SyncOutlined style={{ color: '#1b4d3e' }} />
                <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                  {screens.xs ? 'Vận hành Buồng phòng' : 'Vận hành Buồng phòng (Housekeeping Performance)'}
                </Text>
              </Space>
            }
            style={{ marginBottom: 20, borderRadius: 8 }}
          >
            <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
              Tình trạng phòng tức thời (Snapshot)
            </Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #ff4d4f' }}>
                  <Statistic title="Phòng bẩn" value={hk.snapshot.dirtyRooms} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #faad14' }}>
                  <Statistic title="Đang dọn" value={hk.snapshot.cleaningRooms} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #1890ff' }}>
                  <Statistic title="Chờ nghiệm thu" value={hk.snapshot.roomsAwaitingInspection} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #52c41a' }}>
                  <Statistic title="Sẵn sàng đón khách" value={hk.snapshot.readyRooms} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #722ed1' }}>
                  <Statistic title="Tác vụ dọn đang mở" value={hk.snapshot.activeHousekeepingTasks} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #13c2c2' }}>
                  <Statistic title="Nhiệm vụ làm sạch" value={hk.snapshot.cleaningTasks} />
                </Card>
              </Col>
            </Row>

            <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
              Hiệu suất hoàn thành trong kỳ được chọn
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic
                    title={<Text strong>Số tác vụ dọn đã hoàn thành (Cleaned)</Text>}
                    value={hk.period.completedHousekeepingTasks}
                    styles={{ content: { color: '#389e0d', fontWeight: 600 } }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                  <Statistic
                    title={<Text strong>Số tác vụ đã kiểm định & nghiệm thu (Inspected)</Text>}
                    value={hk.period.inspectedHousekeepingTasks}
                    styles={{ content: { color: '#096dd9', fontWeight: 600 } }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        )}

        {/* MAINTENANCE SECTION */}
        {maint && (
          <Card
            title={
              <Space wrap size={6}>
                <ToolOutlined style={{ color: '#d46b08' }} />
                <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                  {screens.xs ? 'Bảo trì & Kỹ thuật' : 'Bảo trì & Kỹ thuật phòng (Maintenance Performance)'}
                </Text>
              </Space>
            }
            style={{ borderRadius: 8 }}
          >
            <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
              Tình trạng thiết bị & phòng tức thời (Snapshot)
            </Title>
            <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
              <Col xs={12} sm={8} lg={5}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #ff4d4f' }}>
                  <Statistic title="Phòng đang sửa chữa" value={maint.snapshot.roomsUnderMaintenance} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={5}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #fa8c16' }}>
                  <Statistic title="Phòng ngừng phục vụ (OOS)" value={maint.snapshot.roomsOutOfService} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={5}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #1890ff' }}>
                  <Statistic title="Phiếu bảo trì đang mở" value={maint.snapshot.openMaintenanceTickets} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={5}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #faad14' }}>
                  <Statistic title="Phiếu đang xử lý" value={maint.snapshot.inProgressMaintenanceTickets} />
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Card size="small" style={{ textAlign: 'center', borderTop: '3px solid #722ed1' }}>
                  <Statistic title="Phòng đang bị chặn" value={maint.snapshot.activeMaintenanceBlocks} />
                </Card>
              </Col>
            </Row>

            <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
              Ảnh hưởng đến quỹ phòng bán trong kỳ
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" style={{ background: '#fff2e8', border: '1px solid #ffbb96' }}>
                  <Statistic
                    title={<Text strong>Tổng số đêm phòng bị chặn bảo trì (Blocked Room Nights)</Text>}
                    value={maint.period.maintenanceBlockedRoomNights}
                    styles={{ content: { color: '#d4380d', fontWeight: 600 } }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Số đêm phòng không thể bán do sự cố kỹ thuật trong khoảng thời gian đã chọn
                  </Text>
                </Card>
              </Col>
            </Row>
          </Card>
        )}
      </Spin>
    );
  };

  // ----------------------------------------------------
  // RENDER TAB 6: OUTSTANDING BALANCES
  // ----------------------------------------------------
  const renderOutstandingTab = () => {
    const out = outstandingRes?.data;
    const summary = out?.summary;
    const items = out?.items || [];
    const pagination = out?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

    const columns: ColumnsType<OutstandingItem> = [
      {
        title: 'Mã hóa đơn / Folio',
        dataIndex: 'folioId',
        key: 'folioId',
        width: 220,
        sorter: true,
        render: (id) => (
          <Space orientation="vertical" size={2}>
            <Text strong style={{ color: '#1b4d3e', whiteSpace: 'nowrap' }}>#{id}</Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 12, whiteSpace: 'nowrap' }}
              onClick={() => navigate(`/folios?folioId=${id}`)}
            >
              Xem chi tiết hóa đơn &rarr;
            </Button>
          </Space>
        ),
      },
      {
        title: 'Phân loại công nợ',
        key: 'balanceType',
        width: 260,
        align: 'center',
        render: (_, r) => {
          const num = parseFloat(r.outstandingBalance || '0');
          if (num > 0) {
            return <Tag color="volcano" style={{ whiteSpace: 'nowrap' }}>DEBIT: Khách còn nợ tiền</Tag>;
          } else if (num < 0) {
            return <Tag color="green" style={{ whiteSpace: 'nowrap' }}>CREDIT: Khách trả dư / Cần hoàn</Tag>;
          }
          return <Tag color="default" style={{ whiteSpace: 'nowrap' }}>Đã tất toán (0 ₫)</Tag>;
        },
      },
      {
        title: 'Số dư công nợ',
        dataIndex: 'outstandingBalance',
        key: 'outstandingBalance',
        width: 200,
        align: 'right',
        sorter: true,
        render: (val) => {
          const num = parseFloat(val || '0');
          const color = num > 0 ? '#cf1322' : num < 0 ? '#389e0d' : '#595959';
          return <Text strong style={{ color, fontSize: 15, whiteSpace: 'nowrap' }}>{formatVnd(val)}</Text>;
        },
      },
    ];

    return (
      <Spin spinning={isLoadingOutstanding}>
        {outstandingError && (
          <Alert
            type="error"
            title="Không thể tải sổ theo dõi công nợ"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Tổng dư nợ ròng</Text>}
                value={formatVnd(summary?.outstandingBalance)}
                styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Net Accounts Receivable - Customer Credits
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #cf1322' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Phải thu từ khách (Nợ)</Text>}
                value={formatVnd(summary?.accountsReceivable)}
                styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tổng số tiền khách lưu trú chưa thanh toán
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #389e0d' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Khách trả thừa / Trả trước (Có)</Text>}
                value={formatVnd(summary?.customerCredits)}
                styles={{ content: { color: '#389e0d', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tiền đặt cọc hoặc thanh toán vượt mức hóa đơn
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #fa8c16' }}>
              <Statistic
                title={<Text strong style={{ color: '#595959' }}>Số Folio có số dư</Text>}
                value={summary?.folioCount || 0}
                styles={{ content: { color: '#fa8c16', fontWeight: 600, fontSize: 20 } }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Các hóa đơn chưa cân bằng về 0 ₫
              </Text>
            </Card>
          </Col>
        </Row>

        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <Space wrap size={6}>
                <FileTextOutlined style={{ color: '#1b4d3e' }} />
                <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>Danh sách Folio còn số dư công nợ</Text>
                <Tag color="geekblue" style={{ margin: 0 }}>{pagination.total} folios</Tag>
              </Space>
            </div>
          }
          size="small"
          style={{ borderRadius: 8 }}
        >
          <Table
            columns={columns}
            dataSource={items}
            rowKey="folioId"
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: false,
              onChange: (page) => setOutstandingPage(page),
            }}
            onChange={(_pagination, _filters, sorter: any) => {
              if (sorter.field) {
                setOutstandingSort({
                  sortBy: sorter.field === 'folioId' ? 'folioId' : 'outstandingBalance',
                  sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc',
                });
              }
            }}
            size="middle"
            scroll={{ x: 750 }}
          />
        </Card>
      </Spin>
    );
  };

  return (
    <div style={{ padding: '0 4px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Title level={3} style={{ margin: 0, color: '#1b4d3e' }}>
              Báo cáo & Phân tích Hoạt động
            </Title>
            <Text type="secondary">
              Theo dõi số liệu doanh thu, dòng tiền, công suất phòng và hiệu suất vận hành theo chuẩn kế toán
            </Text>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              {canExportCsv && ['revenue', 'payments', 'occupancy', 'reservations'].includes(activeTab) && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  onClick={handleExportCsv}
                  style={{ background: '#1b4d3e', borderColor: '#1b4d3e' }}
                >
                  Xuất báo cáo CSV
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Global Filter Toolbar */}
      <Card
        size="small"
        style={{
          marginBottom: 20,
          borderRadius: 8,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Space wrap align="center">
              <Text strong>Khoảng thời gian [Start, End):</Text>
              <RangePicker
                allowClear={false}
                value={dateRange}
                format="DD/MM/YYYY"
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    const diffDays = dates[1].diff(dates[0], 'day');
                    if (diffDays > 366) {
                      message.error('Khoảng thời gian báo cáo không được vượt quá 366 ngày (1 năm).');
                      return;
                    }
                    if (diffDays < 1) {
                      message.error('Ngày bắt đầu phải trước ngày kết thúc ít nhất 1 ngày.');
                      return;
                    }
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
              />
              <Space wrap size={4}>
                <Button size="small" onClick={handlePreset7Days}>
                  Theo 7 ngày
                </Button>
                <Button size="small" onClick={handlePresetMonth}>
                  Theo tháng
                </Button>
                <Button size="small" onClick={handlePresetQuarter}>
                  Theo quý
                </Button>
                <Button size="small" onClick={handlePresetYear}>
                  Theo năm
                </Button>
              </Space>
            </Space>
          </Col>

          <Col xs={24} lg={10} style={{ textAlign: screens.xs ? 'left' : 'right' }}>
            {['revenue', 'payments', 'occupancy', 'reservations'].includes(activeTab) && (
              <Space wrap>
                <Text strong>Gộp nhóm chuỗi dữ liệu:</Text>
                <Radio.Group
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="day">Theo ngày</Radio.Button>
                  <Radio.Button value="month">Theo tháng</Radio.Button>
                </Radio.Group>
              </Space>
            )}
          </Col>
        </Row>
      </Card>

      {/* Main Tabs */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          type="line"
          items={availableTabs.map((tab) => ({
            key: tab.key,
            label: (
              <Space>
                {tab.icon}
                <span>{tab.label}</span>
              </Space>
            ),
            children: (
              <div style={{ paddingTop: 8 }}>
                {tab.key === 'revenue' && renderRevenueTab()}
                {tab.key === 'payments' && renderPaymentsTab()}
                {tab.key === 'occupancy' && renderOccupancyTab()}
                {tab.key === 'reservations' && renderReservationsTab()}
                {tab.key === 'operations' && renderOperationsTab()}
                {tab.key === 'outstanding' && renderOutstandingTab()}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};
