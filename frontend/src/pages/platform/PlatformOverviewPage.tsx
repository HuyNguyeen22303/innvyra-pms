import {
  ArrowRightOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Card, Descriptions, Tag } from "antd";
import { Link } from "react-router-dom";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";

export function PlatformOverviewPage() {
  const user = usePlatformAuthStore((state) => state.user);
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">TỔNG QUAN</div>
        <h1>Xin chào, {user?.fullName}</h1>
        <p className="platform-muted">
          Chào mừng bạn đến với khu vực quản trị Innvyra.
        </p>
      </div>
      <div className="platform-overview-grid">
        <Card
          className="platform-profile-card"
          title={
            <span>
              <UserOutlined /> Tài khoản quản trị
            </span>
          }
          extra={<Tag color="success">Đang hoạt động</Tag>}
        >
          <Descriptions
            column={1}
            size="middle"
            items={[
              { key: "name", label: "Họ và tên", children: user?.fullName },
              { key: "email", label: "Email", children: user?.email },
              { key: "role", label: "Vai trò", children: "Quản trị Innvyra" },
            ]}
          />
        </Card>
        <Card className="platform-account-shortcut">
          <div className="platform-shortcut-icon">
            <SafetyCertificateOutlined />
          </div>
          <h2>Thông tin & bảo mật</h2>
          <p className="platform-muted">
            Xem thông tin tài khoản và thay đổi mật khẩu đăng nhập.
          </p>
          <Link to="/platform/account">
            <Button type="primary">
              Quản lý tài khoản <ArrowRightOutlined />
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
