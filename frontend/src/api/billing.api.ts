import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  ServiceItem,
  CreateServiceDto,
  UpdateServiceDto,
  ServiceQueryParams,
  ServiceOrderItem,
  CreateServiceOrderDto,
  CancelServiceOrderDto,
  OrderQueryParams,
  FolioDetailItem,
  FolioItemRecord,
  CreateAdjustmentDto,
  LedgerQueryParams,
  PaymentRecord,
  CreatePaymentDto,
  CreateRefundDto,
} from '../types/billing.types.ts';

/**
 * Tạo Idempotency-Key chuẩn 8-128 ký tự ASCII
 */
export const createIdempotencyKey = (prefix: string = 'idemp'): string => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${ts}_${rand}`;
};

export const billingApi = {
  // ==========================================
  // 1. SERVICE CATALOG (DANH MỤC DỊCH VỤ)
  // ==========================================

  /**
   * Lấy danh sách dịch vụ (hỗ trợ phân trang, tìm kiếm, lọc isActive, sắp xếp)
   * GET /services
   */
  getServices: async (
    params?: ServiceQueryParams
  ): Promise<ApiResponse<PaginatedResult<ServiceItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<ServiceItem>>>('/services', {
      params,
    });
    return res.data;
  },

  /**
   * Xem chi tiết 1 dịch vụ
   * GET /services/:id
   */
  getServiceById: async (id: string): Promise<ApiResponse<ServiceItem>> => {
    const res = await apiClient.get<ApiResponse<ServiceItem>>(`/services/${id}`);
    return res.data;
  },

  /**
   * Tạo dịch vụ mới (Chỉ ADMIN, MANAGER)
   * POST /services
   */
  createService: async (data: CreateServiceDto): Promise<ApiResponse<ServiceItem>> => {
    const res = await apiClient.post<ApiResponse<ServiceItem>>('/services', data);
    return res.data;
  },

  /**
   * Cập nhật dịch vụ (Chỉ ADMIN, MANAGER)
   * PATCH /services/:id
   */
  updateService: async (
    id: string,
    data: UpdateServiceDto
  ): Promise<ApiResponse<ServiceItem>> => {
    const res = await apiClient.patch<ApiResponse<ServiceItem>>(`/services/${id}`, data);
    return res.data;
  },

  /**
   * Ngưng kích hoạt dịch vụ (Chỉ ADMIN, MANAGER)
   * DELETE /services/:id
   */
  deactivateService: async (id: string): Promise<ApiResponse<ServiceItem>> => {
    const res = await apiClient.delete<ApiResponse<ServiceItem>>(`/services/${id}`);
    return res.data;
  },

  // ==========================================
  // 2. SERVICE ORDERS (YÊU CẦU DỊCH VỤ)
  // ==========================================

  /**
   * Lấy danh sách yêu cầu dịch vụ
   * GET /service-orders
   */
  getServiceOrders: async (
    params?: OrderQueryParams
  ): Promise<ApiResponse<PaginatedResult<ServiceOrderItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<ServiceOrderItem>>>(
      '/service-orders',
      { params }
    );
    return res.data;
  },

  /**
   * Xem chi tiết yêu cầu dịch vụ
   * GET /service-orders/:id
   */
  getServiceOrderById: async (id: string): Promise<ApiResponse<ServiceOrderItem>> => {
    const res = await apiClient.get<ApiResponse<ServiceOrderItem>>(`/service-orders/${id}`);
    return res.data;
  },

  /**
   * Tạo yêu cầu dịch vụ mới (Role ADMIN, MANAGER, RECEPTIONIST)
   * POST /service-orders
   */
  createServiceOrder: async (
    data: CreateServiceOrderDto
  ): Promise<ApiResponse<ServiceOrderItem>> => {
    const res = await apiClient.post<ApiResponse<ServiceOrderItem>>('/service-orders', data);
    return res.data;
  },

  /**
   * Hoàn thành order dịch vụ và ghi nợ tự động vào Folio (Role ADMIN, MANAGER, RECEPTIONIST)
   * POST /service-orders/:id/complete
   */
  completeServiceOrder: async (id: string): Promise<ApiResponse<ServiceOrderItem>> => {
    const res = await apiClient.post<ApiResponse<ServiceOrderItem>>(
      `/service-orders/${id}/complete`,
      {}
    );
    return res.data;
  },

  /**
   * Hủy yêu cầu dịch vụ đang REQUESTED (Role ADMIN, MANAGER, RECEPTIONIST)
   * POST /service-orders/:id/cancel
   */
  cancelServiceOrder: async (
    id: string,
    data: CancelServiceOrderDto
  ): Promise<ApiResponse<ServiceOrderItem>> => {
    const res = await apiClient.post<ApiResponse<ServiceOrderItem>>(
      `/service-orders/${id}/cancel`,
      data
    );
    return res.data;
  },

  // ==========================================
  // 3. FOLIO & LEDGER (SỔ CÔNG NỢ & SỔ CÁI)
  // ==========================================

  /**
   * Mở sổ công nợ Folio cho đặt phòng (Role ADMIN, MANAGER, RECEPTIONIST, ACCOUNTANT)
   * POST /reservations/:reservationId/folio/open
   */
  openFolio: async (reservationId: string): Promise<ApiResponse<FolioDetailItem>> => {
    const res = await apiClient.post<ApiResponse<FolioDetailItem>>(
      `/reservations/${reservationId}/folio/open`,
      {}
    );
    return res.data;
  },

  /**
   * Lấy Folio theo mã đặt phòng (Trả về 404 FOLIO_NOT_FOUND nếu chưa mở)
   * GET /reservations/:reservationId/folio
   */
  getFolioByReservation: async (
    reservationId: string
  ): Promise<ApiResponse<FolioDetailItem>> => {
    const res = await apiClient.get<ApiResponse<FolioDetailItem>>(
      `/reservations/${reservationId}/folio`
    );
    return res.data;
  },

  /**
   * Lấy chi tiết Folio theo Folio ID
   * GET /folios/:id
   */
  getFolioById: async (id: string): Promise<ApiResponse<FolioDetailItem>> => {
    const res = await apiClient.get<ApiResponse<FolioDetailItem>>(`/folios/${id}`);
    return res.data;
  },

  /**
   * Lấy danh sách các dòng ghi nợ / ghi có (Ledger Items) của Folio
   * GET /folios/:id/items
   */
  getFolioItems: async (
    id: string,
    params?: LedgerQueryParams
  ): Promise<ApiResponse<PaginatedResult<FolioItemRecord>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<FolioItemRecord>>>(
      `/folios/${id}/items`,
      { params }
    );
    return res.data;
  },

  /**
   * Điều chỉnh công nợ DEBIT / CREDIT trên Folio (Role ADMIN, MANAGER, ACCOUNTANT)
   * Bắt buộc có header Idempotency-Key
   * POST /folios/:id/adjustments
   */
  createAdjustment: async (
    id: string,
    data: CreateAdjustmentDto,
    idempotencyKey?: string
  ): Promise<ApiResponse<FolioItemRecord>> => {
    const key = idempotencyKey || createIdempotencyKey('adj');
    const res = await apiClient.post<ApiResponse<FolioItemRecord>>(
      `/folios/${id}/adjustments`,
      data,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );
    return res.data;
  },

  /**
   * Đóng quyết toán Folio khi số dư = 0 và đã checkout hết (Role ADMIN, MANAGER, ACCOUNTANT)
   * POST /folios/:id/close
   */
  closeFolio: async (id: string): Promise<ApiResponse<FolioDetailItem>> => {
    const res = await apiClient.post<ApiResponse<FolioDetailItem>>(
      `/folios/${id}/close`,
      {}
    );
    return res.data;
  },

  // ==========================================
  // 4. PAYMENTS & REFUNDS (THANH TOÁN & HOÀN TIỀN)
  // ==========================================

  /**
   * Thu tiền thanh toán (PAYMENT) hoặc nhận tiền đặt cọc (DEPOSIT)
   * Bắt buộc có header Idempotency-Key
   * POST /folios/:folioId/payments
   */
  createPayment: async (
    folioId: string,
    data: CreatePaymentDto,
    idempotencyKey?: string
  ): Promise<ApiResponse<PaymentRecord>> => {
    const key = idempotencyKey || createIdempotencyKey('pay');
    const res = await apiClient.post<ApiResponse<PaymentRecord>>(
      `/folios/${folioId}/payments`,
      data,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );
    return res.data;
  },

  /**
   * Lấy danh sách thanh toán / đặt cọc / hoàn tiền của Folio
   * GET /folios/:folioId/payments
   */
  getPayments: async (
    folioId: string,
    params?: LedgerQueryParams
  ): Promise<ApiResponse<PaginatedResult<PaymentRecord>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<PaymentRecord>>>(
      `/folios/${folioId}/payments`,
      { params }
    );
    return res.data;
  },

  /**
   * Ghi nhận hoàn tiền (REFUND) từ một giao dịch thanh toán đã xác nhận
   * Bắt buộc có header Idempotency-Key (Role ADMIN, MANAGER, ACCOUNTANT)
   * POST /payments/:id/refunds
   */
  createRefund: async (
    paymentId: string,
    data: CreateRefundDto,
    idempotencyKey?: string
  ): Promise<ApiResponse<PaymentRecord>> => {
    const key = idempotencyKey || createIdempotencyKey('ref');
    const res = await apiClient.post<ApiResponse<PaymentRecord>>(
      `/payments/${paymentId}/refunds`,
      data,
      {
        headers: {
          'Idempotency-Key': key,
        },
      }
    );
    return res.data;
  },
};
