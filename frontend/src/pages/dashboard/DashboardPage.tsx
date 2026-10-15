import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space, List, Tag } from 'antd';
import {
  HomeOutlined,
  LoginOutlined,
  LogoutOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore.ts';
import { RoleBadge } from '../../components/RoleBadge.tsx';

const { Title, Text, Paragraph } = Typography;

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const operationalTasks = [
    { text: '08 khách dự kiến đến hôm nay', status: 'warning' },
    { text: '04 phòng chờ kiểm tra vệ sinh (INSPECTION)', status: 'processing' },
    { text: '02 phòng đang khóa bảo trì (MAINTENANCE)', status: 'error' },
    { text: 'Hệ thống kết nối trực tiếp cơ sở dữ liệu MySQL ổn định', status: 'success' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Space direction="horizontal" align="center" size="middle">
          <Title level={2} style={{ margin: 0, color: '#0b2545' }}>
            Tổng quan vận hành
          </Title>
          <RoleBadge role={user?.role} />
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
          Xin chào, <Text strong>{user?.fullName}</Text> (@{user?.username}). Chúc bạn một ngày làm
          việc hiệu quả!
        </Paragraph>
      </div>

      {/* Operational Metric Cards from Wireframe #2 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', borderRadius: 12 }}>
            <Statistic
              title={<Text style={{ color: '#1d39c4', fontWeight: 500 }}>Phòng đang có khách</Text>}
              value="32 / 50"
              prefix={<HomeOutlined style={{ color: '#2f54eb', marginRight: 8 }} />}
              valueStyle={{ color: '#1d39c4', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Công suất phòng: 64%
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#e6f7ff', borderRadius: 12 }}>
            <Statistic
              title={<Text style={{ color: '#0050b3', fontWeight: 500 }}>Dự kiến nhận phòng</Text>}
              value={8}
              prefix={<LoginOutlined style={{ color: '#1890ff', marginRight: 8 }} />}
              valueStyle={{ color: '#0050b3', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              05 đơn đã xác nhận
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#f6ffed', borderRadius: 12 }}>
            <Statistic
              title={<Text style={{ color: '#237804', fontWeight: 500 }}>Dự kiến trả phòng</Text>}
              value={6}
              prefix={<LogoutOutlined style={{ color: '#52c41a', marginRight: 8 }} />}
              valueStyle={{ color: '#237804', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              03 phòng trước 12:00
            </Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ background: '#fff7e6', borderRadius: 12 }}>
            <Statistic
              title={<Text style={{ color: '#ad4e00', fontWeight: 500 }}>Cần dọn phòng</Text>}
              value={4}
              prefix={<ClearOutlined style={{ color: '#fa8c16', marginRight: 8 }} />}
              valueStyle={{ color: '#ad4e00', fontWeight: 700 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              02 phòng dọn trả phòng
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Task & Highlights */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>Danh sách công việc cần xử lý hôm nay</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <List
              dataSource={operationalTasks}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Tag
                      color={
                        item.status === 'warning'
                          ? 'gold'
                          : item.status === 'processing'
                          ? 'blue'
                          : item.status === 'error'
                          ? 'red'
                          : 'green'
                      }
                    >
                      {item.status.toUpperCase()}
                    </Tag>
                    <Text>{item.text}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>Trạng thái kết nối Hệ thống</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <Paragraph>
              <Text strong>Khách sạn:</Text> Innvyra Hotel
            </Paragraph>
            <Paragraph>
              <Text strong>API Backend:</Text> <Tag color="green">v1 (Online)</Tag>
            </Paragraph>
            <Paragraph>
              <Text strong>Bảo mật:</Text> JWT Access Token (15m) + HttpOnly Cookie Refresh + CSRF Guard
            </Paragraph>
            <Paragraph>
              <Text strong>Module sẵn sàng:</Text> Auth, Room Types, Rooms, Guests, Reservations, Stays
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
