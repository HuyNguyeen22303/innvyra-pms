import {
  Form,
  Row,
  Col,
  Input,
  Select,
  DatePicker,
  Typography,
  Divider,
} from "antd";
import dayjs from "dayjs";
const { Text } = Typography;

export function GuestFormFields() {
  return (
    <>
      {/* Row 1: Full name & Gender */}
      <Row gutter={16}>
        <Col xs={24} sm={16}>
          <Form.Item
            name="fullName"
            label={<Text strong>Họ và tên khách hàng</Text>}
            rules={[
              {
                required: true,
                message: "Vui lòng nhập họ và tên khách hàng!",
              },
              { min: 1, max: 150, message: "Độ dài họ tên từ 1 đến 150 ký tự" },
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
                { label: "Nam (Male)", value: "MALE" },
                { label: "Nữ (Female)", value: "FEMALE" },
                { label: "Khác (Other)", value: "OTHER" },
                { label: "Chưa xác định", value: "UNSPECIFIED" },
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
                message:
                  "Số điện thoại chỉ gồm chữ số (VD: 0912345678 hoặc +84912345678)",
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
            rules={[{ type: "email", message: "Địa chỉ email không hợp lệ!" }]}
          >
            <Input placeholder="VD: khachhang@example.com" />
          </Form.Item>
        </Col>
      </Row>

      {/* Row 3: Date of Birth & Nationality */}
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="dateOfBirth"
            label={<Text strong>Ngày tháng năm sinh</Text>}
          >
            <DatePicker
              format="DD/MM/YYYY"
              style={{ width: "100%" }}
              placeholder="Chọn ngày sinh"
              disabledDate={(current) =>
                current && current > dayjs().endOf("day")
              }
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={12}>
          <Form.Item name="nationality" label={<Text strong>Quốc tịch</Text>}>
            <Input placeholder="VD: Việt Nam, United States..." />
          </Form.Item>
        </Col>
      </Row>

      <Divider style={{ margin: "12px 0 16px 0" }}>
        Giấy tờ định danh lưu trú
      </Divider>

      {/* Row 4: Document Type & Document Number */}
      <Row gutter={16}>
        <Col xs={24} sm={10}>
          <Form.Item
            name="documentType"
            label={<Text strong>Loại giấy tờ</Text>}
          >
            <Select
              placeholder="Chọn loại giấy tờ"
              allowClear
              options={[
                { label: "CCCD / CMND", value: "NATIONAL_ID" },
                { label: "Hộ chiếu (Passport)", value: "PASSPORT" },
                { label: "Bằng lái xe", value: "DRIVER_LICENSE" },
                { label: "Giấy tờ khác", value: "OTHER" },
              ]}
            />
          </Form.Item>
        </Col>

        <Col xs={24} sm={14}>
          <Form.Item
            name="documentNumber"
            label={<Text strong>Số CCCD / Hộ chiếu</Text>}
            dependencies={["documentType"]}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (value && !getFieldValue("documentType")) {
                    return Promise.reject(
                      new Error("Vui lòng chọn loại giấy tờ khi nhập số!"),
                    );
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input
              placeholder="VD: 079201006200 hoặc C1234567"
              style={{ textTransform: "uppercase" }}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Address & Notes */}
      <Form.Item
        name="address"
        label={<Text strong>Địa chỉ cư trú / Quê quán</Text>}
      >
        <Input placeholder="VD: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh" />
      </Form.Item>

      <Form.Item
        name="notes"
        label={<Text strong>Ghi chú đặc biệt / Sở thích</Text>}
      >
        <Input.TextArea
          rows={2}
          placeholder="VD: Khách thân thiết VIP, thường xuyên đi công tác, thích phòng yên tĩnh..."
        />
      </Form.Item>
    </>
  );
}
