import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Spin,
  Typography,
} from "antd";
import { paymentQrApi } from "../../api/paymentQr.api.ts";
import { hotelError } from "../../utils/hotelErrors.ts";
import { useAuthStore } from "../../store/authStore.ts";

type Values = {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  enabled: boolean;
};
export function BankAccountSettings() {
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const { message } = App.useApp(),
    client = useQueryClient();
  const actor = useAuthStore((s) => s.user?.id);
  const account = useQuery({
    queryKey: ["hotel-bank-account", actor],
    queryFn: ({ signal }) => paymentQrApi.account(signal),
  });
  const banks = useQuery({
    queryKey: ["payment-banks"],
    queryFn: ({ signal }) => paymentQrApi.banks(signal),
    staleTime: 86400000,
  });
  useEffect(() => {
    if (account.isSuccess)
      form.setFieldsValue(
        account.data ?? {
          bankBin: undefined,
          accountNumber: "",
          accountName: "",
          enabled: true,
        },
      );
  }, [account.data, account.isSuccess, form]);
  const save = async (values: Values) => {
    setSaving(true);
    setError(null);
    try {
      const result = await paymentQrApi.saveAccount({
        ...values,
        expectedVersion: account.data?.version ?? 0,
      });
      if (useAuthStore.getState().user?.id !== actor) return;
      client.setQueryData(["hotel-bank-account", actor], result);
      void client.invalidateQueries({ queryKey: ["payment-qr"] });
      void message.success("Đã lưu tài khoản nhận chuyển khoản.");
    } catch (e) {
      setError(hotelError(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Tài khoản nhận chuyển khoản" style={{ marginTop: 24 }}>
      {account.isPending ? (
        <Spin />
      ) : account.isError ? (
        <Alert
          type="error"
          title="Chưa tải được cấu hình ngân hàng"
          action={
            <Button onClick={() => void account.refetch()}>Thử lại</Button>
          }
        />
      ) : (
        <>
          {!account.data && (
            <Typography.Paragraph type="secondary">
              Chưa thiết lập tài khoản nhận chuyển khoản.
            </Typography.Paragraph>
          )}
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              style={{ marginBottom: 16 }}
              action={
                <Button onClick={() => void account.refetch()}>
                  Tải lại cấu hình
                </Button>
              }
            />
          )}
          <Form form={form} layout="vertical" onFinish={save} disabled={saving}>
            <Form.Item
              name="bankBin"
              label="Ngân hàng"
              rules={[{ required: true, message: "Chọn ngân hàng nhận tiền" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={banks.isPending}
                placeholder="Chọn ngân hàng"
                options={banks.data?.banks.map((b) => ({
                  value: b.bin,
                  label: `${b.shortName} — ${b.name}`,
                }))}
              />
            </Form.Item>
            {banks.isError && (
              <Button onClick={() => void banks.refetch()}>
                Tải lại danh sách ngân hàng
              </Button>
            )}
            <Form.Item
              name="accountNumber"
              label="Số tài khoản"
              rules={[
                { required: true },
                {
                  pattern: /^\d{6,19}$/,
                  message: "Nhập 6–19 chữ số, giữ nguyên số 0 đầu",
                },
              ]}
            >
              <Input maxLength={19} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="accountName"
              label="Tên chủ tài khoản"
              rules={[{ required: true }, { min: 5, max: 50 }]}
              extra="Tên được nhập theo tài khoản ngân hàng. Hệ thống lưu dưới dạng chữ in hoa không dấu; chưa xác minh với ngân hàng."
            >
              <Input maxLength={50} />
            </Form.Item>
            <Form.Item name="enabled" valuePropName="checked">
              <Checkbox>Cho phép hiển thị QR nhận chuyển khoản</Checkbox>
            </Form.Item>
            <Space wrap>
              {account.data ? (
                <Popconfirm
                  title="Cập nhật tài khoản nhận tiền?"
                  description="Các yêu cầu QR đang chờ sẽ bị hủy. QR đã tải vẫn có thể được dùng để chuyển khoản."
                  onConfirm={() => form.submit()}
                  okText="Cập nhật"
                  cancelText="Quay lại"
                >
                  <Button type="primary" loading={saving}>
                    Lưu tài khoản
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={saving}
                  disabled={!banks.data}
                >
                  Lưu tài khoản
                </Button>
              )}
            </Space>
          </Form>
        </>
      )}
    </Card>
  );
}
