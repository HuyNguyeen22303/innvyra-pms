import { ResponsiveTable as Table } from '../../../components/responsive/ResponsiveTable.tsx';
import { Collapse, Typography } from "antd";
import type { MaterialItem } from "../../../api/supplies.api.ts";
import { formatInventoryQuantity } from "../../../utils/inventoryQuantity.ts";
export function HousekeepingReusableChecklist({
  items,
}: {
  items: MaterialItem[];
}) {
  return (
    <Collapse
      style={{ width: "100%" }}
      items={[
        {
          key: "reusable",
          label: `Đồ vải & dụng cụ tái sử dụng (${items.length})`,
          children: (
            <>
              <Typography.Paragraph type="secondary">
                Kiểm tra để chuẩn bị phòng và xe đẩy. Không trừ các dụng cụ này
                theo từng lượt dọn; cấp mới hoặc thay hỏng qua phiếu xuất kho.
                Đồ vải theo dõi thu hồi và giặt riêng.
              </Typography.Paragraph>
              <Table<MaterialItem>
                size="small"
                rowKey="id"
                pagination={false}
                scroll={{ x: 650 }}
                dataSource={items}
                columns={[
                  { title: "Vật tư / Dụng cụ", dataIndex: "name", width: 210 },
                  {
                    title: "Tồn kho",
                    render: (_, row) =>
                      `${formatInventoryQuantity(row.currentStock)} ${row.unit}`,
                    width: 110,
                  },
                  {
                    title: "Cách bố trí / Sử dụng",
                    dataIndex: "description",
                    render: (value) =>
                      value ||
                      "Theo nhu cầu thực tế và quy trình của khách sạn.",
                  },
                ]}
              />
            </>
          ),
        },
      ]}
    />
  );
}
