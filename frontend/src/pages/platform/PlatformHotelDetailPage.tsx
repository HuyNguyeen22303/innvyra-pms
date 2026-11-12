import { HotelSubscriptionCard } from "./HotelSubscriptionCard.tsx";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Result,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { Link, useParams } from "react-router-dom";
import { hotelsApi } from "../../api/hotels.api.ts";
import type {
  HotelAdmin,
  HotelAdminInput,
  HotelEdit,
  IssuedHotelCredentials,
} from "../../types/hotel.types.ts";
import {
  HotelAdminFields,
  HotelProfileFields,
  IssuedCredentialsModal,
} from "./HotelForms.tsx";
import { hotelError } from "../../utils/hotelErrors.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";

const actions: Record<string, string> = {
  HOTEL_CREATED: "Tiếp nhận khách sạn",
  HOTEL_UPDATED: "Cập nhật thông tin",
  HOTEL_ADMIN_CREATED: "Cấp tài khoản quản trị",
  HOTEL_ADMIN_PASSWORD_RESET: "Reset mật khẩu quản trị",
  SUBSCRIPTION_PERIOD_RECORDED: "Ghi nhận kỳ sử dụng",
  HOTEL_SUSPENDED: "Tạm ngừng",
  HOTEL_REACTIVATED: "Mở lại",
};
export function PlatformHotelDetailPage() {
  const { id = "" } = useParams();
  return <HotelDetailContent key={id} id={id} />;
}
function HotelDetailContent({ id }: { id: string }) {
  const userId = usePlatformAuthStore((state) => state.user?.id);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [resetTarget, setResetTarget] = useState<HotelAdmin | null>(null);
  const [issued, setIssued] = useState<IssuedHotelCredentials | null>(null);
  const [editForm] = Form.useForm<HotelEdit>();
  const [adminForm] = Form.useForm<HotelAdminInput>();
  const [resetForm] = Form.useForm<{ reason: string }>();
  const { message } = App.useApp();
  const query = useQuery({
    queryKey: ["platform-hotel-detail", userId, id, revision],
    queryFn: ({ signal }) => hotelsApi.detail(id, signal),
  });
  const hotel = query.data;
  const loading = query.isFetching;
  useEffect(() => {
    if (hotel) editForm.setFieldsValue(hotel);
  }, [hotel, editForm]);
  const mutate = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(hotelError(failure));
    } finally {
      setSaving(false);
    }
  };
  if (!hotel && loading)
    return (
      <div className="platform-loading">
        <Spin description="Đang tải khách sạn..." />
      </div>
    );
  if (!hotel)
    return (
      <Result
        status="warning"
        title={
          query.error ? hotelError(query.error) : "Không tìm thấy khách sạn"
        }
        extra={
          <Space>
            <Button onClick={() => setRevision((value) => value + 1)}>
              Thử lại
            </Button>
            <Link to="/platform/hotels">Về danh sách</Link>
          </Space>
        }
      />
    );
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">{hotel.code}</div>
        <h1>{hotel.name}</h1>
        <Space>
          <Tag color={hotel.status === "ACTIVE" ? "green" : "orange"}>
            {hotel.status === "ACTIVE" ? "Hoạt động" : "Tạm ngừng"}
          </Tag>
          <Link to="/platform/hotels">Danh sách khách sạn</Link>
          <Button
            size="small"
            loading={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            Tải lại
          </Button>
        </Space>
      </div>
      {(error || query.error) && (
        <Alert
          type="error"
          title={error || hotelError(query.error)}
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}
      <HotelSubscriptionCard
        id={id}
        status={hotel.status}
        onChanged={() => setRevision((v) => v + 1)}
      />
      <div className="platform-hotel-form-grid" style={{ marginTop: 24 }}>
        <Card title="Thông tin khách sạn">
          <Form<HotelEdit>
            form={editForm}
            layout="vertical"
            disabled={saving || loading}
            onFinish={(values) =>
              void mutate(async () => {
                await hotelsApi.update(id, {
                  ...values,
                  contactEmail: values.contactEmail || null,
                  contactPhone: values.contactPhone || null,
                  address: values.address || null,
                  agreementReference: values.agreementReference || null,
                });
                void message.success("Đã cập nhật thông tin khách sạn.");
              })
            }
          >
            <HotelProfileFields />
            <Button type="primary" htmlType="submit" loading={saving}>
              Lưu thông tin
            </Button>
          </Form>
        </Card>
        <Card
          title="Quản trị khách sạn"
          extra={
            <Button
              disabled={saving}
              onClick={() => {
                adminForm.resetFields();
                setAdding(true);
              }}
            >
              Cấp thêm admin
            </Button>
          }
        >
          <Table<HotelAdmin>
            rowKey="id"
            dataSource={hotel.staff}
            pagination={false}
            scroll={{ x: 470 }}
            columns={[
              {
                title: "Tài khoản",
                render: (_, admin) => (
                  <>
                    <strong>{admin.fullName}</strong>
                    <div>{admin.username}</div>
                    <div className="platform-muted">{admin.email}</div>
                  </>
                ),
              },
              {
                title: "Trạng thái",
                render: (_, admin) => (
                  <>
                    <Tag color={admin.isActive ? "green" : "default"}>
                      {admin.isActive ? "Hoạt động" : "Đã ngừng"}
                    </Tag>
                    {admin.mustChangePassword && (
                      <div className="platform-muted">Cần đổi mật khẩu</div>
                    )}
                  </>
                ),
              },
              {
                title: "Thao tác",
                render: (_, admin) => (
                  <Button
                    disabled={saving}
                    onClick={() => {
                      resetForm.resetFields();
                      setResetTarget(admin);
                    }}
                  >
                    Reset mật khẩu
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </div>
      <Card title="Nhật ký quản trị gần đây" style={{ marginTop: 24 }}>
        <Table
          rowKey="id"
          dataSource={hotel.platformAudits}
          pagination={false}
          scroll={{ x: 620 }}
          columns={[
            {
              title: "Thời gian",
              dataIndex: "createdAt",
              render: (value: string) =>
                new Date(value).toLocaleString("vi-VN"),
            },
            {
              title: "Thao tác",
              dataIndex: "action",
              render: (value: string) => actions[value] || value,
            },
            {
              title: "Người thực hiện",
              render: (_, row) => row.actor.fullName,
            },
            {
              title: "Lý do",
              dataIndex: "reason",
              render: (value: string | null) => value || "—",
            },
          ]}
        />
        <p className="platform-muted">Hiển thị tối đa 50 bản ghi gần nhất.</p>
      </Card>
      <Modal
        open={adding}
        title="Cấp thêm quản trị khách sạn"
        onCancel={() => {
          if (!saving) setAdding(false);
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={adminForm}
          layout="vertical"
          disabled={saving}
          onFinish={(values) =>
            void mutate(async () => {
              setIssued(await hotelsApi.addAdmin(id, values));
              setAdding(false);
            })
          }
        >
          <HotelAdminFields />
          <Button type="primary" htmlType="submit" loading={saving}>
            Cấp tài khoản và mật khẩu tạm
          </Button>
        </Form>
      </Modal>
      <Modal
        open={!!resetTarget}
        title={`Reset mật khẩu: ${resetTarget?.username || ""}`}
        onCancel={() => {
          if (!saving) setResetTarget(null);
        }}
        footer={null}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="Các phiên đang đăng nhập của tài khoản này sẽ bị thu hồi."
          style={{ marginBottom: 20 }}
        />
        <Form
          form={resetForm}
          layout="vertical"
          disabled={saving}
          onFinish={({ reason }) => {
            if (resetTarget)
              void mutate(async () => {
                setIssued(
                  await hotelsApi.resetAdmin(id, resetTarget.id, reason),
                );
                setResetTarget(null);
              });
          }}
        >
          <Form.Item
            name="reason"
            label="Lý do reset"
            rules={[
              {
                required: true,
                whitespace: true,
                message: "Nhập lý do reset.",
              },
            ]}
          >
            <Input.TextArea maxLength={2000} />
          </Form.Item>
          <Button danger htmlType="submit" loading={saving}>
            Reset và cấp mật khẩu tạm mới
          </Button>
        </Form>
      </Modal>
      <IssuedCredentialsModal value={issued} onClose={() => setIssued(null)} />
    </div>
  );
}
