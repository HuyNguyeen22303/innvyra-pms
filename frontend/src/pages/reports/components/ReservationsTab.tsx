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
  BarChartOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.ts';
import { BarComparisonChart, type BarComparisonItem } from '../../../components/charts/BarComparisonChart.tsx';
import { DonutChart, type DonutSlice } from '../../../components/charts/DonutChart.tsx';
import type { ReservationSeriesItem } from '../../../types/reports.types.ts';

const { Text } = Typography;

const formatReservationCount = (val: number) => `${val} lượt`;

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

export interface ReservationsTabProps {
  startDateStr: string;
  endDateStr: string;
  groupBy: 'day' | 'month';
}

export const ReservationsTab: React.FC<ReservationsTabProps> = React.memo(({
  startDateStr,
  endDateStr,
  groupBy,
}) => {
  const screens = Grid.useBreakpoint();

  const {
    data: reservationsRes,
    isLoading: isLoadingReservations,
    error: reservationsError,
  } = useQuery({
    queryKey: ['report-reservations', startDateStr, endDateStr, groupBy],
    queryFn: () => reportsApi.getReservations({ startDate: startDateStr, endDate: endDateStr, groupBy }),
    staleTime: 60000,
  });

  const res = reservationsRes?.data;
  const summary = res?.summary;

  const reservationChartData: BarComparisonItem[] = useMemo(() => {
    return (res?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: item.reservationsCreated ?? 0,
      value2: item.actualCheckins ?? 0,
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Lượt đặt tạo mới: ${item.reservationsCreated} (${item.reservationRoomsCreated} phòng)`,
      tooltipText2: `Check-in thực tế: ${item.actualCheckins}`,
    }));
  }, [res?.series, groupBy]);

  const bookingSourcesDonutData: DonutSlice[] = useMemo(() => {
    return (res?.bookingSources || []).map((src, idx) => ({
      key: src.source,
      label: src.source,
      value: src.reservations,
      color: channelColors[src.source] || defaultPalette[idx % defaultPalette.length],
    }));
  }, [res?.bookingSources]);

  const columns: ColumnsType<ReservationSeriesItem> = useMemo(() => [
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
  ], []);

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

      <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Lượt đặt tạo mới trong kỳ</Text>}
              value={summary?.reservationsCreated || 0}
              styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Tổng {summary?.reservationRoomsCreated || 0} phòng được đặt
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
              title={<Text strong style={{ color: '#595959' }}>Check-in thực tế</Text>}
              value={summary?.actualCheckins || 0}
              styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Lượt khách đã làm thủ tục nhận phòng
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
              title={<Text strong style={{ color: '#595959' }}>Check-out thực tế</Text>}
              value={summary?.actualCheckouts || 0}
              styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Lượt khách đã thanh toán trả phòng
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #ff4d4f' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Đã hủy & No-show</Text>}
              value={(summary?.cancelledReservations || 0) + (summary?.noShowReservationsInCreatedCohort || 0)}
              styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
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
              valueFormatter={formatReservationCount}
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
                valueFormatter={formatReservationCount}
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
});
