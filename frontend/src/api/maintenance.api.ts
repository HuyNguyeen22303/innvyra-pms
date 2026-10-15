import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  MaintenanceTicketItem,
  MaintenanceBlockItem,
  CreateMaintenanceTicketDto,
  AssignMaintenanceTicketDto,
  ResolveMaintenanceTicketDto,
  CloseMaintenanceTicketDto,
  CancelMaintenanceTicketDto,
  TicketFilterParams,
  CreateMaintenanceBlockDto,
  ReleaseMaintenanceBlockDto,
  CancelMaintenanceBlockDto,
  BlockFilterParams,
} from '../types/operations.types.ts';

export const maintenanceApi = {
  // ==========================================
  // MAINTENANCE TICKETS (PHIẾU SỰ CỐ / SỬA CHỮA)
  // ==========================================

  /**
   * Lấy danh sách phiếu sự cố bảo trì
   * GET /maintenance/tickets
   */
  getTickets: async (
    params?: TicketFilterParams
  ): Promise<ApiResponse<PaginatedResult<MaintenanceTicketItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<MaintenanceTicketItem>>>(
      '/maintenance/tickets',
      {
        params: { limit: 50, ...params },
      }
    );
    return res.data;
  },

  /**
   * Lấy chi tiết phiếu sự cố kèm lịch sử timeline (audit logs)
   * GET /maintenance/tickets/:id
   */
  getTicketById: async (id: string): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.get<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}`
    );
    return res.data;
  },

  /**
   * Báo cáo sự cố bảo trì mới
   * POST /maintenance/tickets
   */
  createTicket: async (
    data: CreateMaintenanceTicketDto
  ): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceTicketItem>>(
      '/maintenance/tickets',
      data
    );
    return res.data;
  },

  /**
   * Phân công kỹ thuật viên xử lý
   * PATCH /maintenance/tickets/:id/assign
   */
  assignTicket: async (
    id: string,
    data: AssignMaintenanceTicketDto
  ): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.patch<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}/assign`,
      data
    );
    return res.data;
  },

  /**
   * Bắt đầu sửa chữa (chuyển trạng thái sang IN_PROGRESS)
   * POST /maintenance/tickets/:id/start
   */
  startRepair: async (id: string): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}/start`,
      {}
    );
    return res.data;
  },

  /**
   * Báo hoàn thành sửa chữa (chuyển sang RESOLVED)
   * POST /maintenance/tickets/:id/resolve
   */
  resolveTicket: async (
    id: string,
    data: ResolveMaintenanceTicketDto
  ): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}/resolve`,
      data
    );
    return res.data;
  },

  /**
   * Nghiệm thu và đóng phiếu sự cố (chuyển sang CLOSED)
   * POST /maintenance/tickets/:id/close
   */
  closeTicket: async (
    id: string,
    data?: CloseMaintenanceTicketDto
  ): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}/close`,
      data ?? {}
    );
    return res.data;
  },

  /**
   * Hủy phiếu sự cố (chuyển sang CANCELLED)
   * POST /maintenance/tickets/:id/cancel
   */
  cancelTicket: async (
    id: string,
    data: CancelMaintenanceTicketDto
  ): Promise<ApiResponse<MaintenanceTicketItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceTicketItem>>(
      `/maintenance/tickets/${id}/cancel`,
      data
    );
    return res.data;
  },

  // ==========================================
  // MAINTENANCE BLOCKS (LỆNH KHÓA PHÒNG BẢO TRÌ)
  // ==========================================

  /**
   * Lấy danh sách lệnh khóa phòng bảo trì
   * GET /maintenance/blocks
   */
  getBlocks: async (
    params?: BlockFilterParams
  ): Promise<ApiResponse<PaginatedResult<MaintenanceBlockItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<MaintenanceBlockItem>>>(
      '/maintenance/blocks',
      {
        params: { limit: 50, ...params },
      }
    );
    return res.data;
  },

  /**
   * Lấy chi tiết lệnh khóa phòng kèm lịch sử timeline (audit logs)
   * GET /maintenance/blocks/:id
   */
  getBlockById: async (id: string): Promise<ApiResponse<MaintenanceBlockItem>> => {
    const res = await apiClient.get<ApiResponse<MaintenanceBlockItem>>(
      `/maintenance/blocks/${id}`
    );
    return res.data;
  },

  /**
   * Tạo lệnh khóa phòng bảo trì mới (loại trừ phòng khỏi kho bán phòng)
   * POST /maintenance/blocks
   */
  createBlock: async (
    data: CreateMaintenanceBlockDto
  ): Promise<ApiResponse<MaintenanceBlockItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceBlockItem>>(
      '/maintenance/blocks',
      data
    );
    return res.data;
  },

  /**
   * Nghiệm thu an toàn & Mở khóa phòng bảo trì (phòng tự động chuyển sang DIRTY và tạo việc dọn dẹp)
   * POST /maintenance/blocks/:id/release
   */
  releaseBlock: async (
    id: string,
    data: ReleaseMaintenanceBlockDto
  ): Promise<ApiResponse<MaintenanceBlockItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceBlockItem>>(
      `/maintenance/blocks/${id}/release`,
      data
    );
    return res.data;
  },

  /**
   * Hủy lệnh bảo trì đã lên lịch tương lai (SCHEDULED)
   * POST /maintenance/blocks/:id/cancel
   */
  cancelBlock: async (
    id: string,
    data: CancelMaintenanceBlockDto
  ): Promise<ApiResponse<MaintenanceBlockItem>> => {
    const res = await apiClient.post<ApiResponse<MaintenanceBlockItem>>(
      `/maintenance/blocks/${id}/cancel`,
      data
    );
    return res.data;
  },
};
