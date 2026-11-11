import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Button, Form, Input } from "antd";
import { Link, Navigate, useLocation } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo.tsx";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";
import type { PlatformCredentials } from "../../types/platform.types.ts";

export function PlatformLoginPage() {
  const { user, login, isSubmitting, error, clearError } =
    usePlatformAuthStore();
  const location = useLocation();
  const state = location.state as { from?: string; notice?: string } | null;
  const from = state?.from;
  const target =
    from &&
    (from === "/platform" || from.startsWith("/platform/")) &&
    from !== "/platform/login"
      ? from
      : "/platform";
  if (user) return <Navigate to={target} replace />;
  const submit = async (input: PlatformCredentials) => {
    try {
      await login(input);
    } catch {
      /* Store provides a safe error message. */
    }
  };
  return (
    <main className="platform-login">
      <section className="platform-login-intro">
        <BrandLogo tone="dark" size={46} />
        <div className="platform-login-intro-copy">
          <div className="platform-eyebrow">
            <SafetyCertificateOutlined /> INNVYRA ADMIN
          </div>
          <h1>
            Một điểm đến.
            <br />
            {" "}
            Toàn bộ nền tảng.
          </h1>
          <p>Không gian làm việc dành cho đội ngũ quản trị Innvyra.</p>
          <div className="platform-login-emblem" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <span className="platform-login-signature">
          INNVYRA · PROPERTY MANAGEMENT SYSTEM
        </span>
      </section>
      <section className="platform-login-form-area">
        <div className="platform-login-card">
          <div className="platform-login-mark">
            <SafetyCertificateOutlined />
          </div>
          <div className="platform-eyebrow">QUẢN TRỊ NỀN TẢNG</div>
          <h2>Chào mừng trở lại</h2>
          <p className="platform-muted">
            Đăng nhập bằng tài khoản quản trị Innvyra của bạn.
          </p>
          {state?.notice && (
            <Alert
              type="success"
              showIcon
              title={state.notice}
              className="platform-form-alert"
            />
          )}
          {error && (
            <Alert
              type="error"
              showIcon
              title={error}
              closable
              onClose={clearError}
              className="platform-form-alert"
            />
          )}
          <Form<PlatformCredentials>
            layout="vertical"
            size="large"
            requiredMark={false}
            onFinish={submit}
            onValuesChange={clearError}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Vui lòng nhập email." },
                { type: "email", message: "Email chưa hợp lệ." },
              ]}
            >
              <Input
                type="email"
                prefix={<MailOutlined />}
                placeholder="Email quản trị"
                autoComplete="username"
                autoFocus
                maxLength={191}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: "Vui lòng nhập mật khẩu." }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                maxLength={128}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              block
              className="platform-login-submit"
            >
              Đăng nhập <ArrowRightOutlined />
            </Button>
          </Form>
          <div className="platform-login-other">
            <Link to="/login">
              <ArrowLeftOutlined /> Đăng nhập dành cho khách sạn
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
