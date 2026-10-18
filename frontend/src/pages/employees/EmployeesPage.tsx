import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Popconfirm,
  Tooltip,
  Badge,
  message,
  Empty,
  Skeleton,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  TeamOutlined,
  UserAddOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { employeesApi } from '../../api/employees.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import {
  ROLE_CONFIG,
  canManageRole,
  type EmployeeItem,
  type Role,
} from '../../types/employees.types.ts';
import { CreateEmployeeModal } from './components/CreateEmployeeModal.tsx';
import { EditEmployeeModal } from './components/EditEmployeeModal.tsx';
import { ResetPasswordModal } from './components/ResetPasswordModal.tsx';
import { registerStaffMembers } from '../../utils/staffDirectory.ts';

const { Title, Text, Paragraph } = Typography;

const ALL_ROLES: Role[] = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'];

export const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<EmployeeItem | null>(null);

  // Filters & Pagination State
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'fullName' | 'createdAt' | 'username'>('fullName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Query Main Employee List
  const {
    data: employeesRes,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: [
      'employees',
      {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        role: roleFilter,
        isActive: statusFilter,
        sortBy,
        sortOrder,
      },
    ],
    queryFn: () =>
      employeesApi.list({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        role: roleFilter,
        isActive: statusFilter,
        sortBy,
        sortOrder,
      }),
  });

  const employeeItems = employeesRes?.data?.items || [];
  const pagination = employeesRes?.data?.pagination;

  // Sync loaded employees with global staff directory cache
  React.useEffect(() => {
    if (employeesRes?.data?.items) {
      registerStaffMembers(employeesRes.data.items);
    }
  }, [employeesRes]);

  // KPI Queries (Get accurate totals without full list download)
  const { data: totalAllRes } = useQuery({
    queryKey: ['employees', 'kpi', 'total-all'],
    queryFn: () => employeesApi.list({ limit: 1 }),
    staleTime: 60000,
  });

  const { data: totalActiveRes } = useQuery({
    queryKey: ['employees', 'kpi', 'total-active'],
    queryFn: () => employeesApi.list({ isActive: true, limit: 1 }),
    staleTime: 60000,
  });

  const { data: totalInactiveRes } = useQuery({
    queryKey: ['employees', 'kpi', 'total-inactive'],
    queryFn: () => employeesApi.list({ isActive: false, limit: 1 }),
    staleTime: 60000,
  });

  // Queries for role breakdown
  const roleKpiQueries = useQueries({
    queries: ALL_ROLES.map((role) => ({
      queryKey: ['employees', 'kpi', 'role', role],
      queryFn: () => employeesApi.list({ role, limit: 1 }),
      staleTime: 60000,
    })),
  });

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = {
      ADMIN: 0,
      MANAGER: 0,
      RECEPTIONIST: 0,
      ACCOUNTANT: 0,
      HOUSEKEEPING: 0,
      TECHNICIAN: 0,
    };
    ALL_ROLES.forEach((r, idx) => {
      counts[r] = roleKpiQueries[idx]?.data?.data?.pagination?.total ?? 0;
    });
    return counts;
  }, [roleKpiQueries]);

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => employeesApi.deactivate(id),
    onSuccess: (res) => {
      message.success(`Đã vô hiệu hóa tài khoản ${res.data.fullName} và thu hồi mọi phiên đăng nhập!`);
      // Invalidate queries to refresh table and KPIs
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory-global'] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg = err.response?.data?.error?.message || err.response?.data?.message;

      if (code === 'LAST_ADMIN') {
        message.error('Không thể vô hiệu hóa Quản trị viên (ADMIN) cuối cùng còn lại trong khách sạn!');
      } else if (code === 'ALREADY_DEACTIVATED') {
        message.warning('Tài khoản nhân viên này đã bị vô hiệu hóa từ trước.');
      } else if (code === 'FORBIDDEN') {
        message.error('Bạn không có quyền vô hiệu hóa nhân viên có cấp bậc bằng hoặc cao hơn (Role Hierarchy).');
      } else {
        message.error(msg || 'Thao tác vô hiệu hóa thất bại. Vui lòng thử lại.');
      }
    },
  });

  // Activate Mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => employeesApi.activate(id),
    onSuccess: (res) => {
      message.success(`Đã mở lại tài khoản cho nhân viên ${res.data.fullName} thành công!`);
      // Invalidate queries to refresh table and KPIs
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['staff-directory-global'] });
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code || err.response?.data?.code;
      const msg = err.response?.data?.error?.message || err.response?.data?.message;

      if (code === 'ALREADY_ACTIVE') {
        message.warning('Tài khoản nhân viên này đang hoạt động.');
      } else if (code === 'FORBIDDEN') {
        message.error('Bạn không có quyền mở lại tài khoản cho nhân viên có cấp bậc bằng hoặc cao hơn (Role Hierarchy).');
      } else {
        message.error(msg || 'Thao tác mở lại tài khoản thất bại. Vui lòng thử lại.');
      }
    },
  });

  // Table Columns
  const columns: ColumnsType<EmployeeItem> = [
    {
      title: 'Họ và tên & Username',
      key: 'nameAndUser',
      width: 250,
      render: (_, record) => {
        const initial = record.fullName.trim().charAt(0).toUpperCase();
        const config = ROLE_CONFIG[record.role] || ROLE_CONFIG.RECEPTIONIST;
        const isSelf = String(record.id) === String(user?.id);

        return (
          <Space size={12}>
            <Avatar
              style={{
                backgroundColor: config.badgeBg,
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {initial}
            </Avatar>
            <div>
              <Space size={4}>
                <Text strong style={{ color: '#0f172a', fontSize: 14 }}>
                  {record.fullName}
                </Text>
                {isSelf && (
                  <Tag color="cyan" style={{ fontSize: 10, lineHeight: '18px', padding: '0 4px', margin: 0 }}>
                    Bạn
                  </Tag>
                )}
              </Space>
              <br />
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                @{record.username}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Vai trò & Cấp bậc',
      dataIndex: 'role',
      key: 'role',
      width: 170,
      render: (role: Role) => {
        const config = ROLE_CONFIG[role];
        return (
          <Tag
            color={config.color}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Địa chỉ Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      render: (email: string | null) =>
        email ? (
          <Text style={{ fontSize: 13, color: '#334155' }}>{email}</Text>
        ) : (
          <Text type="secondary" italic style={{ fontSize: 12 }}>
            Chưa có email
          </Text>
        ),
    },
    {
      title: 'Trạng thái tài khoản',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 170,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success" icon={<CheckCircleOutlined />} style={{ padding: '2px 8px' }}>
            Đang hoạt động
          </Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />} style={{ padding: '2px 8px' }}>
            Đã vô hiệu hóa
          </Tag>
        ),
    },
    {
      title: 'Ngày tạo hồ sơ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (createdAt: string) => (
        <Text style={{ fontSize: 12, color: '#64748b' }}>
          {dayjs(createdAt).format('DD/MM/YYYY HH:mm')}
        </Text>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        const isSelf = String(record.id) === String(user?.id);
        const canManage = canManageRole(user?.role, record.role);

        // Edit permission: must be able to manage this employee's role
        const canEdit = isAdminOrManager && canManage;

        // Reset password permission:
        const canResetPassword = isAdminOrManager && canManage;

        // Deactivate permission:
        // 1. Must be active (cannot deactivate an already deactivated account)
        // 2. Cannot deactivate self
        // 3. Must be able to manage according to role hierarchy
        const canDeactivate = isAdminOrManager && record.isActive && !isSelf && canManage;

        // Activate permission:
        // 1. Must be deactivated
        // 2. Cannot activate self
        // 3. Must be able to manage according to role hierarchy
        const canActivate = isAdminOrManager && !record.isActive && !isSelf && canManage;

        return (
          <Space size={4}>
            {/* 1. Edit Employee */}
            <Tooltip
              title={
                !canManage
                  ? 'Cấp bậc nhân viên này bằng hoặc cao hơn bạn (không được chỉnh sửa).'
                  : 'Chỉnh sửa họ tên, email hoặc vai trò'
              }
            >
              <Button
                type="text"
                size="small"
                icon={<EditOutlined style={{ color: canEdit ? '#1b4d3e' : '#cbd5e1' }} />}
                disabled={!canEdit}
                onClick={() => setEditingEmployee(record)}
              />
            </Tooltip>

            {/* 2. Reset Password */}
            <Tooltip
              title={
                !canManage
                  ? 'Cấp bậc nhân viên này bằng hoặc cao hơn bạn (không thể đặt lại mật khẩu).'
                  : 'Cấp lại mật khẩu đăng nhập & thu hồi các phiên cũ'
              }
            >
              <Button
                type="text"
                size="small"
                icon={<KeyOutlined style={{ color: canResetPassword ? '#d97706' : '#cbd5e1' }} />}
                disabled={!canResetPassword}
                onClick={() => setResetPasswordEmployee(record)}
              />
            </Tooltip>

            {/* 3. Lock / Unlock Account */}
            {record.isActive ? (
              <Tooltip
                title={
                  isSelf
                    ? 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.'
                    : !canManage
                    ? 'Không thể vô hiệu hóa nhân viên có cấp bậc bằng hoặc cao hơn.'
                    : 'Vô hiệu hóa tài khoản & thu hồi mọi phiên đăng nhập'
                }
              >
                {canDeactivate ? (
                  <Popconfirm
                    title="Vô hiệu hóa tài khoản?"
                    description={
                      <div style={{ maxWidth: 280 }}>
                        <Paragraph style={{ margin: 0, fontSize: 13 }}>
                          Tài khoản của <strong>{record.fullName}</strong> sẽ bị khóa. Toàn bộ phiên đăng nhập của nhân
                          viên sẽ bị thu hồi ngay lập tức.
                        </Paragraph>
                      </div>
                    }
                    onConfirm={() => deactivateMutation.mutate(record.id)}
                    okText="Xác nhận khóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true, loading: deactivateMutation.isPending }}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<LockOutlined />}
                    />
                  </Popconfirm>
                ) : (
                  <Button
                    type="text"
                    disabled
                    size="small"
                    icon={<LockOutlined style={{ color: '#cbd5e1' }} />}
                  />
                )}
              </Tooltip>
            ) : (
              <Tooltip
                title={
                  isSelf
                    ? 'Không thể tự mở lại tài khoản của chính mình.'
                    : !canManage
                    ? 'Không thể mở lại tài khoản cho nhân viên có cấp bậc bằng hoặc cao hơn.'
                    : 'Mở lại tài khoản nhân viên & cho phép đăng nhập lại'
                }
              >
                {canActivate ? (
                  <Popconfirm
                    title="Mở lại tài khoản nhân viên?"
                    description={
                      <div style={{ maxWidth: 280 }}>
                        <Paragraph style={{ margin: 0, fontSize: 13 }}>
                          Tài khoản của <strong>{record.fullName}</strong> sẽ được kích hoạt trở lại để tiếp tục đăng nhập và làm việc bình thường.
                        </Paragraph>
                      </div>
                    }
                    onConfirm={() => activateMutation.mutate(record.id)}
                    okText="Mở lại tài khoản"
                    cancelText="Hủy"
                    okButtonProps={{ style: { backgroundColor: '#15803d', borderColor: '#15803d' }, loading: activateMutation.isPending }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<UnlockOutlined style={{ color: '#15803d' }} />}
                    />
                  </Popconfirm>
                ) : (
                  <Button
                    type="text"
                    disabled
                    size="small"
                    icon={<UnlockOutlined style={{ color: '#cbd5e1' }} />}
                  />
                )}
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            <TeamOutlined style={{ marginRight: 8, color: '#1b4d3e' }} />
            Quản Lý Nhân Sự & Phân Quyền Tài Khoản
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Danh bạ nhân viên, cấp phát tài khoản đăng nhập và kiểm soát quyền hạn theo Role Hierarchy.
          </Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ['employees', 'kpi'] });
            }}
          >
            Làm mới
          </Button>

          {isAdminOrManager && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Thêm nhân viên
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Cards Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8} md={8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Tổng nhân sự khách sạn
            </Text>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Title level={3} style={{ margin: 0, color: '#1b4d3e' }}>
                {totalAllRes?.data?.pagination?.total ?? <Skeleton.Button active size="small" />}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                thành viên
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Đang hoạt động (Active)
            </Text>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Title level={3} style={{ margin: 0, color: '#15803d' }}>
                {totalActiveRes?.data?.pagination?.total ?? <Skeleton.Button active size="small" />}
              </Title>
              <Badge status="success" text="Sẵn sàng phân việc" style={{ fontSize: 12 }} />
            </div>
          </Card>
        </Col>

        <Col xs={12} sm={8} md={8}>
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Đã vô hiệu hóa (Disabled)
            </Text>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Title level={3} style={{ margin: 0, color: '#64748b' }}>
                {totalInactiveRes?.data?.pagination?.total ?? <Skeleton.Button active size="small" />}
              </Title>
              <Badge status="default" text="Thu hồi phiên" style={{ fontSize: 12 }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Role Breakdown Distribution Bar */}
      <Card
        size="small"
        style={{
          marginBottom: 20,
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space size={6}>
            <IdcardOutlined style={{ color: '#1b4d3e' }} />
            <Text strong style={{ fontSize: 13, color: '#334155' }}>
              Phân bổ nhân lực theo vai trò:
            </Text>
          </Space>

          <Space wrap size={10}>
            {ALL_ROLES.map((role) => {
              const meta = ROLE_CONFIG[role];
              const count = roleCounts[role];
              return (
                <Tag
                  key={role}
                  color={meta.color}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    cursor: 'pointer',
                    opacity: roleFilter && roleFilter !== role ? 0.4 : 1,
                  }}
                  onClick={() => {
                    setRoleFilter(roleFilter === role ? undefined : role);
                    setCurrentPage(1);
                  }}
                >
                  <strong>{meta.label}:</strong> {count}
                </Tag>
              );
            })}
          </Space>
        </div>
      </Card>

      {/* Filters Bar */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={7}>
            <Input
              placeholder="Tìm theo họ tên, username hoặc email..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchKeyword}
              allowClear
              onChange={(e) => setSearchKeyword(e.target.value)}
              onPressEnter={() => {
                setDebouncedSearch(searchKeyword.trim());
                setCurrentPage(1);
              }}
              onBlur={() => {
                if (searchKeyword.trim() !== debouncedSearch) {
                  setDebouncedSearch(searchKeyword.trim());
                  setCurrentPage(1);
                }
              }}
            />
          </Col>

          <Col xs={12} sm={6} md={5}>
            <Select
              style={{ width: '100%' }}
              placeholder="Lọc theo vai trò"
              value={roleFilter || 'ALL'}
              onChange={(val) => {
                setRoleFilter(val === 'ALL' ? undefined : (val as Role));
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả chức danh' },
                ...ALL_ROLES.map((r) => ({
                  value: r,
                  label: ROLE_CONFIG[r].label,
                })),
              ]}
            />
          </Col>

          <Col xs={12} sm={6} md={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="Trạng thái"
              value={statusFilter === undefined ? 'ALL' : statusFilter ? 'ACTIVE' : 'INACTIVE'}
              onChange={(val) => {
                if (val === 'ALL') setStatusFilter(undefined);
                else if (val === 'ACTIVE') setStatusFilter(true);
                else setStatusFilter(false);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: '● Đang hoạt động' },
                { value: 'INACTIVE', label: '🔒 Đã vô hiệu hóa' },
              ]}
            />
          </Col>

          <Col xs={16} sm={8} md={5}>
            <Select
              style={{ width: '100%' }}
              value={`${sortBy}-${sortOrder}`}
              onChange={(val) => {
                const [sb, so] = val.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
                setCurrentPage(1);
              }}
              options={[
                { value: 'fullName-asc', label: 'Tên: A ➔ Z' },
                { value: 'fullName-desc', label: 'Tên: Z ➔ A' },
                { value: 'createdAt-desc', label: 'Mới tạo gần đây' },
                { value: 'createdAt-asc', label: 'Tạo lâu nhất' },
                { value: 'username-asc', label: 'Username: A ➔ Z' },
              ]}
            />
          </Col>

          <Col xs={8} sm={4} md={3} style={{ textAlign: 'right' }}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setSearchKeyword('');
                setDebouncedSearch('');
                setRoleFilter(undefined);
                setStatusFilter(undefined);
                setSortBy('fullName');
                setSortOrder('asc');
                setCurrentPage(1);
              }}
            >
              Đặt lại
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <Table<EmployeeItem>
          columns={columns}
          dataSource={employeeItems}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          locale={{
            emptyText: isError ? (
              <div style={{ padding: '30px 0' }}>
                <Paragraph type="danger">Có lỗi khi tải danh sách nhân viên từ máy chủ.</Paragraph>
                <Button onClick={() => refetch()} icon={<ReloadOutlined />}>
                  Thử lại
                </Button>
              </div>
            ) : (
              <Empty description="Không tìm thấy nhân viên nào phù hợp với bộ lọc." style={{ padding: '30px 0' }} />
            ),
          }}
          pagination={{
            current: currentPage,
            pageSize,
            total: pagination?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} nhân viên`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Card>

      {/* Modals */}
      <CreateEmployeeModal open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />

      <EditEmployeeModal
        open={!!editingEmployee}
        employee={editingEmployee}
        onClose={() => setEditingEmployee(null)}
      />

      <ResetPasswordModal
        open={!!resetPasswordEmployee}
        employee={resetPasswordEmployee}
        onClose={() => setResetPasswordEmployee(null)}
      />
    </div>
  );
};
