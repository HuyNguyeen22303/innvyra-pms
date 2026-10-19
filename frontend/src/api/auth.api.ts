import { apiClient } from './axiosClient.ts';
import type { ApiResponse } from '../types/api.types.ts';
import type { CurrentUser, LoginCredentials, AuthTokens } from '../types/auth.types.ts';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<ApiResponse<AuthTokens>> => {
    const response = await apiClient.post<ApiResponse<AuthTokens>>('/auth/login', credentials);
    return response.data;
  },

  logout: async (): Promise<ApiResponse<object>> => {
    const response = await apiClient.post<ApiResponse<object>>('/auth/logout');
    return response.data;
  },

  getMe: async (): Promise<ApiResponse<CurrentUser>> => {
    const response = await apiClient.get<ApiResponse<CurrentUser>>('/auth/me');
    return response.data;
  },

  refreshToken: async (): Promise<ApiResponse<{ accessToken: string; tokenType: string; expiresIn: number }>> => {
    const response = await apiClient.post<ApiResponse<{ accessToken: string; tokenType: string; expiresIn: number }>>('/auth/refresh');
    return response.data;
  },

  adminCheck: async (): Promise<ApiResponse<object>> => {
    const response = await apiClient.get<ApiResponse<object>>('/auth/admin-check');
    return response.data;
  },
};
