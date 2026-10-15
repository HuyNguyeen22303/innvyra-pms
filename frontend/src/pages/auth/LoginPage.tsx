import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
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
        background: 'linear-gradient(145deg, #091c17 0%, #0f2922 45%, #1b4d3e 100%)',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.35)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: '#ffffff',
          padding: '8px 12px',
        }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
          {/* Logo Badge */}
          <div
            style={{
              width: 64,
              height: 64,
              margin: '6px auto 0',
              background: '#ecfdf5',
              border: '2px solid #a7f3d0',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
            }}
          >
            🏨
          </div>

          <div>
            <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 700, letterSpacing: -0.5 }}>
              INNVYRA PMS
            </Title>
            <Text style={{ fontSize: 13, color: '#475569', display: 'block', marginTop: 4 }}>
              Hệ thống Quản lý Vận hành Khách sạn & Lưu trú
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
              style={{ textAlign: 'left', borderRadius: 8 }}
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
              label={<Text strong style={{ color: '#1e293b', fontSize: 13 }}>Tên đăng nhập</Text>}
              rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập!' }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#64748b', marginRight: 4 }} />}
                placeholder="Nhập tên đăng nhập (VD: le_tan_01, admin)"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<Text strong style={{ color: '#1e293b', fontSize: 13 }}>Mật khẩu</Text>}
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu!' }]}
              style={{ marginBottom: 20 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#64748b', marginRight: 4 }} />}
                placeholder="Nhập mật khẩu"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                block
                style={{
                  height: 44,
                  fontSize: 15,
                  fontWeight: 600,
                  backgroundColor: '#1b4d3e',
                  borderColor: '#1b4d3e',
                  boxShadow: '0 4px 12px rgba(27,77,62,0.25)',
                }}
              >
                Đăng nhập hệ thống
              </Button>
            </Form.Item>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '10px 12px',
                textAlign: 'left',
                fontSize: 12,
                color: '#475569',
              }}
            >
              <strong style={{ color: '#0f172a' }}>ℹ️ Lưu ý bảo mật:</strong>
              <div style={{ marginTop: 2 }}>
                Tài khoản nội bộ được phân quyền theo 6 vai trò bởi Quản lý khách sạn.
              </div>
            </div>
          </Form>
        </Space>
      </Card>
    </div>
  );
};
