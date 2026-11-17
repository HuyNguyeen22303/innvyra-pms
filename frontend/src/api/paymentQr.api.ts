import { apiClient } from "./axiosClient.ts";
import type { ApiResponse, PaginatedResult } from "../types/api.types.ts";

export interface PaymentBank {
  bin: string;
  code: string;
  name: string;
  shortName: string;
}
export interface BankAccount {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  enabled: boolean;
  version: number;
  updatedAt: string;
}
export interface PaymentQrRequest {
  id: string;
  reservationId: string;
  folioId: string | null;
  paymentId: string | null;
  paymentType: "DEPOSIT" | "PAYMENT";
  amount: string;
  memo: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  cancelledReason: string | null;
  createdAt: string;
  confirmedAt: string | null;
}
export interface PaymentQrDetail extends PaymentQrRequest {
  qrCode: string | null;
  qrDataURL: string | null;
  canConfirm: boolean;
  invalidReason: string | null;
}
export type QrCollectionInput = {
  amount: string;
  paymentType: "DEPOSIT" | "PAYMENT";
};
const keyed = (key: string) => ({ headers: { "Idempotency-Key": key } });
export const paymentQrApi = {
  async banks(signal?: AbortSignal) {
    return (
      await apiClient.get<
        ApiResponse<{ banks: PaymentBank[]; source: string }>
      >("/hotel/banks", { signal })
    ).data.data;
  },
  async account(signal?: AbortSignal) {
    return (
      await apiClient.get<ApiResponse<BankAccount | null>>(
        "/hotel/bank-account",
        { signal },
      )
    ).data.data;
  },
  async saveAccount(
    input: Pick<
      BankAccount,
      "bankBin" | "accountNumber" | "accountName" | "enabled"
    > & { expectedVersion: number },
  ) {
    return (
      await apiClient.put<ApiResponse<BankAccount>>(
        "/hotel/bank-account",
        input,
      )
    ).data.data;
  },
  async list(reservationId: string, page = 1, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiResponse<PaginatedResult<PaymentQrRequest>>>(
        `/reservations/${reservationId}/payment-requests`,
        { params: { page, limit: 20 }, signal },
      )
    ).data.data;
  },
  async detail(id: string, signal?: AbortSignal) {
    return (
      await apiClient.get<ApiResponse<PaymentQrDetail>>(
        `/payment-requests/${id}`,
        { signal },
      )
    ).data.data;
  },
  async create(reservationId: string, input: QrCollectionInput, key: string) {
    return (
      await apiClient.post<ApiResponse<PaymentQrRequest>>(
        `/reservations/${reservationId}/payment-requests`,
        input,
        keyed(key),
      )
    ).data.data;
  },
  async confirm(
    id: string,
    input: { referenceNumber: string; confirmedReceived: true },
    key: string,
  ) {
    return (
      await apiClient.post<ApiResponse<PaymentQrRequest>>(
        `/payment-requests/${id}/confirm`,
        input,
        keyed(key),
      )
    ).data.data;
  },
  async cancel(id: string, reason: string, key: string) {
    return (
      await apiClient.post<ApiResponse<PaymentQrRequest>>(
        `/payment-requests/${id}/cancel`,
        { reason },
        keyed(key),
      )
    ).data.data;
  },
};
