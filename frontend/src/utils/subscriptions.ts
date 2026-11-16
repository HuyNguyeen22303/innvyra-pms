import type { SubscriptionSummary } from "../api/subscriptions.api.ts";
export const subscriptionLabels: Record<SubscriptionSummary["status"], string> =
  {
    ACTIVE: "Đang sử dụng",
    EXPIRING: "Sắp hết hạn",
    EXPIRED: "Đã hết hạn",
    UPCOMING: "Chưa đến ngày bắt đầu",
    UNCONFIGURED: "Chưa ghi nhận kỳ sử dụng",
  };
export const money = (value: string) =>
  `${Number(value).toLocaleString("vi-VN")} ₫`;
export const displayDay = (value: string) =>
  value.slice(0, 10).split("-").reverse().join("/");

export function subscriptionPlanState(
  planId: string,
  summary?: SubscriptionSummary,
) {
  if (
    summary?.current?.planId === planId &&
    (summary.status === "ACTIVE" || summary.status === "EXPIRING")
  )
    return "current";
  if (summary?.upcoming?.planId === planId) return "upcoming";
  return null;
}
