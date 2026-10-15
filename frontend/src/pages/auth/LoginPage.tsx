import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import type { LoginCredentials } from '../../types/auth.types.ts';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [customError, setCustomError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const onFinish = async (values: LoginCredentials) => {
    try {
      clearError();
      setCustomError(null);
      await login(values);
      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Đăng nhập không thành công.';
      setCustomError(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b2545 0%, #134074 50%, #006d77 100%)',
        padding: '20px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
          borderRadius: 16,
          border: 'none',
        }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto',
              background: '#e8f1f5',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0f4c81',
              fontSize: 28,
            }}
          >
            <BankOutlined />
          </div>

          <div>
            <Title level={3} style={{ margin: 0, color: '#0b2545' }}>
              INNVYRA PMS
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Hệ thống Quản lý Khách sạn & Tài sản Lưu trú
            </Text>
          </div>

          {(error || customError) && (
            <Alert
              message={customError || error}
              type="error"
              showIcon
              closable
              onClose={() => {
                clearError();
                setCustomError(null);
              }}
              style={{ textAlign: 'left' }}
            />
          )}

          <Form
            form={form}
            name="loginForm"
            layout="vertical"
            size="large"
            onFinish={onFinish}
            autoComplete="off"
            style={{ marginTop: 8 }}
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="Tên đăng nhập"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="Mật khẩu"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                style={{
                  height: 44,
                  fontSize: 16,
                  fontWeight: 600,
                  backgroundColor: '#0f4c81',
                }}
              >
                Đăng nhập
              </Button>
            </Form.Item>

            <Text type="secondary" style={{ fontSize: 12 }}>
              Tài khoản được cấp bởi Quản trị viên hệ thống.
            </Text>
          </Form>
        </Space>
      </Card>
    </div>
  );
};
