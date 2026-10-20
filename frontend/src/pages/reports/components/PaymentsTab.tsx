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
  Radio,
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
import type { PaymentSeriesItem } from '../../../types/reports.types.ts';
import { formatVnd } from '../reports.utils.ts';

const { Text } = Typography;

const formatVndNumber = (val: number) => formatVnd(val);

export interface PaymentsTabProps {
  startDateStr: string;
  endDateStr: string;
  groupBy: 'day' | 'month';
  paymentMethod: 'ALL' | 'CASH' | 'BANK_TRANSFER';
  onPaymentMethodChange: (val: 'ALL' | 'CASH' | 'BANK_TRANSFER') => void;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = React.memo(({
  startDateStr,
  endDateStr,
  groupBy,
  paymentMethod,
  onPaymentMethodChange,
}) => {
  const screens = Grid.useBreakpoint();

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
    staleTime: 60000,
  });

  const pay = paymentsRes?.data;
  const summary = pay?.summary;

  const paymentChartData: BarComparisonItem[] = useMemo(() => {
    return (pay?.series || []).map((item) => ({
      key: item.date,
      label: groupBy === 'month' ? dayjs(item.date).format('MM/YYYY') : dayjs(item.date).format('DD/MM'),
      value1: Math.max(0, parseFloat(item.cashPayments || '0')),
      value2: Math.max(0, parseFloat(item.bankTransferPayments || '0')),
      tooltipTitle: groupBy === 'month' ? `Tháng ${dayjs(item.date).format('MM/YYYY')}` : `Ngày ${dayjs(item.date).format('DD/MM/YYYY')}`,
      tooltipText1: `Tiền mặt (CASH): ${formatVnd(item.cashPayments)}`,
      tooltipText2: `Chuyển khoản (BANK): ${formatVnd(item.bankTransferPayments)}`,
    }));
  }, [pay?.series, groupBy]);

  const paymentDonutData: DonutSlice[] = useMemo(() => {
    const data: DonutSlice[] = [];
    const cashNum = parseFloat(summary?.cashPayments || '0');
    const bankNum = parseFloat(summary?.bankTransferPayments || '0');
    if (cashNum > 0) data.push({ key: 'cash', label: 'Tiền mặt (CASH)', value: cashNum, color: '#389e0d' });
    if (bankNum > 0) data.push({ key: 'bank', label: 'Chuyển khoản (BANK)', value: bankNum, color: '#096dd9' });
    return data;
  }, [summary?.cashPayments, summary?.bankTransferPayments]);

  const columns: ColumnsType<PaymentSeriesItem> = useMemo(
    () => [
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
    ],
    []
  );

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
            onChange={(e) => onPaymentMethodChange(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="ALL">Tất cả phương thức</Radio.Button>
            <Radio.Button value="CASH">Tiền mặt (CASH)</Radio.Button>
            <Radio.Button value="BANK_TRANSFER">Chuyển khoản (BANK)</Radio.Button>
          </Radio.Group>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Thực thu ròng (Net Cash)</Text>}
              value={formatVnd(summary?.netCashCollected)}
              styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Tổng tiền mặt & ngân hàng sau trừ hoàn trả
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #389e0d' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Thu tiền mặt (CASH)</Text>}
              value={formatVnd(summary?.cashPayments)}
              styles={{ content: { color: '#389e0d', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Tiền mặt thu tại quầy lễ tân
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #096dd9' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Thu Chuyển khoản (BANK)</Text>}
              value={formatVnd(summary?.bankTransferPayments)}
              styles={{ content: { color: '#096dd9', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Chuyển khoản ngân hàng & QR
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #cf1322' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Tiền hoàn trả (Refunds)</Text>}
              value={formatVnd(summary?.successfulRefunds)}
              styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
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
              valueFormatter={formatVndNumber}
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
                valueFormatter={formatVndNumber}
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
});
