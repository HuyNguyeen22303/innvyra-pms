import React from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Spin,
  Statistic,
  Alert,
  Button,
  Grid,
} from 'antd';
import {
  SyncOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../../api/reports.api.ts';

const { Text, Title } = Typography;

export interface OperationsTabProps {
  startDateStr: string;
  endDateStr: string;
}

export const OperationsTab: React.FC<OperationsTabProps> = React.memo(({
  startDateStr,
  endDateStr,
}) => {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();

  const {
    data: operationsRes,
    isLoading: isLoadingOperations,
    error: operationsError,
  } = useQuery({
    queryKey: ['report-operations', startDateStr, endDateStr],
    queryFn: () => reportsApi.getOperations({ startDate: startDateStr, endDate: endDateStr }),
    staleTime: 60000,
  });

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

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary">
          * Dữ liệu tức thời tại thời điểm chốt snapshot:{' '}
          <Text code>{ops?.snapshotAt ? dayjs(ops.snapshotAt).format('DD/MM/YYYY HH:mm:ss') : '-'}</Text>
        </Text>
        <Space wrap>
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
          <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #ff4d4f', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phòng bẩn"
                  value={hk.snapshot.dirtyRooms}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #faad14', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Đang dọn"
                  value={hk.snapshot.cleaningRooms}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #1890ff', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Chờ nghiệm thu"
                  value={hk.snapshot.roomsAwaitingInspection}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #52c41a', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Sẵn sàng đón khách"
                  value={hk.snapshot.readyRooms}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #722ed1', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Tác vụ dọn đang mở"
                  value={hk.snapshot.activeHousekeepingTasks}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #13c2c2', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Nhiệm vụ làm sạch"
                  value={hk.snapshot.cleaningTasks}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
          </Row>

          <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
            Hiệu suất hoàn thành trong kỳ được chọn
          </Title>
          <Row gutter={[16, 16]} className="pms-kpi-row">
            <Col xs={24} sm={12}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ background: '#f6ffed', border: '1px solid #b7eb8f', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  title={<Text strong>Số tác vụ dọn đã hoàn thành (Cleaned)</Text>}
                  value={hk.period.completedHousekeepingTasks}
                  styles={{ content: { color: '#389e0d', fontWeight: 600 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ background: '#e6f7ff', border: '1px solid #91d5ff', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
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
          <Row gutter={[16, 16]} className="pms-kpi-row" style={{ marginBottom: 20 }}>
            <Col xs={12} sm={8} lg={5}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #ff4d4f', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phòng đang sửa chữa"
                  value={maint.snapshot.roomsUnderMaintenance}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={5}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #fa8c16', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phòng ngừng phục vụ (OOS)"
                  value={maint.snapshot.roomsOutOfService}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={5}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #1890ff', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phiếu bảo trì đang mở"
                  value={maint.snapshot.openMaintenanceTickets}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={5}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #faad14', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phiếu đang xử lý"
                  value={maint.snapshot.inProgressMaintenanceTickets}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={4}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ textAlign: 'center', borderTop: '3px solid #722ed1', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  title="Phòng đang bị chặn"
                  value={maint.snapshot.activeMaintenanceBlocks}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                />
              </Card>
            </Col>
          </Row>

          <Title level={5} style={{ color: '#595959', marginBottom: 12 }}>
            Ảnh hưởng đến quỹ phòng bán trong kỳ
          </Title>
          <Row gutter={[16, 16]} className="pms-kpi-row">
            <Col xs={24} sm={12}>
              <Card
                size="small"
                className="pms-kpi-card"
                style={{ background: '#fff2e8', border: '1px solid #ffbb96', height: '100%' }}
                styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
              >
                <Statistic
                  style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  title={<Text strong>Tổng số đêm phòng bị chặn bảo trì (Blocked Room Nights)</Text>}
                  value={maint.period.maintenanceBlockedRoomNights}
                  styles={{ content: { color: '#d4380d', fontWeight: 600 } }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                  Số đêm phòng không thể bán do sự cố kỹ thuật trong khoảng thời gian đã chọn
                </Text>
              </Card>
            </Col>
          </Row>
        </Card>
      )}
    </Spin>
  );
});
