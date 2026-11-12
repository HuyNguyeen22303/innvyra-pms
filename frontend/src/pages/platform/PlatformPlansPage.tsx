import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import {
  subscriptionsApi,
  type PlanInput,
  type SubscriptionPlan,
} from "../../api/subscriptions.api.ts";
import { usePlatformAuthStore } from "../../store/platformAuthStore.ts";
import { hotelError } from "../../utils/hotelErrors.ts";
import { money } from "../../utils/subscriptions.ts";

export function PlatformPlansPage() {
  const owner = usePlatformAuthStore((s) => s.user?.id);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<SubscriptionPlan | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<PlanInput>();
  const query = useQuery({
    queryKey: ["platform-plans", owner, revision],
    queryFn: ({ signal }) => subscriptionsApi.plans(signal),
  });
  const open = (plan: SubscriptionPlan | "new") => {
    form.resetFields();
    form.setFieldsValue(plan === "new" ? { isActive: true } : plan);
    setError(null);
    setEditing(plan);
  };
  const submit = async (input: PlanInput) => {
    setSaving(true);
    setError(null);
    try {
      if (editing === "new")
        await subscriptionsApi.createPlan({
          ...input,
          description: input.description || null,
        });
      else if (editing) {
        const { code: _code, ...fields } = input;
        void _code;
        await subscriptionsApi.updatePlan(editing.id, {
          ...fields,
          description: fields.description || null,
        });
      }
      setEditing(null);
      setRevision((v) => v + 1);
    } catch (failure) {
      setError(hotelError(failure));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="platform-page">
      <div className="platform-page-heading">
        <div className="platform-eyebrow">THUÊ BAO THEO THÁNG</div>
        <h1>Gói dịch vụ</h1>
        <p className="platform-muted">
          Các gói dùng chung tính năng PMS, khác hạn mức phòng và tài khoản hoạt
          động. Giá tính theo VND mỗi tháng.
        </p>
      </div>
      <Space style={{ marginBottom: 20 }}>
        <Button type="primary" onClick={() => open("new")}>
          Tạo gói dịch vụ
        </Button>
        <Button onClick={() => setRevision((v) => v + 1)}>Làm mới</Button>
      </Space>
      {query.isError && <Alert type="error" title={hotelError(query.error)} />}
      <Card>
        <Table
          rowKey="id"
          loading={query.isFetching}
          dataSource={query.data ?? []}
          scroll={{ x: 850 }}
          locale={{
            emptyText:
              "Chưa có gói. Tạo gói đầu tiên để tiếp nhận khách sạn theo tháng.",
          }}
          columns={[
            { title: "Mã gói", dataIndex: "code" },
            { title: "Tên gói", dataIndex: "name" },
            { title: "Giá / tháng", dataIndex: "monthlyPrice", render: money },
            { title: "Phòng", dataIndex: "roomLimit" },
            { title: "Tài khoản", dataIndex: "staffLimit" },
            {
              title: "Tiếp nhận",
              dataIndex: "isActive",
              render: (v: boolean) => (
                <Tag color={v ? "green" : "default"}>
                  {v ? "Đang mở" : "Ngừng đăng ký"}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              render: (_, row) => (
                <Button onClick={() => open(row)}>Chỉnh sửa</Button>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing === "new" ? "Tạo gói dịch vụ" : "Chỉnh sửa gói"}
        open={editing !== null}
        onCancel={() => {
          if (!saving) setEditing(null);
        }}
        footer={null}
        forceRender
      >
        <p>
          Thay đổi chỉ áp dụng cho kỳ đăng ký mới. Lịch sử và hạn mức kỳ đã ghi
          nhận được giữ nguyên.
        </p>
        {error && (
          <Alert type="error" title={error} style={{ marginBottom: 16 }} />
        )}
        <Form
          name="platform-plan"
          form={form}
          layout="vertical"
          onFinish={submit}
          disabled={saving}
        >
          <Form.Item
            name="code"
            label="Mã gói"
            rules={[
              { required: true },
              { pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/ },
            ]}
          >
            <Input maxLength={50} disabled={editing !== "new"} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên gói"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea maxLength={10000} />
          </Form.Item>
          <Form.Item
            name="monthlyPrice"
            label="Giá mỗi tháng (VND)"
            rules={[
              { required: true },
              {
                pattern: /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/,
                message: "Nhập số tiền không âm, tối đa 2 chữ số thập phân.",
              },
            ]}
          >
            <Input inputMode="decimal" />
          </Form.Item>
          <Space align="start">
            <Form.Item
              name="roomLimit"
              label="Số phòng hoạt động tối đa"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={100000} precision={0} />
            </Form.Item>
            <Form.Item
              name="staffLimit"
              label="Số tài khoản hoạt động tối đa"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={100000} precision={0} />
            </Form.Item>
          </Space>
          <Form.Item
            name="isActive"
            label="Cho phép đăng ký / gia hạn mới"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={saving}>
            Lưu gói
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
