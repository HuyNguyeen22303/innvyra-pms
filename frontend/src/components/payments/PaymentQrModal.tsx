import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Radio,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import {
  paymentQrApi,
  type PaymentQrRequest,
  type QrCollectionInput,
} from "../../api/paymentQr.api.ts";
import { createIdempotencyKey } from "../../api/billing.api.ts";
import { formatFolioMoney } from "../../utils/folioSettlement.ts";
import { validQrAmount } from "../../utils/paymentQr.ts";
import { useAuthStore } from "../../store/authStore.ts";

type Attempt = { key: string } & (
  | { kind: "create"; input: QrCollectionInput }
  | {
      kind: "confirm";
      id: string;
      input: { referenceNumber: string; confirmedReceived: true };
    }
  | { kind: "cancel"; id: string; reason: string }
);
const errorText = (error: unknown) =>
  axios.isAxiosError(error)
    ? String(
        error.response?.data?.error?.message ??
          "Chưa nhận được kết quả. Kiểm tra kết nối và thử lại.",
      )
    : error instanceof Error
      ? error.message
      : "Không thể thực hiện thao tác";
export function PaymentQrModal({
  reservationId,
  initialAmount,
  initialType = "DEPOSIT",
  autoCreate = false,
  allowDeposit = true,
  onClose,
  onConfirmed,
}: {
  reservationId: string;
  initialAmount?: string;
  initialType?: "DEPOSIT" | "PAYMENT";
  autoCreate?: boolean;
  allowDeposit?: boolean;
  onClose: () => void;
  onConfirmed?: (request: PaymentQrRequest) => void;
}) {
  const client = useQueryClient(),
    actor = useAuthStore((s) => s.user?.id);
  const [form] = Form.useForm<QrCollectionInput>(),
    [confirmForm] = Form.useForm();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null),
    [reason, setReason] = useState("");
  const [uncertain, setUncertain] = useState<Attempt | null>(null);
  const started = useRef(false),
    busy = useRef(false);
  const list = useQuery({
    queryKey: ["payment-qr", actor, reservationId, page],
    queryFn: ({ signal }) => paymentQrApi.list(reservationId, page, signal),
    refetchOnWindowFocus: true,
  });
  const account = useQuery({
    queryKey: ["hotel-bank-account", actor],
    queryFn: ({ signal }) => paymentQrApi.account(signal),
    refetchOnWindowFocus: true,
  });
  const pendingRequest = list.data?.items.find((r) => r.status === "PENDING");
  const activeId = selected ?? pendingRequest?.id ?? null;
  const detail = useQuery({
    queryKey: ["payment-qr-detail", actor, activeId],
    queryFn: ({ signal }) => paymentQrApi.detail(activeId!, signal),
    enabled: !!activeId,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" ? 15000 : false,
  });
  const current = detail.data;
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["payment-qr"] });
    void client.invalidateQueries({ queryKey: ["payment-qr-detail"] });
    void client.invalidateQueries({
      predicate: ({ queryKey }) =>
        /^(billing|report|dashboard|reservations)/.test(String(queryKey[0])),
    });
  };
  const mutation = useMutation({
    mutationFn: (attempt: Attempt) =>
      attempt.kind === "create"
        ? paymentQrApi.create(reservationId, attempt.input, attempt.key)
        : attempt.kind === "confirm"
          ? paymentQrApi.confirm(attempt.id, attempt.input, attempt.key)
          : paymentQrApi.cancel(attempt.id, attempt.reason, attempt.key),
    onSuccess: (result, attempt) => {
      if (useAuthStore.getState().user?.id !== actor) return;
      setSelected(result.id);
      setUncertain(null);
      setError(null);
      refresh();
      if (attempt.kind === "confirm") {
        confirmForm.resetFields();
        onConfirmed?.(result);
      }
    },
    onError: (failure, attempt) => {
      setError(errorText(failure));
      if (
        !axios.isAxiosError(failure) ||
        !failure.response ||
        failure.response.status >= 500
      )
        setUncertain(attempt);
      else {
        setUncertain(null);
        if (activeId) void detail.refetch();
      }
    },
    onSettled: () => {
      busy.current = false;
    },
  });
  const { mutate } = mutation;
  const run = (attempt: Attempt) => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    mutation.mutate(uncertain ?? attempt);
  };
  useEffect(() => {
    const pending = list.data?.items.find((r) => r.status === "PENDING");
    if (!started.current && autoCreate && list.isSuccess && account.isSuccess) {
      started.current = true;
      if (!pending && account.data?.enabled && validQrAmount(initialAmount)) {
        busy.current = true;
        mutate({
          kind: "create",
          key: createIdempotencyKey("qr-create"),
          input: { paymentType: initialType, amount: initialAmount },
        });
      }
    }
  }, [
    list.data,
    list.isSuccess,
    account.data,
    account.isSuccess,
    autoCreate,
    initialAmount,
    initialType,
    mutate,
  ]);
  const locked = mutation.isPending || !!uncertain;
  return (
    <Modal
      open
      title="Nhận chuyển khoản bằng QR"
      width={720}
      onCancel={() => {
        if (!locked) onClose();
      }}
      closable={!locked}
      maskClosable={false}
      footer={
        <Button disabled={locked} onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          Đơn #{reservationId} đã được lưu. Chỉ xác nhận sau khi kiểm tra tiền
          thực tế vào tài khoản khách sạn.
        </Typography.Text>
        {error && <Alert type="error" showIcon title={error} />}
        {uncertain && (
          <Alert
            type="warning"
            title="Chưa rõ kết quả thao tác"
            description="Thử lại cùng lần xác nhận để tránh ghi trùng tiền hoặc yêu cầu thu."
            action={
              <Button
                loading={mutation.isPending}
                onClick={() => run(uncertain)}
              >
                Kiểm tra / Thử lại
              </Button>
            }
          />
        )}
        {(list.isPending || account.isPending) && <Spin />}
        {(list.isError || account.isError) && (
          <Alert
            type="error"
            title="Chưa tải được yêu cầu thu hoặc cấu hình ngân hàng"
            action={
              <Button
                onClick={() => {
                  void list.refetch();
                  void account.refetch();
                }}
              >
                Thử lại
              </Button>
            }
          />
        )}
        {account.isSuccess && !account.data?.enabled && (
          <Alert
            type="warning"
            title="Chưa thiết lập hoặc đã tắt tài khoản nhận QR"
            description={
              useAuthStore.getState().user?.role === "ADMIN" ? (
                <Link to="/hotel">Thiết lập tài khoản nhận chuyển khoản</Link>
              ) : (
                "Liên hệ ADMIN khách sạn để thiết lập. Bạn vẫn có thể ghi nhận tiền đã nhận bằng thao tác thủ công."
              )
            }
          />
        )}
        {activeId &&
          (detail.isPending ? (
            <Spin />
          ) : detail.isError ? (
            <Alert
              type="error"
              title={errorText(detail.error)}
              action={
                <Button onClick={() => void detail.refetch()}>
                  Tải lại QR
                </Button>
              }
            />
          ) : (
            current && (
              <>
                <Tag
                  color={
                    current.status === "CONFIRMED"
                      ? "success"
                      : current.status === "CANCELLED"
                        ? "default"
                        : "processing"
                  }
                >
                  {current.status === "CONFIRMED"
                    ? "Đã xác nhận"
                    : current.status === "CANCELLED"
                      ? "Đã hủy"
                      : "Chờ xác nhận"}
                </Tag>
                {current.invalidReason && (
                  <Alert type="warning" title={current.invalidReason} />
                )}
                {current.status === "CANCELLED" && (
                  <Alert
                    type="warning"
                    title={current.cancelledReason ?? "Yêu cầu đã hủy"}
                    description="QR cũ vẫn có thể chuyển tiền qua ngân hàng. Kiểm tra giao dịch thực nhận trước khi tạo yêu cầu khác."
                  />
                )}
                {current.qrDataURL && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={current.qrDataURL}
                      alt={`QR chuyển khoản ${formatFolioMoney(current.amount)}`}
                      width={280}
                      height={280}
                      style={{
                        maxWidth: "100%",
                        height: "auto",
                        background: "#fff",
                      }}
                    />
                    <div>
                      <a
                        href={current.qrDataURL}
                        download={`${current.memo}.png`}
                      >
                        Tải ảnh QR
                      </a>
                    </div>
                  </div>
                )}
                <Descriptions
                  bordered
                  column={1}
                  size="small"
                  items={[
                    {
                      key: "bank",
                      label: "Ngân hàng",
                      children: current.bankName,
                    },
                    {
                      key: "name",
                      label: "Chủ tài khoản",
                      children: current.accountName,
                    },
                    {
                      key: "account",
                      label: "Số tài khoản",
                      children: (
                        <Typography.Text copyable>
                          {current.accountNumber}
                        </Typography.Text>
                      ),
                    },
                    {
                      key: "amount",
                      label:
                        current.paymentType === "DEPOSIT"
                          ? "Tiền cọc"
                          : "Thanh toán",
                      children: formatFolioMoney(current.amount),
                    },
                    {
                      key: "memo",
                      label: "Nội dung chuyển khoản",
                      children: (
                        <Typography.Text copyable>
                          {current.memo}
                        </Typography.Text>
                      ),
                    },
                  ]}
                />
                {current.canConfirm && (
                  <Form
                    form={confirmForm}
                    layout="vertical"
                    disabled={locked}
                    onFinish={(values) =>
                      run({
                        kind: "confirm",
                        id: current.id,
                        key: createIdempotencyKey("qr-confirm"),
                        input: {
                          referenceNumber: String(
                            values.referenceNumber,
                          ).trim(),
                          confirmedReceived: true,
                        },
                      })
                    }
                  >
                    <Form.Item
                      name="referenceNumber"
                      label="Mã giao dịch ngân hàng thực tế"
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "Nhập mã giao dịch đã nhận từ ngân hàng",
                        },
                      ]}
                      extra="Mã này khác với nội dung chuyển khoản trên QR."
                    >
                      <Input maxLength={100} autoComplete="off" />
                    </Form.Item>
                    <Form.Item
                      name="confirmedReceived"
                      valuePropName="checked"
                      rules={[
                        {
                          validator: (_, v) =>
                            v
                              ? Promise.resolve()
                              : Promise.reject(
                                  new Error("Cần xác nhận đã thực nhận tiền"),
                                ),
                        },
                      ]}
                    >
                      <Checkbox>
                        Tôi đã kiểm tra khách sạn thực nhận đúng số tiền trên.
                      </Checkbox>
                    </Form.Item>
                    <Button
                      htmlType="submit"
                      type="primary"
                      loading={mutation.isPending}
                    >
                      Xác nhận{" "}
                      {current.paymentType === "DEPOSIT"
                        ? "nhận cọc"
                        : "thu tiền"}
                    </Button>
                    <Typography.Paragraph
                      type="secondary"
                      style={{ marginTop: 8 }}
                    >
                      Nếu số tiền thực nhận khác QR, đối soát và dùng thao tác
                      ghi nhận chuyển khoản thủ công.
                    </Typography.Paragraph>
                  </Form>
                )}
                {current.status === "PENDING" && (
                  <Space orientation="vertical" style={{ width: "100%" }}>
                    <Input
                      aria-label="Lý do hủy yêu cầu QR"
                      placeholder="Lý do hủy yêu cầu thu"
                      maxLength={2000}
                      value={reason}
                      disabled={locked}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <Button
                      danger
                      disabled={locked || !reason.trim()}
                      onClick={() =>
                        run({
                          kind: "cancel",
                          id: current.id,
                          reason: reason.trim(),
                          key: createIdempotencyKey("qr-cancel"),
                        })
                      }
                    >
                      Hủy yêu cầu thu
                    </Button>
                  </Space>
                )}
                {current.status === "CONFIRMED" && (
                  <Alert
                    type="success"
                    title="Đã ghi nhận khoản thu vào folio"
                    action={
                      <Link to={`/folios?reservationId=${reservationId}`}>
                        Xem folio
                      </Link>
                    }
                  />
                )}
                {current.status !== "PENDING" && (
                  <Button
                    disabled={locked}
                    onClick={() => {
                      setSelected(null);
                      setReason("");
                      confirmForm.resetFields();
                    }}
                  >
                    Tạo yêu cầu thu khác
                  </Button>
                )}
              </>
            )
          ))}
        {!activeId && account.data?.enabled && list.isSuccess && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ amount: initialAmount, paymentType: initialType }}
            disabled={locked}
            onFinish={(input) =>
              run({
                kind: "create",
                input,
                key: createIdempotencyKey("qr-create"),
              })
            }
          >
            <Form.Item
              name="paymentType"
              label="Loại thu"
              rules={[{ required: true }]}
            >
              <Radio.Group>
                <Radio.Button value="DEPOSIT" disabled={!allowDeposit}>
                  Nhận cọc
                </Radio.Button>
                <Radio.Button value="PAYMENT">Thanh toán</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              name="amount"
              label="Số tiền chuyển khoản (VND)"
              rules={[
                {
                  validator: (_, v) =>
                    validQrAmount(v)
                      ? Promise.resolve()
                      : Promise.reject(
                          new Error(
                            "Nhập số đồng nguyên từ 1 đến 9.999.999.999.999",
                          ),
                        ),
                },
              ]}
            >
              <InputNumber<string>
                stringMode
                precision={0}
                min="1"
                max="9999999999999"
                style={{ width: "100%" }}
                formatter={(v) =>
                  `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
                }
                parser={(v) => (v ?? "").replace(/[.\s₫]/g, "")}
              />
            </Form.Item>
            <Button
              htmlType="submit"
              type="primary"
              loading={mutation.isPending}
            >
              Hiển thị QR
            </Button>
          </Form>
        )}
        {!!list.data?.items.length && (
          <>
            <Typography.Text strong>Lịch sử yêu cầu thu QR</Typography.Text>
            {list.data.items.map((r) => (
              <Button
                key={r.id}
                block
                disabled={locked}
                onClick={() => {
                  setSelected(r.id);
                  setReason("");
                  confirmForm.resetFields();
                }}
                style={{
                  height: "auto",
                  whiteSpace: "normal",
                  textAlign: "left",
                }}
              >
                {r.memo} · {formatFolioMoney(r.amount)} ·{" "}
                {r.status === "PENDING"
                  ? "Chờ xác nhận"
                  : r.status === "CONFIRMED"
                    ? "Đã xác nhận"
                    : "Đã hủy"}
              </Button>
            ))}
            <Pagination
              size="small"
              current={page}
              total={list.data.pagination.total}
              pageSize={20}
              showSizeChanger={false}
              onChange={setPage}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
