import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  HousekeepingTaskItem,
  DirtyRoomItem,
  CreateHousekeepingTaskDto,
  AssignHousekeepingTaskDto,
  InspectHousekeepingTaskDto,
  CancelHousekeepingTaskDto,
  HousekeepingFilterParams,
  DirtyRoomFilterParams,
} from '../types/operations.types.ts';

export const housekeepingApi = {
  /**
   * Lấy danh sách nhiệm vụ buồng phòng (phân trang, lọc theo trạng thái, độ ưu tiên, phòng, tầng)
   * GET /housekeeping/tasks
   */
  getAll: async (
    params?: HousekeepingFilterParams
  ): Promise<ApiResponse<PaginatedResult<HousekeepingTaskItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<HousekeepingTaskItem>>>(
      '/housekeeping/tasks',
      {
        params: { limit: 50, ...params },
      }
    );
    return res.data;
  },

  /**
   * Lấy chi tiết nhiệm vụ buồng phòng kèm lịch sử dòng thời gian (audit logs)
   * GET /housekeeping/tasks/:id
   */
  getById: async (id: string): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.get<ApiResponse<HousekeepingTaskItem>>(`/housekeeping/tasks/${id}`);
    return res.data;
  },

  /**
   * Tạo nhiệm vụ dọn phòng mới (chỉ áp dụng cho phòng trống đang DIRTY)
   * POST /housekeeping/tasks
   */
  create: async (data: CreateHousekeepingTaskDto): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.post<ApiResponse<HousekeepingTaskItem>>(
      '/housekeeping/tasks',
      data
    );
    return res.data;
  },

  /**
   * Phân công nhân viên buồng phòng thực hiện
   * PATCH /housekeeping/tasks/:id/assign
   */
  assign: async (
    id: string,
    data: AssignHousekeepingTaskDto
  ): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.patch<ApiResponse<HousekeepingTaskItem>>(
      `/housekeeping/tasks/${id}/assign`,
      data
    );
    return res.data;
  },

  /**
   * Bắt đầu dọn dẹp (chuyển phòng sang CLEANING, nhiệm vụ sang IN_PROGRESS)
   * POST /housekeeping/tasks/:id/start
   */
  start: async (id: string): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.post<ApiResponse<HousekeepingTaskItem>>(
      `/housekeeping/tasks/${id}/start`,
      {}
    );
    return res.data;
  },

  /**
   * Hoàn thành dọn dẹp, gửi yêu cầu nghiệm thu (phòng sang INSPECTION, nhiệm vụ sang AWAITING_INSPECTION)
   * POST /housekeeping/tasks/:id/complete
   */
  complete: async (
    id: string,
    notes?: string
  ): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.post<ApiResponse<HousekeepingTaskItem>>(
      `/housekeeping/tasks/${id}/complete`,
      notes ? { notes } : {}
    );
    return res.data;
  },

  /**
   * Nghiệm thu buồng phòng (Pass: nhiệm vụ COMPLETED, phòng READY; Fail: quay về PENDING & DIRTY)
   * POST /housekeeping/tasks/:id/inspect
   */
  inspect: async (
    id: string,
    data: InspectHousekeepingTaskDto
  ): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.post<ApiResponse<HousekeepingTaskItem>>(
      `/housekeeping/tasks/${id}/inspect`,
      data
    );
    return res.data;
  },

  /**
   * Hủy nhiệm vụ dọn phòng (phòng giữ nguyên DIRTY)
   * POST /housekeeping/tasks/:id/cancel
   */
  cancel: async (
    id: string,
    data: CancelHousekeepingTaskDto
  ): Promise<ApiResponse<HousekeepingTaskItem>> => {
    const res = await apiClient.post<ApiResponse<HousekeepingTaskItem>>(
      `/housekeeping/tasks/${id}/cancel`,
      data
    );
    return res.data;
  },

  /**
   * Lấy danh sách các phòng bẩn (DIRTY) cần dọn dẹp
   * GET /housekeeping/dirty-rooms
   */
  getDirtyRooms: async (
    params?: DirtyRoomFilterParams
  ): Promise<ApiResponse<PaginatedResult<DirtyRoomItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<DirtyRoomItem>>>(
      '/housekeeping/dirty-rooms',
      {
        params: { limit: 100, ...params },
      }
    );
    return res.data;
  },
};
