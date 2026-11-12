import { useQuery } from "@tanstack/react-query";
import {
  subscriptionsApi,
  type MonthlyPeriodInput,
} from "../../api/subscriptions.api.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Space,
  Select,
  InputNumber,
} from "antd";
import type { Dayjs } from "dayjs";
import { Link, useNavigate } from "react-router-dom";
import { hotelsApi } from "../../api/hotels.api.ts";
import type {
  HotelCreate,
  IssuedHotelCredentials,
} from "../../types/hotel.types.ts";
import {
  HotelAdminFields,
  HotelProfileFields,
  IssuedCredentialsModal,
} from "./HotelForms.tsx";
import { hotelError } from "../../utils/hotelErrors.ts";

type CreateForm = Omit<HotelCreate, "subscription"> & {
  subscription: Omit<MonthlyPeriodInput, "startsOn"> & {
    startsOn: Dayjs;
  };
};
export function PlatformHotelCreatePage() {
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<
    (IssuedHotelCredentials & { hotel: { id: string } }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const owner = usePlatformAuthStore((s) => s.user?.id);
  const plans = useQuery({
    queryKey: ["platform-plans-onboarding", owner],
    queryFn: ({ signal }) => subscriptionsApi.plans(signal),
  });
  const submit = async (values: CreateForm) => {
    setSaving(true);
    setError(null);
    try {
      setIssued(
        await hotelsApi.create({
          ...values,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
          address: values.address || null,
          agreementReference: values.agreementReference || null,
          subscription: {
            ...values.subscription,
            startsOn: values.subscription.startsOn.format("YYYY-MM-DD"),
          },
        }),
      );
    } catch (failure) {
      setError(hotelError(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">TIẾP NHẬN</div>
        <h1>Thêm khách sạn</h1>
        <p className="platform-muted">
          Tạo khách sạn, quản trị đầu tiên và kỳ sử dụng ban đầu.
        </p>
      </div>
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          style={{ marginBottom: 20 }}
        />
      )}
      <Form<CreateForm>
        layout="vertical"
        onFinish={submit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement)
            event.preventDefault();
        }}
        disabled={saving || !!issued}
        initialValues={{
          timezone: "Asia/Ho_Chi_Minh",
          subscription: { monthCount: 1, reason: "Tiếp nhận khách sạn" },
        }}
      >
        <div className="platform-hotel-form-grid">
          <Card title="Thông tin khách sạn">
            <Form.Item
              name="code"
              label="Mã khách sạn"
              rules={[
                { required: true, message: "Nhập mã khách sạn." },
                {
                  pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/,
                  message: "Dùng chữ không dấu, số, gạch dưới hoặc gạch ngang.",
                },
              ]}
            >
              <Input maxLength={50} placeholder="Ví dụ: HOTEL_A" />
            </Form.Item>
            <HotelProfileFields />
          </Card>
          <div className="platform-hotel-form-stack">
            <Card title="Quản trị khách sạn đầu tiên">
              <HotelAdminFields nested />
              <p className="platform-muted">
                Mật khẩu tạm được hệ thống tạo và chỉ hiển thị sau khi tiếp nhận
                thành công.
              </p>
            </Card>
            <Card title="Kỳ sử dụng ban đầu">
              {plans.isError && (
                <Alert type="error" title={hotelError(plans.error)} />
              )}
              {plans.data?.length === 0 && (
                <Alert
                  type="info"
                  title={
                    <Link to="/platform/plans">
                      Tạo gói dịch vụ trước khi tiếp nhận khách sạn
                    </Link>
                  }
                />
              )}
              <Form.Item
                name={["subscription", "planId"]}
                label="Gói dịch vụ"
                rules={[{ required: true, message: "Chọn gói dịch vụ." }]}
              >
                <Select
                  loading={plans.isFetching}
                  options={plans.data
                    ?.filter((p) => p.isActive)
                    .map((p) => ({
                      value: p.id,
                      label:
                        p.name +
                        " • " +
                        Number(p.monthlyPrice).toLocaleString("vi-VN") +
                        " ₫ / tháng • " +
                        p.roomLimit +
                        " phòng / " +
                        p.staffLimit +
                        " tài khoản",
                    }))}
                />
              </Form.Item>
              <Form.Item
                name={["subscription", "startsOn"]}
                label="Ngày bắt đầu"
                rules={[{ required: true, message: "Chọn ngày bắt đầu." }]}
              >
                <DatePicker format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item
                name={["subscription", "monthCount"]}
                label="Số tháng"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={120} precision={0} />
              </Form.Item>
              <p>
                Phí kỳ bằng giá gói mỗi tháng × số tháng. Ngày kết thúc được hệ
                thống tính khi ghi nhận.
              </p>
              <Form.Item
                name={["subscription", "reason"]}
                label="Lý do ghi nhận"
                rules={[{ required: true, whitespace: true }]}
              >
                <Input maxLength={2000} />
              </Form.Item>
              <Form.Item
                name={["subscription", "agreementReference"]}
                label="Tham chiếu thỏa thuận kỳ sử dụng"
              >
                <Input maxLength={191} />
              </Form.Item>
              <Form.Item
                name={["subscription", "paymentReference"]}
                label="Tham chiếu thanh toán đã ghi nhận"
              >
                <Input maxLength={191} />
              </Form.Item>
              <Form.Item name={["subscription", "notes"]} label="Ghi chú">
                <Input.TextArea maxLength={10000} />
              </Form.Item>
            </Card>
          </div>
        </div>
        <Space style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={saving}>
            Tạo khách sạn và cấp tài khoản
          </Button>
          <Link to="/platform/hotels">Quay lại danh sách</Link>
        </Space>
      </Form>
      <IssuedCredentialsModal
        value={issued}
        onClose={() => {
          const id = issued?.hotel.id;
          setIssued(null);
          if (id) navigate(`/platform/hotels/${id}`, { replace: true });
        }}
      />
    </div>
  );
}
