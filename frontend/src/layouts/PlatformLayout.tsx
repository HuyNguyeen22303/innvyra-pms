import {
  ApartmentOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { App, Avatar, Button, Drawer, Layout, Menu, Tag } from "antd";
import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo.tsx";
import { usePlatformAuthStore } from "../store/platformAuthStore.ts";

export function PlatformLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout, isSubmitting } = usePlatformAuthStore();
  const { message } = App.useApp();
  const signOut = async () => {
    try {
      await logout();
    } catch {
      void message.error(
        "Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.",
      );
    }
  };
  const location = useLocation();
  const navigate = useNavigate();
  const selected = location.pathname.startsWith("/platform/account")
    ? "/platform/account"
    : "/platform";
  const navigation = (
    <>
      <Link to="/platform" className="platform-sidebar-brand">
        <BrandLogo tone="dark" size={34} />
      </Link>
      <div className="platform-sidebar-label">QUẢN TRỊ NỀN TẢNG</div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selected]}
        items={[
          { key: "/platform", icon: <ApartmentOutlined />, label: "Tổng quan" },
          {
            key: "/platform/account",
            icon: <UserOutlined />,
            label: "Tài khoản",
          },
        ]}
        onClick={({ key }) => {
          navigate(key);
          setOpen(false);
        }}
      />
      <div className="platform-sidebar-foot">
        <SafetyCertificateOutlined /> Không gian quản trị Innvyra
      </div>
    </>
  );
  return (
    <Layout className="platform-shell">
      <Layout.Sider
        width={240}
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        className="platform-sidebar"
      >
        {navigation}
      </Layout.Sider>
      <Drawer
        placement="left"
        open={open}
        onClose={() => setOpen(false)}
        size={268}
        styles={{ body: { padding: 0, background: "#0f2922" } }}
        title="Điều hướng Innvyra"
      >
        {navigation}
      </Drawer>
      <Layout>
        <Layout.Header className="platform-header">
          <div className="platform-header-left">
            <Button
              type="text"
              icon={<MenuOutlined />}
              className="platform-mobile-menu"
              aria-label="Mở điều hướng"
              onClick={() => setOpen(true)}
            />
            <span>Quản trị Innvyra</span>
            <Tag color="green">Nền tảng</Tag>
          </div>
          <div className="platform-header-right">
            <Avatar icon={<UserOutlined />} />
            <span className="platform-user-name">{user?.fullName}</span>
            <Button
              icon={<LogoutOutlined />}
              loading={isSubmitting}
              onClick={() => void signOut()}
              aria-label="Đăng xuất Innvyra"
            >
              Đăng xuất
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content className="platform-content">
          <Outlet />
        </Layout.Content>
        <Layout.Footer className="platform-footer">
          Innvyra PMS · Quản trị nền tảng
        </Layout.Footer>
      </Layout>
    </Layout>
  );
}
