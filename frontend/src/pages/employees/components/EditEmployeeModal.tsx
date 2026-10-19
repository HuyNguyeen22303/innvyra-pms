import React, { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  Alert,
  message,
} from 'antd';
import {
  EditOutlined,
  UserOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '../../../api/employees.api.ts';
import { useAuthStore } from '../../../store/authStore.ts';
import {
  ROLE_CONFIG,
  getAssignableRoles,
  type EmployeeItem,
  type UpdateEmployeeDto,
  type Role,
} from '../../../types/employees.types.ts';

const { Paragraph } = Typography;

interface EditEmployeeModalProps {
  open: boolean;
  employee: EmployeeItem | null;
  onClose: () => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  open,
  employee,
  onClose,
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const assignableRoles = getAssignableRoles(user?.role);

  useEffect(() => {
    if (employee && open) {
      form.setFieldsValue({
        fullName: employee.fullName,
        username: employee.username,
        email: employee.email || '',
        role: employee.role,
      });
      setErrorMessage(null);
    }
  }, [employee, open, form]);

  const updateMutation = useMutation({
    mutationFn: (values: UpdateEmployeeDto) => {
      if (!employee) throw new Error('No employee selected');
      return employeesApi.update(employee.id, values);
    },
    onSuccess: (res) => {
      message.success(`Cập nhật thông tin nhân viên ${res.data.fullName} thành công!`);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory-global'] });
      handleClose();
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg = err.response?.data?.error?.message || err.response?.data?.message;

      if (code === 'EMAIL_EXISTS') {
        setErrorMessage('Địa chỉ email này đã được sử dụng bởi một nhân viên khác.');
      } else if (code === 'INVALID_ROLE') {
        setErrorMessage('Vai trò không hợp lệ trong hệ thống.');
      } else if (code === 'FORBIDDEN') {
        setErrorMessage('Bạn không có quyền quản lý hoặc đổi vai trò cho nhân viên này (Role Hierarchy).');
      } else {
        setErrorMessage(msg || 'Không thể cập nhật nhân viên. Vui lòng thử lại.');
      }
    },
  });

  const handleClose = () => {
    form.resetFields();
    setErrorMessage(null);
    onClose();
  };

  const handleFinish = (values: any) => {
    if (!employee) return;
    setErrorMessage(null);

    // Only send changed fields
    const payload: UpdateEmployeeDto = {};
    if (values.fullName.trim() !== employee.fullName) {
      payload.fullName = values.fullName.trim();
    }
    const cleanEmail = values.email && values.email.trim() ? values.email.trim().toLowerCase() : null;
    if (cleanEmail !== employee.email) {
      payload.email = cleanEmail;
    }
    if (values.role !== employee.role) {
      payload.role = values.role;
    }

    if (Object.keys(payload).length === 0) {
      message.info('Không có thông tin nào thay đổi.');
      handleClose();
      return;
    }

    updateMutation.mutate(payload);
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined style={{ color: '#1b4d3e' }} />
          <span>Chỉnh Sửa Hồ Sơ Nhân Viên</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnHidden
    >
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 16 }}>
        Cập nhật thông tin định danh và vai trò công tác của nhân viên. Tên đăng nhập và mật khẩu được bảo vệ không thể thay đổi tại đây.
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

      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item label="Tên đăng nhập (Username)" name="username">
          <Input disabled style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }} />
        </Form.Item>

        <Form.Item
          name="fullName"
          label="Họ và tên nhân viên"
          rules={[
            { required: true, message: 'Vui lòng nhập họ và tên' },
            { max: 191, message: 'Họ tên không vượt quá 191 ký tự' },
          ]}
        >
          <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Địa chỉ Email"
          rules={[{ type: 'email', message: 'Địa chỉ email không đúng định dạng' }]}
        >
          <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="Để trống nếu không có email" />
        </Form.Item>

        <Form.Item
          name="role"
          label="Vai trò công tác"
          rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          <Button onClick={handleClose}>Hủy bỏ</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateMutation.isPending}
            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
          >
            Lưu thay đổi
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
