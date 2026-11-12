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
