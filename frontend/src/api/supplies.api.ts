import { apiClient } from "./axiosClient.ts";
import type { ApiResponse } from "../types/api.types.ts";
export type MaterialType = "CONSUMABLE" | "REUSABLE" | "UNCLASSIFIED";
export const materialTypeLabels: Record<MaterialType, string> = {
  CONSUMABLE: "Tiêu hao",
  REUSABLE: "Tái sử dụng",
  UNCLASSIFIED: "Chưa phân loại",
};
export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentStock: string;
  isActive: boolean;
  materialType: MaterialType;
  description?: string | null;
}
export type MaterialUsageBasis = "PER_GUEST" | "PER_ROOM";
export interface MaterialRoomType {
  id: string;
  code: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
}
export interface MaterialLine {
  itemId: string;
  quantity: string;
  item: MaterialItem;
  usageBasis?: MaterialUsageBasis;
  presetQuantity?: string;
}
export interface MaterialUsage {
  id: string;
  createdAt: string;
  actor: { id: string; fullName: string };
  noMaterialsReason: string | null;
  preparedAdults?: number | null;
  preparedChildren?: number | null;
  stockIssueId: string | null;
  issueNumber: string | null;
  materials: MaterialLine[];
}
export interface TaskMaterials {
  taskId: string;
  roomTypeId: string;
  workToken: string | null;
  materials: MaterialLine[];
  history: MaterialUsage[];
  roomType: MaterialRoomType;
  reusableItems: MaterialItem[];
  preparation: {
    adults: number;
    children: number;
    source: "ROOM_TYPE_STANDARD";
  };
}
export interface CompleteMaterialsDto {
  workToken: string;
  materials: { itemId: string; quantity: string }[];
  noMaterialsReason?: string;
  notes?: string;
  preparedAdults?: number;
  preparedChildren?: number;
}
export interface SupplierPaymentDto {
  requestKey: string;
  amount: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paidAt: string;
  referenceNumber?: string;
  notes?: string;
}
export interface SupplierPayment {
  id: string;
  amount: string;
  paymentMethod: "CASH" | "BANK_TRANSFER";
  paidAt: string;
  referenceNumber: string | null;
  notes: string | null;
  actor: { id: string; fullName: string };
  reversal: {
    reason: string;
    reversedAt: string;
    actor: { fullName: string };
  } | null;
}
export interface SupplierSettlement {
  receiptId: string;
  receiptNumber: string;
  totalAmount: string;
  paymentTracking: "TRACKED" | "UNRECONCILED";
  paidAmount: string;
  outstandingAmount: string | null;
  status: "UNRECONCILED" | "UNPAID" | "PARTIAL" | "PAID";
  payments: SupplierPayment[];
}
export interface SupplierFinance {
  timezone: string;
  startDate: string;
  endDate: string;
  cutoffExclusive: string;
  paidOut: string;
  reversedAmount: string;
  netPaidOut: string;
  outstandingAmount: string;
  unreconciledValue: string;
  unreconciledCount: number;
  items: {
    id: string;
    receiptNumber: string;
    receiptDate: string;
    supplierName: string | null;
    totalAmount: string;
    outstandingAmount: string | null;
    paymentTracking: string;
  }[];
  pagination: { total: number; page: number; limit: number };
}
export interface ProcurementReport {
  summary: {
    totalExpense: string;
    receiptCount: number;
    averageReceiptValue: string;
    distinctItemCount: number;
  };
  series: { date: string; totalExpense: string; receiptCount: number }[];
  byCategory: {
    categoryId: string;
    categoryName: string;
    totalAmount: string;
    percentage: number;
  }[];
  bySupplier: {
    supplierId: string | null;
    supplierName: string;
    totalAmount: string;
    receiptCount: number;
    percentage: number;
  }[];
  topItems: {
    itemId: string;
    sku: string;
    name: string;
    categoryName: string;
    unit: string;
    totalQuantity: string;
    totalAmount: string;
  }[];
}
const get = async <T>(url: string, params?: object, signal?: AbortSignal) =>
  (await apiClient.get<ApiResponse<T>>(url, { params, signal })).data.data;
const post = async <T>(url: string, body: object) =>
  (await apiClient.post<ApiResponse<T>>(url, body)).data.data;
export const suppliesApi = {
  presets: (id: string, signal?: AbortSignal) =>
    get<{
      roomTypeId: string;
      roomType: MaterialRoomType;
      materials: MaterialLine[];
      reusableItems: MaterialItem[];
    }>(`/room-types/${id}/housekeeping-materials`, undefined, signal),
  savePresets: async (
    id: string,
    materials: {
      itemId: string;
      quantity: string;
      usageBasis?: MaterialUsageBasis;
    }[],
  ) =>
    (
      await apiClient.put(`/room-types/${id}/housekeeping-materials`, {
        materials,
      })
    ).data,
  task: (id: string, signal?: AbortSignal) =>
    get<TaskMaterials>(
      `/housekeeping/tasks/${id}/materials`,
      undefined,
      signal,
    ),
  settlement: (id: string, signal?: AbortSignal) =>
    get<SupplierSettlement>(
      `/inventory/receipts/${id}/settlement`,
      undefined,
      signal,
    ),
  pay: (id: string, body: SupplierPaymentDto) =>
    post<SupplierSettlement>(`/inventory/receipts/${id}/payments`, body),
  reconcile: (id: string, reason: string, payment?: SupplierPaymentDto) =>
    post<SupplierSettlement>(`/inventory/receipts/${id}/reconcile`, {
      reason,
      ...(payment ? { payment } : {}),
    }),
  reverse: (id: string, reason: string) =>
    post<SupplierSettlement>(`/inventory/supplier-payments/${id}/reverse`, {
      reason,
    }),
  finance: (
    params: {
      startDate: string;
      endDate: string;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ) => get<SupplierFinance>("/reports/supplier-finance", params, signal),
  procurement: (
    params: {
      startDate: string;
      endDate: string;
      groupBy: "day" | "month";
      supplierId?: string;
      categoryId?: string;
    },
    signal?: AbortSignal,
  ) => get<ProcurementReport>("/reports/procurement", params, signal),
};
