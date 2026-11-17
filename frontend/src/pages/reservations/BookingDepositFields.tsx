import {
  Checkbox,
  Input,
  InputNumber,
  Radio,
  Space,
  Switch,
  Typography,
} from "antd";
import {
  type BookingDepositDraft,
  emptyBookingDeposit,
} from "../../utils/bookingWorkflow.ts";
import { formatFolioMoney } from "../../utils/folioSettlement.ts";
export function BookingDepositFields({
  value,
  onChange,
  maximum,
}: {
  value: BookingDepositDraft;
  onChange: (value: BookingDepositDraft) => void;
  maximum: string;
}) {
  const change = (patch: Partial<BookingDepositDraft>) =>
    onChange({ ...value, confirmedReceived: false, ...patch });
  return (
    <Space
      orientation="vertical"
      size={12}
      style={{ width: "100%", marginBottom: 16 }}
    >
      <Space>
        <Switch
          aria-label="Nhận cọc ngay"
          checked={value.enabled}
          onChange={(enabled) =>
            onChange({ ...emptyBookingDeposit(), enabled })
          }
        />
        <Typography.Text strong>Nhận cọc ngay</Typography.Text>
      </Space>
      {value.enabled && (
        <>
          <Typography.Text type="secondary">
            Tiền phòng dự kiến để nhận cọc: {formatFolioMoney(maximum)}
          </Typography.Text>
          <InputNumber<string>
            aria-label="Số tiền cọc"
            stringMode
            min="1"
            max="9999999999999999"
            precision={0}
            value={value.amount}
            onChange={(amount) => change({ amount })}
            placeholder="Số tiền đã nhận (VND)"
            style={{ width: "100%" }}
            formatter={(amount) =>
              `${amount ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
            }
            parser={(amount) => (amount ?? "").replace(/[.\s₫]/g, "")}
          />
          <Radio.Group
            aria-label="Phương thức nhận cọc"
            value={value.paymentMethod}
            onChange={(event) =>
              change({ paymentMethod: event.target.value, referenceNumber: "" })
            }
          >
            <Radio.Button value="CASH">Tiền mặt</Radio.Button>
            <Radio.Button value="BANK_TRANSFER">Chuyển khoản</Radio.Button>
          </Radio.Group>
          {value.paymentMethod === "BANK_TRANSFER" && (
            <Input
              aria-label="Mã giao dịch nhận cọc"
              maxLength={100}
              placeholder="Mã giao dịch ngân hàng đã nhận"
              value={value.referenceNumber}
              onChange={(event) =>
                change({ referenceNumber: event.target.value })
              }
            />
          )}
          <Checkbox
            checked={value.confirmedReceived}
            onChange={(event) =>
              onChange({ ...value, confirmedReceived: event.target.checked })
            }
          >
            Tôi xác nhận khách sạn đã thực nhận số tiền cọc trên.
          </Checkbox>
        </>
      )}
    </Space>
  );
}
