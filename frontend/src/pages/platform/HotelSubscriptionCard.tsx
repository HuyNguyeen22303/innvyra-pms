import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import {
  subscriptionsApi,
  type MonthlyPeriodInput,
} from "../../api/subscriptions.api.ts";
import { SubscriptionDetails } from "../../components/SubscriptionDetails.tsx";
import { money } from "../../utils/subscriptions.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";
import { hotelError } from "../../utils/hotelErrors.ts";
type PeriodForm = Omit<MonthlyPeriodInput, "startsOn"> & { startsOn: Dayjs };
export function HotelSubscriptionCard({
  id,
  status,
  onChanged,
}: {
  id: string;
  status: "ACTIVE" | "SUSPENDED";
  onChanged: () => void;
}) {
  const owner = usePlatformAuthStore((s) => s.user?.id);
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<"period" | "status" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<PeriodForm>();
  const [statusForm] = Form.useForm<{ reason: string }>();
  const summary = useQuery({
    queryKey: ["platform-subscription", owner, id, revision],
    queryFn: ({ signal }) => subscriptionsApi.summary(id, signal),
  });
  const plans = useQuery({
    queryKey: ["platform-plans-select", owner, revision],
    queryFn: ({ signal }) => subscriptionsApi.plans(signal),
  });
  const planId = Form.useWatch("planId", form) as string | undefined;
  const months = Form.useWatch("monthCount", form) as number | undefined;
  const selected = plans.data?.find((plan) => plan.id === planId);
  const submit = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      setMode(null);
      setRevision((v) => v + 1);
      onChanged();
    } catch (failure) {
      setError(hotelError(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card
      title="Gói dịch vụ và thời hạn"
      style={{ marginTop: 24 }}
      loading={summary.isLoading}
    >
      {summary.isError && (
        <Alert
          type="error"
          title={hotelError(summary.error)}
          action={
            <Button onClick={() => void summary.refetch()}>Thử lại</Button>
          }
        />
      )}
      {status === "SUSPENDED" && (
        <Alert
          type="error"
          showIcon
          title="Khách sạn đang tạm ngừng vận hành"
          description={summary.data?.suspensionReason}
          style={{ marginBottom: 16 }}
        />
      )}
      {summary.data && <SubscriptionDetails value={summary.data} />}
      <Space wrap style={{ marginTop: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            form.resetFields();
            const next = summary.data?.nextStartsOn;
            const localToday =
              summary.data?.today ?? dayjs().format("YYYY-MM-DD");
            form.setFieldsValue({
              startsOn: dayjs(next && next > localToday ? next : localToday),
              monthCount: 1,
            });
            setError(null);
            setMode("period");
            setRevision((v) => v + 1);
          }}
        >
          Đăng ký / gia hạn / đổi gói
        </Button>
        <Button
          danger={status === "ACTIVE"}
          onClick={() => {
            statusForm.resetFields();
            setError(null);
            setMode("status");
          }}
        >
          {status === "ACTIVE" ? "Tạm ngừng khách sạn" : "Mở lại khách sạn"}
        </Button>
      </Space>
      <Modal
        title="Ghi nhận kỳ sử dụng theo tháng"
        open={mode === "period"}
        onCancel={() => {
          if (!saving) setMode(null);
        }}
        footer={null}
        forceRender
      >
        <Alert
          type="info"
          showIcon
          title="Gói có hiệu lực từ ngày bắt đầu"
          description="Chọn ngày sau kỳ đã ghi nhận để gia hạn hoặc đổi gói. Không ghi đè lịch sử. Phí được tính từ giá hiện hành × số tháng, thanh toán được ghi nhận thủ công. Gia hạn không tự mở lại khách sạn đang tạm ngừng."
          style={{ marginBottom: 16 }}
        />
        {error && <Alert type="error" title={error} />}
        {plans.isError && (
          <Alert
            type="error"
            title={hotelError(plans.error)}
            action={
              <Button onClick={() => void plans.refetch()}>Thử lại</Button>
            }
          />
        )}
        <Form
          name="hotel-subscription-period"
          form={form}
          layout="vertical"
          disabled={saving}
          onFinish={(values) =>
            void submit(() =>
              subscriptionsApi.record(id, {
                ...values,
                startsOn: values.startsOn.format("YYYY-MM-DD"),
              }),
            )
          }
        >
          <Form.Item
            name="planId"
            label="Gói dịch vụ"
            rules={[{ required: true }]}
          >
            <Select
              loading={plans.isFetching}
              options={plans.data
                ?.filter((p) => p.isActive)
                .map((p) => ({
                  value: p.id,
                  label: `${p.name} • ${money(p.monthlyPrice)} / tháng • ${p.roomLimit} phòng / ${p.staffLimit} tài khoản`,
                }))}
            />
          </Form.Item>
          <Form.Item
            name="startsOn"
            label="Ngày bắt đầu có hiệu lực"
            rules={[{ required: true }]}
          >
            <DatePicker format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item
            name="monthCount"
            label="Số tháng"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={120} precision={0} />
          </Form.Item>
          {selected && months && (
            <p>
              Phí dự kiến:{" "}
              <strong>
                {money(String(Number(selected.monthlyPrice) * months))}
              </strong>
              . Ngày kết thúc được hệ thống tính và lưu khi xác nhận.
            </p>
          )}
          <Form.Item name="agreementReference" label="Tham chiếu thỏa thuận">
            <Input maxLength={191} />
          </Form.Item>
          <Form.Item name="paymentReference" label="Tham chiếu thanh toán">
            <Input maxLength={191} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea maxLength={10000} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Lý do ghi nhận / đổi gói"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea maxLength={2000} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>
            Xác nhận ghi nhận kỳ sử dụng
          </Button>
        </Form>
      </Modal>
      <Modal
        title={status === "ACTIVE" ? "Tạm ngừng khách sạn" : "Mở lại khách sạn"}
        open={mode === "status"}
        onCancel={() => {
          if (!saving) setMode(null);
        }}
        footer={null}
        forceRender
      >
        <p>
          {status === "ACTIVE"
            ? "Các tài khoản vẫn đăng nhập được nhưng không truy cập nghiệp vụ PMS, kể cả phiên đang mở. Dữ liệu được giữ nguyên."
            : "Khôi phục truy cập nghiệp vụ PMS. Thao tác này không thay đổi thời hạn thuê bao."}
        </p>
        {error && <Alert type="error" title={error} />}
        <Form
          name="hotel-subscription-status"
          form={statusForm}
          layout="vertical"
          disabled={saving}
          onFinish={(values) =>
            void submit(() =>
              subscriptionsApi.setStatus(
                id,
                status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                values.reason,
              ),
            )
          }
        >
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea maxLength={2000} />
          </Form.Item>
          <Button
            danger={status === "ACTIVE"}
            type="primary"
            htmlType="submit"
            loading={saving}
          >
            Xác nhận {status === "ACTIVE" ? "tạm ngừng" : "mở lại"}
          </Button>
        </Form>
      </Modal>
    </Card>
  );
}
