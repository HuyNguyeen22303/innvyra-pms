import {
  ApartmentOutlined,
  CheckCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Empty, Row, Tag, Typography } from 'antd';
import type {
  SubscriptionPlan,
  SubscriptionSummary,
} from '../../api/subscriptions.api.ts';
import { money, subscriptionPlanState } from '../../utils/subscriptions.ts';

const { Text, Title } = Typography;

export function HotelSubscriptionPlans({
  plans,
  summary,
  onContact,
}: {
  plans: SubscriptionPlan[];
  summary?: SubscriptionSummary;
  onContact: (plan: SubscriptionPlan) => void;
}) {
  if (!plans.length)
    return (
      <Empty description="Chưa có gói mở đăng ký. Vui lòng liên hệ Innvyra để được tư vấn." />
    );
  return (
    <Row gutter={[16, 16]} className="hotel-subscription-plans">
      {plans.map((plan) => {
        const state = subscriptionPlanState(plan.id, summary);
        const currentLabel =
          summary?.hotelStatus === 'SUSPENDED'
            ? 'Gói đã đăng ký'
            : 'Đang sử dụng';
        const renewal =
          summary?.status === 'EXPIRED' && summary.current?.planId === plan.id;
        return (
          <Col xs={24} sm={12} lg={8} key={plan.id}>
            <Card
              className={`hotel-subscription-plan${state === 'current' ? ' hotel-subscription-plan--current' : ''}`}
            >
              <div className="hotel-subscription-plan-badge">
                {state === 'current' && (
                  <Tag color="success">{currentLabel}</Tag>
                )}
                {state === 'upcoming' && (
                  <Tag color="processing">Đã đăng ký kỳ tới</Tag>
                )}
              </div>
              <Title level={4}>{plan.name}</Title>
              <div className="hotel-subscription-plan-price">
                {money(plan.monthlyPrice)} <Text type="secondary">/ tháng</Text>
              </div>
              {plan.description && (
                <Text
                  type="secondary"
                  className="hotel-subscription-plan-description"
                >
                  {plan.description}
                </Text>
              )}
              <ul className="hotel-subscription-plan-features">
                <li>
                  <CheckCircleOutlined /> Đầy đủ nghiệp vụ PMS
                </li>
                <li>
                  <ApartmentOutlined /> Tối đa{' '}
                  {plan.roomLimit.toLocaleString('vi-VN')} phòng hoạt động
                </li>
                <li>
                  <TeamOutlined /> Tối đa{' '}
                  {plan.staffLimit.toLocaleString('vi-VN')} tài khoản hoạt động
                </li>
              </ul>
              <Button
                block
                type={state === 'current' ? 'default' : 'primary'}
                disabled={state != null}
                onClick={() => onContact(plan)}
              >
                {state === 'current'
                  ? currentLabel
                  : state === 'upcoming'
                    ? 'Đã đăng ký kỳ tới'
                    : renewal
                      ? 'Liên hệ gia hạn'
                      : !summary?.current
                        ? 'Liên hệ đăng ký'
                        : 'Liên hệ đổi gói'}
              </Button>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
