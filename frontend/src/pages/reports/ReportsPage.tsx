import { ResponsiveRangePicker as RangePicker } from '../../components/responsive/ResponsiveRangePicker.tsx';
import { ResponsiveTabs as Tabs } from '../../components/responsive/ResponsiveTabs.tsx';
import { ProcurementTab } from './components/ProcurementTab.tsx';
import React, { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Radio,
  App as AntdApp,
  Grid,
  Alert,
  Spin,
  Tooltip,
} from 'antd';
import {
  DollarOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  ToolOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useAuthStore } from '../../store/authStore.ts';
import { useHotelClock } from '../../hooks/useHotelClock.ts';
import { isReportRangeError, reportConfigKey, reportExportError, reportRangeErrorMessage, reportsApi } from '../../api/reports.api.ts';
import { RevenueTab } from './components/RevenueTab.tsx';
import { PaymentsTab } from './components/PaymentsTab.tsx';
import { OccupancyTab } from './components/OccupancyTab.tsx';
import { ReservationsTab } from './components/ReservationsTab.tsx';
import { OperationsTab } from './components/OperationsTab.tsx';
import { OutstandingTab } from './components/OutstandingTab.tsx';

const { Title, Text } = Typography;


// Report tabs stay mounted once visited. Memoizing them keeps a change that
// only affects one tab (for example the room-type filter) from re-rendering
// every other report chart.
const MemoRevenueTab = React.memo(RevenueTab);
const MemoPaymentsTab = React.memo(PaymentsTab);
const MemoOccupancyTab = React.memo(OccupancyTab);
const MemoReservationsTab = React.memo(ReservationsTab);
const MemoOperationsTab = React.memo(OperationsTab);
const MemoOutstandingTab = React.memo(OutstandingTab);

export const ReportsPage: React.FC = () => {
  const clock = useHotelClock();
  const config = useQuery({
    queryKey: reportConfigKey,
    queryFn: ({ signal }) => reportsApi.getConfig(signal),
    enabled: Boolean(clock),
  });
  if (!clock) return <Alert type="error" showIcon title="Chưa xác định được múi giờ khách sạn" />;
  if (!config.data) {
    return config.isError
      ? <Alert type="error" showIcon title="Không thể tải cấu hình báo cáo"
          action={<Button onClick={() => void config.refetch()}>Thử lại</Button>} />
      : <Spin />;
  }
  return <Reports hotelDate={clock.date} maxDays={config.data.maxDays} />;
};

