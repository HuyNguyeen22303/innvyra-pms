import React from 'react';
import { Typography, Space, Card, Result, Tag, Row, Col, Alert } from 'antd';
import {
  InboxOutlined,
  ToolOutlined,
  SyncOutlined,
  ShopOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export const InventoryPage: React.FC = () => {
  return (
    <div style={{ padding: '0 0 24px 0' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" size={12}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#e6f4ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <InboxOutlined style={{ fontSize: 26, color: '#1b4d3e' }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
              Quản lý Vật tư & Kho (Supplies & Warehouse)
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Kiểm soát nhập - xuất - tồn vật tư tiêu hao, đồ vải buồng phòng (Linen), công cụ dụng cụ và linh kiện bảo trì kỹ thuật.
            </Text>
          </div>
        </Space>
      </div>

      {/* Development Status Banner */}
      <Alert
        message="Module đang trong quá trình phát triển (Backend Integration Pending)"
        description="Giao diện và nghiệp vụ kho đang chờ kết nối các API từ backend. Dưới đây là khung kiến trúc tính năng dự kiến sẽ triển khai."
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 8 }}
      />

      {/* Feature Blueprint Preview Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}
          >
            <Space orientation="vertical" size={8}>
              <SyncOutlined style={{ fontSize: 28, color: '#0284c7' }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Đồ vải & Buồng phòng
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
                Quản lý số lượng drap giường, khăn tắm, áo choàng, hóa chất giặt là và định mức tồn phòng sạch.
              </Paragraph>
              <Tag color="cyan">Linen & Laundry</Tag>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}
          >
            <Space orientation="vertical" size={8}>
              <ShopOutlined style={{ fontSize: 28, color: '#16a34a' }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Đồ tiêu hao (Amenities)
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
                Bàn chải, dầu gội, trà, café, nước suối minibar. Cảnh báo khi mức tồn kho chạm ngưỡng tối thiểu.
              </Paragraph>
              <Tag color="green">Consumables</Tag>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}
          >
            <Space orientation="vertical" size={8}>
              <ToolOutlined style={{ fontSize: 28, color: '#d97706' }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Vật tư & Linh kiện kỹ thuật
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
                Bóng đèn, khóa thẻ từ, phụ kiện điện nước phục vụ cho các phiếu bảo trì và sửa chữa phòng.
              </Paragraph>
              <Tag color="orange">Maintenance Spare Parts</Tag>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 8, height: '100%', border: '1px solid #e2e8f0' }}
          >
            <Space orientation="vertical" size={8}>
              <FileDoneOutlined style={{ fontSize: 28, color: '#7c3aed' }} />
              <Text strong style={{ fontSize: 15, color: '#0f172a' }}>
                Phiếu Nhập - Xuất & Kiểm kê
              </Text>
              <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
                Lập phiếu nhập kho từ nhà cung cấp, xuất kho nội bộ theo bộ phận và đối soát biên bản kiểm kê định kỳ.
              </Paragraph>
              <Tag color="purple">Inventory Audits</Tag>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Main Empty State Placeholder */}
      <Card style={{ marginTop: 24, borderRadius: 12, textAlign: 'center', padding: '24px 0' }}>
        <Result
          icon={<InboxOutlined style={{ fontSize: 56, color: '#1b4d3e' }} />}
          title="Phân hệ Quản lý Vật tư & Kho đang được chuẩn bị"
          subTitle="Khi Backend API hoàn tất, các bảng dữ liệu quản lý danh mục vật tư, phiếu nhập xuất kho và báo cáo tồn kho sẽ tự động kích hoạt tại đây."
          extra={
            <Space>
              <Tag icon={<SafetyCertificateOutlined />} color="default">
                Sẵn sàng cấu trúc Frontend Router
              </Tag>
            </Space>
          }
        />
      </Card>
    </div>
  );
};
