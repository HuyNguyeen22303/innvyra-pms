import React, { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tabs,
  Button,
  DatePicker,
  Radio,
  App as AntdApp,
  Grid,
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
import { reportsApi } from '../../api/reports.api.ts';
import { RevenueTab } from './components/RevenueTab.tsx';
import { PaymentsTab } from './components/PaymentsTab.tsx';
import { OccupancyTab } from './components/OccupancyTab.tsx';
import { ReservationsTab } from './components/ReservationsTab.tsx';
import { OperationsTab } from './components/OperationsTab.tsx';
import { OutstandingTab } from './components/OutstandingTab.tsx';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const ReportsPage: React.FC = () => {
  const { message: appMessage } = AntdApp.useApp();
  const { user } = useAuthStore();
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
    } catch (err: any) {
      appMessage.error(err?.response?.data?.message || 'Có lỗi xảy ra khi xuất file CSV.');
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
            <RevenueTab startDateStr={startDateStr} endDateStr={endDateStr} groupBy={groupBy} />
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
            <PaymentsTab
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
            <OccupancyTab
              startDateStr={startDateStr}
              endDateStr={endDateStr}
              groupBy={groupBy}
              userRole={userRole}
              selectedRoomTypeId={selectedRoomTypeId}
              onSelectedRoomTypeIdChange={setSelectedRoomTypeId}
              dateRange={dateRange}
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
            <ReservationsTab startDateStr={startDateStr} endDateStr={endDateStr} groupBy={groupBy} />
          </div>
        ),
      });
    }

    items.push({
      key: 'operations',
      label: (
        <Space>
          <ToolOutlined />
          <span>Vận hành Buồng & Bảo trì</span>
        </Space>
      ),
      children: (
        <div style={{ paddingTop: 8 }}>
          <OperationsTab startDateStr={startDateStr} endDateStr={endDateStr} />
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
            <OutstandingTab startDateStr={startDateStr} endDateStr={endDateStr} />
          </div>
        ),
      });
    }

    return items;
  }, [
    canViewFinancial,
    canViewFrontDeskReports,
    startDateStr,
    endDateStr,
    groupBy,
    paymentMethod,
    selectedRoomTypeId,
    userRole,
    dateRange,
  ]);

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
                      appMessage.error('Khoảng thời gian báo cáo không được vượt quá 366 ngày (1 năm).');
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
          items={tabItems}
        />
      </Card>
    </div>
  );
};
