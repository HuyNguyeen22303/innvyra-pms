import type {
  CreateReservationDto,
  InitialDepositDto,
  RoomAvailabilityItem,
} from "../types/reservations.types.ts";
import { validFinalCharge } from "./folioSettlement.ts";

export interface BookingDepositDraft {
  enabled: boolean;
  amount: string | null;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  referenceNumber: string;
  confirmedReceived: boolean;
}
export const emptyBookingDeposit = (): BookingDepositDraft => ({
  enabled: false,
  amount: null,
  paymentMethod: "CASH",
  referenceNumber: "",
  confirmedReceived: false,
});
export function bookingRoomCharge(
  rooms: Record<string, { quantity: number }>,
  available: RoomAvailabilityItem[],
  nights: number,
): string {
  let total = 0n;
  for (const [id, room] of Object.entries(rooms)) {
    if (!room.quantity) continue;
    const rate = available.find((item) => item.roomTypeId === id)?.basePrice;
    if (!rate || !/^\d+(?:\.\d{1,2})?$/.test(rate))
      throw new Error("Cần tra cứu lại giá phòng");
    const [whole, fraction = ""] = rate.split(".");
    const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
    total += ((cents + 50n) / 100n) * BigInt(room.quantity) * BigInt(nights);
  }
  return `${total}.00`;
}
export function bookingDepositPayload(
  draft: BookingDepositDraft,
  maximum: string,
): InitialDepositDto | undefined {
  if (!draft.enabled) return undefined;
  if (
    !validFinalCharge(draft.amount) ||
    BigInt(draft.amount.split(".")[0]!) <= 0n
  )
    throw new Error("Nhập số tiền cọc là số đồng nguyên lớn hơn 0");
  const amount = `${draft.amount.split(".")[0]}.00`;
  if (BigInt(amount.split(".")[0]!) > BigInt(maximum.split(".")[0]!))
    throw new Error("Tiền cọc không được vượt tiền phòng dự kiến");
  const referenceNumber = draft.referenceNumber.trim() || null;
  if (draft.paymentMethod === "BANK_TRANSFER" && !referenceNumber)
    throw new Error("Nhập mã giao dịch chuyển khoản đã nhận");
  if (!draft.confirmedReceived)
    throw new Error("Cần xác nhận đã thực nhận tiền cọc");
  return {
    amount,
    paymentMethod: draft.paymentMethod,
    referenceNumber,
    confirmedReceived: true,
  };
}
export interface BookingAttempt {
  key: string;
  payload: CreateReservationDto;
}
export function prepareBookingAttempt(
  previous: BookingAttempt | null,
  payload: CreateReservationDto,
  uncertain: boolean,
  createKey: () => string,
): BookingAttempt {
  if (
    previous &&
    (uncertain || JSON.stringify(previous.payload) === JSON.stringify(payload))
  )
    return previous;
  return { key: createKey(), payload: structuredClone(payload) };
}