const Reports: React.FC<{ hotelDate: string; maxDays: number }> = ({ hotelDate, maxDays }) => {
  const { message: appMessage } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const screens = Grid.useBreakpoint();
  const userRole = user?.role || '';

  // Role permissions
  const canViewFinancial = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);
  const canViewFrontDeskReports = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(userRole);
  const canViewOperations = canViewFrontDeskReports || ['HOUSEKEEPING', 'TECHNICIAN'].includes(userRole);
  const canExportCsv = ['ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(userRole);

  const [selectedTab, setSelectedTab] = useState('');

  const [rangeOverride, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const today = useMemo(() => dayjs(hotelDate), [hotelDate]);
  const dateRange = useMemo<[Dayjs, Dayjs]>(() => {
    const end = rangeOverride?.[1] ?? today.add(1, 'day');
    const start = rangeOverride?.[0] ?? today.subtract(30, 'day');
    return end.diff(start, 'day') > maxDays ? [end.subtract(maxDays, 'day'), end] : [start, end];
  }, [rangeOverride, today, maxDays]);

  useEffect(() => queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error' && isReportRangeError(event.action.error)) {
      void appMessage.warning(reportRangeErrorMessage);
      void queryClient.invalidateQueries({ queryKey: reportConfigKey, exact: true });
    }
  }), [appMessage, queryClient]);

  const startDateStr = dateRange[0].format('YYYY-MM-DD');
  const endDateStr = dateRange[1].format('YYYY-MM-DD');

  // Aggregation group: 'day' | 'month'
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');

  // Filters for sub-tabs
  const [paymentMethod, setPaymentMethod] = useState<'ALL' | 'CASH' | 'BANK_TRANSFER'>('ALL');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | undefined>(undefined);

  // Export loading state
  const [exporting, setExporting] = useState<boolean>(false);

  // ----------------------------------------------------
  // CSV EXPORT HANDLER
  // ----------------------------------------------------
  const handleExportCsv = async () => {
    if (!canExportCsv) {
      appMessage.warning('Tài khoản của bạn không có quyền trích xuất dữ liệu báo cáo sang CSV.');
      return;
    }

    let exportType: 'revenue' | 'occupancy' | 'reservations' | 'payments' | null = null;
    if (activeTab === 'revenue') exportType = 'revenue';
    else if (activeTab === 'payments') exportType = 'payments';
    else if (activeTab === 'occupancy') exportType = 'occupancy';
    else if (activeTab === 'reservations') exportType = 'reservations';

    if (!exportType) {
      appMessage.info('Báo cáo hiện tại không hỗ trợ tải file CSV trực tiếp.');
      return;
    }

    // Role check for Accountant
    if (userRole === 'ACCOUNTANT' && (exportType === 'occupancy' || exportType === 'reservations')) {
      appMessage.warning('Kế toán chỉ được phép xuất dữ liệu Báo cáo Doanh thu và Dòng tiền.');
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

      appMessage.success(`Đã xuất báo cáo ${filename} thành công!`);
    } catch (err: unknown) {
      const failure = await reportExportError(err);
      if (failure?.error?.code === 'REPORT_RANGE_TOO_LARGE') {
        await queryClient.invalidateQueries({ queryKey: reportConfigKey, exact: true });
      }
      appMessage.error(failure?.message ?? 'Có lỗi xảy ra khi xuất file CSV.');
    } finally {
      setExporting(false);
    }
  };

  // Quick period presets
  const periodEnd = today.add(1, 'day');
  const presets = [
    { label: 'Theo 7 ngày', start: today.subtract(6, 'day'), group: 'day' },
    { label: 'Theo tháng', start: today.startOf('month'), group: 'day' },
    { label: 'Theo quý', start: today.subtract(89, 'day'), group: 'month' },
    { label: 'Theo năm', start: today.startOf('year'), group: 'month' },
  ] as const;
  const maxDaysMessage = `Giới hạn báo cáo là ${maxDays} ngày.`;

  // Memoized tab items (does NOT depend on activeTab, avoiding recreating tabs on switch)
  const tabItems = useMemo(() => {
    const items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> = [];

    if (canViewFinancial) {
      items.push({
        key: 'revenue',
        label: (
          <Space>
            <DollarOutlined />
            <span>Doanh thu & Bán phòng</span>
          </Space>
        ),
        children: (
          <div style={{ paddingTop: 8 }}>
            <MemoRevenueTab startDateStr={startDateStr} endDateStr={endDateStr} groupBy={groupBy} />
          </div>
        ),
      });
      items.push({
        key: 'payments',
        label: (
          <Space>
            <CreditCardOutlined />
            <span>Dòng tiền & Thu chi</span>
          </Space>
        ),
        children: (
          <div style={{ paddingTop: 8 }}>
            <MemoPaymentsTab
              startDateStr={startDateStr}
              endDateStr={endDateStr}
              groupBy={groupBy}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
            />
          </div>
        ),
      });
    }

    if (canViewFinancial) {
      items.push({
        key: 'procurement',
        label: <Space><FileTextOutlined /><span>Mua vật tư & Công nợ NCC</span></Space>,
        children: <ProcurementTab
          key={`${startDateStr}:${endDateStr}`}
          startDateStr={startDateStr}
          endDateStr={endDateStr}
          groupBy={groupBy}
        />,
      });
    }
    if (canViewFrontDeskReports) {
      items.push({
        key: 'occupancy',
        label: (
          <Space>
            <CalendarOutlined />
            <span>Công suất & ADR / RevPAR</span>
          </Space>
        ),
        children: (
          <div style={{ paddingTop: 8 }}>
            <MemoOccupancyTab
              startDateStr={startDateStr}
              endDateStr={endDateStr}
              groupBy={groupBy}
              userRole={userRole}
              selectedRoomTypeId={selectedRoomTypeId}
              onSelectedRoomTypeIdChange={setSelectedRoomTypeId}
              dateRange={dateRange}
              hotelDate={hotelDate}
              onDateRangeChange={setDateRange}
            />
          </div>
        ),
      });
      items.push({
        key: 'reservations',
        label: (
          <Space>
            <AppstoreOutlined />
            <span>Đặt phòng & Nguồn khách</span>
          </Space>
        ),
        children: (
          <div style={{ paddingTop: 8 }}>
            <MemoReservationsTab startDateStr={startDateStr} endDateStr={endDateStr} groupBy={groupBy} />
          </div>
        ),
      });
    }

    if (canViewOperations) items.push({
      key: 'operations',
      label: (
        <Space>
          <ToolOutlined />
          <span>Vận hành Buồng & Bảo trì</span>
        </Space>
      ),
      children: (
        <div style={{ paddingTop: 8 }}>
          <MemoOperationsTab startDateStr={startDateStr} endDateStr={endDateStr} />
        </div>
      ),
    });

    if (canViewFinancial) {
      items.push({
        key: 'outstanding',
        label: (
          <Space>
            <FileTextOutlined />
            <span>Sổ theo dõi Công nợ</span>
          </Space>
        ),
        children: (
          <div style={{ paddingTop: 8 }}>
            <MemoOutstandingTab startDateStr={startDateStr} endDateStr={endDateStr} />
          </div>
        ),
      });
    }

    return items;
  }, [
    canViewFinancial,
    canViewFrontDeskReports,
    canViewOperations,
    startDateStr,
    endDateStr,
    groupBy,
    paymentMethod,
    selectedRoomTypeId,
    userRole,
    dateRange,
    hotelDate,
  ]);
  const activeTab = tabItems.some(({ key }) => key === selectedTab) ? selectedTab : tabItems[0]?.key ?? '';

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
                    if (diffDays > maxDays) {
                      appMessage.error(maxDaysMessage);
                      return;
                    }
                    if (diffDays < 1) {
                      appMessage.error('Ngày bắt đầu phải trước ngày kết thúc ít nhất 1 ngày.');
                      return;
                    }
                    setDateRange([dates[0], dates[1]]);
                  }
                }}
              />
              <Space wrap size={4}>
                {presets.map(({ label, start, group }) => {
                  const disabled = periodEnd.diff(start, 'day') > maxDays;
                  return (
                    <Tooltip key={label} title={disabled ? maxDaysMessage : undefined}>
                      <span>
                        <Button size="small" disabled={disabled} onClick={() => {
                          setDateRange([start, periodEnd]);
                          setGroupBy(group);
                        }}>
                          {label}
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })}
              </Space>
              <Text type="secondary">{maxDaysMessage}</Text>
            </Space>
          </Col>

          <Col xs={24} lg={10} style={{ textAlign: screens.xs ? 'left' : 'right' }}>
            {['revenue', 'payments', 'occupancy', 'reservations', 'procurement'].includes(activeTab) && (
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
          onChange={setSelectedTab}
          type="line"
          items={tabItems}
        />
      </Card>
    </div>
  );
};
