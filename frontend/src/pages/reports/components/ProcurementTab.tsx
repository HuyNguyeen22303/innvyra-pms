import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
} from "antd";
import dayjs from "dayjs";
import { suppliesApi } from "../../../api/supplies.api.ts";
import { inventoryApi } from "../../../api/inventory.api.ts";
import { formatInventoryQuantity } from "../../../utils/inventoryQuantity.ts";
import { money } from "../../../utils/subscriptions.ts";
import { BarComparisonChart } from "../../../components/charts/BarComparisonChart.tsx";
import { PaginatedSelect } from "../../../components/PaginatedSelect.tsx";
import { SupplierSettlementPanel } from "../../inventory/components/SupplierSettlementPanel.tsx";
import { Modal } from "antd";
export function ProcurementTab({
  startDateStr,
  endDateStr,
  groupBy,
}: {
  startDateStr: string;
  endDateStr: string;
  groupBy: "day" | "month";
}) {
  const [supplierId, setSupplierId] = useState<string>(),
    [categoryId, setCategoryId] = useState<string>(),
    [page, setPage] = useState(1),
    [receiptId, setReceiptId] = useState<string | null>(null);
  const purchases = useQuery({
    queryKey: [
      "reports",
      "procurement",
      startDateStr,
      endDateStr,
      groupBy,
      supplierId,
      categoryId,
    ],
    queryFn: ({ signal }) =>
      suppliesApi.procurement(
        {
          startDate: startDateStr,
          endDate: endDateStr,
          groupBy,
          supplierId,
          categoryId,
        },
        signal,
      ),
  });
  const finance = useQuery({
    queryKey: ["reports", "supplier-finance", startDateStr, endDateStr, page],
    queryFn: ({ signal }) =>
      suppliesApi.finance(
        { startDate: startDateStr, endDate: endDateStr, page, limit: 10 },
        signal,
      ),
  });
  const summary = purchases.data?.summary;
  return (
    <Space orientation="vertical" size={20} style={{ width: "100%" }}>
      {(purchases.isError || finance.isError) && (
        <Alert
          type="error"
          title="Chưa tải đủ báo cáo mua hàng và thanh toán"
          action={
            <Button
              onClick={() => {
                void purchases.refetch();
                void finance.refetch();
              }}
            >
              Thử lại
            </Button>
          }
        />
      )}
      <Card title="Chi tiền & Công nợ nhà cung cấp">
        <Typography.Paragraph type="secondary">
          Tiền chi tính theo ngày trả trong kỳ. Công nợ tính lũy kế đến hết kỳ
          đã chọn, theo giao dịch được ghi nhận. Các số này bao gồm toàn bộ nhà
          cung cấp và không phụ thuộc bộ lọc giá trị nhập bên dưới.
        </Typography.Paragraph>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Statistic
              title="Chi mua vật tư thuần trong kỳ"
              value={finance.data ? money(finance.data.netPaidOut) : "—"}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title="Công nợ nhà cung cấp đã xác minh"
              value={finance.data ? money(finance.data.outstandingAmount) : "—"}
            />
          </Col>
        </Row>
        {!!finance.data?.unreconciledCount && (
          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            title={`${finance.data.unreconciledCount} phiếu chưa đối soát · Giá trị ${money(finance.data.unreconciledValue)}`}
            description="Chưa xác minh tiền đã trả của các phiếu này, nên chưa cộng vào tổng công nợ đã xác minh."
          />
        )}
      </Card>
      <Card title="Phiếu còn phải trả & Chưa đối soát">
        <Table
          rowKey="id"
          loading={finance.isFetching}
          dataSource={finance.data?.items ?? []}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            pageSize: 10,
            total: finance.data?.pagination.total ?? 0,
            onChange: setPage,
          }}
          columns={[
            {
              title: "Phiếu nhập",
              dataIndex: "receiptNumber",
              render: (value, row) => (
                <Button type="link" onClick={() => setReceiptId(row.id)}>
                  {value}
                </Button>
              ),
            },
            {
              title: "Ngày nhập",
              dataIndex: "receiptDate",
              render: (value) => dayjs(value).format("DD/MM/YYYY"),
            },
            {
              title: "Nhà cung cấp",
              dataIndex: "supplierName",
              render: (value) => value || "Mua trực tiếp / Chưa có NCC",
            },
            { title: "Giá trị nhập", dataIndex: "totalAmount", render: money },
            {
              title: "Còn phải trả",
              dataIndex: "outstandingAmount",
              render: (value) =>
                value == null ? "Chưa đối soát" : money(value),
            },
          ]}
        />
      </Card>
      <Card title="Giá trị vật tư nhập kho">
        <Space wrap style={{ marginBottom: 20 }}>
          <PaginatedSelect
            allowClear
            placeholder="Tất cả nhà cung cấp"
            style={{ width: 250 }}
            value={supplierId}
            onChange={setSupplierId}
            lookupKey={['inventory', 'suppliers', 'all']}
            loadPage={inventoryApi.getSuppliers}
            loadSelected={inventoryApi.getSupplierById}
            formatOption={(row) => row.name}
          />
          <PaginatedSelect
            allowClear
            placeholder="Tất cả nhóm vật tư"
            style={{ width: 230 }}
            value={categoryId}
            onChange={setCategoryId}
            lookupKey={['inventory', 'categories', 'all']}
            loadPage={inventoryApi.getCategories}
            loadSelected={inventoryApi.getCategoryById}
            formatOption={(row) => row.name}
          />
        </Space>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Statistic
              title="Giá trị hàng nhập trong kỳ"
              value={summary ? money(summary.totalExpense) : "—"}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="Số phiếu nhập"
              value={summary?.receiptCount ?? "—"}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="Số mã vật tư nhập"
              value={summary?.distinctItemCount ?? "—"}
            />
          </Col>
        </Row>
        <Typography.Paragraph type="secondary">
          Giá trị hàng đã nhận theo ngày nhập, không phải số tiền đã thanh toán.
          Bộ lọc áp dụng thống nhất cho biểu đồ và các bảng giá trị nhập.
        </Typography.Paragraph>
        <BarComparisonChart
          data={
            purchases.data?.series.map((row) => ({
              key: row.date,
              label: dayjs(row.date).format(
                groupBy === "month" ? "MM/YYYY" : "DD/MM",
              ),
              value1: Number(row.totalExpense),
              value2: 0,
            })) ?? []
          }
          series1Label="Giá trị nhập"
          series2Label=""
          valueFormatter={(value) => money(String(value))}
        />
      </Card>
      <Row gutter={[16, 16]} style={{ width: "100%", margin: 0 }}>
        <Col xs={24} lg={12}>
          <Card title="Theo nhóm vật tư">
            <Table
              rowKey="categoryId"
              pagination={false}
              dataSource={purchases.data?.byCategory ?? []}
              columns={[
                { title: "Nhóm", dataIndex: "categoryName" },
                {
                  title: "Giá trị nhập",
                  dataIndex: "totalAmount",
                  render: money,
                },
                {
                  title: "Tỷ trọng",
                  dataIndex: "percentage",
                  render: (value) => `${value}%`,
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Theo nhà cung cấp">
            <Table
              rowKey={(row) => row.supplierId ?? "direct"}
              pagination={false}
              dataSource={purchases.data?.bySupplier ?? []}
              columns={[
                { title: "Nhà cung cấp", dataIndex: "supplierName" },
                { title: "Số phiếu", dataIndex: "receiptCount" },
                {
                  title: "Giá trị nhập",
                  dataIndex: "totalAmount",
                  render: money,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Vật tư có giá trị nhập cao">
        <Table
          rowKey="itemId"
          loading={purchases.isFetching}
          pagination={false}
          dataSource={purchases.data?.topItems ?? []}
          scroll={{ x: 700 }}
          columns={[
            { title: "Mã", dataIndex: "sku" },
            { title: "Vật tư", dataIndex: "name" },
            { title: "Đơn vị", dataIndex: "unit" },
            {
              title: "Số lượng nhập",
              dataIndex: "totalQuantity",
              render: formatInventoryQuantity,
            },
            { title: "Giá trị", dataIndex: "totalAmount", render: money },
          ]}
        />
      </Card>
      <Modal
        title="Thanh toán phiếu nhập"
        open={!!receiptId}
        onCancel={() => setReceiptId(null)}
        footer={null}
        width={950}
        destroyOnHidden
      >
        {receiptId && (
          <SupplierSettlementPanel key={receiptId} receiptId={receiptId} open />
        )}
      </Modal>
    </Space>
  );
}
