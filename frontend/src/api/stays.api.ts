import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  StaySummaryItem,
  StayDetailItem,
  CheckinDto,
  CheckoutDto,
  TransferRoomDto,
  StayFilterParams,
} from '../types/stays.types.ts';

export const staysApi = {
  /**
   * Lấy danh sách lượt lưu trú (hỗ trợ phân trang, lọc theo trạng thái CHECKED_IN/CHECKED_OUT, số phòng, ngày)
   */
  getAll: async (
    params?: StayFilterParams
  ): Promise<ApiResponse<PaginatedResult<StaySummaryItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<StaySummaryItem>>>('/stays', {
      params: { limit: 50, ...params },
    });
    return res.data;
  },

  /**
   * Xem chi tiết lượt lưu trú (thông tin checkin, checkout, nhân viên thực hiện, lịch sử chuyển phòng)
   */
  getById: async (id: string): Promise<ApiResponse<StayDetailItem>> => {
    const res = await apiClient.get<ApiResponse<StayDetailItem>>(`/stays/${id}`);
    return res.data;
  },

  /**
   * Thực hiện Check-in nhận phòng cho 1 phòng trong đơn đặt phòng
   * Endpoint: POST /reservations/:reservationId/rooms/:reservationRoomId/check-in
   */
  checkin: async (
    reservationId: string,
    reservationRoomId: string,
    data: CheckinDto
  ): Promise<ApiResponse<StayDetailItem>> => {
    const res = await apiClient.post<ApiResponse<StayDetailItem>>(
      `/reservations/${reservationId}/rooms/${reservationRoomId}/check-in`,
      data
    );
    return res.data;
  },

  /**
   * Thực hiện Check-out trả phòng (giải phóng phòng vật lý sang trạng thái DIRTY)
   * Endpoint: POST /stays/:id/check-out
   */
  checkout: async (id: string, data: CheckoutDto): Promise<ApiResponse<StayDetailItem>> => {
    const res = await apiClient.post<ApiResponse<StayDetailItem>>(`/stays/${id}/check-out`, data);
    return res.data;
  },

  /**
   * Đổi phòng giữa kỳ lưu trú (Room Transfer - yêu cầu cùng hạng phòng và phòng đích phải READY)
   * Endpoint: POST /stays/:id/transfers
   */
  transfer: async (
    id: string,
    data: TransferRoomDto
  ): Promise<ApiResponse<StayDetailItem>> => {
    const res = await apiClient.post<ApiResponse<StayDetailItem>>(`/stays/${id}/transfers`, data);
    return res.data;
  },
};
