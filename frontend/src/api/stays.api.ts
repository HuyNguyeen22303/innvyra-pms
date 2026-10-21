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
   * Lấy TOÀN BỘ lượt lưu trú khớp bộ lọc, không chỉ trang đầu.
   *
   * Backend giới hạn `limit` tối đa 100 mỗi request (stayListQuery -> paginationFields),
   * nên một lần gọi không thể trả hết dữ liệu. Hàm này đi lần lượt các trang cho tới
   * khi phủ đủ `pagination.total`, để trang Stays có đủ dữ liệu mà lọc theo tên khách
   * ngay trên client (không cần đổi backend).
   */
  getAllPages: async (
    params?: StayFilterParams,
    pageSize = 100
  ): Promise<StaySummaryItem[]> => {
    const first = await staysApi.getAll({ ...params, page: 1, limit: pageSize });
    const firstItems: StaySummaryItem[] = Array.isArray(first.data)
      ? first.data
      : first.data?.items || [];
    const total = Array.isArray(first.data)
      ? firstItems.length
      : first.data?.pagination?.total ?? firstItems.length;

    if (firstItems.length >= total) return firstItems;

    // Remaining pages are independent, so fetch them in parallel.
    const loadedPages = Math.ceil(firstItems.length / pageSize);
    const totalPages = Math.ceil(total / pageSize);
    const rest = await Promise.all(
      Array.from({ length: Math.max(totalPages - loadedPages, 0) }, (_, idx) =>
        staysApi.getAll({ ...params, page: loadedPages + idx + 1, limit: pageSize })
      )
    );

    return rest.reduce<StaySummaryItem[]>((acc, res) => {
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      return acc.concat(items);
    }, firstItems);
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
