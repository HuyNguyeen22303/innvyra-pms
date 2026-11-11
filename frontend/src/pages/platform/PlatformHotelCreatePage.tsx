import { useState } from "react";
import { Alert, Button, Card, DatePicker, Form, Input, Space } from "antd";
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
  subscription: Omit<HotelCreate["subscription"], "startsOn" | "endsOn"> & {
    startsOn: Dayjs;
    endsOn: Dayjs;
  };
};
export function PlatformHotelCreatePage() {
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<
    (IssuedHotelCredentials & { hotel: { id: string } }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
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
            endsOn: values.subscription.endsOn.format("YYYY-MM-DD"),
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
          subscription: { planName: "Innvyra PMS" },
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
              <Form.Item
                name={["subscription", "planName"]}
                label="Tên gói"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Nhập tên gói.",
                  },
                ]}
              >
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item
                name={["subscription", "startsOn"]}
                label="Ngày bắt đầu"
                rules={[{ required: true, message: "Chọn ngày bắt đầu." }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name={["subscription", "endsOn"]}
                label="Ngày kết thúc (bao gồm ngày này)"
                dependencies={[["subscription", "startsOn"]]}
                rules={[
                  { required: true, message: "Chọn ngày kết thúc." },
                  ({ getFieldValue }) => ({
                    validator(_, value: Dayjs | undefined) {
                      const start = getFieldValue([
                        "subscription",
                        "startsOn",
                      ]) as Dayjs | undefined;
                      return value && start && value.isBefore(start, "day")
                        ? Promise.reject(
                            new Error(
                              "Ngày kết thúc phải từ ngày bắt đầu trở đi.",
                            ),
                          )
                        : Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name={["subscription", "feeAmount"]}
                label="Phí theo thỏa thuận (VND)"
                rules={[
                  { required: true, message: "Nhập mức phí." },
                  {
                    pattern: /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/,
                    message:
                      "Nhập số tiền không âm, tối đa 12 chữ số phần nguyên và 2 chữ số thập phân.",
                  },
                ]}
              >
                <Input inputMode="decimal" />
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
