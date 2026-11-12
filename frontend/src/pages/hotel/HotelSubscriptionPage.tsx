import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Space } from "antd";
import { Link } from "react-router-dom";
import { subscriptionsApi } from "../../api/subscriptions.api.ts";
import { SubscriptionDetails } from "../../components/SubscriptionDetails.tsx";
import { useAuthStore } from "../../store/authStore.ts";
import { hotelError } from "../../utils/hotelErrors.ts";
export function HotelSubscriptionPage() {
  const { user, checkAuth, logout } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const query = useQuery({
    queryKey: ["hotel-subscription", user?.hotelId, user?.id],
    enabled: allowed,
    queryFn: ({ signal }) => subscriptionsApi.own(signal),
  });
  const action = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
    } catch (failure) {
      setError(hotelError(failure));
    }
  };
  return (
    <div style={{ maxWidth: 1100, margin: "32px auto", padding: 20 }}>
      <h1>Gói dịch vụ khách sạn</h1>
      <p>{user?.hotel?.name}</p>
      {user?.hotel?.status === "SUSPENDED" && (
        <Alert
          type="error"
          showIcon
          title="Khách sạn đang tạm ngừng sử dụng PMS"
          description="Vui lòng liên hệ quản trị Innvyra để được hỗ trợ mở lại. Dữ liệu khách sạn được giữ nguyên."
          style={{ marginBottom: 20 }}
        />
      )}
      {error && <Alert type="error" title={error} />}
      {allowed ? (
        <Card loading={query.isLoading}>
          {query.isError && (
            <Alert
              type="error"
              title={hotelError(query.error)}
              action={
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              }
            />
          )}
          {query.data && <SubscriptionDetails value={query.data} />}
        </Card>
      ) : (
        <p>
          Liên hệ ADMIN hoặc MANAGER khách sạn để kiểm tra thời hạn và gói dịch
          vụ.
        </p>
      )}
      <Space wrap style={{ marginTop: 20 }}>
        <Button onClick={() => void action(checkAuth)}>
          Kiểm tra lại trạng thái
        </Button>
        {user?.hotel?.status !== "SUSPENDED" && (
          <Link to="/dashboard">Về PMS</Link>
        )}
        <Link to="/change-password">Đổi mật khẩu</Link>
        <Button onClick={() => void action(logout)}>Đăng xuất</Button>
      </Space>
    </div>
  );
}
