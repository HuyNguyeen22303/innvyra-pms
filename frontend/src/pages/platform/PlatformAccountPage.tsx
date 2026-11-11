import { useState } from "react";
import { Alert, Button, Card, Descriptions, Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { platformErrorMessage } from "../../api/platformClient.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";
import type { PlatformPasswordChange } from "../../types/platform.types.ts";

interface PasswordForm extends PlatformPasswordChange {
  confirmation: string;
}
export function PlatformAccountPage() {
  const { user, changePassword } = usePlatformAuthStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const submit = async ({ currentPassword, newPassword }: PasswordForm) => {
    setSaving(true);
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword });
      navigate("/platform/login", {
        replace: true,
        state: { notice: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." },
      });
    } catch (failure: unknown) {
      setError(platformErrorMessage(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">TÀI KHOẢN</div>
        <h1>Thông tin & bảo mật</h1>
        <p className="platform-muted">Quản lý thông tin đăng nhập của bạn.</p>
      </div>
      <div className="platform-account-grid">
        <Card title="Thông tin tài khoản">
          <Descriptions
            column={1}
            items={[
              { key: "name", label: "Họ và tên", children: user?.fullName },
              { key: "email", label: "Email", children: user?.email },
              { key: "role", label: "Vai trò", children: "Quản trị Innvyra" },
            ]}
          />
        </Card>
        <Card title="Đổi mật khẩu">
          <p className="platform-muted">
            Sau khi đổi mật khẩu, bạn sẽ đăng nhập lại trên các thiết bị đang sử
            dụng.
          </p>
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              className="platform-form-alert"
            />
          )}
          <Form<PasswordForm>
            layout="vertical"
            requiredMark={false}
            onFinish={submit}
            onValuesChange={() => setError(null)}
          >
            <Form.Item
              name="currentPassword"
              label="Mật khẩu hiện tại"
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu hiện tại." },
              ]}
            >
              <Input.Password autoComplete="current-password" maxLength={128} />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              dependencies={["currentPassword"]}
              extra="Ít nhất 15 ký tự, gồm tối thiểu 8 ký tự khác nhau."
              rules={[
                { required: true, message: "Vui lòng nhập mật khẩu mới." },
                ({ getFieldValue }) => ({
                  validator(_, value: string | undefined) {
                    if (!value) return Promise.resolve();
                    if (
                      value.trim().length < 15 ||
                      value.length > 128 ||
                      new Set(value).size < 8
                    )
                      return Promise.reject(
                        new Error(
                          "Mật khẩu cần ít nhất 15 ký tự và 8 ký tự khác nhau.",
                        ),
                      );
                    if (value === getFieldValue("currentPassword"))
                      return Promise.reject(
                        new Error("Mật khẩu mới phải khác mật khẩu hiện tại."),
                      );
                    return Promise.resolve();
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
                { required: true, message: "Vui lòng xác nhận mật khẩu mới." },
                ({ getFieldValue }) => ({
                  validator(_, value: string | undefined) {
                    return !value || value === getFieldValue("newPassword")
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error("Mật khẩu xác nhận chưa khớp."),
                        );
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" maxLength={128} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Cập nhật mật khẩu
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
