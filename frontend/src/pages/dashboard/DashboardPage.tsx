import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Tabs,
  Table,
  Button,
  Progress,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.ts';
import { RoleBadge } from '../../components/RoleBadge.tsx';

const { Title, Text, Paragraph } = Typography;

interface BookingSample {
  id: string;
  guestName: string;
  phone: string;
  room: string;
  type: string;
  checkIn: string;
  checkOut: string;
  status: 'CONFIRMED' | 'IN_HOUSE' | 'COMPLETED';
  balance: number;
  vip?: boolean;
}

const sampleArrivals: BookingSample[] = [
  {
    id: 'INV-1056',
    guestName: 'Nguyễn Văn A',
    phone: '0912 345 678',
    room: '301',
    type: 'Deluxe',
    checkIn: '20/10/2026',
    checkOut: '22/10/2026',
    status: 'CONFIRMED',
    balance: 1100000,
    vip: true,
  },
  {
    id: 'INV-1057',
    guestName: 'Trần Thị B',
    phone: '0987 654 321',
    room: '302',
    type: 'Deluxe',
    checkIn: '20/10/2026',
    checkOut: '23/10/2026',
    status: 'CONFIRMED',
    balance: 1900000,
  },
  {
    id: 'INV-1058',
    guestName: 'Phạm Minh Đức',
    phone: '0903 112 233',
    room: '201',
    type: 'Superior',
    checkIn: '20/10/2026',
    checkOut: '21/10/2026',
    status: 'CONFIRMED',
    balance: 850000,
  },
];

