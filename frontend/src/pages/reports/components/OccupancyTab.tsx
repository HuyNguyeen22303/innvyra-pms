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
  Select,
  Button,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.ts';
import { roomTypesApi } from '../../../api/rooms.api.ts';
import { BarComparisonChart, type BarComparisonItem } from '../../../components/charts/BarComparisonChart.tsx';
import type { OccupancySeriesItem } from '../../../types/reports.types.ts';
import { formatVnd } from '../reports.utils.ts';

const { Text } = Typography;

const formatNightCount = (val: number) => `${val} đêm`;

export interface OccupancyTabProps {
  startDateStr: string;
  endDateStr: string;
  groupBy: 'day' | 'month';
  userRole?: string;
  selectedRoomTypeId?: string;
  onSelectedRoomTypeIdChange: (val?: string) => void;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs];
  onDateRangeChange: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void;
}

export const OccupancyTab: React.FC<OccupancyTabProps> = React.memo(({
  startDateStr,
  endDateStr,
  groupBy,
  userRole,
  selectedRoomTypeId,
  onSelectedRoomTypeIdChange,
  dateRange,
  onDateRangeChange,
}) => {
  const screens = Grid.useBreakpoint();

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
    staleTime: 60000,
  });

  const { data: roomTypesRes } = useQuery({
    queryKey: ['roomTypes-list'],
    queryFn: () => roomTypesApi.getAll({ limit: 100 }),
    staleTime: 120000,
  });

  const roomTypes = useMemo(() => roomTypesRes?.data?.items || [], [roomTypesRes]);

  const occ = occupancyRes?.data;
  const summary = occ?.summary;
  const isReceptionist = userRole === 'RECEPTIONIST';

  // Aggregates computed on closed days in the current series as fallback for ongoing day periods
  const { closedSeries, closedOccupied, closedSellable, closedOccupancyRate, closedAdr, closedRevpar } = useMemo(() => {
    const series = occ?.series?.filter((s) => s.unclosedDays === 0 && s.sellableRoomNights > 0) || [];
    const occupied = series.reduce((acc, s) => acc + (s.occupiedRoomNights ?? 0), 0);
    const sellable = series.reduce((acc, s) => acc + s.sellableRoomNights, 0);
    const sales = series.reduce((acc, s) => acc + (s.roomSalesValue ? parseFloat(s.roomSalesValue) : 0), 0);
    const occRate = sellable > 0 ? Number(((occupied / sellable) * 100).toFixed(2)) : null;
    const adr = occupied > 0 ? (sales / occupied).toFixed(2) : null;
    const revpar = sellable > 0 ? (sales / sellable).toFixed(2) : null;
    return {
      closedSeries: series,
      closedOccupied: occupied,
      closedSellable: sellable,
      closedOccupancyRate: occRate,
      closedAdr: adr,
      closedRevpar: revpar,
    };
  }, [occ?.series]);

  const displayOccupancyRate = summary?.occupancyRate ?? closedOccupancyRate;
  const displayAdr = summary?.operationalAdr ?? closedAdr;
  const displayRevpar = summary?.operationalRevpar ?? closedRevpar;

  const occupancyChartData: BarComparisonItem[] = useMemo(() => {
    return (occ?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: item.occupiedRoomNights ?? 0,
      value2: item.sellableRoomNights ?? 0,
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Phòng có khách: ${item.occupiedRoomNights ?? 0} đêm (${item.occupancyRate !== null && item.occupancyRate !== undefined ? item.occupancyRate + '%' : 'Chưa chốt'})`,
      tooltipText2: `Phòng sẵn bán: ${item.sellableRoomNights} đêm`,
    }));
  }, [occ?.series, groupBy]);

  const columns: ColumnsType<OccupancySeriesItem> = useMemo(() => [
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
  ], [isReceptionist]);

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
                onClick={() => onDateRangeChange([dateRange[0], dayjs().startOf('day')])}
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
            onChange={(val) => onSelectedRoomTypeIdChange(val)}
            options={[
              { value: '', label: 'Tất cả hạng phòng' },
              ...roomTypes.map((rt) => ({ value: rt.id, label: `${rt.name} (${rt.code})` })),
            ]}
          />
        </Space>
      </div>

      {/* Occupancy KPI Cards */}
      <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Tỷ lệ lấp đầy (Occupancy)</Text>}
              value={
                displayOccupancyRate !== null && displayOccupancyRate !== undefined
                  ? `${displayOccupancyRate}%`
                  : 'Chưa đủ dữ liệu'
              }
              styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              {summary?.occupiedRoomNights ?? closedOccupied} / {summary?.sellableRoomNights ?? closedSellable} phòng-đêm
            </Text>
          </Card>
        </Col>
        {!isReceptionist && (
          <>
            <Col xs={24} sm={12} lg={6}>
              <Card
                className="pms-kpi-card"
                style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1890ff' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title={<Text strong style={{ color: '#595959' }}>Giá phòng bình quân (ADR)</Text>}
                  value={displayAdr ? formatVnd(displayAdr) : 'Chưa đủ dữ liệu'}
                  styles={{ content: { color: '#1890ff', fontWeight: 600, fontSize: 20 } }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  Doanh thu bình quân / phòng có khách
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
                  title={<Text strong style={{ color: '#595959' }}>Doanh thu trên phòng sẵn có (RevPAR)</Text>}
                  value={displayRevpar ? formatVnd(displayRevpar) : 'Chưa đủ dữ liệu'}
                  styles={{ content: { color: '#52c41a', fontWeight: 600, fontSize: 20 } }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  Doanh thu bình quân / tổng phòng có thể bán
                </Text>
              </Card>
            </Col>
          </>
        )}
        <Col xs={24} sm={12} lg={isReceptionist ? 12 : 6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #faad14' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Phòng bảo trì / OOS</Text>}
              value={summary?.maintenanceBlockedRoomNights || 0}
              styles={{ content: { color: '#d46b08', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
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
          valueFormatter={formatNightCount}
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
});
