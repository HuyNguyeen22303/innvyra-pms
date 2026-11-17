import { useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  App,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Button,
} from "antd";
import { billingApi, createIdempotencyKey } from "../../../api/billing.api.ts";
import type {
  FolioDetailItem,
  TerminalSettlementDto,
} from "../../../types/billing.types.ts";
import {
  formatFolioMoney,
  terminalSettlementAmounts,
  validFinalCharge,
} from "../../../utils/folioSettlement.ts";

interface Props {
  folioId: string;
  open: boolean;
  onCancel: () => void;
  onSettled: (folio: FolioDetailItem) => void;
}

export function TerminalSettlementModal({
  folioId,
  open,
  onCancel,
  onSettled,
}: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const finalCharge = Form.useWatch("finalChargeAmount", form);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const preview = useQuery({
    queryKey: ["billing-terminal-settlement", folioId],
    queryFn: () => billingApi.getTerminalSettlement(folioId),
    enabled: open,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const state = preview.data?.data;
  const blocked =
    !!state &&
    !!(state.activeStays || state.pendingOrders || state.pendingPayments);
  const amounts =
    state && validFinalCharge(finalCharge)
      ? terminalSettlementAmounts(
          state.folio.netCharges,
          state.folio.netPaid,
          finalCharge,
        )
      : null;
  const mutation = useMutation({
    mutationFn: (dto: TerminalSettlementDto) => {
      const payload = JSON.stringify(dto);
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: createIdempotencyKey("settle") };
      return billingApi.settleTerminalFolio(folioId, dto, attempt.current.key);
    },
    onSuccess: ({ data }) => {
      attempt.current = null;
      message.success(
        data.status === "CLOSED"
          ? "Đã quyết toán và đóng folio."
          : "Đã lưu tổng phí quyết toán. Tiếp tục xử lý số tiền còn lại.",
      );
      onSettled(data);
    },
    onError: (error: any) => {
      message.error(
        error.response?.data?.error?.message ||
          "Chưa xác nhận được kết quả. Gửi lại cùng thông tin để kiểm tra.",
      );
      if (error.response?.data?.error?.code === "SETTLEMENT_STALE") {
        form.setFieldValue("confirmedReviewed", false);
        void preview.refetch();
      }
    },
  });
  return (
    <Modal
      title="Quyết toán đơn hủy / Không đến"
      open={open}
      width={680}
      onCancel={() => {
        if (!mutation.isPending) onCancel();
      }}
      afterClose={() => {
        form.resetFields();
        attempt.current = null;
      }}
      onOk={() => form.submit()}
      okText={
        amounts?.outstanding === "0.00"
          ? "Xác nhận và đóng folio"
          : "Lưu quyết toán"
      }
      cancelText="Để sau"
      confirmLoading={mutation.isPending}
      okButtonProps={{
        disabled: !state || blocked || preview.isFetching || preview.isError,
      }}
      cancelButtonProps={{ disabled: mutation.isPending }}
      maskClosable={false}
    >
      {preview.isFetching ? (
        <Spin />
      ) : preview.isError ? (
        <Alert
          type="error"
          showIcon
          title="Chưa tải được đối soát"
          action={
            <Button onClick={() => void preview.refetch()}>Tải lại</Button>
          }
        />
      ) : (
        state && (
          <Space orientation="vertical" style={{ width: "100%" }} size={16}>
            <Descriptions
              column={1}
              size="small"
              bordered
              items={[
                {
                  key: "status",
                  label: "Trạng thái đơn",
                  children:
                    state.reservationStatus === "NO_SHOW"
                      ? "Khách không đến"
                      : "Đã hủy",
                },
                {
                  key: "charges",
                  label: "Phí hiện tại sau điều chỉnh",
                  children: formatFolioMoney(state.folio.netCharges),
                },
                {
                  key: "received",
                  label: "Đã thu (gồm đặt cọc)",
                  children: `${formatFolioMoney(state.folio.totalPayments)} + ${formatFolioMoney(state.folio.totalDeposits)}`,
                },
                {
                  key: "refunds",
                  label: "Đã hoàn",
                  children: formatFolioMoney(state.folio.totalRefunds),
                },
                {
                  key: "paid",
                  label: "Tiền đang giữ của khách",
                  children: formatFolioMoney(state.folio.netPaid),
                },
              ]}
            />
            {blocked && (
              <Alert
                type="warning"
                showIcon
                title="Chưa đủ điều kiện quyết toán"
                description={`Còn ${state.activeStays} lượt lưu trú đang hoạt động, ${state.pendingOrders} dịch vụ chờ và ${state.pendingPayments} thanh toán chờ. Hoàn tất các mục này rồi tải lại.`}
                action={
                  <Button onClick={() => void preview.refetch()}>
                    Tải lại
                  </Button>
                }
              />
            )}
            <Form
              form={form}
              layout="vertical"
              disabled={blocked || mutation.isPending}
              onFinish={(values) =>
                mutation.mutate({
                  finalChargeAmount: values.finalChargeAmount,
                  reason: values.reason.trim(),
                  expectedRevision: state.revision,
                  confirmedReviewed: true,
                })
              }
            >
              <Form.Item
                name="finalChargeAmount"
                label="Tổng phí cuối cùng giữ lại (VND)"
                extra="Nhập toàn bộ phí khách phải chịu: phí hủy/không đến và các khoản khác đã thỏa thuận. Nhập 0 khi miễn toàn bộ."
                rules={[
                  { required: true, message: "Nhập tổng phí cuối cùng" },
                  {
                    validator: async (_, value) => {
                      if (!validFinalCharge(value))
                        throw new Error(
                          "Nhập số đồng nguyên, không âm, tối đa 16 chữ số",
                        );
                    },
                  },
                ]}
              >
                <InputNumber<string>
                  stringMode
                  precision={0}
                  min="0"
                  max="9999999999999999"
                  style={{ width: "100%" }}
                  placeholder="Nhập mức phí đã đối soát"
                  formatter={(value) =>
                    `${value ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                  }
                  parser={(value) => (value ?? "").replace(/[.\s₫]/g, "")}
                />
              </Form.Item>
              {amounts && (
                <Alert
                  type={amounts.outstanding === "0.00" ? "success" : "info"}
                  showIcon
                  style={{ marginBottom: 16 }}
                  title={
                    amounts.outstanding === "0.00"
                      ? "Số dư sau quyết toán bằng 0 — folio sẽ đóng"
                      : amounts.refundDue !== "0.00"
                        ? `Cần hoàn khách: ${formatFolioMoney(amounts.refundDue)}`
                        : `Cần thu thêm: ${formatFolioMoney(amounts.collectionDue)}`
                  }
                  description={`Điều chỉnh phí: ${formatFolioMoney(amounts.adjustment)}. ${amounts.outstanding === "0.00" ? "" : "Folio tiếp tục mở để ghi nhận tiền thực tế, sau đó đóng sổ."}`}
                />
              )}
              <Form.Item
                name="reason"
                label="Căn cứ và lý do quyết toán"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Nhập căn cứ áp dụng/miễn phí và lý do",
                  },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={2000}
                  showCount
                  placeholder="Chính sách đặt phòng, thỏa thuận với khách, lý do miễn hoặc giữ phí..."
                />
              </Form.Item>
              <Form.Item
                name="confirmedReviewed"
                valuePropName="checked"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (value !== true)
                        throw new Error(
                          "Cần xác nhận đã đối soát trước khi lưu",
                        );
                    },
                  },
                ]}
              >
                <Checkbox>
                  Tôi đã đối soát toàn bộ phí và tiền đã thu/hoàn, đồng ý tổng
                  phí cuối cùng ở trên.
                </Checkbox>
              </Form.Item>
            </Form>
          </Space>
        )
      )}
    </Modal>
  );
}
