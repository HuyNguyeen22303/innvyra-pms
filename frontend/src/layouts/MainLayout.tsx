import React, { useState } from "react";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Typography,
  Button,
  Tag,
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
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../store/authStore.ts";
import { RoleBadge } from "../components/RoleBadge.tsx";
import { roomsApi } from "../api/rooms.api.ts";
import { useStaffDirectory } from "../utils/staffDirectory.ts";
import type { Role } from "../types/auth.types.ts";

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
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Globally preload and subscribe to hotel staff directory for all pages
  useStaffDirectory();

  // Dynamic room count from backend API
  const { data: roomsRes } = useQuery({
    queryKey: ["rooms-count"],
    queryFn: () => roomsApi.getAll(),
    staleTime: 30000,
  });
  const rawRooms = roomsRes?.data;
  const roomCount = Array.isArray(rawRooms)
    ? rawRooms.length
    : Array.isArray((rawRooms as any)?.items)
      ? (rawRooms as any).items.length
      : ((rawRooms as any)?.pagination?.total ?? 20);

  // Dynamic real-time operational date & shift
  const currentDate = dayjs().format("DD/MM/YYYY");
  const currentHour = dayjs().hour();
  const currentShift =
    currentHour >= 6 && currentHour < 14
      ? "Ca sáng: 06:00 – 14:00"
      : currentHour >= 14 && currentHour < 22
        ? "Ca chiều: 14:00 – 22:00"
        : "Ca đêm: 22:00 – 06:00";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
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

  const filteredMenuItems: MenuProps["items"] = collapsed
    ? menuGroups
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
    : (menuGroups
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

  return (
    <Layout style={{ minHeight: "100vh", background: "#f8fafc" }}>
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
        {/* Brand Header */}
        <div
          style={{
            height: 70,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#091c17",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              backgroundColor: "#1b4d3e",
              border: "1px solid #2d6b58",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              marginRight: collapsed ? 0 : 12,
              flexShrink: 0,
            }}
          >
            🏨
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: 0.8,
                  lineHeight: 1.2,
                }}
              >
                INNVYRA PMS
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 10,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                Boutique Hotel & Resort
              </div>
            </div>
          )}
        </div>

        {/* Property & Shift Strip */}
        {!collapsed && (
          <div
            style={{
              margin: "14px 16px",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#cbd5e1",
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Innvyra Hotel</span>
              <span style={{ color: "#4ade80" }}>● {roomCount} phòng</span>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
              {currentShift}
            </div>
          </div>
        )}

        {/* Navigation Menu */}
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

      <Layout
        style={{
          marginLeft: collapsed ? 80 : 250,
          transition: "all 0.2s",
          background: "#f8fafc",
        }}
      >
        <Header
          style={{
            padding: "0 28px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 99,
            height: 64,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 17, color: "#334155" }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#64748b",
              }}
            >
              <span>Không gian làm việc</span>
              <span>/</span>
              <strong style={{ color: "#0f172a", fontWeight: 600 }}>
                Hệ thống quản lý PMS
              </strong>
            </div>
          </div>

          <Space size="large" align="center">
            {/* Operational Date Tag */}
            <Tag
              icon={<ClockCircleOutlined />}
              style={{
                backgroundColor: "#f1f5f9",
                borderColor: "#cbd5e1",
                color: "#334155",
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              Ngày vận hành: {currentDate}
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
                  padding: "4px 8px",
                  borderRadius: 6,
                }}
              >
                <Avatar
                  style={{
                    backgroundColor: "#1b4d3e",
                    color: "#ffffff",
                    fontWeight: 600,
                  }}
                  icon={<UserOutlined />}
                />
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
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: "24px 28px",
            padding: "24px 28px",
            background: "#ffffff",
            borderRadius: 12,
            minHeight: "calc(100vh - 112px)",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
