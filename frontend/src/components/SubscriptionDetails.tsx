import {
  subscriptionLabels,
  money,
  displayDay,
} from "../utils/subscriptions.ts";
import { Alert, Descriptions, Table, Tag } from "antd";
import type { SubscriptionSummary } from "../api/subscriptions.api.ts";
export function SubscriptionDetails({
  value,
  history = true,
}: {
  value: SubscriptionSummary;
  history?: boolean;
}) {
  const period = value.current ?? value.upcoming;
  return (
    <>
      {value.alert && (
        <Alert
          showIcon
          type={value.status === "EXPIRED" ? "warning" : "info"}
          title={
            value.status === "EXPIRED"
              ? `Kỳ sử dụng đã hết hạn ${Math.abs(value.daysRemaining ?? 0)} ngày. Vui lòng liên hệ Innvyra để gia hạn.`
              : `Kỳ sử dụng còn ${value.daysRemaining} ngày (ngày kết thúc vẫn được sử dụng).`
          }
          description={
            value.alert === "FOLLOW_UP"
              ? "Đã quá hạn trên 7 ngày, cần quản trị Innvyra theo dõi. Hệ thống không tự tạm ngừng."
              : undefined
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {value.upcoming && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title={
            "Đã ghi nhận kỳ tiếp theo: " +
            value.upcoming.planName +
            " • " +
            displayDay(value.upcoming.startsOn) +
            " – " +
            displayDay(value.upcoming.endsOn)
          }
        />
      )}
      {((value.usage.roomLimit != null &&
        value.usage.rooms > value.usage.roomLimit) ||
        (value.usage.staffLimit != null &&
          value.usage.staff > value.usage.staffLimit)) && (
        <Alert
          type="warning"
          showIcon
          title="Số lượng đang hoạt động vượt hạn mức của kỳ hiện tại"
          description="Dữ liệu vẫn được giữ nguyên. Cần giảm số phòng/tài khoản hoạt động hoặc liên hệ Innvyra để đăng ký gói phù hợp trước khi thêm mới hay kích hoạt lại."
          style={{ marginBottom: 16 }}
        />
      )}
      <Descriptions
        bordered
        size="small"
        column={{ xs: 1, sm: 2 }}
        items={[
          {
            key: "status",
            label: "Thời hạn",
            children: <Tag>{subscriptionLabels[value.status]}</Tag>,
          },
          {
            key: "plan",
            label: "Gói",
            children: period?.planName ?? "Chưa cấu hình",
          },
          {
            key: "room",
            label: "Phòng hoạt động",
            children: `${value.usage.rooms} / ${value.usage.roomLimit ?? "Chưa đặt hạn mức"}`,
          },
          {
            key: "staff",
            label: "Tài khoản hoạt động",
            children: `${value.usage.staff} / ${value.usage.staffLimit ?? "Chưa đặt hạn mức"}`,
          },
          ...(period
            ? [
                {
                  key: "dates",
                  label: "Kỳ sử dụng",
                  children: `${displayDay(period.startsOn)} – ${displayDay(period.endsOn)}`,
                },
                {
                  key: "fee",
                  label: "Phí kỳ đã ghi nhận",
                  children: money(period.feeAmount),
                },
              ]
            : []),
        ]}
      />
      {history && (
        <Table
          style={{ marginTop: 20 }}
          size="small"
          rowKey="id"
          dataSource={value.history}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 5 }}
          columns={[
            { title: "Gói đã đăng ký", dataIndex: "planName" },
            { title: "Từ ngày", dataIndex: "startsOn", render: displayDay },
            { title: "Đến hết ngày", dataIndex: "endsOn", render: displayDay },
            {
              title: "Số tháng",
              dataIndex: "monthCount",
              render: (v: number | null) => v ?? "Kỳ cũ",
            },
            {
              title: "Đơn giá / tháng",
              dataIndex: "monthlyPrice",
              render: (value: string | null) =>
                value == null ? "Kỳ cũ" : money(value),
            },
            { title: "Phí (VND)", dataIndex: "feeAmount", render: money },
            {
              title: "Thanh toán tham chiếu",
              dataIndex: "paymentReference",
              render: (v: string | null) => v || "—",
            },
          ]}
        />
      )}
    </>
  );
}
