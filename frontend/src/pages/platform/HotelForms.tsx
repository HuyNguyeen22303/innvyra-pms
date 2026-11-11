import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import type { IssuedHotelCredentials } from "../../types/hotel.types.ts";

export function HotelProfileFields({
  platform = true,
}: {
  platform?: boolean;
}) {
  return (
    <>
      <Form.Item
        name="name"
        label="Tên khách sạn"
        rules={[
          { required: true, whitespace: true, message: "Nhập tên khách sạn." },
        ]}
      >
        <Input maxLength={191} />
      </Form.Item>
      {platform && (
        <Form.Item
          name="timezone"
          label="Múi giờ IANA"
          rules={[{ required: true, message: "Nhập múi giờ." }]}
        >
          <Input maxLength={64} placeholder="Asia/Ho_Chi_Minh" />
        </Form.Item>
      )}
      <Form.Item
        name="contactEmail"
        label="Email liên hệ"
        rules={[{ type: "email", message: "Email chưa hợp lệ." }]}
      >
        <Input maxLength={191} />
      </Form.Item>
      <Form.Item name="contactPhone" label="Số điện thoại liên hệ">
        <Input maxLength={30} />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ">
        <Input.TextArea maxLength={10000} rows={2} />
      </Form.Item>
      {platform && (
        <Form.Item name="agreementReference" label="Tham chiếu thỏa thuận">
          <Input maxLength={191} />
        </Form.Item>
      )}
    </>
  );
}
export function HotelAdminFields({ nested = false }: { nested?: boolean }) {
  const field = (key: string) => (nested ? ["admin", key] : key);
  return (
    <>
      <Form.Item
        name={field("fullName")}
        label="Họ tên quản trị khách sạn"
        rules={[
          {
            required: true,
            whitespace: true,
            message: "Nhập họ tên quản trị.",
          },
        ]}
      >
        <Input maxLength={191} />
      </Form.Item>
      <Form.Item
        name={field("username")}
        label="Tên đăng nhập"
        rules={[
          { required: true, message: "Nhập tên đăng nhập." },
          {
            pattern: /^[a-zA-Z0-9._-]{3,64}$/,
            message:
              "Dùng 3–64 chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
          },
        ]}
      >
        <Input maxLength={64} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name={field("email")}
        label="Email quản trị khách sạn"
        rules={[
          { required: true, message: "Nhập email quản trị." },
          { type: "email", message: "Email chưa hợp lệ." },
        ]}
      >
        <Input maxLength={191} autoComplete="off" />
      </Form.Item>
    </>
  );
}
export function IssuedCredentialsModal({
  value,
  onClose,
}: {
  value: IssuedHotelCredentials | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!value}
      title="Bàn giao tài khoản khách sạn"
      onCancel={onClose}
      mask={{ closable: false }}
      footer={
        <Button type="primary" onClick={onClose}>
          Đã lưu thông tin bàn giao
        </Button>
      }
    >
      {value && (
        <>
          <Alert
            type="warning"
            showIcon
            title="Mật khẩu tạm chỉ hiển thị lần này"
            description="Lưu và bàn giao cho đúng người nhận. Khách sạn phải đổi mật khẩu trước khi dùng PMS. Nếu mất mật khẩu tạm, hãy reset để cấp mật khẩu mới."
          />
          <p>Họ tên: {value.admin.fullName}</p>
          <p>
            Tên đăng nhập:{" "}
            <Typography.Text copyable>{value.admin.username}</Typography.Text>
          </p>
          <p>Email: {value.admin.email}</p>
          <p>
            Mật khẩu tạm:{" "}
            <Typography.Text code copyable>
              {value.temporaryPassword}
            </Typography.Text>
          </p>
          <p>
            Trang đăng nhập khách sạn:{" "}
            <Typography.Text code>/login</Typography.Text>
          </p>
        </>
      )}
    </Modal>
  );
}
