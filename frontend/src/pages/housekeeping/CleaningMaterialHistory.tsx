import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { inventoryApi } from "../../api/inventory.api.ts";
import { IssueDetailModal } from "../inventory/components/IssueDetailModal.tsx";
import { Alert, Button, Card, Empty, Space, Typography } from "antd";
import dayjs from "dayjs";
import { suppliesApi } from "../../api/supplies.api.ts";
import { useAuthStore } from "../../store/authStore.ts";
import { formatInventoryQuantity } from "../../utils/inventoryQuantity.ts";
export function CleaningMaterialHistory({ taskId }: { taskId: string }) {
  const [issueId, setIssueId] = useState<string | null>(null);
  const role = useAuthStore((state) => state.user?.role);
  const allowed = ["ADMIN", "MANAGER", "HOUSEKEEPING"].includes(role ?? "");
  const query = useQuery({
    queryKey: ["inventory", "task-material-history", taskId],
    enabled: allowed,
    queryFn: ({ signal }) => suppliesApi.task(taskId, signal),
  });
  const issue = useQuery({
    queryKey: ["inventory", "cleaning-issue", issueId],
    enabled: allowed && !!issueId,
    queryFn: () => inventoryApi.getIssueById(issueId!),
  });
  if (!allowed) return null;
  return (
    <Card
      title="Vật tư đã sử dụng"
      size="small"
      style={{ marginBottom: 20 }}
      loading={query.isPending}
    >
      {query.isError && (
        <Alert
          type="error"
          title="Không tải được lịch sử vật tư"
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      )}
      {query.data?.history.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có ghi nhận vật tư cho nhiệm vụ này"
        />
      )}
      <Space orientation="vertical" style={{ width: "100%" }}>
        {query.data?.history.map((row) => (
          <div key={row.id}>
            {row.stockIssueId ? (
              <Button
                type="link"
                loading={issueId === row.stockIssueId && issue.isFetching}
                onClick={() => setIssueId(row.stockIssueId)}
              >
                {row.issueNumber}
              </Button>
            ) : (
              <Typography.Text strong>Không dùng vật tư</Typography.Text>
            )}
            <div>
              {row.actor.fullName} ·{" "}
              {dayjs(row.createdAt).format("DD/MM/YYYY HH:mm")}
            </div>
            {row.materials.map((line) => (
              <div key={line.itemId}>
                {line.item.name}: {formatInventoryQuantity(line.quantity)}{" "}
                {line.item.unit}
              </div>
            ))}
            {row.preparedAdults != null && (
              <Typography.Text type="secondary">
                Chuẩn bị: {row.preparedAdults} người lớn +{" "}
                {row.preparedChildren ?? 0} trẻ em.
              </Typography.Text>
            )}
            {row.noMaterialsReason && (
              <Typography.Text type="secondary">
                {row.noMaterialsReason}
              </Typography.Text>
            )}
          </div>
        ))}
      </Space>
      {issue.isError && (
        <Alert
          type="error"
          title="Không tải được phiếu xuất"
          action={<Button onClick={() => void issue.refetch()}>Thử lại</Button>}
        />
      )}
      <IssueDetailModal
        open={!!issueId && !!issue.data}
        issue={issue.data?.data ?? null}
        onClose={() => setIssueId(null)}
      />
    </Card>
  );
}
