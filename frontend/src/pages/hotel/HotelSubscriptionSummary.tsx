import { Card, Col, Progress, Row, Tag, Typography } from 'antd';
import {
  ApartmentOutlined,
  CalendarOutlined,
  CrownOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { SubscriptionSummary } from '../../api/subscriptions.api.ts';
import {
  displayDay,
  money,
  subscriptionLabels,
} from '../../utils/subscriptions.ts';

const { Text } = Typography;
const statusColors: Record<SubscriptionSummary['status'], string> = {
  ACTIVE: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'error',
  UPCOMING: 'processing',
  UNCONFIGURED: 'default',
};

export function HotelSubscriptionStatus({
  value,
}: {
  value: SubscriptionSummary;
}) {
  const period = value.current ?? value.upcoming;
  return (
    <div className="hotel-subscription-status" role="status">
      <div>
        <CrownOutlined />{' '}
        <Text strong>
          {period
            ? `${value.status === 'EXPIRED' ? 'Gói kỳ gần nhất' : value.status === 'UPCOMING' ? 'Gói sắp sử dụng' : 'Gói hiện tại'}: ${period.planName}`
            : 'Chưa đăng ký gói dịch vụ'}
        </Text>
      </div>
      <Tag color={statusColors[value.status]}>
        {subscriptionLabels[value.status]}
      </Tag>
      {period && (
        <Text type="secondary">
          {value.status === 'UPCOMING'
            ? `Bắt đầu từ ${displayDay(period.startsOn)}`
            : value.daysRemaining == null
              ? `Đến hết ${displayDay(period.endsOn)}`
              : value.daysRemaining < 0
                ? `Đã hết hạn ${Math.abs(value.daysRemaining)} ngày`
                : `Còn ${value.daysRemaining} ngày · Đến hết ${displayDay(period.endsOn)}`}
        </Text>
      )}
    </div>
  );
}

function Usage({ used, limit }: { used: number; limit: number | null }) {
  const exceeded = limit != null && used > limit;
  return (
    <>
      <div className="hotel-subscription-value">
        {used.toLocaleString('vi-VN')}{' '}
        <span>/ {limit == null ? '—' : limit.toLocaleString('vi-VN')}</span>
      </div>
      {limit != null && limit > 0 ? (
        <>
          <Progress
            percent={Math.min(100, Math.round((used / limit) * 100))}
            showInfo={false}
            status={exceeded ? 'exception' : 'normal'}
            strokeColor={exceeded ? undefined : '#1b4d3e'}
            size="small"
          />
          <Text type={exceeded ? 'danger' : 'secondary'}>
            {exceeded
              ? `Vượt hạn mức ${used - limit}`
              : `Còn có thể sử dụng ${limit - used}`}
          </Text>
        </>
      ) : (
        <Text type="secondary">Chưa ghi nhận hạn mức</Text>
      )}
    </>
  );
}

export function HotelSubscriptionSummary({
  value,
}: {
  value: SubscriptionSummary;
}) {
  const period = value.current ?? value.upcoming;
  const remaining = value.daysRemaining;
  const timeLabel =
    value.status === 'UNCONFIGURED'
      ? 'Chưa cấu hình'
      : value.status === 'UPCOMING'
        ? 'Chưa bắt đầu'
        : remaining == null
          ? 'Chưa xác định'
          : remaining < 0
            ? `Quá hạn ${Math.abs(remaining)} ngày`
            : `${remaining} ngày`;
  return (
    <Row gutter={[16, 16]} className="pms-kpi-row hotel-subscription-kpis">
      <Col xs={24} sm={12} xl={6}>
        <Card className="pms-kpi-card hotel-subscription-kpi hotel-subscription-kpi--plan">
          <Text type="secondary">
            <CrownOutlined /> Gói dịch vụ
          </Text>
          <div className="hotel-subscription-value">
            {period?.planName ?? 'Chưa đăng ký'}
          </div>
          <Tag color={statusColors[value.status]}>
            {subscriptionLabels[value.status]}
          </Tag>
          {period?.monthlyPrice != null && (
            <Text type="secondary">{money(period.monthlyPrice)} / tháng</Text>
          )}
        </Card>
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <Card className="pms-kpi-card hotel-subscription-kpi hotel-subscription-kpi--time">
          <Text type="secondary">
            <CalendarOutlined /> Thời hạn còn lại
          </Text>
          <div className="hotel-subscription-value">{timeLabel}</div>
          <Text type="secondary">
            {period
              ? `${value.status === 'UPCOMING' ? 'Bắt đầu' : 'Đến hết'} ${displayDay(value.status === 'UPCOMING' ? period.startsOn : period.endsOn)}`
              : 'Liên hệ Innvyra để ghi nhận kỳ sử dụng'}
          </Text>
        </Card>
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <Card className="pms-kpi-card hotel-subscription-kpi">
          <Text type="secondary">
            <ApartmentOutlined /> Phòng hoạt động
          </Text>
          <Usage used={value.usage.rooms} limit={value.usage.roomLimit} />
        </Card>
      </Col>
      <Col xs={24} sm={12} xl={6}>
        <Card className="pms-kpi-card hotel-subscription-kpi hotel-subscription-kpi--staff">
          <Text type="secondary">
            <TeamOutlined /> Tài khoản hoạt động
          </Text>
          <Usage used={value.usage.staff} limit={value.usage.staffLimit} />
        </Card>
      </Col>
    </Row>
  );
}
