import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Alert, App, Button, Form, Modal, Select, Space } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { guestsApi } from "../../api/guests.api.ts";
import type { GuestWarning } from "../../types/guests.types.ts";
import { guestFormPayload } from "../../utils/guestForm.ts";
import { GuestFormFields } from "./GuestFormFields.tsx";

export function BookingGuestPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [warnings, setWarnings] = useState<GuestWarning[]>([]);
  const [form] = Form.useForm();
  const submitting = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useInfiniteQuery({
    queryKey: ["guestsForBooking", term],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      guestsApi.getAll({
        page: pageParam,
        limit: 20,
        search: term || undefined,
      }),
    getNextPageParam: (last) =>
      last.data.pagination.page < last.data.pagination.totalPages
        ? last.data.pagination.page + 1
        : undefined,
    retry: false,
  });
  const selected = useQuery({
    queryKey: ["guest-detail", value],
    queryFn: () => guestsApi.getById(value!),
    enabled: !!value,
  });
  const candidateIds = useMemo(
    () => warnings.flatMap((warning) => warning.candidateIds),
    [warnings],
  );
  const candidates = useQuery({
    queryKey: ["booking-guest-candidates", candidateIds],
    queryFn: async () => {
      const responses = await Promise.allSettled(
        candidateIds.map((id) => guestsApi.getById(id)),
      );
      return responses.flatMap((response) =>
        response.status === "fulfilled" ? [response.value.data] : [],
      );
    },
    enabled: candidateIds.length > 0,
  });
  const options = useMemo(() => {
    const all = [
      selected.data?.data,
      ...(candidates.data ?? []),
      ...(list.data?.pages.flatMap((page) => page.data.items) ?? []),
    ];
    const unique = new Map(
      all.filter((guest) => !!guest).map((guest) => [guest.id, guest]),
    );
    return [...unique.values()].map((guest) => ({
      value: guest.id,
      label: `${guest.fullName} — ${guest.phone || "Chưa có SĐT"}${candidateIds.includes(guest.id) ? " (Có thể trùng)" : ""}`,
    }));
  }, [selected.data, candidates.data, list.data, candidateIds]);
  const mutation = useMutation({
    mutationFn: guestsApi.create,
    onSuccess: (response) => {
      client.setQueryData(["guest-detail", response.data.id], response);
      void client.invalidateQueries({ queryKey: ["guests"] });
      void client.invalidateQueries({ queryKey: ["guestsForBooking"] });
      onChange(response.data.id);
      setWarnings(response.warnings ?? []);
      setOpen(false);
      setUncertain(false);
      form.resetFields();
      message.success("Đã lưu và chọn khách hàng cho đơn đặt phòng.");
    },
    onError: (error: any) => {
      if (!error.response || error.response.status >= 500) setUncertain(true);
      message.error(
        error.response?.data?.error?.message ||
          "Chưa xác định được kết quả lưu hồ sơ. Kiểm tra lại trước khi tạo tiếp.",
      );
    },
    onSettled: () => {
      submitting.current = false;
    },
  });
  const saved = selected.data?.data;
  const recoverSearch = () => {
    setSearch(
      form.getFieldValue("phone")?.trim() ||
        form.getFieldValue("fullName")?.trim() ||
        "",
    );
    setOpen(false);
    void client.invalidateQueries({ queryKey: ["guestsForBooking"] });
  };
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%", minWidth: 0 }}>
        <Select
          aria-label="Tìm khách đặt phòng"
          showSearch={{ filterOption: false, onSearch: setSearch }}
          placeholder="Tìm theo họ tên hoặc số điện thoại"
          value={value}
          options={options}
          loading={list.isFetching}
          disabled={disabled}
          style={{ flex: "1 1 200px", minWidth: 0, maxWidth: "100%" }}
          onChange={(id) => {
            onChange(id);
            setWarnings([]);
          }}
          onPopupScroll={(event) => {
            const target = event.currentTarget;
            if (
              target.scrollTop + target.clientHeight >=
                target.scrollHeight - 30 &&
              list.hasNextPage &&
              !list.isFetching
            )
              void list.fetchNextPage();
          }}
          popupRender={(menu) => (
            <>
              {menu}
              {list.hasNextPage && (
                <Button
                  block
                  type="text"
                  loading={list.isFetchingNextPage}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void list.fetchNextPage()}
                >
                  Tải thêm khách hàng
                </Button>
              )}
            </>
          )}
          notFoundContent={
            list.isFetching ? "Đang tìm khách..." : "Không tìm thấy khách hàng"
          }
        />
        <Button
          icon={<PlusOutlined />}
          disabled={disabled}
          onClick={() => {
            if (!form.isFieldsTouched())
              form.setFieldsValue({
                nationality: "Việt Nam",
                gender: "UNSPECIFIED",
              });
            setOpen(true);
          }}
        >
          Thêm khách mới
        </Button>
      </div>
      {list.isError && (
        <Alert
          type="error"
          title="Chưa tải được danh sách khách"
          action={
            <Button size="small" onClick={() => void list.refetch()}>
              Thử lại
            </Button>
          }
        />
      )}
      {warnings.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="Hồ sơ vừa tạo có dấu hiệu trùng"
          description="Các hồ sơ nghi trùng đã được đưa vào ô chọn khách. Kiểm tra trước khi xác nhận đơn; hệ thống giữ riêng các hồ sơ."
        />
      )}
      <Modal
        title="Thêm hồ sơ khách hàng mới"
        open={open}
        width={680}
        onCancel={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        onOk={() => form.submit()}
        okText="Lưu và chọn khách"
        cancelText="Để sau"
        confirmLoading={mutation.isPending}
        okButtonProps={{ disabled: uncertain }}
        cancelButtonProps={{ disabled: mutation.isPending }}
        closable={!mutation.isPending}
        mask={{ closable: false }}
      >
        {uncertain && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title="Cần kiểm tra kết quả lưu hồ sơ"
            description="Yêu cầu trước có thể đã được lưu. Tìm lại theo tên hoặc điện thoại để chọn hồ sơ đã có."
            action={
              <Space orientation="vertical">
                <Button onClick={recoverSearch}>Tìm hồ sơ đã lưu</Button>
                <Button type="text" onClick={() => setUncertain(false)}>
                  Đã kiểm tra, tiếp tục tạo
                </Button>
              </Space>
            }
          />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={mutation.isPending || uncertain}
          onFinish={(values) => {
            if (submitting.current || uncertain) return;
            submitting.current = true;
            mutation.mutate(guestFormPayload(values));
          }}
        >
          <GuestFormFields />
        </Form>
      </Modal>
      {saved && (
        <span style={{ color: "#64748b", fontSize: 12 }}>
          Đã chọn: {saved.fullName}
        </span>
      )}
    </Space>
  );
}
