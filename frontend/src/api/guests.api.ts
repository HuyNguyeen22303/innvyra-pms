import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  GuestSummary,
  GuestDetail,
  CreateGuestDto,
  UpdateGuestDto,
  GuestFilterParams,
} from '../types/guests.types.ts';

export const guestsApi = {
  getAll: async (
    params?: GuestFilterParams
  ): Promise<ApiResponse<PaginatedResult<GuestSummary>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<GuestSummary>>>(
      '/guests',
      {
        params: { limit: 100, ...params },
      }
    );
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<GuestDetail>> => {
    const res = await apiClient.get<ApiResponse<GuestDetail>>(`/guests/${id}`);
    return res.data;
  },

  create: async (data: CreateGuestDto): Promise<ApiResponse<GuestDetail>> => {
    const res = await apiClient.post<ApiResponse<GuestDetail>>('/guests', data);
    return res.data;
  },

  update: async (
    id: string,
    data: UpdateGuestDto
  ): Promise<ApiResponse<GuestDetail>> => {
    const res = await apiClient.patch<ApiResponse<GuestDetail>>(
      `/guests/${id}`,
      data
    );
    return res.data;
  },

  delete: async (id: string): Promise<ApiResponse<{ id: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ id: string }>>(
      `/guests/${id}`
    );
    return res.data;
  },
};
