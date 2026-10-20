import React, { useState, useMemo } from 'react';
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
  Button,
  Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.ts';
import type { OutstandingItem } from '../../../types/reports.types.ts';
import { formatVnd } from '../reports.utils.ts';

const { Text } = Typography;

export interface OutstandingTabProps {
  startDateStr: string;
  endDateStr: string;
}

export const OutstandingTab: React.FC<OutstandingTabProps> = React.memo(({
  startDateStr,
  endDateStr,
}) => {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();

  const [outstandingPage, setOutstandingPage] = useState<number>(1);
  const [outstandingLimit] = useState<number>(20);
  const [outstandingSort, setOutstandingSort] = useState<{
    sortBy: 'folioId' | 'outstandingBalance';
    sortOrder: 'asc' | 'desc';
  }>({ sortBy: 'outstandingBalance', sortOrder: 'desc' });

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
    staleTime: 60000,
  });

  const out = outstandingRes?.data;
  const summary = out?.summary;
  const items = out?.items || [];
  const pagination = out?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };

  const columns: ColumnsType<OutstandingItem> = useMemo(() => [
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
  ], [navigate]);

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

      <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #1b4d3e' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Tổng dư nợ ròng</Text>}
              value={formatVnd(summary?.outstandingBalance)}
              styles={{ content: { color: '#1b4d3e', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Net Accounts Receivable - Customer Credits
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
              title={<Text strong style={{ color: '#595959' }}>Phải thu từ khách (Nợ)</Text>}
              value={formatVnd(summary?.accountsReceivable)}
              styles={{ content: { color: '#cf1322', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Tổng số tiền khách lưu trú chưa thanh toán
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
              title={<Text strong style={{ color: '#595959' }}>Khách trả thừa / Trả trước (Có)</Text>}
              value={formatVnd(summary?.customerCredits)}
              styles={{ content: { color: '#389e0d', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              Tiền đặt cọc hoặc thanh toán vượt mức hóa đơn
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className="pms-kpi-card"
            style={{ borderRadius: 8, height: '100%', borderLeft: '4px solid #faad14' }}
            styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
          >
            <Statistic
              title={<Text strong style={{ color: '#595959' }}>Số Folio có số dư</Text>}
              value={summary?.folioCount || 0}
              styles={{ content: { color: '#faad14', fontWeight: 600, fontSize: 20 } }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
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
});
