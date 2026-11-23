import React, { useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Table,
  Spin,
  Statistic,
  Alert,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DollarOutlined,
  LineChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.ts';
import { ReportTrendChart } from '../../../components/charts/ReportTrendChart.tsx';
import { DonutChart, type DonutSlice } from '../../../components/charts/DonutChart.tsx';
import type { RevenueSeriesItem } from '../../../types/reports.types.ts';
import { formatReportTotal, formatVnd } from '../reports.utils.ts';

const { Text } = Typography;

const formatVndNumber = (val: number) => formatVnd(val);
const compactVnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const revenueSeries = [
  { dataKey: 'billed', label: 'Doanh thu ghi nhận', color: '#1b4d3e' },
  { dataKey: 'cash', label: 'Thực thu ròng', color: '#2469a2', dashed: true },
] as const;

export interface RevenueTabProps {
  startDateStr: string;
  endDateStr: string;
  groupBy: 'day' | 'month';
}

export const RevenueTab: React.FC<RevenueTabProps> = React.memo(({
  startDateStr,
  endDateStr,
  groupBy,
}) => {
  const screens = Grid.useBreakpoint();

  const {
    data: revenueRes,
    isLoading: isLoadingRevenue,
    error: revenueError,
  } = useQuery({
    queryKey: ['report-revenue', startDateStr, endDateStr, groupBy],
    queryFn: () => reportsApi.getRevenue({ startDate: startDateStr, endDate: endDateStr, groupBy }),
    staleTime: 60000,
  });

  const rev = revenueRes?.data;
  const summary = rev?.summary;
  const balance = rev?.balance;

  const revenueChartData = useMemo(() => (rev?.series ?? []).map((item) => ({
    ...item,
    billed: Number(item.netBilledCharges),
    cash: Number(item.netCashCollected),
  })), [rev?.series]);

  const revenueDonutData: DonutSlice[] = useMemo(() => {
    const data: DonutSlice[] = [];
    const roomChargesNum = parseFloat(summary?.roomCharges || '0');
    const serviceChargesNum = parseFloat(summary?.serviceCharges || '0');
    if (roomChargesNum > 0) {
      data.push({ key: 'room', label: 'Tiền phòng', value: roomChargesNum, color: '#1b4d3e', displayValue: formatVnd(summary?.roomCharges) });
    }
    if (serviceChargesNum > 0) {
      data.push({ key: 'service', label: 'Dịch vụ & Minibar', value: serviceChargesNum, color: '#1890ff', displayValue: formatVnd(summary?.serviceCharges) });
    }
    return data;
  }, [summary?.roomCharges, summary?.serviceCharges]);

  const columns: ColumnsType<RevenueSeriesItem> = useMemo(
    () => [
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
    ],
    []
  );

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
      <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Tiền phòng đã Billed</Text>}
              value={formatVnd(summary?.roomCharges)}
              styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Ghi nhận từ tiền phòng theo đêm lưu trú
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1890ff' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Tiền dịch vụ phát sinh</Text>}
              value={formatVnd(summary?.serviceCharges)}
              styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Dịch vụ, minibar, giặt ủi, ẩm thực
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #52c41a' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Thực thu ròng kỳ này</Text>}
              value={formatVnd(summary?.netCashCollected)}
              styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              (Thanh toán + Đặt cọc) - Hoàn trả
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #fa8c16' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Biến động công nợ kỳ</Text>}
              value={formatVnd(summary?.balanceMovement)}
              styles={{ content: { color: '#fa8c16', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
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

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space wrap size={6}>
                <LineChartOutlined style={{ color: '#1b4d3e' }} />
                <Text strong style={{ fontSize: screens.xs ? 13 : 14 }}>
                  Doanh thu ghi nhận và thực thu ròng
                </Text>
              </Space>
            }
            size="small"
            style={{ borderRadius: 8, height: '100%' }}
          >
            <ReportTrendChart
              label="Doanh thu ghi nhận và thực thu ròng"
              data={revenueChartData}
              groupBy={groupBy}
              series={revenueSeries}
              formatTick={compactVnd.format}
              describePoint={(point) => [
                { label: 'Doanh thu ghi nhận', value: formatVnd(point.netBilledCharges) },
                { label: 'Thực thu ròng', value: formatVnd(point.netCashCollected) },
                { label: 'Tiền phòng', value: formatVnd(point.roomCharges) },
                { label: 'Tiền dịch vụ', value: formatVnd(point.serviceCharges) },
              ]}
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
                displayTotal={formatReportTotal(summary?.roomCharges, summary?.serviceCharges)}
                valueFormatter={formatVndNumber}
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
});
