import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  ReservationSummaryItem,
  ReservationDetailItem,
  RoomAvailabilityItem,
  CreateReservationDto,
  CancelReservationDto,
  NoShowReservationDto,
  AvailabilityQueryParams,
  ReservationFilterParams,
} from '../types/reservations.types.ts';

export const reservationsApi = {
  /**
   * Lấy danh sách đặt phòng (hỗ trợ phân trang, lọc theo trạng thái, ngày, mã đơn, khách hàng)
   */
  getAll: async (
    params?: ReservationFilterParams
  ): Promise<ApiResponse<PaginatedResult<ReservationSummaryItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<ReservationSummaryItem>>>(
      '/reservations',
      {
        params: { limit: 50, ...params },
      }
    );
    return res.data;
  },

  /** Pending arrival orders for one day, including partially checked-in bookings. */
  getPendingArrivals: async (checkInDate: string): Promise<ReservationSummaryItem[]> => {
    const lists = await Promise.all(
      (['CONFIRMED', 'PARTIALLY_CHECKED_IN'] as const).map(async (status) => {
        const params = { checkInDate, status, limit: 100 };
        const first = await reservationsApi.getAll({ ...params, page: 1 });
        const rest = await Promise.all(
          Array.from({ length: Math.max(0, first.data.pagination.totalPages - 1) }, (_, index) =>
            reservationsApi.getAll({ ...params, page: index + 2 })
          )
        );
        return first.data.items.concat(...rest.map((response) => response.data.items));
      })
    );
    return lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  },

  /**
   * Xem chi tiết đặt phòng bao gồm danh sách phòng, giá từng đêm, thông tin hủy (nếu có)
   */
  getById: async (id: string): Promise<ApiResponse<ReservationDetailItem>> => {
    const res = await apiClient.get<ApiResponse<ReservationDetailItem>>(`/reservations/${id}`);
    return res.data;
  },

  /**
   * Tra cứu tình trạng phòng trống theo khoảng thời gian và số lượng khách
   */
  checkAvailability: async (
    params: AvailabilityQueryParams
  ): Promise<ApiResponse<RoomAvailabilityItem[]>> => {
    const res = await apiClient.get<ApiResponse<RoomAvailabilityItem[]>>(
      '/rooms/availability',
      { params }
    );
    return res.data;
  },

  /**
   * Tạo đơn đặt phòng mới
   */
  create: async (data: CreateReservationDto): Promise<ApiResponse<ReservationDetailItem>> => {
    const res = await apiClient.post<ApiResponse<ReservationDetailItem>>('/reservations', data);
    return res.data;
  },

  /**
   * Hủy đơn đặt phòng (chỉ áp dụng cho đơn CONFIRMED, yêu cầu lý do hủy)
   */
  cancel: async (
    id: string,
    data: CancelReservationDto
  ): Promise<ApiResponse<{ id: string; status: string }>> => {
    const res = await apiClient.post<ApiResponse<{ id: string; status: string }>>(
      `/reservations/${id}/cancel`,
      data
    );
    return res.data;
  },

  /**
   * Đánh dấu khách không đến (No-Show). Chỉ áp dụng cho đơn CONFIRMED,
   * yêu cầu lý do và giải phóng tồn phòng giống thao tác hủy đơn.
   */
  markNoShow: async (
    id: string,
    data: NoShowReservationDto
  ): Promise<ApiResponse<{ id: string; status: string }>> => {
    const res = await apiClient.post<ApiResponse<{ id: string; status: string }>>(
      `/reservations/${id}/no-show`,
      data
    );
    return res.data;
  },
};
