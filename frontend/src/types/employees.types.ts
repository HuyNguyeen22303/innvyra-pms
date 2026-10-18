import type { Role } from './auth.types.ts';
export type { Role };

export interface EmployeeItem {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface CreateEmployeeDto {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: Role;
}

export interface UpdateEmployeeDto {
  fullName?: string;
  email?: string | null;
  role?: Role;
}

export interface EmployeeQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
  sortBy?: 'fullName' | 'createdAt' | 'username';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Backend Role Hierarchy Weights:
 * ADMIN: 100 (manages all roles)
 * MANAGER: 80 (only manages roles below 80)
 * RECEPTIONIST: 60
 * HOUSEKEEPING: 40
 * ACCOUNTANT: 40
 * TECHNICIAN: 40
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  MANAGER: 80,
  RECEPTIONIST: 60,
  HOUSEKEEPING: 40,
  ACCOUNTANT: 40,
  TECHNICIAN: 40,
};

/**
 * Check if actor can manage target role according to backend hierarchy
 */
export const canManageRole = (
  actorRole: Role | string | undefined | null,
  targetRole: Role | string | undefined | null
): boolean => {
  if (!actorRole || !targetRole) return false;
  if (actorRole === 'ADMIN') return true;
  const actorWeight = ROLE_HIERARCHY[actorRole as Role] ?? 0;
  const targetWeight = ROLE_HIERARCHY[targetRole as Role] ?? 0;
  return actorWeight > targetWeight;
};

/**
 * List of assignable roles for a given actor
 */
export const getAssignableRoles = (actorRole: Role | string | undefined | null): Role[] => {
  if (!actorRole) return [];
  if (actorRole === 'ADMIN') {
    return ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'];
  }
  if (actorRole === 'MANAGER') {
    return ['RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING', 'TECHNICIAN'];
  }
  return [];
};

/**
 * Visual styling and metadata for roles
 */
export interface RoleMeta {
  label: string;
  code: Role;
  color: string;
  badgeBg: string;
  description: string;
}

export const ROLE_CONFIG: Record<Role, RoleMeta> = {
  ADMIN: {
    label: 'Quản trị viên',
    code: 'ADMIN',
    color: 'magenta',
    badgeBg: '#f759ab',
    description: 'Toàn quyền cấu hình hệ thống, quản lý tài khoản & phân quyền cấp cao',
  },
  MANAGER: {
    label: 'Quản lý KS',
    code: 'MANAGER',
    color: 'blue',
    badgeBg: '#1890ff',
    description: 'Điều hành buồng phòng, duyệt bảo trì, kiểm soát folio và quản lý nhân viên',
  },
  RECEPTIONIST: {
    label: 'Lễ tân',
    code: 'RECEPTIONIST',
    color: 'cyan',
    badgeBg: '#13c2c2',
    description: 'Check-in, Check-out, tạo đơn đặt phòng, quản lý khách và tạo dịch vụ',
  },
  ACCOUNTANT: {
    label: 'Kế toán',
    code: 'ACCOUNTANT',
    color: 'green',
    badgeBg: '#52c41a',
    description: 'Thu ngân, đối soát giao dịch, quyết toán sổ công nợ Folio và hoàn tiền',
  },
  HOUSEKEEPING: {
    label: 'Buồng phòng',
    code: 'HOUSEKEEPING',
    color: 'orange',
    badgeBg: '#fa8c16',
    description: 'Tiếp nhận phòng dọn dẹp, cập nhật trạng thái làm sạch và báo cáo sự cố',
  },
  TECHNICIAN: {
    label: 'Kỹ thuật viên',
    code: 'TECHNICIAN',
    color: 'purple',
    badgeBg: '#722ed1',
    description: 'Khắc phục sự cố trang thiết bị, kiểm tra lệnh bảo trì và mở khóa phòng',
  },
};
