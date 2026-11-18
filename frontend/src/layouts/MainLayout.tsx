import { SubscriptionNotice } from '../components/SubscriptionNotice.tsx';
import React, { Suspense, useState } from "react";
import axios from 'axios';
import {
  Layout,
  App as AntdApp,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
  Tag,
  Drawer,
} from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  CalendarOutlined,
  BookOutlined,
  UsergroupAddOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ToolOutlined,
  DollarOutlined,
  TeamOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  InboxOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { useHotelClock } from "../hooks/useHotelClock.ts";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.ts";
import { RoleBadge } from "../components/RoleBadge.tsx";
import { BrandLogo } from "../components/BrandLogo.tsx";
import "./MainLayout.css";
import { roomsApi } from "../api/rooms.api.ts";
import { useResponsiveLayout } from '../components/responsive/useResponsiveLayout.ts';
import { useStaffDirectory } from "../utils/staffDirectory.ts";
import type { Role } from "../types/auth.types.ts";
import {
  canLoadHotelOperations,
  isHotelWorkspaceRestricted,
  isSubscriptionPath,
} from "../auth/hotelWorkspaceAccess.ts";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface MenuItemDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  roles?: Role[];
}

interface MenuGroupDef {
  key: string;
  title: string;
  items: MenuItemDef[];
}

const menuGroups: MenuGroupDef[] = [
  {
    key: "group-overview",
    title: "TỔNG QUAN",
    items: [
      {
        key: "/dashboard",
        icon: <DashboardOutlined />,
        label: "Tổng quan vận hành",
      },
    ],
  },
  {
    key: "group-frontdesk",
    title: "LỄ TÂN & ĐẶT PHÒNG",
    items: [
      {
        key: "/calendar",
        icon: <CalendarOutlined />,
        label: "Sơ đồ phòng",
      },
      {
        key: "/reservations",
        icon: <BookOutlined />,
        label: "Đặt phòng",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "ACCOUNTANT"],
      },
      {
        key: "/stays",
        icon: <CheckCircleOutlined />,
        label: "Lưu trú / Check-in",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "ACCOUNTANT"],
      },
      {
        key: "/guests",
        icon: <UsergroupAddOutlined />,
        label: "Hồ sơ khách hàng",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "ACCOUNTANT"],
      },
      {
        key: "/rooms",
        icon: <ApartmentOutlined />,
        label: "Phòng vật lý",
      },
    ],
  },
  {
    key: "group-operations",
    title: "VẬN HÀNH & CƠ SỞ",
    items: [
      {
        key: "/services",
        icon: <CustomerServiceOutlined />,
        label: "Dịch vụ khách sạn",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "ACCOUNTANT"],
      },
      {
        key: "/housekeeping",
        icon: <SyncOutlined />,
        label: "Buồng phòng ",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING"],
      },
      {
        key: "/maintenance",
        icon: <ToolOutlined />,
        label: "Bảo trì kỹ thuật",
        roles: [
          "ADMIN",
          "MANAGER",
          "RECEPTIONIST",
          "HOUSEKEEPING",
          "TECHNICIAN",
        ],
      },
      {
        key: "/inventory",
        icon: <InboxOutlined />,
        label: "Quản lý vật tư & Kho",
        roles: [
          "ADMIN",
          "MANAGER",
          "ACCOUNTANT",
          "HOUSEKEEPING",
          "TECHNICIAN",
        ],
      },
    ],
  },
  {
    key: "group-finance",
    title: "TÀI CHÍNH & BÁO CÁO",
    items: [
      {
        key: "/folios",
        icon: <DollarOutlined />,
        label: "Thu ngân / Folio",
        roles: ["ADMIN", "MANAGER", "RECEPTIONIST", "ACCOUNTANT"],
      },
      {
        key: "/reports",
        icon: <BarChartOutlined />,
        label: "Báo cáo điều hành",
      },
    ],
  },
  {
    key: "group-system",
    title: "HỆ THỐNG & CÀI ĐẶT",
    items: [
      { key: '/subscription', icon: <ApartmentOutlined />, label: 'Gói dịch vụ', roles: ['ADMIN', 'MANAGER'] },
      { key: '/hotel', icon: <ApartmentOutlined />, label: 'Thông tin khách sạn', roles: ['ADMIN'] },
      {
        key: "/room-types",
        icon: <AppstoreOutlined />,
        label: "Cấu hình hạng phòng",
      },
      {
        key: "/employees",
        icon: <TeamOutlined />,
        label: "Quản lý nhân sự",
        roles: ["ADMIN", "MANAGER"],
      },
    ],
  },
];

