import React, { useState } from "react";
import { Form, Input, Button, Alert } from "antd";
import {
  UserOutlined,
  LockOutlined,
  KeyOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  HomeOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore.ts";
import type { LoginCredentials } from "../../types/auth.types.ts";
import { BrandLogo } from "../../components/BrandLogo.tsx";
import { LoginIllustration } from "./LoginIllustration.tsx";
import "./LoginPage.css";

const demoAccounts = [
  {
    label: "Lễ tân",
    username: "receptionist",
    role: "RECEPTIONIST",
    color: "blue",
  },
  { label: "Quản lý", username: "manager", role: "MANAGER", color: "green" },
  {
    label: "Kế toán",
    username: "accountant",
    role: "ACCOUNTANT",
    color: "gold",
  },
  {
    label: "Buồng phòng",
    username: "housekeeping",
    role: "HOUSEKEEPING",
    color: "cyan",
  },
  {
    label: "Kỹ thuật",
    username: "technician",
    role: "TECHNICIAN",
    color: "purple",
  },
];

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [customError, setCustomError] = useState<string | null>(null);

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  const onFinish = async (values: LoginCredentials) => {
    try {
      clearError();
      setCustomError(null);
      await login(values);
      navigate(from, { replace: true });
    } catch {
      setCustomError(useAuthStore.getState().error || 'Đăng nhập không thành công.');
    }
  };

  const fillDemoAccount = (username: string) => {
    form.setFieldsValue({
      username,
      password: "Innvyra@Demo2026!",
    });
    clearError();
    setCustomError(null);
  };

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Giới thiệu Innvyra PMS">
        <div className="login-brand">
          <BrandLogo tone="dark" size={48} />
          <p>Nền tảng quản lý khách sạn</p>
        </div>
        <div className="login-hero-copy">
          <h1>
            <span>Vận hành tinh gọn.</span>
            <span>Dịch vụ trọn vẹn.</span>
          </h1>
          <p>Kết nối đặt phòng, lưu trú và vận hành trong một không gian.</p>
        </div>
        <LoginIllustration />
        <div className="login-features">
          <span>
            <CalendarOutlined /> Đặt phòng
          </span>
          <span>
            <HomeOutlined /> Lưu trú
          </span>
          <span>
            <BarChartOutlined /> Báo cáo
          </span>
        </div>
      </section>

      <section className="login-form-area" aria-labelledby="login-title">
        <div className="login-card">
          <header className="login-card-heading">
            <h2 id="login-title">Chào mừng trở lại</h2>
            <p>Đăng nhập để tiếp tục công việc.</p>
          </header>
          {(location.state as { passwordChanged?: boolean } | null)?.passwordChanged && <Alert type="success" showIcon title="Đổi mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới." style={{ marginBottom: 16 }} />}

          {(error || customError) && (
            <Alert
              title={customError || error}
              type="error"
              showIcon
              closable
              className="login-error"
              onClose={() => {
                clearError();
                setCustomError(null);
              }}
            />
          )}

          <Form
            form={form}
            name="loginForm"
            layout="vertical"
            size="large"
            onFinish={onFinish}
            autoComplete="off"
            className="login-form"
          >
            <Form.Item
              name="username"
              label="Tên đăng nhập"
              rules={[
                { required: true, message: "Vui lòng nhập tên đăng nhập!" },
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Nhập tên đăng nhập"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: "Vui lòng nhập mật khẩu!" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Nhập mật khẩu"
              />
            </Form.Item>
            <Form.Item className="login-submit-item">
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                className="login-submit"
              >
                <span>Đăng nhập</span>
                <ArrowRightOutlined />
              </Button>
            </Form.Item>
          </Form>

          <section className="login-demo" aria-label="Tài khoản thử nghiệm">
            <div className="login-demo-heading">
              <KeyOutlined /> Chọn nhanh tài khoản thử nghiệm
            </div>
            <div className="login-demo-buttons">
              {demoAccounts.map((acc) => (
                <Button
                  key={acc.username}
                  htmlType="button"
                  className="login-demo-button"
                  aria-label={`Điền tài khoản ${acc.label}`}
                  onClick={() => fillDemoAccount(acc.username)}
                >
                  <span>{acc.label}</span>
                  <span>{acc.username}</span>
                </Button>
              ))}
            </div>
          </section>
          <p style={{ marginTop: 20, textAlign: 'center' }}><Link to="/platform/login">Đăng nhập quản trị Innvyra →</Link></p>
        </div>
        <p className="login-footnote">
          INNVYRA PMS · KHÔNG GIAN VẬN HÀNH KHÁCH SẠN
        </p>
      </section>
    </main>
  );
};