const sampleDepartures: BookingSample[] = [
  {
    id: 'INV-1024',
    guestName: 'Lê Hoàng Nam',
    phone: '0901 223 344',
    room: '101',
    type: 'Standard',
    checkIn: '18/10/2026',
    checkOut: '20/10/2026',
    status: 'IN_HOUSE',
    balance: 0,
  },
  {
    id: 'INV-1025',
    guestName: 'David Wilson',
    phone: '0908 998 877',
    room: '401',
    type: 'Deluxe',
    checkIn: '17/10/2026',
    checkOut: '20/10/2026',
    status: 'IN_HOUSE',
    balance: 650000,
    vip: true,
  },
];

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('arrivals');

  const columns: ColumnsType<BookingSample> = [
    {
      title: 'Khách hàng',
      dataIndex: 'guestName',
      key: 'guestName',
      render: (text, record) => (
        <div>
          <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
            {text}
          </Text>
          {record.vip && (
            <Tag color="gold" style={{ marginLeft: 6, fontSize: 10, fontWeight: 700 }}>
              ★ VIP
            </Tag>
          )}
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {record.id} • {record.phone}
          </div>
        </div>
      ),
    },
    {
      title: 'Phòng',
      dataIndex: 'room',
      key: 'room',
      render: (room, record) => (
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
            P.{room}
          </span>
          <div style={{ fontSize: 11, color: '#64748b' }}>{record.type}</div>
        </div>
      ),
    },
    {
      title: 'Lưu trú',
      key: 'dates',
      render: (_, record) => (
        <div style={{ fontSize: 12, color: '#334155' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Đến:</Text> {record.checkIn}
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>Đi:</Text> {record.checkOut}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) =>
        status === 'CONFIRMED' ? (
          <Tag color="cyan" style={{ fontWeight: 600 }}>
            Đã xác nhận
          </Tag>
        ) : (
          <Tag color="blue" style={{ fontWeight: 600 }}>
            Đang lưu trú
          </Tag>
        ),
    },
    {
      title: 'Số dư cần thu',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (val) => (
        <span
          style={{
            fontWeight: 700,
            color: val > 0 ? '#b91c1c' : '#15803d',
            fontSize: 13,
          }}
        >
          {val.toLocaleString('vi-VN')} ₫
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      align: 'center',
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          style={{ color: '#1b4d3e', fontWeight: 600 }}
          onClick={() => navigate('/stays')}
        >
          {record.status === 'CONFIRMED' ? 'Check-in' : 'Chi tiết'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Title & User Greeting */}
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
              Tổng quan vận hành
            </Title>
            <RoleBadge role={user?.role} />
          </Space>
          <Paragraph style={{ marginTop: 4, marginBottom: 0, color: '#475569', fontSize: 13 }}>
            Khách sạn <Text strong style={{ color: '#0f172a' }}>Innvyra Hotel</Text> • 
            Chào <Text strong style={{ color: '#0f172a' }}>{user?.fullName}</Text> (@{user?.username}).
          </Paragraph>
        </div>

        <Space>
          <Button
            icon={<CalendarOutlined />}
            onClick={() => navigate('/calendar')}
            style={{ fontWeight: 500 }}
          >
            Mở lịch phòng
          </Button>
          <Button
            type="primary"
            style={{ backgroundColor: '#1b4d3e', borderColor: '#1b4d3e' }}
            onClick={() => navigate('/reservations')}
          >
            + Đặt phòng mới
          </Button>
        </Space>
      </div>

      {/* 4 Crisp Operational KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                Phòng đang có khách
              </Text>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HomeOutlined />
              </div>
            </div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                32 / 50
              </span>
              <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>
                (64% công suất)
              </span>
            </div>
            <Progress percent={64} showInfo={false} strokeColor="#1b4d3e" size="small" />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                Khách đến chờ nhận
              </Text>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#f0fdf4',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LoginOutlined />
              </div>
            </div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                08
              </span>
              <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>
                đơn hôm nay
              </span>
            </div>
            <Text style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>
              ● 05 đơn đã cọc tiền đầy đủ
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                Khách đi chờ trả
              </Text>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#fffbeb',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LogoutOutlined />
              </div>
            </div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                06
              </span>
              <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>
                phòng cần trả
              </span>
            </div>
            <Text style={{ fontSize: 12, color: '#d97706', fontWeight: 500 }}>
              ● Hạn chót checkout: 12:00
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ color: '#0f172a', fontSize: 13 }}>
                Cần dọn phòng
              </Text>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: '#fef2f2',
                  color: '#b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ClearOutlined />
              </div>
            </div>
            <div style={{ marginTop: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>
                04
              </span>
              <span style={{ fontSize: 12, color: '#475569', marginLeft: 8 }}>
                phòng DIRTY
              </span>
            </div>
            <Text style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
              ● Cần hoàn tất trước 14:00 đón khách
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Main Operational Tables & Activity Column */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            bordered
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
            title={
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                style={{ marginBottom: -16 }}
                items={[
                  {
                    key: 'arrivals',
                    label: (
                      <span>
                        Khách đến hôm nay{' '}
                        <Tag color="cyan" style={{ marginLeft: 4 }}>
                          8
                        </Tag>
                      </span>
                    ),
                  },
                  {
                    key: 'departures',
                    label: (
                      <span>
                        Khách đi hôm nay{' '}
                        <Tag color="orange" style={{ marginLeft: 4 }}>
                          6
                        </Tag>
                      </span>
                    ),
                  },
                ]}
              />
            }
          >
            <Table
              dataSource={activeTab === 'arrivals' ? sampleArrivals : sampleDepartures}
              columns={columns}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            bordered
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1b4d3e' }} />
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  Ghi chú ca trực hôm nay
                </span>
              </Space>
            }
            style={{
              borderRadius: 12,
              borderColor: '#cbd5e1',
              boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
            }}
          >
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16,
              }}
            >
              <Text strong style={{ color: '#0f172a', display: 'block' }}>
                📌 Thông điệp giao ban:
              </Text>
              <Text style={{ fontSize: 13, color: '#334155', display: 'block', marginTop: 4 }}>
                Phòng 201 đang khóa bảo trì máy lạnh dự kiến hoàn tất lúc 15:00. Khách VIP David Wilson
                (P.401) có yêu cầu xe tiễn sân bay lúc 11:30.
              </Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#475569' }}>Cơ sở dữ liệu:</span>
                <span style={{ fontWeight: 600, color: '#15803d' }}>
                  <CheckCircleOutlined /> MySQL Đã đồng bộ
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#475569' }}>Doanh thu dự kiến:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  48.500.000 ₫
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#475569' }}>Phòng bảo trì:</span>
                <span style={{ fontWeight: 600, color: '#b91c1c' }}>
                  02 phòng (P.201, P.310)
                </span>
              </div>
            </div>

            <Button
              block
              style={{ marginTop: 20, color: '#1b4d3e', borderColor: '#1b4d3e', fontWeight: 600 }}
              onClick={() => navigate('/calendar')}
            >
              Xem toàn bộ Lịch phòng <ArrowRightOutlined />
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
