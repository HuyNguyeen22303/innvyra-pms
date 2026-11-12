import { useQuery } from "@tanstack/react-query";
import { Alert } from "antd";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore.ts";
import { subscriptionsApi } from "../api/subscriptions.api.ts";
export function SubscriptionNotice() {
  const user = useAuthStore((s) => s.user);
  const query = useQuery({
    queryKey: ["hotel-subscription", user?.hotelId, user?.id],
    enabled: user?.role === "ADMIN" || user?.role === "MANAGER",
    queryFn: ({ signal }) => subscriptionsApi.own(signal),
    staleTime: 60000,
    refetchInterval: 60000,
  });
  if (!query.data?.alert) return null;
  return (
    <Alert
      showIcon
      type="warning"
      style={{ marginBottom: 16 }}
      title={
        <>
          {query.data.status === "EXPIRED"
            ? "Kỳ sử dụng Innvyra đã hết hạn."
            : `Kỳ sử dụng Innvyra còn ${query.data.daysRemaining} ngày.`}{" "}
          <Link to="/subscription">Xem gói dịch vụ và gia hạn</Link>
        </>
      }
    />
  );
}
