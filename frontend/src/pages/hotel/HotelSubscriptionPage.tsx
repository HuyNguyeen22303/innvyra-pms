import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Modal,
  Result,
  Skeleton,
  Space,
  Typography,
} from 'antd';
import {
  CrownOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import {
  subscriptionsApi,
  type SubscriptionPlan,
} from '../../api/subscriptions.api.ts';
import {
  SubscriptionDetails,
  SubscriptionHistory,
} from '../../components/SubscriptionDetails.tsx';
import { useAuthStore } from '../../store/authStore.ts';
import { hotelError } from '../../utils/hotelErrors.ts';
import { hotelSessionGeneration } from '../../auth/hotelSession.ts';
import {
  HotelSubscriptionStatus,
  HotelSubscriptionSummary,
} from './HotelSubscriptionSummary.tsx';
import { HotelSubscriptionPlans } from './HotelSubscriptionPlans.tsx';
import { money } from '../../utils/subscriptions.ts';
import './HotelSubscriptionPage.css';

const { Title, Text, Paragraph } = Typography;
export function HotelSubscriptionPage() {
  const { user, checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [contactPlan, setContactPlan] = useState<SubscriptionPlan | null>(null);
  const allowed = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const suspended = user?.hotel?.status === 'SUSPENDED';
  const query = useQuery({
    queryKey: ['hotel-subscription', user?.hotelId, user?.id],
    enabled: allowed,
    queryFn: ({ signal }) => subscriptionsApi.own(signal),
  });
  const plansQuery = useQuery({
    queryKey: ['hotel-subscription-plans', user?.hotelId, user?.id],
    enabled: allowed,
    queryFn: ({ signal }) => subscriptionsApi.availablePlans(signal),
  });
  const refresh = async () => {
    const generation = hotelSessionGeneration();
    setRefreshing(true);
    try {
      setError(null);
      await checkAuth();
      if (generation === hotelSessionGeneration() && allowed)
        await Promise.all([
          query.refetch({ throwOnError: true }),
          plansQuery.refetch({ throwOnError: true }),
        ]);
    } catch (failure) {
      if (generation === hotelSessionGeneration())
        setError(hotelError(failure));
    } finally {
      if (generation === hotelSessionGeneration()) setRefreshing(false);
    }
  };
  return (
    <div className="hotel-subscription-page">
      <div className="pms-action-bar hotel-subscription-heading">
        <div className="hotel-subscription-heading-copy">
          <Title level={3}>
            <CrownOutlined />
            Gói dịch vụ
          </Title>
          <Text type="secondary">
            Theo dõi thời hạn, hạn mức sử dụng và lịch sử đăng ký của{' '}
            {user?.hotel?.name || 'khách sạn'}.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={refreshing || query.isFetching || plansQuery.isFetching}
          onClick={() => void refresh()}
        >
          Làm mới
        </Button>
      </div>
      {suspended && (
        <Alert
          type="error"
          showIcon
          title="Khách sạn đang tạm ngừng sử dụng PMS"
          description={
            query.data?.suspensionReason ||
            'Vui lòng liên hệ quản trị Innvyra để được hỗ trợ mở lại. Dữ liệu khách sạn được giữ nguyên.'
          }
          style={{ marginBottom: 20 }}
        />
      )}
      {error && <Alert type="error" title={error} />}
      {allowed ? (
        <>
          {query.data && <HotelSubscriptionStatus value={query.data} />}
          <section
            className="hotel-subscription-catalog"
            aria-labelledby="hotel-subscription-catalog-title"
          >
            <Title level={4} id="hotel-subscription-catalog-title">
              Các gói dịch vụ
            </Title>
            <Paragraph type="secondary">
              Các gói đều có đầy đủ nghiệp vụ PMS, khác nhau về hạn mức phòng và
              tài khoản hoạt động. Giá và hạn mức bên dưới áp dụng cho kỳ đăng
              ký mới; kỳ đang sử dụng giữ theo thông tin đã ghi nhận.
            </Paragraph>
            {plansQuery.isPending && (
              <Skeleton active paragraph={{ rows: 4 }} />
            )}
            {plansQuery.isError && (
              <Alert
                type="error"
                showIcon
                title={hotelError(plansQuery.error)}
                action={
                  <Button onClick={() => void plansQuery.refetch()}>
                    Thử lại
                  </Button>
                }
              />
            )}
            {plansQuery.data && (
              <HotelSubscriptionPlans
                plans={plansQuery.data}
                summary={query.data}
                onContact={setContactPlan}
              />
            )}
          </section>
          <Title level={4}>Chi tiết gói đã đăng ký</Title>
          {query.data && <HotelSubscriptionSummary value={query.data} />}
          <Card
            className="hotel-subscription-details"
            title={
              <Space>
                <CrownOutlined />
                <span>Thông tin kỳ sử dụng</span>
              </Space>
            }
          >
            {query.isPending && <Skeleton active paragraph={{ rows: 5 }} />}
            {query.isError && (
              <Alert
                type="error"
                title={hotelError(query.error)}
                action={<Button onClick={() => void refresh()}>Thử lại</Button>}
              />
            )}
            {query.data && (
              <SubscriptionDetails value={query.data} history={false} />
            )}
          </Card>
          {query.data && (
            <Card
              className="hotel-subscription-details"
              title={
                <Space>
                  <HistoryOutlined />
                  <span>Lịch sử đăng ký</span>
                </Space>
              }
            >
              <SubscriptionHistory value={query.data} />
            </Card>
          )}
        </>
      ) : (
        <Card className="hotel-subscription-details">
          <Result
            status="info"
            title="Thông tin gói dịch vụ khách sạn"
            subTitle="Liên hệ quản trị viên hoặc quản lý khách sạn để kiểm tra thời hạn và hạn mức sử dụng."
          />
        </Card>
      )}
      <Card className="hotel-subscription-support" size="small">
        <div className="pms-action-bar">
          <div className="hotel-subscription-support-copy">
            <Text strong>
              <SafetyCertificateOutlined /> Hỗ trợ gói dịch vụ
            </Text>
            <Text type="secondary">
              Liên hệ đội ngũ Innvyra để đăng ký, gia hạn hoặc điều chỉnh gói
              phù hợp với khách sạn.
            </Text>
          </div>
          <Space wrap>
            {suspended && (
              <Button onClick={() => void refresh()} loading={refreshing}>
                Kiểm tra lại trạng thái
              </Button>
            )}
            {!suspended && (
              <Link to="/dashboard">
                <Button>Về tổng quan</Button>
              </Link>
            )}
            <Link to="/change-password">
              <Button>Đổi mật khẩu</Button>
            </Link>
          </Space>
        </div>
      </Card>
      <Modal
        title="Liên hệ Innvyra về gói dịch vụ"
        open={contactPlan != null}
        onCancel={() => setContactPlan(null)}
        footer={<Button onClick={() => setContactPlan(null)}>Đóng</Button>}
      >
        {contactPlan && (
          <>
            <Paragraph>
              Liên hệ đội ngũ Innvyra qua kênh hỗ trợ đã được cung cấp cho khách
              sạn. Bạn có thể sao chép nội dung bên dưới để trao đổi về gói mong
              muốn.
            </Paragraph>
            <Paragraph copyable className="hotel-subscription-contact-message">
              Khách sạn {user?.hotel?.name || ''} muốn được tư vấn về gói{' '}
              {contactPlan.name}, giá {money(contactPlan.monthlyPrice)}/tháng,
              tối đa {contactPlan.roomLimit} phòng và {contactPlan.staffLimit}{' '}
              tài khoản hoạt động.
            </Paragraph>
            <Text type="secondary">
              Quản trị Innvyra sẽ xác nhận thời điểm áp dụng và ghi nhận kỳ sử
              dụng sau khi hai bên thống nhất.
            </Text>
          </>
        )}
      </Modal>
    </div>
  );
}
