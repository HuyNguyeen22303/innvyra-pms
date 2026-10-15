import { apiClient } from './axiosClient.ts';
import type { ApiResponse } from '../types/api.types.ts';
import type {
  RoomTypeItem,
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
  RoomItem,
  CreateRoomDto,
  UpdateRoomDto,
  RoomFilterParams,
} from '../types/rooms.types.ts';

export const roomTypesApi = {
  getAll: async (): Promise<ApiResponse<RoomTypeItem[]>> => {
    const res = await apiClient.get<ApiResponse<RoomTypeItem[]>>('/room-types');
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<RoomTypeItem>> => {
    const res = await apiClient.get<ApiResponse<RoomTypeItem>>(`/room-types/${id}`);
    return res.data;
  },

  create: async (data: CreateRoomTypeDto): Promise<ApiResponse<RoomTypeItem>> => {
    const res = await apiClient.post<ApiResponse<RoomTypeItem>>('/room-types', data);
    return res.data;
  },

  update: async (id: string, data: UpdateRoomTypeDto): Promise<ApiResponse<RoomTypeItem>> => {
    const res = await apiClient.patch<ApiResponse<RoomTypeItem>>(`/room-types/${id}`, data);
    return res.data;
  },

  deactivate: async (id: string): Promise<ApiResponse<RoomTypeItem>> => {
    const res = await apiClient.delete<ApiResponse<RoomTypeItem>>(`/room-types/${id}`);
    return res.data;
  },
};

export const roomsApi = {
  getAll: async (params?: RoomFilterParams): Promise<ApiResponse<RoomItem[]>> => {
    const res = await apiClient.get<ApiResponse<RoomItem[]>>('/rooms', { params });
    return res.data;
  },

  getById: async (id: string): Promise<ApiResponse<RoomItem>> => {
    const res = await apiClient.get<ApiResponse<RoomItem>>(`/rooms/${id}`);
    return res.data;
  },

  create: async (data: CreateRoomDto): Promise<ApiResponse<RoomItem>> => {
    const res = await apiClient.post<ApiResponse<RoomItem>>('/rooms', data);
    return res.data;
  },

  update: async (id: string, data: UpdateRoomDto): Promise<ApiResponse<RoomItem>> => {
    const res = await apiClient.patch<ApiResponse<RoomItem>>(`/rooms/${id}`, data);
    return res.data;
  },

  deactivate: async (id: string): Promise<ApiResponse<RoomItem>> => {
    const res = await apiClient.delete<ApiResponse<RoomItem>>(`/rooms/${id}`);
    return res.data;
  },
};
