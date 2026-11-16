import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Col, InputNumber, Row, Select, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { inventoryApi } from "../../../api/inventory.api.ts";
import type {
  MaterialItem,
  MaterialUsageBasis,
} from "../../../api/supplies.api.ts";
import {
  formatInventoryQuantity,
  inventoryQuantityInputProps,
} from "../../../utils/inventoryQuantity.ts";
export interface MaterialDraft {
  key: string;
  itemId: string;
  quantity: number;
  usageBasis?: MaterialUsageBasis;
}
export function MaterialEditor({
  value,
  onChange,
  knownItems = [],
  actual = false,
  previewGuests = 1,
  suggestedAmounts = {},
}: {
  value: MaterialDraft[];
  onChange: (rows: MaterialDraft[]) => void;
  knownItems?: MaterialItem[];
  actual?: boolean;
  previewGuests?: number;
  suggestedAmounts?: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["inventory", "material-choices", search],
    queryFn: () =>
      inventoryApi.getItems({ page: 1, limit: 100, search, isActive: true }),
  });
  const items = [
    ...new Map(
      [...knownItems, ...(query.data?.data?.items ?? [])].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];
  const selected = new Set(value.map((row) => row.itemId));
  const available = (item: MaterialItem) =>
    item.isActive && item.materialType === "CONSUMABLE";
  const choices = items.filter(
    (item) => available(item) || selected.has(item.id),
  );
  const change = (key: string, fields: Partial<MaterialDraft>) =>
    onChange(
      value.map((row) => (row.key === key ? { ...row, ...fields } : row)),
    );
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      {value.map((row) => {
        const item = items.find((item) => item.id === row.itemId);
        return (
          <Row key={row.key} gutter={[8, 8]} align="middle">
            <Col xs={24} sm={actual ? 13 : 10}>
              <Select
                style={{ width: "100%" }}
                value={row.itemId || undefined}
                placeholder="Chọn vật tư tiêu hao"
                showSearch
                filterOption={false}
                onSearch={setSearch}
                loading={query.isFetching}
                onChange={(itemId) => change(row.key, { itemId })}
                options={choices.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.unit})${available(item) ? "" : " · Không khả dụng"}`,
                  disabled: !available(item),
                }))}
              />
            </Col>
            <Col xs={12} sm={actual ? 6 : 4}>
              <InputNumber
                style={{ width: "100%" }}
                min={actual ? 0 : 0.01}
                precision={2}
                {...inventoryQuantityInputProps}
                value={row.quantity}
                onChange={(qty) =>
                  change(row.key, { quantity: Number(qty ?? 0) })
                }
                aria-label={actual ? "Số lượng thực dùng" : "Định mức sử dụng"}
              />
            </Col>
            {!actual && (
              <Col xs={12} sm={5}>
                <Select
                  aria-label="Cách tính định mức"
                  style={{ width: "100%" }}
                  value={row.usageBasis ?? "PER_ROOM"}
                  onChange={(usageBasis) => change(row.key, { usageBasis })}
                  options={[
                    { value: "PER_GUEST", label: "Cho 1 khách" },
                    { value: "PER_ROOM", label: "Cho 1 phòng" },
                  ]}
                />
              </Col>
            )}
            <Col xs={9} sm={3}>
              <Typography.Text type="secondary">
                {actual && item ? (
                  <>
                    <div>Tồn {formatInventoryQuantity(item.currentStock)}</div>
                    {suggestedAmounts[row.itemId] != null && (
                      <div style={{ fontSize: 12 }}>
                        Gợi ý{" "}
                        {formatInventoryQuantity(suggestedAmounts[row.itemId])}{" "}
                        {item.unit}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {item?.unit}
                    <div style={{ fontSize: 12 }}>
                      Chuẩn{" "}
                      {formatInventoryQuantity(
                        row.quantity *
                          ((row.usageBasis ?? "PER_ROOM") === "PER_GUEST"
                            ? previewGuests
                            : 1),
                      )}
                    </div>
                  </>
                )}
              </Typography.Text>
            </Col>
            <Col xs={3} sm={2}>
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                aria-label="Xóa vật tư"
                onClick={() =>
                  onChange(value.filter((item) => item.key !== row.key))
                }
              />
            </Col>
          </Row>
        );
      })}
      <Button
        icon={<PlusOutlined />}
        onClick={() =>
          onChange([
            ...value,
            {
              key: crypto.randomUUID(),
              itemId: "",
              quantity: 1,
              usageBasis: "PER_ROOM",
            },
          ])
        }
      >
        Thêm vật tư
      </Button>
      {query.isError && (
        <Typography.Text type="danger">
          Không tải được danh sách vật tư.{" "}
          <Button type="link" onClick={() => void query.refetch()}>
            Thử lại
          </Button>
        </Typography.Text>
      )}
    </Space>
  );
}
