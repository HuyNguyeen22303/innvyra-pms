import { apiClient } from './axiosClient.ts';
import type { ApiResponse, PaginatedResult } from '../types/api.types.ts';
import type {
  EmployeeItem,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQuery,
} from '../types/employees.types.ts';

export const employeesApi = {
  /**
   * List employees with filtering, searching, sorting and pagination
   * Accessible by all 6 authenticated roles
   */
  list: async (params?: EmployeeQuery): Promise<ApiResponse<PaginatedResult<EmployeeItem>>> => {
    const res = await apiClient.get<ApiResponse<PaginatedResult<EmployeeItem>>>('/employees', {
      params,
    });
    return res.data;
  },

  /**
   * Create a new employee with an initial secure password
   * Requires ADMIN or MANAGER role and X-CSRF-Protection: 1
   */
  create: async (data: CreateEmployeeDto): Promise<ApiResponse<EmployeeItem>> => {
    // Sanitize input: clean empty email to undefined/null
    const payload = {
      fullName: data.fullName.trim(),
      username: data.username.trim().toLowerCase(),
      email: data.email?.trim() ? data.email.trim().toLowerCase() : null,
      password: data.password,
      role: data.role,
    };
    const res = await apiClient.post<ApiResponse<EmployeeItem>>('/employees', payload);
    return res.data;
  },

  /**
   * Update an existing employee (fullName, email, role)
   * Username and password cannot be modified through this endpoint
   */
  update: async (id: string, data: UpdateEmployeeDto): Promise<ApiResponse<EmployeeItem>> => {
    const payload: Record<string, unknown> = {};
    if (data.fullName !== undefined) {
      payload.fullName = data.fullName.trim();
    }
    if (data.email !== undefined) {
      payload.email = data.email && data.email.trim() ? data.email.trim().toLowerCase() : null;
    }
    if (data.role !== undefined) {
      payload.role = data.role;
    }

    const res = await apiClient.patch<ApiResponse<EmployeeItem>>(`/employees/${id}`, payload);
    return res.data;
  },

  /**
   * Soft-deactivate an employee account and revoke all active auth sessions
   * Cannot deactivate self or the last active ADMIN
   */
  deactivate: async (id: string): Promise<ApiResponse<EmployeeItem>> => {
    const res = await apiClient.patch<ApiResponse<EmployeeItem>>(`/employees/${id}/deactivate`);
    return res.data;
  },

  /**
   * Re-activate a deactivated employee account
   * Enforces role hierarchy (cannot activate equal or higher role)
   */
  activate: async (id: string): Promise<ApiResponse<EmployeeItem>> => {
    const res = await apiClient.patch<ApiResponse<EmployeeItem>>(`/employees/${id}/activate`);
    return res.data;
  },

  /**
   * Reset an employee password and revoke all active auth sessions
   * Accepts an optional new secure password
   */
  resetPassword: async (id: string, password?: string): Promise<ApiResponse<EmployeeItem>> => {
    const res = await apiClient.post<ApiResponse<EmployeeItem>>(`/employees/${id}/reset-password`, {
      password: password || undefined,
    });
    return res.data;
  },
};
