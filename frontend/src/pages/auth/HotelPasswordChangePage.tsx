import { useState } from "react";
import { Alert, Button, Card, Form, Input, Space } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import { hotelAuthError } from "../../api/axiosClient.ts";
import { useAuthStore } from "../../store/authStore.ts";

export function HotelPasswordChangePage() {
  const { user, isAuthenticated, isLoading, logout, changePassword, error: sessionError } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!isLoading && (!isAuthenticated || !user))
    return <Navigate to="/login" replace />;
  const submit = async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
    confirmation: string;
  }) => {
    setSaving(true);
    setError(null);
    try {
      await changePassword({
        currentPassword,
        newPassword,
      });
      navigate("/login", { replace: true, state: { passwordChanged: true } });
    } catch (failure) {
      setError(hotelAuthError(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "#f2f5f1",
      }}
    >
      <Card
        title="Đổi mật khẩu tài khoản khách sạn"
        style={{ width: "100%", maxWidth: 500 }}
      >
        <p>
          {user?.hotel?.name} · {user?.username}
        </p>
        <Alert
          type="info"
          showIcon
          title="Đổi mật khẩu tạm trước khi sử dụng PMS"
          description="Sau khi đổi thành công, hãy đăng nhập lại bằng mật khẩu mới."
          style={{ marginBottom: 20 }}
        />
        {(error || sessionError) && (
          <Alert
            type="error"
            title={error || sessionError}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form
          layout="vertical"
          onFinish={submit}
          disabled={saving || isLoading}
        >
          <Form.Item
            name="currentPassword"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: "Nhập mật khẩu hiện tại." }]}
          >
            <Input.Password autoComplete="current-password" maxLength={128} />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            extra="15–128 ký tự, ít nhất 8 ký tự khác nhau."
            dependencies={["currentPassword"]}
            rules={[
              { required: true, message: "Nhập mật khẩu mới." },
              ({ getFieldValue }) => ({
                validator(_, value: string | undefined) {
                  return !value ||
                    (value.trim().length >= 15 &&
                      value.length <= 128 &&
                      new Set(value).size >= 8 &&
                      value !== getFieldValue("currentPassword"))
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(
                          "Mật khẩu chưa đủ mạnh hoặc trùng mật khẩu hiện tại.",
                        ),
                      );
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={128} />
          </Form.Item>
          <Form.Item
            name="confirmation"
            label="Xác nhận mật khẩu mới"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Xác nhận mật khẩu mới." },
              ({ getFieldValue }) => ({
                validator(_, value: string | undefined) {
                  return !value || value === getFieldValue("newPassword")
                    ? Promise.resolve()
                    : Promise.reject(new Error("Mật khẩu xác nhận chưa khớp."));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" maxLength={128} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Đổi mật khẩu
            </Button>
            <Button onClick={() => void logout().catch(() => {})}>Đăng xuất</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
}
