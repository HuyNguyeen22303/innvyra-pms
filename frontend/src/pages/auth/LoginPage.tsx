import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Space, Divider, Tag } from 'antd';
import { UserOutlined, LockOutlined, KeyOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import type { LoginCredentials } from '../../types/auth.types.ts';

const { Title, Text } = Typography;

const demoAccounts = [
  { label: 'Lễ tân', username: 'receptionist', role: 'RECEPTIONIST', color: 'blue' },
  { label: 'Quản lý', username: 'manager', role: 'MANAGER', color: 'green' },
  { label: 'Kế toán', username: 'accountant', role: 'ACCOUNTANT', color: 'gold' },
  { label: 'Buồng phòng', username: 'housekeeping', role: 'HOUSEKEEPING', color: 'cyan' },
  { label: 'Kỹ thuật', username: 'technician', role: 'TECHNICIAN', color: 'purple' },
];

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

  const fillDemoAccount = (username: string) => {
    form.setFieldsValue({
      username,
      password: 'Innvyra@Demo2026!',
    });
    clearError();
    setCustomError(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #091c17 0%, #0f2922 45%, #1b4d3e 100%)',
        padding: '16px 12px',
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
          padding: '4px 6px',
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%', textAlign: 'center' }}>
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
                placeholder="Nhập tên đăng nhập (VD: receptionist, manager)"
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

            <Divider style={{ margin: '14px 0 10px', fontSize: 12, color: '#64748b' }}>
              <Space size={4}>
                <KeyOutlined />
                <span>Chọn nhanh tài khoản thử nghiệm</span>
              </Space>
            </Divider>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {demoAccounts.map((acc) => (
                <Tag.CheckableTag
                  key={acc.username}
                  checked={false}
                  onChange={() => fillDemoAccount(acc.username)}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 12,
                    cursor: 'pointer',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{acc.label}</span>
                  <span style={{ color: '#64748b', marginLeft: 4, fontSize: 11 }}>({acc.username})</span>
                </Tag.CheckableTag>
              ))}
            </div>
          </Form>
        </Space>
      </Card>
    </div>
  );
};
