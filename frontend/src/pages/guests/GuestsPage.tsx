import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Typography,
  message,
  Popconfirm,
  Card,
  Tooltip,
  Row,
  Col,
  Alert,
  Avatar,
  Divider,
  Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  SearchOutlined,
  IdcardOutlined,
  PhoneOutlined,
  MailOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { guestsApi } from '../../api/guests.api.ts';
import { useAuthStore } from '../../store/authStore.ts';
import type {
  GuestSummary,
  GuestDetail,
  CreateGuestDto,
  GuestGender,
  DocumentType,
} from '../../types/guests.types.ts';

const { Title, Text, Paragraph } = Typography;

export const GuestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [form] = Form.useForm();

  // Search & Filter state
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedNationality, setSelectedNationality] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'fullName' | 'createdAt'>('fullName');

  // Modals & Drawer state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestDetail | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showDocumentNumber, setShowDocumentNumber] = useState(false);

  // RBAC permissions based on backend guestPermissions:
  // write: ['ADMIN', 'MANAGER', 'RECEPTIONIST']
  // delete: ['ADMIN', 'MANAGER']
  // sensitive (can see phone, email, document): ['ADMIN', 'MANAGER', 'RECEPTIONIST']
  // read only (minimal identity): ['ACCOUNTANT']
  const canWrite = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'RECEPTIONIST';
  const canDelete = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAccountant = user?.role === 'ACCOUNTANT';

  // Fetch Guest List
  const {
    data: guestsRes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['guests', searchKeyword, selectedNationality, sortBy],
    queryFn: () =>
      guestsApi.getAll({
        search: searchKeyword.trim() || undefined,
        nationality: selectedNationality || undefined,
        sortBy,
        sortOrder: 'asc',
      }),
  });

  const rawData = guestsRes?.data;
  const guests: GuestSummary[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.items)
    ? (rawData as any).items
    : [];

  // Fetch Single Guest Detail for Drawer / Edit
  const {
    data: detailRes,
    isLoading: isDetailLoading,
  } = useQuery({
    queryKey: ['guest-detail', selectedGuestId],
    queryFn: () => guestsApi.getById(selectedGuestId!),
    enabled: !!selectedGuestId,
  });

  const guestDetail: GuestDetail | undefined = detailRes?.data;

  // Create Guest Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateGuestDto) => guestsApi.create(data),
    onSuccess: () => {
      message.success('Thêm hồ sơ khách hàng thành công!');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Không thể thêm khách hàng.';
      message.error(msg);
    },
  });

  // Update Guest Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGuestDto> }) =>
      guestsApi.update(id, data),
    onSuccess: () => {
      message.success('Cập nhật hồ sơ thành công!');
      setIsModalOpen(false);
      setEditingGuest(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['guests'] });
      if (selectedGuestId) {
        queryClient.invalidateQueries({ queryKey: ['guest-detail', selectedGuestId] });
      }
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Cập nhật thất bại.';
      message.error(msg);
    },
  });

  // Delete Guest Mutation (Soft delete)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => guestsApi.delete(id),
    onSuccess: () => {
      message.success('Đã lưu trữ / xóa hồ sơ khách hàng!');
      setIsDrawerOpen(false);
      setSelectedGuestId(null);
      queryClient.invalidateQueries({ queryKey: ['guests'] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        'Không thể xóa hồ sơ.';
      message.error(msg);
    },
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingGuest(null);
    form.resetFields();
    form.setFieldsValue({
      nationality: 'Việt Nam',
      gender: 'UNSPECIFIED',
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal (fetches detail first if not in memory)
  const handleOpenEdit = async (record: GuestSummary) => {
    try {
      const res = await guestsApi.getById(record.id);
      const detail = res.data;
      setEditingGuest(detail);
      form.setFieldsValue({
        fullName: detail.fullName,
        phone: detail.phone,
        email: detail.email,
        dateOfBirth: detail.dateOfBirth ? dayjs(detail.dateOfBirth) : null,
        gender: detail.gender || 'UNSPECIFIED',
        nationality: detail.nationality || 'Việt Nam',
        documentType: detail.documentType,
        documentNumber: detail.documentNumber,
        address: detail.address,
        notes: detail.notes,
      });
      setIsModalOpen(true);
    } catch {
      message.error('Không thể lấy thông tin chi tiết để chỉnh sửa.');
    }
  };

  // Open Detail Drawer
  const handleOpenDetail = (record: GuestSummary) => {
    setSelectedGuestId(record.id);
    setShowDocumentNumber(false);
    setIsDrawerOpen(true);
  };

  // Submit Create / Edit Form
  const handleSubmit = (values: any) => {
    const payload: CreateGuestDto = {
      fullName: values.fullName.trim(),
      phone: values.phone ? values.phone.trim() : null,
      email: values.email ? values.email.trim().toLowerCase() : null,
      dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
      gender: values.gender || null,
      nationality: values.nationality ? values.nationality.trim() : null,
      documentType: values.documentType || null,
      documentNumber: values.documentNumber ? values.documentNumber.trim().toUpperCase() : null,
      address: values.address ? values.address.trim() : null,
      notes: values.notes ? values.notes.trim() : null,
    };

    if (editingGuest) {
      updateMutation.mutate({
        id: editingGuest.id,
        data: payload,
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Document Type Label Helper
  const getDocTypeLabel = (type?: DocumentType | null) => {
    switch (type) {
      case 'NATIONAL_ID':
        return 'CCCD / CMND';
      case 'PASSPORT':
        return 'Hộ chiếu (Passport)';
      case 'DRIVER_LICENSE':
        return 'Bằng lái xe';
      case 'OTHER':
        return 'Giấy tờ khác';
      default:
        return 'Chưa khai báo';
    }
  };

  // Gender Label Helper
  const getGenderLabel = (gender?: GuestGender | null) => {
    switch (gender) {
      case 'MALE':
        return 'Nam';
      case 'FEMALE':
        return 'Nữ';
      case 'OTHER':
        return 'Khác';
      default:
        return 'Chưa chọn';
    }
  };

  // Mask sensitive document numbers: 079201006200 -> 07920******
  const maskDocument = (doc?: string | null) => {
    if (!doc) return '—';
    if (showDocumentNumber) return doc;
    if (doc.length <= 5) return '*****';
    return `${doc.slice(0, 5)}******`;
  };

  // Table Columns Definition
  const columns: ColumnsType<GuestSummary> = [
    {
      title: 'Mã khách',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (id: string) => (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            color: '#1b4d3e',
            backgroundColor: '#ecfdf5',
            padding: '2px 8px',
            borderRadius: 6,
            border: '1px solid #a7f3d0',
          }}
        >
          #{id}
        </span>
      ),
    },
    {
      title: 'Họ và tên khách hàng',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (fullName: string) => (
        <Space orientation="horizontal" align="center">
          <Avatar
            style={{
              backgroundColor: '#1b4d3e',
              color: '#ffffff',
              fontWeight: 600,
            }}
          >
            {fullName.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
              {fullName}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone?: string | null) =>
        isAccountant ? (
          <Text type="secondary" italic style={{ fontSize: 12 }}>
            🔒 Đã mã hóa
          </Text>
        ) : phone ? (
          <Space size={4}>
            <PhoneOutlined style={{ color: '#0284c7', fontSize: 12 }} />
            <span style={{ color: '#334155', fontWeight: 500 }}>{phone}</span>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email?: string | null) =>
        isAccountant ? (
          <Text type="secondary" italic style={{ fontSize: 12 }}>
            🔒 Đã mã hóa
          </Text>
        ) : email ? (
          <Space size={4}>
            <MailOutlined style={{ color: '#64748b', fontSize: 12 }} />
            <a href={`mailto:${email}`} style={{ color: '#0369a1', fontSize: 12 }}>
              {email}
            </a>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        ),
    },
    {
      title: 'Quốc tịch',
      dataIndex: 'nationality',
      key: 'nationality',
      width: 140,
      render: (nationality?: string | null) => {
        const isVN = !nationality || nationality === 'Việt Nam' || nationality === 'Vietnam';
        return (
          <Tag color={isVN ? 'green' : 'blue'} icon={<GlobalOutlined />}>
            {nationality || 'Việt Nam'}
          </Tag>
        );
      },
    },
    {
      title: 'Ngày tạo hồ sơ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date?: string) =>
        date ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(date).format('DD/MM/YYYY HH:mm')}
          </Text>
        ) : (
          '—'
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      align: 'center',
      render: (_: unknown, record: GuestSummary) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết hồ sơ định danh">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: '#0369a1' }} />}
              onClick={() => handleOpenDetail(record)}
            />
          </Tooltip>

          {canWrite && (
            <Tooltip title="Chỉnh sửa thông tin">
              <Button
                type="text"
                icon={<EditOutlined style={{ color: '#1b4d3e' }} />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
          )}

          {canDelete && (
            <Popconfirm
              title="Lưu trữ / Xóa hồ sơ này?"
              description="Hồ sơ sẽ được đánh dấu xóa mềm và lưu lại lịch sử kiểm toán (Audit Log)."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Đồng ý xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Xóa hồ sơ">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Quick stats calculation
  const totalGuests = guests.length;
  const domesticCount = guests.filter(
    (g) => !g.nationality || g.nationality === 'Việt Nam' || g.nationality === 'Vietnam'
  ).length;
  const internationalCount = totalGuests - domesticCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Space align="center" size="middle">
            <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>
              Hồ sơ Khách hàng & Định danh
            </Title>
            <Tag color="cyan">{totalGuests} hồ sơ</Tag>
          </Space>
          <Paragraph style={{ marginTop: 4, marginBottom: 0, color: '#475569', fontSize: 13 }}>
            Quản lý thông tin định danh lưu trú, số CCCD/Passport mã hóa an toàn chuẩn AES-GCM và liên lạc khách sạn.
          </Paragraph>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
            Làm mới
          </Button>

          {canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Thêm khách hàng mới
            </Button>
          )}
        </Space>
      </div>

      {/* Accountant Security Banner Notice */}
      {isAccountant && (
        <Alert
          message="Chính sách Bảo vệ Dữ liệu Định danh Khách hàng (PII Protection)"
          description="Bạn đang truy cập hệ thống với vai trò Kế toán. Theo chính sách bảo mật khách sạn, các thông tin định danh cá nhân nhạy cảm (Số điện thoại, Email, Số CCCD/Passport) được mã hóa bảo vệ; bạn chỉ có quyền tra cứu Mã và Họ tên khách hàng để phục vụ đối soát hóa đơn / Folio."
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined style={{ color: '#0284c7' }} />}
          style={{
            borderRadius: 8,
            backgroundColor: '#f0f9ff',
            borderColor: '#bae6fd',
          }}
        />
      )}

      {/* 3 Metrics Overview Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            }}
          >
            <Space align="center">
              <Avatar
                size={44}
                style={{ backgroundColor: '#ecfdf5', color: '#1b4d3e' }}
                icon={<UserOutlined style={{ fontSize: 22 }} />}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tổng hồ sơ khách
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                  {totalGuests}
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={12} sm={8}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            }}
          >
            <Space align="center">
              <Avatar
                size={44}
                style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}
                icon={<GlobalOutlined style={{ fontSize: 22 }} />}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Khách nội địa (Việt Nam)
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                  {domesticCount}
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={12} sm={8}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            }}
          >
            <Space align="center">
              <Avatar
                size={44}
                style={{ backgroundColor: '#fef3c7', color: '#d97706' }}
                icon={<SafetyCertificateOutlined style={{ fontSize: 22 }} />}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Khách quốc tế
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
                  {internationalCount}
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Filter & Search Toolbar */}
      <Card
        bordered
        style={{
          borderRadius: 12,
          borderColor: '#cbd5e1',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="Tìm theo Tên khách hàng, SĐT, Email..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>

          <Col xs={12} md={7}>
            <Select
              placeholder="Quốc tịch"
              allowClear
              style={{ width: '100%' }}
              value={selectedNationality}
              onChange={setSelectedNationality}
              options={[
                { label: 'Việt Nam', value: 'Việt Nam' },
                { label: 'Hoa Kỳ (USA)', value: 'United States' },
                { label: 'Hàn Quốc (Korea)', value: 'South Korea' },
                { label: 'Nhật Bản (Japan)', value: 'Japan' },
                { label: 'Pháp (France)', value: 'France' },
                { label: 'Anh (United Kingdom)', value: 'United Kingdom' },
              ]}
            />
          </Col>

          <Col xs={12} md={7}>
            <Select
              placeholder="Sắp xếp danh sách"
              style={{ width: '100%' }}
              value={sortBy}
              onChange={setSortBy}
              options={[
                { label: 'Tên khách hàng (A - Z)', value: 'fullName' },
                { label: 'Ngày tạo mới nhất', value: 'createdAt' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Guests Main Table */}
      <Card
        bordered
        style={{
          borderRadius: 12,
          borderColor: '#cbd5e1',
          boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
        }}
      >
        <Table
          dataSource={guests}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          size="middle"
        />
      </Card>

      {/* Drawer: Detailed Guest Identity Profile */}
      <Drawer
        title={
          <Space>
            <IdcardOutlined style={{ color: '#1b4d3e', fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>
              Hồ sơ định danh khách hàng #{guestDetail?.id}
            </Text>
          </Space>
        }
        placement="right"
        width={560}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedGuestId(null);
        }}
        extra={
          canWrite &&
          guestDetail && (
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setIsDrawerOpen(false);
                handleOpenEdit(guestDetail);
              }}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              Sửa hồ sơ
            </Button>
          )
        }
      >
        {isDetailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">Đang tải hồ sơ bảo mật...</Text>
          </div>
        ) : guestDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header Profile Identity */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
              }}
            >
              <Avatar
                size={58}
                style={{ backgroundColor: '#1b4d3e', fontSize: 24, fontWeight: 700 }}
              >
                {guestDetail.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                  {guestDetail.fullName}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Tag color="cyan">Mã khách: #{guestDetail.id}</Tag>
                  <Tag color="green">{guestDetail.nationality || 'Việt Nam'}</Tag>
                  <Tag>{getGenderLabel(guestDetail.gender)}</Tag>
                </div>
              </div>
            </div>

            {/* Document & Security Card */}
            <Card
              size="small"
              title={
                <Space>
                  <SafetyCertificateOutlined style={{ color: '#15803d' }} />
                  <Text strong>Giấy tờ tùy thân (Mã hóa an toàn AES-GCM)</Text>
                </Space>
              }
              style={{ borderRadius: 8, borderColor: '#cbd5e1' }}
            >
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Loại giấy tờ">
                  <Tag color="purple">{getDocTypeLabel(guestDetail.documentType)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Số định danh">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: 14,
                        color: '#0f172a',
                        backgroundColor: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {maskDocument(guestDetail.documentNumber)}
                    </span>
                    {guestDetail.documentNumber && !isAccountant && (
                      <Button
                        type="text"
                        size="small"
                        icon={
                          showDocumentNumber ? (
                            <EyeInvisibleOutlined style={{ color: '#64748b' }} />
                          ) : (
                            <EyeOutlined style={{ color: '#0284c7' }} />
                          )
                        }
                        onClick={() => setShowDocumentNumber(!showDocumentNumber)}
                      >
                        {showDocumentNumber ? 'Ẩn số' : 'Hiện số'}
                      </Button>
                    )}
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">
                  {guestDetail.dateOfBirth
                    ? dayjs(guestDetail.dateOfBirth).format('DD/MM/YYYY')
                    : 'Chưa cập nhật'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Contact Details Card */}
            <Card
              size="small"
              title={
                <Space>
                  <PhoneOutlined style={{ color: '#0284c7' }} />
                  <Text strong>Thông tin liên lạc & Cư trú</Text>
                </Space>
              }
              style={{ borderRadius: 8, borderColor: '#cbd5e1' }}
            >
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Số điện thoại">
                  {isAccountant ? (
                    <Text type="secondary" italic>
                      🔒 Ẩn theo quyền kế toán
                    </Text>
                  ) : (
                    guestDetail.phone || 'Chưa cung cấp'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {isAccountant ? (
                    <Text type="secondary" italic>
                      🔒 Ẩn theo quyền kế toán
                    </Text>
                  ) : (
                    guestDetail.email || 'Chưa cung cấp'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                  {isAccountant ? (
                    <Text type="secondary" italic>
                      🔒 Ẩn theo quyền kế toán
                    </Text>
                  ) : (
                    guestDetail.address || 'Chưa cung cấp'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Special Notes Card */}
            {guestDetail.notes && !isAccountant && (
              <Card
                size="small"
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: '#d97706' }} />
                    <Text strong>Ghi chú phục vụ & Đặc quyền</Text>
                  </Space>
                }
                style={{ borderRadius: 8, borderColor: '#cbd5e1' }}
              >
                <Paragraph style={{ margin: 0, color: '#334155', fontSize: 13 }}>
                  {guestDetail.notes}
                </Paragraph>
              </Card>
            )}

            <Divider style={{ margin: '8px 0' }} />

            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              <div>Ngày khởi tạo hồ sơ: {dayjs(guestDetail.createdAt).format('DD/MM/YYYY HH:mm:ss')}</div>
              {guestDetail.updatedAt && (
                <div>Lần sửa đổi gần nhất: {dayjs(guestDetail.updatedAt).format('DD/MM/YYYY HH:mm:ss')}</div>
              )}
            </div>
          </div>
        ) : (
          <Alert message="Không tìm thấy hồ sơ khách hàng." type="error" />
        )}
      </Drawer>

      {/* Modal: Create or Edit Guest Form */}
      <Modal
        title={
          <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
            {editingGuest ? `Chỉnh sửa hồ sơ: ${editingGuest.fullName}` : 'Thêm hồ sơ khách hàng mới'}
          </Text>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingGuest(null);
        }}
        footer={null}
        destroyOnClose
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 16 }}
        >
          {/* Row 1: Full name & Gender */}
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item
                name="fullName"
                label={<Text strong>Họ và tên khách hàng</Text>}
                rules={[
                  { required: true, message: 'Vui lòng nhập họ và tên khách hàng!' },
                  { min: 1, max: 150, message: 'Độ dài họ tên từ 1 đến 150 ký tự' },
                ]}
              >
                <Input placeholder="VD: Nguyễn Văn Anh, John Smith" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={8}>
              <Form.Item name="gender" label={<Text strong>Giới tính</Text>}>
                <Select
                  placeholder="Chọn giới tính"
                  options={[
                    { label: 'Nam (Male)', value: 'MALE' },
                    { label: 'Nữ (Female)', value: 'FEMALE' },
                    { label: 'Khác (Other)', value: 'OTHER' },
                    { label: 'Chưa xác định', value: 'UNSPECIFIED' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 2: Phone & Email */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="phone"
                label={<Text strong>Số điện thoại liên lạc</Text>}
                rules={[
                  {
                    pattern: /^\+?[0-9() .-]+$/,
                    message: 'Số điện thoại chỉ gồm chữ số (VD: 0912345678 hoặc +84912345678)',
                  },
                ]}
              >
                <Input placeholder="VD: 0912 345 678" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="email"
                label={<Text strong>Địa chỉ Email</Text>}
                rules={[{ type: 'email', message: 'Địa chỉ email không hợp lệ!' }]}
              >
                <Input placeholder="VD: khachhang@example.com" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 3: Date of Birth & Nationality */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="dateOfBirth" label={<Text strong>Ngày tháng năm sinh</Text>}>
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  placeholder="Chọn ngày sinh"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name="nationality" label={<Text strong>Quốc tịch</Text>}>
                <Input placeholder="VD: Việt Nam, United States..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0 16px 0' }}>Giấy tờ định danh lưu trú</Divider>

          {/* Row 4: Document Type & Document Number */}
          <Row gutter={16}>
            <Col xs={24} sm={10}>
              <Form.Item name="documentType" label={<Text strong>Loại giấy tờ</Text>}>
                <Select
                  placeholder="Chọn loại giấy tờ"
                  allowClear
                  options={[
                    { label: 'CCCD / CMND', value: 'NATIONAL_ID' },
                    { label: 'Hộ chiếu (Passport)', value: 'PASSPORT' },
                    { label: 'Bằng lái xe', value: 'DRIVER_LICENSE' },
                    { label: 'Giấy tờ khác', value: 'OTHER' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={14}>
              <Form.Item
                name="documentNumber"
                label={<Text strong>Số CCCD / Hộ chiếu</Text>}
                dependencies={['documentType']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value && !getFieldValue('documentType')) {
                        return Promise.reject(
                          new Error('Vui lòng chọn loại giấy tờ khi nhập số!')
                        );
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Input
                  placeholder="VD: 079201006200 hoặc C1234567"
                  style={{ textTransform: 'uppercase' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Address & Notes */}
          <Form.Item name="address" label={<Text strong>Địa chỉ cư trú / Quê quán</Text>}>
            <Input placeholder="VD: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh" />
          </Form.Item>

          <Form.Item name="notes" label={<Text strong>Ghi chú đặc biệt / Sở thích</Text>}>
            <Input.TextArea
              rows={2}
              placeholder="VD: Khách thân thiết VIP, thường xuyên đi công tác, thích phòng yên tĩnh..."
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button
              onClick={() => {
                setIsModalOpen(false);
                setEditingGuest(null);
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createMutation.isPending || updateMutation.isPending}
              style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            >
              {editingGuest ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
