import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  Space,
  Spin,
  Typography,
  Row,
  Col,
  InputNumber,
} from "antd";
import type { HousekeepingTaskItem } from "../../types/operations.types.ts";
import {
  suppliesApi,
  type CompleteMaterialsDto,
} from "../../api/supplies.api.ts";
import {
  MaterialEditor,
  type MaterialDraft,
} from "../inventory/components/MaterialEditor.tsx";
import { formatInventoryQuantity } from "../../utils/inventoryQuantity.ts";
import { cleaningSuggestions } from "../../utils/housekeepingMaterials.ts";
import { HousekeepingReusableChecklist } from "../inventory/components/HousekeepingReusableChecklist.tsx";
interface CompleteCleaningProps {
  open: boolean;
  task: HousekeepingTaskItem | null;
  confirmLoading: boolean;
  onCancel: () => void;
  onConfirm: (body: CompleteMaterialsDto) => void;
}

export function CompleteCleaningModal(props: CompleteCleaningProps) {
  return props.open && props.task ? (
    <CleaningDialog
      key={`${props.task.id}:${props.task.workToken}`}
      {...props}
    />
  ) : null;
}

function CleaningDialog({
  open,
  task,
  confirmLoading,
  onCancel,
  onConfirm,
}: CompleteCleaningProps) {
  const [draft, setDraft] = useState<MaterialDraft[] | null>(null),
    [notes, setNotes] = useState(""),
    [reason, setReason] = useState(""),
    [none, setNone] = useState(false),
    [error, setError] = useState("");
  const [preparedAdults, setPreparedAdults] = useState<number | null>(null),
    [preparedChildren, setPreparedChildren] = useState(0);
  const query = useQuery({
    queryKey: ["inventory", "task-materials", task?.id, task?.workToken],
    enabled: open && !!task,
    queryFn: ({ signal }) => suppliesApi.task(task!.id, signal),
  });
  const adults = preparedAdults ?? query.data?.preparation.adults ?? 1;
  const suggestions = cleaningSuggestions(
    query.data?.materials ?? [],
    adults,
    preparedChildren,
  );
  const rows =
    draft ??
    cleaningSuggestions(
      query.data?.materials ?? [],
      adults,
      preparedChildren,
      true,
    );
  const submit = () => {
    if (!query.data?.workToken) {
      setError("Chưa có lượt dọn đang thực hiện. Vui lòng tải lại nhiệm vụ.");
      return;
    }
    if (!none && rows.some((row) => !row.itemId)) {
      setError("Vui lòng chọn vật tư cho các dòng đã thêm.");
      return;
    }
    const materials = none
      ? []
      : rows
          .filter((row) => row.quantity > 0)
          .map((row) => ({
            itemId: row.itemId,
            quantity: row.quantity.toFixed(2),
          }));
    if (!materials.length && (!none || !reason.trim())) {
      setError("Nếu không dùng vật tư, hãy xác nhận và ghi rõ lý do.");
      return;
    }
    setError("");
    onConfirm({
      workToken: query.data.workToken,
      materials,
      preparedAdults: adults,
      preparedChildren,
      ...(!materials.length ? { noMaterialsReason: reason.trim() } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  };
  return (
    <Modal
      title={`Hoàn thành dọn phòng ${task?.room.roomNumber ?? ""}`}
      open={open}
      width={1050}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      onCancel={onCancel}
      onOk={submit}
      okText="Ghi nhận vật tư & Gửi nghiệm thu"
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: query.isPending || query.isError }}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: "100%" }} size={16}>
        <Alert
          type="info"
          showIcon
          title="Kiểm tra lượng vật tư thực dùng"
          description="Chọn số khách sắp đón, kiểm tra vật tư còn trong phòng rồi nhập phần thực xuất bổ sung. Chỉ lượng bạn xác nhận mới được trừ kho. Vật tư còn nguyên và đủ dùng không cần cấp mới."
        />
        {query.isPending && <Spin />}
        {query.isError && (
          <Alert
            type="error"
            title="Không tải được định mức và lịch sử vật tư"
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        )}
        {error && <Alert type="error" title={error} />}
        {query.data && (
          <>
            <Row gutter={[16, 12]}>
              <Col xs={12} sm={7}>
                <Typography.Text strong>Người lớn cần chuẩn bị</Typography.Text>
                <InputNumber
                  aria-label="Người lớn cần chuẩn bị"
                  style={{ width: "100%" }}
                  min={1}
                  max={query.data.roomType.maxAdults}
                  value={adults}
                  precision={0}
                  onChange={(value) => {
                    setPreparedAdults(Number(value ?? 1));
                    setDraft(null);
                  }}
                />
              </Col>
              <Col xs={12} sm={7}>
                <Typography.Text strong>Trẻ em cần chuẩn bị</Typography.Text>
                <InputNumber
                  aria-label="Trẻ em cần chuẩn bị"
                  style={{ width: "100%" }}
                  min={0}
                  max={query.data.roomType.maxChildren}
                  value={preparedChildren}
                  precision={0}
                  onChange={(value) => {
                    setPreparedChildren(Number(value ?? 0));
                    setDraft(null);
                  }}
                />
              </Col>
              <Col xs={24} sm={10}>
                <Typography.Text type="secondary">
                  {query.data.roomType.name}: tối đa{" "}
                  {query.data.roomType.maxAdults} người lớn +{" "}
                  {query.data.roomType.maxChildren} trẻ em. Đổi số khách sẽ đặt
                  lại lượng gợi ý. Chọn vật dụng phù hợp độ tuổi.
                </Typography.Text>
              </Col>
            </Row>
            <Checkbox
              checked={none}
              onChange={(event) => setNone(event.target.checked)}
            >
              Lượt này không sử dụng vật tư tiêu hao
            </Checkbox>
            {none ? (
              <Input.TextArea
                placeholder="Lý do không sử dụng vật tư"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={2000}
              />
            ) : (
              <Space orientation="vertical" style={{ width: "100%" }}>
                {!query.data.history.length && (
                  <Button onClick={() => setDraft(suggestions)}>
                    Điền lượng gợi ý khi cấp mới toàn bộ
                  </Button>
                )}
                <Typography.Text type="secondary">
                  Lượng thực xuất ban đầu là 0. Nhập đúng phần lấy từ kho; vật
                  tư còn đủ trong phòng không cần xuất thêm.
                </Typography.Text>
                <MaterialEditor
                  actual
                  value={rows}
                  onChange={setDraft}
                  knownItems={query.data.materials.map((line) => line.item)}
                  suggestedAmounts={Object.fromEntries(
                    suggestions.map((row) => [row.itemId, row.quantity]),
                  )}
                />
              </Space>
            )}
            {!query.data.materials.length && !none && (
              <Typography.Text type="secondary">
                Hạng phòng chưa có định mức. Bạn có thể chọn vật tư thực dùng.
              </Typography.Text>
            )}
            {!!query.data.history.length && (
              <Alert
                type="warning"
                title="Các lượt trước đã được ghi nhận"
                description={
                  <>
                    {query.data.history.map((row) => (
                      <div key={row.id}>
                        {row.issueNumber ?? "Không dùng vật tư"}:{" "}
                        {row.materials
                          .map(
                            (line) =>
                              `${line.item.name} × ${formatInventoryQuantity(line.quantity)} ${line.item.unit}`,
                          )
                          .join(", ") || row.noMaterialsReason}
                      </div>
                    ))}
                    <div>Chỉ nhập phần vật tư dùng bổ sung trong lượt này.</div>
                  </>
                }
              />
            )}
            <HousekeepingReusableChecklist items={query.data.reusableItems} />
          </>
        )}
        <Input.TextArea
          placeholder="Ghi chú công việc (tùy chọn)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={2000}
        />
      </Space>
    </Modal>
  );
}
