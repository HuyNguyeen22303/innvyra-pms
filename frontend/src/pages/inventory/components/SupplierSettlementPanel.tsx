import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  suppliesApi,
  type SupplierPayment,
} from "../../../api/supplies.api.ts";
import { supplierPaymentFromForm } from "../../../utils/supplierPayments.ts";
import { getInventoryErrorMessage } from "../../../api/inventory.api.ts";
import { inventoryQuantityInputProps } from "../../../utils/inventoryQuantity.ts";
import { money } from "../../../utils/subscriptions.ts";

export function SupplierPaymentFields({ maxAmount }: { maxAmount?: number }) {
  const method = Form.useWatch("supplierMethod");
  return (
    <>
      <Form.Item
        name="supplierAmount"
        label="Số tiền đã trả (VNĐ)"
        rules={[
          { required: true, message: "Nhập số tiền thực tế đã trả" },
          {
            type: "number",
            min: 0.01,
            ...(maxAmount != null ? { max: maxAmount } : {}),
            message: "Số tiền phải lớn hơn 0 và không vượt số còn phải trả",
          },
        ]}
      >
        <InputNumber
          style={{ width: "100%" }}
          min={0.01}
          max={maxAmount}
          precision={2}
          {...inventoryQuantityInputProps}
        />
      </Form.Item>
      <Form.Item
        name="supplierMethod"
        label="Phương thức thanh toán"
        rules={[{ required: true }]}
      >
        <Select
          options={[
            { value: "CASH", label: "Tiền mặt" },
            { value: "BANK_TRANSFER", label: "Chuyển khoản" },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="supplierPaidAt"
        label="Ngày giờ đã trả tiền"
        rules={[{ required: true }]}
      >
        <DatePicker
          showTime
          style={{ width: "100%" }}
          format="DD/MM/YYYY HH:mm"
          disabledDate={(date) => date.isAfter(dayjs(), "day")}
        />
      </Form.Item>
      <Form.Item
        name="supplierReference"
        label="Mã tham chiếu giao dịch"
        rules={[
          {
            required: method === "BANK_TRANSFER",
            message: "Nhập mã giao dịch chuyển khoản",
          },
        ]}
      >
        <Input maxLength={100} />
      </Form.Item>
    </>
  );
}
export function SupplierSettlementPanel({
  receiptId,
  open,
}: {
  receiptId: string;
  open: boolean;
}) {
  const { message } = App.useApp();
  const cache = useQueryClient();
  const [form] = Form.useForm(),
    [reverseForm] = Form.useForm();
  const [mode, setMode] = useState<"pay" | "reconcile" | null>(null),
    [requestKey, setRequestKey] = useState(""),
    [historical, setHistorical] = useState(false),
    [reversing, setReversing] = useState<SupplierPayment | null>(null);
  const query = useQuery({
    queryKey: ["inventory", "supplier-settlement", receiptId],
    enabled: open,
    queryFn: ({ signal }) => suppliesApi.settlement(receiptId, signal),
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["inventory"] });
    void cache.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        /report|dashboard/.test(query.queryKey[0]),
    });
  };
  const mutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      if (mode === "reconcile")
        return suppliesApi.reconcile(
          receiptId,
          values.reason.trim(),
          historical ? supplierPaymentFromForm(values, requestKey) : undefined,
        );
      return suppliesApi.pay(
        receiptId,
        supplierPaymentFromForm(values, requestKey),
      );
    },
    onSuccess: () => {
      void message.success("Đã ghi nhận thanh toán nhà cung cấp.");
      setMode(null);
      refresh();
    },
    onError: (error) =>
      void message.error(
        getInventoryErrorMessage(
          error,
          "Không thể ghi nhận. Kiểm tra dữ liệu và thử lại.",
        ),
      ),
  });
  const reversal = useMutation({
    mutationFn: async () => {
      const values = await reverseForm.validateFields();
      return suppliesApi.reverse(reversing!.id, values.reason.trim());
    },
    onSuccess: () => {
      void message.success("Đã đảo khoản chi và giữ lại lịch sử.");
      setReversing(null);
      refresh();
    },
    onError: (error) =>
      void message.error(
        getInventoryErrorMessage(error, "Không thể đảo khoản chi."),
      ),
  });
  const show = (value: "pay" | "reconcile") => {
    form.resetFields();
    form.setFieldsValue({
      supplierAmount: Number(
        query.data?.outstandingAmount ?? query.data?.totalAmount ?? 0,
      ),
      supplierMethod: "CASH",
      supplierPaidAt: dayjs(),
    });
    setRequestKey(crypto.randomUUID());
    setHistorical(false);
    setMode(value);
  };
  const labels = {
    UNRECONCILED: "Chưa đối soát",
    UNPAID: "Chưa thanh toán",
    PARTIAL: "Thanh toán một phần",
    PAID: "Đã thanh toán",
  };
  return (
    <div style={{ marginTop: 24 }}>
      <Typography.Title level={5}>Thanh toán nhà cung cấp</Typography.Title>
      {query.isPending && (
        <Typography.Text>Đang tải thanh toán…</Typography.Text>
      )}
      {query.isError && (
        <Alert
          type="error"
          title="Không tải được thông tin thanh toán"
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      )}
      {query.data && (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions
            size="small"
            bordered
            column={{ xs: 1, sm: 2 }}
            items={[
              {
                key: "status",
                label: "Tình trạng",
                children: (
                  <Tag
                    color={query.data.status === "PAID" ? "success" : "warning"}
                  >
                    {labels[query.data.status]}
                  </Tag>
                ),
              },
              {
                key: "total",
                label: "Giá trị hàng nhập",
                children: money(query.data.totalAmount),
              },
              {
                key: "paid",
                label: "Tiền đã trả theo sổ",
                children: money(query.data.paidAmount),
              },
              {
                key: "due",
                label: "Còn phải trả",
                children:
                  query.data.outstandingAmount == null
                    ? "Chưa xác minh"
                    : money(query.data.outstandingAmount),
              },
            ]}
          />
          {query.data.status === "UNRECONCILED" ? (
            <Alert
              type="warning"
              title="Phiếu cũ chưa được xác minh thanh toán"
              description="Đối chiếu chứng từ trước khi xác nhận số đã trả. Phiếu này chưa được tính vào tổng công nợ nhà cung cấp đã xác minh."
              action={
                <Button onClick={() => show("reconcile")}>
                  Đối soát phiếu
                </Button>
              }
            />
          ) : (
            Number(query.data.outstandingAmount) > 0 && (
              <Button type="primary" onClick={() => show("pay")}>
                Ghi nhận trả tiền nhà cung cấp
              </Button>
            )
          )}
          <Table<SupplierPayment>
            rowKey="id"
            size="small"
            dataSource={query.data.payments}
            pagination={false}
            scroll={{ x: 700 }}
            columns={[
              {
                title: "Ngày trả",
                dataIndex: "paidAt",
                render: (value) => dayjs(value).format("DD/MM/YYYY HH:mm"),
              },
              { title: "Số tiền", dataIndex: "amount", render: money },
              {
                title: "Phương thức",
                dataIndex: "paymentMethod",
                render: (value) =>
                  value === "CASH" ? "Tiền mặt" : "Chuyển khoản",
              },
              { title: "Tham chiếu", dataIndex: "referenceNumber" },
              {
                title: "Người ghi nhận",
                render: (_, row) => row.actor.fullName,
              },
              {
                title: "Trạng thái",
                render: (_, row) =>
                  row.reversal ? (
                    <Tag
                      color="default"
                      title={`${row.reversal.reason} · ${dayjs(row.reversal.reversedAt).format("DD/MM/YYYY HH:mm")} · ${row.reversal.actor.fullName}`}
                    >
                      Đã đảo
                    </Tag>
                  ) : (
                    <Button
                      danger
                      type="link"
                      onClick={() => {
                        reverseForm.resetFields();
                        setReversing(row);
                      }}
                    >
                      Đảo khoản chi
                    </Button>
                  ),
              },
            ]}
          />
        </Space>
      )}
      <Modal
        title={
          mode === "reconcile"
            ? "Đối soát thanh toán phiếu nhập"
            : "Ghi nhận khoản tiền đã trả"
        }
        open={mode != null}
        onCancel={() => setMode(null)}
        onOk={() => mutation.mutate()}
        confirmLoading={mutation.isPending}
        okText="Xác nhận ghi nhận"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {mode === "reconcile" && (
            <>
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                title="Chỉ xác nhận theo chứng từ đã kiểm tra"
                description="Nếu phiếu đã được trả tiền, nhập khoản đã trả và đúng ngày giao dịch. Nếu chưa trả, giữ lựa chọn chưa thanh toán."
              />
              <Checkbox
                style={{ marginBottom: 16 }}
                checked={historical}
                onChange={(event) => setHistorical(event.target.checked)}
              >
                Phiếu đã được thanh toán toàn bộ hoặc một phần
              </Checkbox>
              <Form.Item
                name="reason"
                label="Nội dung đối soát"
                rules={[{ required: true, whitespace: true }]}
              >
                <Input.TextArea maxLength={2000} />
              </Form.Item>
            </>
          )}
          {(mode === "pay" || historical) && (
            <SupplierPaymentFields
              maxAmount={Number(
                query.data?.outstandingAmount ?? query.data?.totalAmount ?? 0,
              )}
            />
          )}
          <Typography.Text type="secondary">
            Khoản chi được tính theo ngày trả tiền. Đây là xác nhận khoản tiền
            thực tế đã thanh toán.
          </Typography.Text>
        </Form>
      </Modal>
      <Modal
        title="Đảo khoản chi ghi nhầm"
        open={!!reversing}
        onCancel={() => setReversing(null)}
        onOk={() => reversal.mutate()}
        confirmLoading={reversal.isPending}
        okText="Xác nhận đảo"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <Typography.Paragraph>
          Lịch sử khoản chi được giữ lại. Khoản đảo được ghi nhận vào ngày hôm
          nay và số còn phải trả của phiếu được tính lại.
        </Typography.Paragraph>
        <Form form={reverseForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Lý do"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea maxLength={2000} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
