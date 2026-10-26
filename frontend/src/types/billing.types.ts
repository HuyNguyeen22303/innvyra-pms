/**
 * Innvyra PMS - Billing & Folio TypeScript Type Definitions
 * Tuân thủ 100% hợp đồng backend trong backend/BILLING.md và backend/src/modules/billing/
 */

export type ServiceOrderStatus = 'REQUESTED' | 'COMPLETED' | 'CANCELLED';
export type FolioStatus = 'OPEN' | 'CLOSED';
export type FolioEntryType = 'DEBIT' | 'CREDIT';
export type FolioSourceType = 'ROOM_NIGHT' | 'SERVICE_ORDER_ITEM' | 'MANUAL_ADJUSTMENT';
export type PaymentType = 'PAYMENT' | 'DEPOSIT' | 'REFUND';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER';
export type PaymentStatus = 'CONFIRMED' | 'PENDING' | 'FAILED';

// ----------------------------------------------------
// SERVICE CATALOG (DANH MỤC DỊCH VỤ)
// ----------------------------------------------------

export interface ServiceItem {
  id: string;
  hotelId: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  price: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDto {
  code: string;
  name: string;
  description?: string | null;
  unit: string;
  price: string;
  isActive?: boolean;
}

export interface UpdateServiceDto {
  code?: string;
  name?: string;
  description?: string | null;
  unit?: string;
  price?: string;
  isActive?: boolean;
}

export interface ServiceQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: 'true' | 'false' | boolean;
  sortBy?: 'name' | 'code' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ----------------------------------------------------
// SERVICE ORDERS (YÊU CẦU DỊCH VỤ)
// ----------------------------------------------------

export interface ServiceOrderItemDetail {
  id: string;
  serviceId: string;
  nameSnapshot: string;
  unitSnapshot: string;
  quantity: number;
  unitPriceSnapshot: string;
  lineTotal: string;
  createdAt: string;
}

export interface ServiceOrderItem {
  id: string;
  reservationId: string;
  stayId: string | null;
  guestName: string;
  confirmationCode: string;
  roomNumber: string | null;
  roomTypeName: string | null;
  status: ServiceOrderStatus;
  notes: string | null;
  createdBy: string;
  completedBy: string | null;
  completedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: ServiceOrderItemDetail[];
}

export interface CreateServiceOrderDto {
  reservationId: string;
  stayId?: string;
  items: {
    serviceId: string;
    quantity: number;
  }[];
  notes?: string | null;
}

export interface CancelServiceOrderDto {
  reason: string;
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  reservationId?: string;
  stayId?: string;
  status?: ServiceOrderStatus;
  search?: string;
  sortBy?: 'createdAt' | 'id';
  sortOrder?: 'asc' | 'desc';
}

// ----------------------------------------------------
// FOLIO & LEDGER (SỔ CÔNG NỢ & BẢN GHI SỔ CÁI)
// ----------------------------------------------------

export interface FolioDetailItem {
  id: string;
  reservationId: string;
  currency: string;
  status: FolioStatus;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Financial metrics from backend
  totalCharges: string;
  totalCredits: string;
  totalPayments: string;
  totalDeposits: string;
  totalRefunds: string;
  netCharges: string;
  netPaid: string;
  outstandingBalance: string;
}

export interface FolioItemRecord {
  id: string;
  folioId: string;
  entryType: FolioEntryType;
  sourceType: FolioSourceType;
  sourceId: string | null;
  amount: string;
  description: string;
  relatedItemId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CreateAdjustmentDto {
  entryType: FolioEntryType;
  amount: string;
  reason: string;
  relatedItemId?: string;
}

export interface LedgerQueryParams {
  page?: number;
  limit?: number;
}

// ----------------------------------------------------
// PAYMENTS & REFUNDS (THANH TOÁN & HOÀN TIỀN)
// ----------------------------------------------------

export interface PaymentRecord {
  id: string;
  folioId: string;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  amount: string;
  status: PaymentStatus;
  referenceNumber: string | null;
  originalPaymentId: string | null;
  reason: string | null;
  processedBy: string;
  processedAt: string;
  createdAt: string;
}

export interface CreatePaymentDto {
  paymentType: 'PAYMENT' | 'DEPOSIT';
  paymentMethod: PaymentMethod;
  amount: string;
  referenceNumber?: string | null;
  confirmedReceived: true;
}

export interface CreateRefundDto {
  amount: string;
  reason: string;
  confirmedRefunded: true;
  referenceNumber?: string | null;
}
