import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Result,
  Spin,
} from "antd";
import { ownHotelApi } from "../../api/hotels.api.ts";
import { useAuthStore } from "../../store/authStore.ts";
import type { HotelEdit } from "../../types/hotel.types.ts";
import { HotelProfileFields } from "../platform/HotelForms.tsx";
import { hotelError } from "../../utils/hotelErrors.ts";

export function HotelSettingsPage() {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [form] = Form.useForm();
  const user = useAuthStore((state) => state.user);
  const { message } = App.useApp();
  const query = useQuery({
    queryKey: ["own-hotel-profile", user?.id, user?.hotelId, revision],
    queryFn: ({ signal }) => ownHotelApi.get(signal),
  });
  const hotel = query.data;
  useEffect(() => {
    if (hotel) form.setFieldsValue(hotel);
  }, [hotel, form]);
  const submit = async (
    values: Pick<
      HotelEdit,
      "name" | "contactEmail" | "contactPhone" | "address"
    >,
  ) => {
    const actorId = user?.id;
    setSaving(true);
    setError(null);
    try {
      const updated = await ownHotelApi.update({
        ...values,
        contactEmail: values.contactEmail || null,
        contactPhone: values.contactPhone || null,
        address: values.address || null,
      });
      if (useAuthStore.getState().user?.id !== actorId) return;
      setRevision((value) => value + 1);
      useAuthStore.setState((state) =>
        state.user
          ? {
              user: {
                ...state.user,
                hotel: {
                  id: updated.id,
                  name: updated.name,
                  code: updated.code,
                  timezone: updated.timezone,
                },
              },
            }
          : {},
      );
      void message.success("Đã cập nhật thông tin khách sạn.");
    } catch (failure) {
      setError(hotelError(failure));
    } finally {
      setSaving(false);
    }
  };
  if (query.isPending)
    return <Spin description="Đang tải thông tin khách sạn..." />;
  if (!hotel)
    return (
      <Result
        status="warning"
        title={
          query.error ? hotelError(query.error) : "Chưa tải được thông tin"
        }
        extra={
          <Button onClick={() => setRevision((value) => value + 1)}>
            Thử lại
          </Button>
        }
      />
    );
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <h1>Thông tin khách sạn</h1>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}
      <Card>
        <Descriptions
          column={1}
          items={[
            { key: "code", label: "Mã khách sạn", children: hotel.code },
            { key: "timezone", label: "Múi giờ", children: hotel.timezone },
          ]}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          disabled={saving}
          style={{ marginTop: 24 }}
        >
          <HotelProfileFields platform={false} />
          <Button type="primary" htmlType="submit" loading={saving}>
            Lưu thông tin khách sạn
          </Button>
        </Form>
      </Card>
    </div>
  );
}