export const MainLayout: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { screens, isMobile, isCompact } = useResponsiveLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const subscriptionOnly = isHotelWorkspaceRestricted(user);

  // Keep the full workspace available on tablets and smaller laptops. The
  // persistent sidebar returns once there is room for both navigation and content.
  const useDrawerNavigation = isCompact;
  const isTablet = screens.md && !screens.lg;

  // Automatically close mobile drawer whenever route changes without cascading render effect
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileDrawerOpen(false);
  }

  // Globally preload and subscribe to hotel staff directory for all pages
  useStaffDirectory();

  // Dynamic room count from backend API
  const { data: roomsRes, isError: roomCountError } = useQuery({
    queryKey: ["rooms", "count"],
    enabled: canLoadHotelOperations(user),
    queryFn: ({ signal }) => roomsApi.getAll({ limit: 1 }, signal),
    staleTime: 30000,
  });
  const roomCount = roomsRes?.data.pagination.total;

  // Dynamic real-time operational date & shift
  const clock = useHotelClock();
  const currentDate = clock ? dayjs(clock.date).format("DD/MM/YYYY") : "Chưa có ngày vận hành";
  const currentShortDate = clock ? dayjs(clock.date).format("DD/MM") : "—";
  const currentHour = clock?.hour ?? -1;
  const currentShift =
    currentHour < 0
      ? "Chưa có múi giờ khách sạn"
      : currentHour >= 6 && currentHour < 14
      ? "Ca sáng: 06:00 – 14:00"
      : currentHour >= 14 && currentHour < 22
        ? "Ca chiều: 14:00 – 22:00"
        : "Ca đêm: 22:00 – 06:00";

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); }
    catch (error) { if (!axios.isCancel(error)) void message.error('Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.'); }
  };

  const userMenuItems: MenuProps["items"] = [
    {
      key: "user-info",
      disabled: true,
      label: (
        <div style={{ padding: "6px 2px" }}>
          <Text strong style={{ color: "#0f172a", fontSize: 13 }}>
            {user?.fullName}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12, color: "#64748b" }}>
            @{user?.username}
          </Text>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất tài khoản",
      danger: true,
      onClick: handleLogout,
    },
  ];

  const visibleMenuGroups: MenuGroupDef[] = subscriptionOnly
    ? [{
        key: "group-account",
        title: "TÀI KHOẢN KHÁCH SẠN",
        items: [{
          key: "/subscription",
          icon: <ApartmentOutlined />,
          label: "Gói dịch vụ",
        }],
      }]
    : menuGroups;
  const filteredMenuItems: MenuProps["items"] = (collapsed && !useDrawerNavigation)
    ? visibleMenuGroups
        .flatMap((group) =>
          group.items.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role)),
          ),
        )
        .map((item) => ({
          key: item.key,
          icon: item.icon,
          label: item.label,
        }))
    : (visibleMenuGroups
        .map((group) => {
          const allowedItems = group.items
            .filter(
              (item) => !item.roles || (user && item.roles.includes(user.role)),
            )
            .map((item) => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
            }));

          if (allowedItems.length === 0) return null;

          return {
            type: "group" as const,
            key: group.key,
            label: (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  color: "#6ee7b7",
                  textTransform: "uppercase",
                  userSelect: "none",
                }}
              >
                {group.title}
              </span>
            ),
            children: allowedItems,
          };
        })
        .filter(Boolean) as MenuProps["items"]);

  // Product identity is shared with login; the property remains a separate context.
  const compactBrand = collapsed && !useDrawerNavigation;
  const brandBlock = (
    <div className={`sidebar-brand${compactBrand ? ' sidebar-brand--compact' : ''}`}>
      <BrandLogo tone="dark" variant={compactBrand ? 'mark' : 'full'} size={36} />
      {!compactBrand && <p>Nền tảng quản lý khách sạn</p>}
    </div>
  );

  const propertyStrip = !compactBrand && (
    <div className="sidebar-property">
      <div className="sidebar-property__label">Cơ sở hiện tại</div>
      <div className="sidebar-property__name">
        <span>{user?.hotel?.name || 'Khách sạn'}</span>
        {!subscriptionOnly && <span className="sidebar-property__rooms">{roomCountError ? "Chưa tải được số phòng" : roomCount === undefined ? "Đang tải số phòng…" : `${roomCount} phòng`}</span>}
      </div>
      <div className="sidebar-property__shift"><ClockCircleOutlined />{currentShift}</div>
    </div>
  );
  return (
    <Layout className="pms-shell" style={{ minHeight: "100vh", background: "#f8fafc", maxWidth: "100%" }}>
      {/* Persistent navigation is reserved for wide workspaces. */}
      {!useDrawerNavigation && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={250}
          theme="dark"
          style={{
            overflowY: "auto",
            overflowX: "hidden",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: "#0f2922", // Forest Slate
            borderRight: "1px solid #163d33",
            boxShadow: "3px 0 12px rgba(15,41,34,0.12)",
          }}
        >
          {brandBlock}
          {propertyStrip}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={filteredMenuItems}
            onClick={({ key }) => navigate(key)}
            style={{
              background: "transparent",
              borderRight: 0,
              padding: "4px 8px",
            }}
          />
        </Sider>
      )}

      {/* Tablet and mobile navigation drawer */}
      {useDrawerNavigation && (
        <Drawer
          placement="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          size={270}
          title="Menu điều hướng"
          closable={{ placement: 'end', 'aria-label': 'Đóng menu điều hướng' }}
          styles={{
            header: {
              padding: '8px 12px',
              background: '#0b241c',
              borderBottom: '1px solid #c6ad7724',
              flexShrink: 0,
            },
            title: { color: '#f2f0e4' },
            close: {
              color: '#f2f0e4',
              background: '#ffffff0d',
              width: 44,
              height: 44,
              marginInlineEnd: 0,
            },
            body: {
              padding: 0,
              background: "#0f2922",
              overflowY: "auto",
            },
          }}
        >
          {brandBlock}
          {propertyStrip}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={filteredMenuItems}
            onClick={({ key }) => {
              navigate(key);
              setMobileDrawerOpen(false);
            }}
            style={{
              background: "transparent",
              borderRight: 0,
              padding: "4px 8px",
            }}
          />
        </Drawer>
      )}

      {/* Main Content Layout Container */}
      <Layout
        style={{
          marginLeft: useDrawerNavigation ? 0 : collapsed ? 80 : 250,
          transition: "all 0.2s",
          background: "#f8fafc",
          minWidth: 0,
        }}
      >
        <Header
          style={{
            padding: isMobile ? "0 10px" : isTablet ? "0 16px" : useDrawerNavigation ? "0 20px" : "0 24px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 99,
            height: 60,
          }}
        >
          {/* Left Action / Brand breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, minWidth: 0 }}>
            {useDrawerNavigation ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileDrawerOpen(true)}
                style={{ fontSize: 18, color: "#1b4d3e" }}
                aria-label="Mở menu điều hướng"
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: 17, color: "#334155" }}
              />
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "#64748b",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {!useDrawerNavigation && <span>Không gian làm việc /</span>}
              <strong style={{ color: "#0f172a", fontWeight: 600 }}>
                {useDrawerNavigation ? "INNVYRA PMS" : "Hệ thống quản lý PMS"}
              </strong>
              {useDrawerNavigation && <span className="pms-header-property" title={user?.hotel?.name}>{user?.hotel?.name}</span>}
            </div>
          </div>

          {/* Right User & Operational Status */}
          <Space size={isMobile ? 6 : isTablet ? 8 : "middle"} align="center" className="pms-header-actions">
            {/* Operational Date Tag */}
            <Tag
              icon={<ClockCircleOutlined />}
              style={{
                backgroundColor: "#f1f5f9",
                borderColor: "#cbd5e1",
                color: "#334155",
                fontSize: 11,
                padding: useDrawerNavigation ? "2px 6px" : "3px 8px",
                borderRadius: 6,
                fontWeight: 500,
                marginRight: 0,
              }}
            >
              {useDrawerNavigation ? currentShortDate : `Ngày vận hành: ${currentDate}`}
            </Tag>

            {user && <RoleBadge role={user.role} />}

            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Space
                style={{
                  cursor: "pointer",
                  padding: "4px 4px",
                  borderRadius: 6,
                }}
              >
                <Avatar
                  style={{
                    backgroundColor: "#1b4d3e",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                  size={useDrawerNavigation ? 32 : 36}
                  icon={<UserOutlined />}
                />
                {!useDrawerNavigation && (
                  <div style={{ lineHeight: 1.2, textAlign: "left" }}>
                    <div
                      style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}
                    >
                      {user?.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {user?.role}
                    </div>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Content Area */}
        <Content
          className="pms-content"
          style={{
            margin: isMobile ? "10px 6px" : isTablet ? "12px" : useDrawerNavigation ? "16px" : "20px 24px",
            padding: isMobile ? "12px 8px" : isTablet ? "16px 14px" : useDrawerNavigation ? "18px" : "20px 24px",
            background: "#ffffff",
            borderRadius: isMobile ? 8 : 12,
            minHeight: "calc(100vh - 84px)",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
            minWidth: 0,
          }}
        >
          {!isSubscriptionPath(location.pathname) && <SubscriptionNotice />}
          <Suspense fallback={<div role="status" style={{ padding: 24 }}>Đang tải trang…</div>}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
};
