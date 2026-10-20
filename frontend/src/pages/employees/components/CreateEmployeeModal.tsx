import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Alert,
  Tooltip,
  App as AntdApp,
} from 'antd';
import {
  KeyOutlined,
  CopyOutlined,
  UserOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../../api/employees.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import {
  ROLE_CONFIG,
  getAssignableRoles,
  type CreateEmployeeDto,
  type Role,
} from '../../../types/employees.types.ts';
import { generateSecurePassword } from '../../../utils/password.ts';

const { Text, Paragraph } = Typography;

interface CreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
}



export const CreateEmployeeModal: React.FC<CreateEmployeeModalProps> = ({ open, onClose }) => {
  const { message: appMessage } = AntdApp.useApp();
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Watch password field to validate live distinct characters
  const passwordValue = Form.useWatch('password', form) || '';
  const passwordDistinctChars = new Set(passwordValue).size;
  const isPasswordLengthValid = passwordValue.length >= 15 && passwordValue.length <= 128;
  const isPasswordDistinctValid = passwordDistinctChars >= 8;

  const assignableRoles = getAssignableRoles(user?.role);

  const createMutation = useMutation({
    mutationFn: (values: CreateEmployeeDto) => employeesApi.create(values),
    onSuccess: (res) => {
      appMessage.success(`Tạo tài khoản nhân viên ${res.data.fullName} thành công!`);
      // Invalidate all employees queries
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory-global'] });
      handleClose();
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg = err.response?.data?.error?.message || err.response?.data?.message;

      if (code === 'USERNAME_EXISTS') {
        setErrorMessage('Tên đăng nhập (username) đã tồn tại trong hệ thống. Vui lòng chọn tên đăng nhập khác.');
      } else if (code === 'EMAIL_EXISTS') {
        setErrorMessage('Địa chỉ email này đã được sử dụng bởi một nhân viên khác.');
      } else if (code === 'INVALID_ROLE') {
        setErrorMessage('Vai trò không hợp lệ trong hệ thống.');
      } else if (code === 'FORBIDDEN') {
        setErrorMessage('Bạn không có quyền quản lý hoặc tạo tài khoản cho vai trò có cấp bậc này (Role Hierarchy).');
      } else {
        setErrorMessage(msg || 'Không thể tạo tài khoản nhân viên. Vui lòng kiểm tra lại thông tin.');
      }
    },
  });

  const handleGeneratePassword = () => {
    const pwd = generateSecurePassword(16);
    setGeneratedPassword(pwd);
    form.setFieldsValue({ password: pwd });
    appMessage.info('Đã tạo mật khẩu an toàn ngẫu nhiên (16 ký tự).');
  };

  const handleCopyPassword = () => {
    const currentPwd = form.getFieldValue('password') || generatedPassword;
    if (!currentPwd) {
      appMessage.warning('Chưa có mật khẩu để sao chép.');
      return;
    }
    navigator.clipboard.writeText(currentPwd);
    appMessage.success('Đã sao chép mật khẩu vào bộ nhớ tạm (Clipboard)!');
  };

  const handleClose = () => {
    form.resetFields();
    setGeneratedPassword('');
    setErrorMessage(null);
    onClose();
  };

  const handleFinish = (values: any) => {
    setErrorMessage(null);
    createMutation.mutate({
      fullName: values.fullName,
      username: values.username,
      email: values.email || null,
      password: values.password,
      role: values.role,
    });
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1b4d3e' }} />
          <span>Thêm Nhân Viên & Cấp Tài Khoản Mới</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      destroyOnHidden
    >
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Tạo hồ sơ nhân viên và cấp phát tài khoản truy cập hệ thống Innvyra PMS theo cấp bậc phân quyền.
      </Paragraph>

      {errorMessage && (
        <Alert
          type="error"
          title={errorMessage}
          showIcon
          closable
          onClose={() => setErrorMessage(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} layout="vertical" onFinish={handleFinish} initialValues={{ role: assignableRoles[0] }}>
        <Form.Item
          name="fullName"
          label="Họ và tên nhân viên"
          rules={[
            { required: true, message: 'Vui lòng nhập họ và tên nhân viên' },
            { max: 191, message: 'Họ tên không được vượt quá 191 ký tự' },
          ]}
        >
          <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: Hoàng Văn Nam" />
        </Form.Item>

        <Form.Item
          name="username"
          label="Tên đăng nhập (Username)"
          rules={[
            { required: true, message: 'Vui lòng nhập tên đăng nhập' },
            { min: 3, message: 'Tên đăng nhập tối thiểu 3 ký tự' },
            { max: 64, message: 'Tên đăng nhập tối đa 64 ký tự' },
            {
              pattern: /^[a-z0-9._-]+$/,
              message: 'Tên đăng nhập chỉ được dùng chữ thường, số, dấu chấm (.), gạch dưới (_) hoặc gạch nối (-)',
            },
          ]}
          extra="Chỉ chữ thường, số và ký tự . _ -. Không thể thay đổi sau khi tạo."
        >
          <Input
            placeholder="ví dụ: namhoang.tech"
            onChange={(e) => {
              // Auto lowercase username for convenience
              form.setFieldValue('username', e.target.value.toLowerCase());
            }}
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="Địa chỉ Email (Tùy chọn)"
          rules={[{ type: 'email', message: 'Địa chỉ email không đúng định dạng' }]}
        >
          <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="ví dụ: namhoang@innvyra.vn" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Chức danh / Vai trò"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò nhân sự' }]}
          extra={
            user?.role === 'MANAGER'
              ? 'Tài khoản Quản lý chỉ được cấp quyền cho các vai trò cấp dưới (Lễ tân, Kế toán, Buồng phòng, Kỹ thuật).'
              : undefined
          }
        >
          <Select
            options={assignableRoles.map((r: Role) => ({
              value: r,
              label: (
                <Space>
                  <span style={{ fontWeight: 600, color: '#1b4d3e' }}>{ROLE_CONFIG[r].label}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>({ROLE_CONFIG[r].code})</span>
                </Space>
              ),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Mật khẩu ban đầu"
          rules={[
            { required: true, message: 'Vui lòng nhập hoặc sinh mật khẩu ban đầu' },
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
            prefix={<KeyOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tối thiểu 15 ký tự, ít nhất 8 ký tự khác nhau"
          />
        </Form.Item>

        {/* Password Strength Checklist & Generator Tools */}
        <div
          style={{
            marginTop: -10,
            marginBottom: 18,
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Yêu cầu mật khẩu an toàn:</Text>
            <Space size={6}>
              <Button type="dashed" size="small" icon={<KeyOutlined />} onClick={handleGeneratePassword}>
                Tự sinh mật khẩu ngẫu nhiên
              </Button>
              <Tooltip title="Sao chép mật khẩu hiện tại vào clipboard">
                <Button size="small" icon={<CopyOutlined />} onClick={handleCopyPassword} />
              </Tooltip>
            </Space>
          </div>

          <Space orientation="vertical" size={2} style={{ fontSize: 12 }}>
            <Space size={6}>
              {isPasswordLengthValid ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#94a3b8' }} />
              )}
              <Text style={{ fontSize: 12, color: isPasswordLengthValid ? '#15803d' : '#64748b' }}>
                Độ dài tối thiểu 15 ký tự (hiện có: {passwordValue.length}/15)
              </Text>
            </Space>
            <Space size={6}>
              {isPasswordDistinctValid ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#94a3b8' }} />
              )}
              <Text style={{ fontSize: 12, color: isPasswordDistinctValid ? '#15803d' : '#64748b' }}>
                Có ít nhất 8 ký tự phân biệt (hiện có: {passwordDistinctChars}/8)
              </Text>
            </Space>
          </Space>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Button onClick={handleClose}>Hủy bỏ</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={createMutation.isPending}
            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
          >
            Tạo tài khoản
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
