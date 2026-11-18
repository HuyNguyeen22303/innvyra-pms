import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Select,
  Space,
  Spin,
  App,
  Typography,
  Tag,
} from "antd";
import { roomTypesApi } from "../../../api/rooms.api.ts";
import { suppliesApi } from "../../../api/supplies.api.ts";
import { getInventoryErrorMessage } from "../../../api/inventory.api.ts";
import { MaterialEditor, type MaterialDraft } from "./MaterialEditor.tsx";
import { HousekeepingReusableChecklist } from "./HousekeepingReusableChecklist.tsx";
function PresetForm({ id }: { id: string }) {
  const { message } = App.useApp();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<MaterialDraft[] | null>(null);
  const query = useQuery({
    queryKey: ["inventory", "housekeeping-presets", id],
    queryFn: ({ signal }) => suppliesApi.presets(id, signal),
  });
  const value =
    draft ??
    query.data?.materials.map((line) => ({
      key: line.itemId,
      itemId: line.itemId,
      quantity: Number(line.quantity),
      usageBasis: line.usageBasis,
    })) ??
    [];
  const mutation = useMutation({
    mutationFn: () => {
      if (value.some((row) => !row.itemId || row.quantity <= 0))
        throw Error("Chọn đủ vật tư và số lượng lớn hơn 0.");
      if (new Set(value.map((row) => row.itemId)).size !== value.length)
        throw Error("Mỗi vật tư chỉ được chọn một lần.");
      return suppliesApi.savePresets(
        id,
        value.map((row) => ({
          itemId: row.itemId,
          quantity: row.quantity.toFixed(2),
          usageBasis: row.usageBasis ?? "PER_ROOM",
        })),
      );
    },
    onSuccess: () => {
      void message.success("Đã lưu định mức vật tư theo hạng phòng.");
      setDraft(null);
      void cache.invalidateQueries({
        queryKey: ["inventory", "housekeeping-presets"],
      });
    },
    onError: (error) =>
      void message.error(
        getInventoryErrorMessage(
          error,
          error instanceof Error ? error.message : "Không lưu được định mức.",
        ),
      ),
  });
  if (query.isPending) return <Spin />;
  if (query.isError)
    return (
      <Alert
        type="error"
        title="Không tải được định mức"
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />
    );
  return (
    <Space orientation="vertical" style={{ width: "100%" }} size={20}>
      <div>
        <Tag color="green">
          Chuẩn bị tiêu chuẩn: {query.data.roomType.maxAdults} khách
        </Tag>
        <Tag>
          Sức chứa: {query.data.roomType.maxAdults} người lớn +{" "}
          {query.data.roomType.maxChildren} trẻ em
        </Tag>
      </div>
      <Alert
        type="info"
        showIcon
        title="Chọn đúng cách tính cho từng vật tư"
        description="Đồ dùng cá nhân tính cho 1 khách. Giấy, túi rác và hóa chất tính cho 1 phòng. Đây là lượng gợi ý chuẩn bị; khi gửi nghiệm thu chỉ xác nhận phần thực xuất bổ sung. Số trẻ em và vật dụng phù hợp độ tuổi được kiểm tra khi chuẩn bị phòng."
      />
      <MaterialEditor
        value={value}
        onChange={setDraft}
        knownItems={query.data.materials.map((line) => line.item)}
        previewGuests={query.data.roomType.maxAdults}
      />
      <Button
        type="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Lưu định mức
      </Button>
      <HousekeepingReusableChecklist items={query.data.reusableItems} />
    </Space>
  );
}
export function HousekeepingPresetsTab() {
  const [id, setId] = useState<string>();
  const types = useQuery({
    queryKey: ["roomTypes", "lookup"],
    queryFn: ({ signal }) => roomTypesApi.getLookup(signal),
  });
  return (
    <Card title="Định mức vật tư dọn phòng">
      <Typography.Paragraph type="secondary">
        Cấu hình lượng tiêu hao thường dùng cho mỗi lượt dọn. Nhân viên sẽ kiểm
        tra và điều chỉnh theo lượng thực tế. Khăn, ga tái sử dụng không thuộc
        danh sách này.
      </Typography.Paragraph>
      <Select
        style={{ width: "100%", maxWidth: 400, marginBottom: 24 }}
        placeholder="Chọn hạng phòng"
        loading={types.isLoading}
        value={id}
        onChange={setId}
        options={(types.data ?? [])
          .filter((type) => type.isActive)
          .map((type) => ({ value: type.id, label: type.name }))}
      />
      {types.isError && (
        <Alert
          type="error"
          title="Không tải được danh sách hạng phòng"
          action={<Button onClick={() => void types.refetch()}>Thử lại</Button>}
        />
      )}
      {id && <PresetForm key={id} id={id} />}
    </Card>
  );
}
