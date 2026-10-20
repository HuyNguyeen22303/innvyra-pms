import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Tooltip,
  App as AntdApp,
  Avatar,
  Tag,
} from 'antd';
import {
  KeyOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../../api/employees.api.ts';
import { ROLE_CONFIG, type EmployeeItem } from '../../../types/employees.types.ts';
import { generateSecurePassword } from './CreateEmployeeModal.tsx';

const { Text, Paragraph } = Typography;

interface ResetPasswordModalProps {
  open: boolean;
  employee: EmployeeItem | null;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  open,
  employee,
  onClose,
}) => {
  const { message: appMessage } = AntdApp.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNewPassword, setSuccessNewPassword] = useState<string | null>(null);

  // Watch password field to validate live distinct characters
  const passwordValue = Form.useWatch('password', form) || '';
  const passwordDistinctChars = new Set(passwordValue).size;
  const isPasswordLengthValid = passwordValue.length >= 15 && passwordValue.length <= 128;
  const isPasswordDistinctValid = passwordDistinctChars >= 8;

  useEffect(() => {
    if (open && employee) {
      form.resetFields();
      setErrorMessage(null);
      setSuccessNewPassword(null);
      // Pre-generate a strong password by default for convenience
      const initialPass = generateSecurePassword(16);
      form.setFieldsValue({ password: initialPass });
    }
  }, [open, employee, form]);

  const resetPasswordMutation = useMutation({
    mutationFn: (values: { password: string }) => {
      if (!employee) throw new Error('No employee selected');
      return employeesApi.resetPassword(employee.id, values.password);
    },
    onSuccess: (_, variables) => {
      appMessage.success(`Đã cấp lại mật khẩu cho ${employee?.fullName} thành công!`);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory-global'] });
      // Keep password visible so admin/manager can copy and send
      setSuccessNewPassword(variables.password);
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg = err.response?.data?.error?.message || err.response?.data?.message;

      if (code === 'FORBIDDEN') {
        setErrorMessage('Bạn không có quyền đặt lại mật khẩu cho nhân viên có cấp bậc bằng hoặc cao hơn (Role Hierarchy).');
      } else if (code === 'EMPLOYEE_NOT_FOUND') {
        setErrorMessage('Không tìm thấy tài khoản nhân viên trong cơ sở dữ liệu khách sạn.');
      } else {
        setErrorMessage(msg || 'Thao tác cấp lại mật khẩu thất bại. Vui lòng thử lại.');
      }
    },
  });

  const handleGeneratePassword = () => {
    const newPass = generateSecurePassword(16);
    form.setFieldsValue({ password: newPass });
    navigator.clipboard.writeText(newPass);
    appMessage.success('Đã sinh mật khẩu mạnh 16 ký tự và sao chép vào clipboard!');
  };

  const handleCopyPassword = (textToCopy?: string) => {
    const pass = textToCopy || form.getFieldValue('password');
    if (!pass) {
      appMessage.warning('Chưa có mật khẩu để sao chép.');
      return;
    }
    navigator.clipboard.writeText(pass);
    appMessage.success('Đã sao chép mật khẩu vào bộ nhớ tạm (clipboard)!');
  };

  const handleClose = () => {
    form.resetFields();
    setErrorMessage(null);
    setSuccessNewPassword(null);
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      resetPasswordMutation.mutate(values);
    } catch {
      // Form validation failed
    }
  };

  if (!employee) return null;

  const roleMeta = ROLE_CONFIG[employee.role] || { label: employee.role, color: 'default', badgeBg: '#1b4d3e' };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Space align="center" size={10}>
          <KeyOutlined style={{ color: '#d97706', fontSize: 20 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Cấp Lại Mật Khẩu Đăng Nhập
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>
              Đặt mật khẩu mới và thu hồi mọi phiên làm việc cũ của nhân viên
            </div>
          </div>
        </Space>
      }
      footer={
        successNewPassword ? (
          <Button type="primary" onClick={handleClose} style={{ backgroundColor: '#1b4d3e' }}>
            Hoàn tất & Đóng
          </Button>
        ) : (
          <Space>
            <Button onClick={handleClose}>Hủy</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={resetPasswordMutation.isPending}
              style={{ backgroundColor: '#1b4d3e' }}
            >
              Xác nhận cấp lại mật khẩu
            </Button>
          </Space>
        )
      }
      width={520}
      destroyOnHidden
    >
      {/* Employee Identity Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          margin: '16px 0 16px',
        }}
      >
        <Space size={12}>
          <Avatar
            style={{
              backgroundColor: roleMeta.badgeBg || '#1b4d3e',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            {employee.fullName.trim().charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
              {employee.fullName}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              @{employee.username}
            </Text>
          </div>
        </Space>
        <Tag color={roleMeta.color} style={{ margin: 0, fontWeight: 600 }}>
          {roleMeta.label}
        </Tag>
      </div>

      {successNewPassword ? (
        <div style={{ padding: '8px 0' }}>
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined style={{ fontSize: 20 }} />}
            title={<Text strong style={{ fontSize: 14 }}>Cấp lại mật khẩu thành công!</Text>}
            description={
              <div style={{ marginTop: 8 }}>
                <Paragraph style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                  Toàn bộ phiên đăng nhập cũ của <strong>{employee.fullName}</strong> đã bị thu hồi. Hãy sao chép mật khẩu mới bên dưới và gửi cho nhân viên:
                </Paragraph>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 10,
                    padding: '10px 14px',
                    background: '#ffffff',
                    border: '1px solid #bbf7d0',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#15803d',
                  }}
                >
                  <span>{successNewPassword}</span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyPassword(successNewPassword)}
                    style={{ backgroundColor: '#15803d' }}
                  >
                    Sao chép
                  </Button>
                </div>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            title="Chính sách bảo mật tài khoản"
            description="Sau khi mật khẩu mới được cấp, mọi thiết bị đang đăng nhập bằng tài khoản này sẽ bị đăng xuất ngay lập tức để bảo vệ hệ thống."
            style={{ marginBottom: 16, fontSize: 12 }}
          />

          {errorMessage && (
            <Alert
              type="error"
              title={errorMessage}
              showIcon
              style={{ marginBottom: 16 }}
              closable
              onClose={() => setErrorMessage(null)}
            />
          )}

          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item
              name="password"
              label="Mật khẩu mới"
              rules={[
                { required: true, message: 'Vui lòng nhập hoặc sinh mật khẩu mới' },
                { min: 15, message: 'Mật khẩu phải dài tối thiểu 15 ký tự' },
                { max: 128, message: 'Mật khẩu không vượt quá 128 ký tự' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const unique = new Set(value).size;
                    if (unique < 8) {
                      return Promise.reject(new Error(`Mật khẩu cần ít nhất 8 ký tự khác nhau (hiện có: ${unique})`));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="Tối thiểu 15 ký tự, ít nhất 8 ký tự khác nhau"
              />
            </Form.Item>

            {/* Password Generator & Requirements */}
            <div
              style={{
                marginTop: -10,
                marginBottom: 16,
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Công cụ tạo mật khẩu:</Text>
                <Space size={6}>
                  <Button type="dashed" size="small" icon={<KeyOutlined />} onClick={handleGeneratePassword}>
                    Tự sinh mật khẩu mới
                  </Button>
                  <Tooltip title="Sao chép mật khẩu hiện tại vào clipboard">
                    <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopyPassword()} />
                  </Tooltip>
                </Space>
              </div>

              <Space orientation="vertical" size={2} style={{ fontSize: 12 }}>
                <div>
                  {isPasswordLengthValid ? (
                    <Text type="success">
                      <CheckCircleOutlined /> Độ dài hợp lệ ({passwordValue.length}/15–128 ký tự)
                    </Text>
                  ) : (
                    <Text type="secondary">
                      <CloseCircleOutlined style={{ color: '#ef4444' }} /> Độ dài tối thiểu 15 ký tự (hiện có: {passwordValue.length})
                    </Text>
                  )}
                </div>
                <div>
                  {isPasswordDistinctValid ? (
                    <Text type="success">
                      <CheckCircleOutlined /> Độ đa dạng tốt ({passwordDistinctChars}/8 ký tự khác nhau)
                    </Text>
                  ) : (
                    <Text type="secondary">
                      <CloseCircleOutlined style={{ color: '#ef4444' }} /> Cần ít nhất 8 ký tự khác nhau (hiện có: {passwordDistinctChars})
                    </Text>
                  )}
                </div>
              </Space>
            </div>
          </Form>
        </>
      )}
    </Modal>
  );
};
