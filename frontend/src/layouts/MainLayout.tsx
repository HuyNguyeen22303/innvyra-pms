import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  BookOutlined,
  UsergroupAddOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  DollarOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.ts';
import { RoleBadge } from '../components/RoleBadge.tsx';
import type { Role } from '../types/auth.types.ts';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MenuItemDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  roles?: Role[];
  badge?: string;
}

const menuDefinitions: MenuItemDef[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Tổng quan',
  },
  {
    key: '/calendar',
    icon: <CalendarOutlined />,
    label: 'Lịch phòng',
  },
  {
    key: '/reservations',
    icon: <BookOutlined />,
    label: 'Đặt phòng',
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    key: '/stays',
    icon: <CheckCircleOutlined />,
    label: 'Lưu trú / Check-in',
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  },
  {
    key: '/guests',
    icon: <UsergroupAddOutlined />,
    label: 'Khách hàng',
    roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  },
  {
    key: '/rooms',
    icon: <ApartmentOutlined />,
    label: 'Phòng',
  },
  {
    key: '/room-types',
    icon: <AppstoreOutlined />,
    label: 'Loại phòng',
  },
  {
    key: '/housekeeping',
    icon: <CheckCircleOutlined />,
    label: 'Buồng phòng',
    roles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING'],
  },
  {
    key: '/maintenance',
    icon: <ToolOutlined />,
    label: 'Bảo trì',
    roles: ['ADMIN', 'MANAGER', 'TECHNICIAN'],
  },
  {
    key: '/folios',
    icon: <DollarOutlined />,
    label: 'Thu ngân / Folio',
    roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
  {
    key: '/reports',
    icon: <BarChartOutlined />,
    label: 'Báo cáo',
    roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
  },
];

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0' }}>
          <Text strong>{user?.fullName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            @{user?.username}
          </Text>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Filter menu items by user role
  const filteredMenuItems: MenuProps['items'] = menuDefinitions
    .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
    .map((item) => ({
      key: item.key,
      icon: item.icon,
      label: item.label,
    }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#071d36',
            color: '#fff',
            fontWeight: 700,
            fontSize: collapsed ? 14 : 18,
            letterSpacing: 1,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            transition: 'all 0.2s',
          }}
        >
          {collapsed ? 'PMS' : '🏨 INNVYRA PMS'}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, width: 48, height: 48 }}
          />

          <Space size="middle" align="center">
            {user && <RoleBadge role={user.role} />}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#0f4c81' }} icon={<UserOutlined />} />
                <span style={{ fontWeight: 500, color: '#333' }}>{user?.fullName}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: 10,
            minHeight: 280,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
