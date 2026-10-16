/**
 * Innvyra PMS - Dynamic Staff Directory & Formatter
 * Cung cấp thông tin tên và chức vụ của nhân viên khách sạn từ API và fallback an toàn
 */

import { useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ROLE_CONFIG, type Role } from '../types/employees.types.ts';
import { employeesApi } from '../api/employees.api.ts';

export interface StaffMemberInfo {
  id: string;
  fullName: string;
  roleTitle: string;
  roleCode: string;
  color: string;
}

// In-memory dynamic registry of loaded staff members from API queries
const dynamicStaffRegistry = new Map<string, StaffMemberInfo>();

/**
 * Register employee records into the dynamic directory cache
 */
export const registerStaffMembers = (
  employees: Array<{ id: string | bigint | number; fullName: string; role: Role | string }>
) => {
  if (!Array.isArray(employees)) return;
  employees.forEach((emp) => {
    const idStr = String(emp.id);
    const roleCode = (emp.role as Role) || 'STAFF';
    const meta = ROLE_CONFIG[roleCode as Role];
    dynamicStaffRegistry.set(idStr, {
      id: idStr,
      fullName: emp.fullName,
      roleTitle: meta ? meta.label : roleCode,
      roleCode,
      color: meta ? meta.color : 'default',
    });
  });
};

/**
 * Known baseline staff - empty by default to prevent displaying disguised / guessed roles
 */
export const KNOWN_STAFF_DIRECTORY: Record<string, StaffMemberInfo> = {};

/**
 * React hook to globally load, cache, and subscribe to staff members.
 * Any consuming component will automatically re-render when staff members are loaded.
 */
export const useStaffDirectory = () => {
  const { data: staffRes, isLoading, refetch } = useQuery({
    queryKey: ['staff-directory-global'],
    queryFn: async () => {
      // Backend validates limit: max 100
      const res = await employeesApi.list({ limit: 100 });
      if (res?.data?.items && Array.isArray(res.data.items)) {
        registerStaffMembers(res.data.items);
      }
      return res;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const staffItems = staffRes?.data?.items;

  // Immediately register in memory if served from React Query cache
  if (staffItems && Array.isArray(staffItems)) {
    registerStaffMembers(staffItems);
  }

  useEffect(() => {
    if (staffItems && Array.isArray(staffItems)) {
      registerStaffMembers(staffItems);
    }
  }, [staffItems]);

  const getStaff = useCallback(
    (
      staffId: string | number | null | undefined,
      currentUser?: { id?: string; fullName?: string; role?: string } | null
    ): StaffMemberInfo => {
      return getStaffDisplay(staffId, currentUser);
    },
    // Dependency on staffItems ensures re-evaluation when staff items are fetched
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staffItems]
  );

  return {
    getStaff,
    isLoading,
    refetch,
    staffList: staffItems || [],
  };
};

/**
 * Trả về thông tin hiển thị gồm Họ tên, Chức vụ và Màu sắc Tag
 * Kiểm tra dynamicStaffRegistry -> KNOWN_STAFF_DIRECTORY -> currentUser -> fallback trung tính
 */
export const getStaffDisplay = (
  staffId: string | number | null | undefined,
  currentUser?: { id?: string; fullName?: string; role?: string } | null
): StaffMemberInfo => {
  if (!staffId) {
    return {
      id: '0',
      fullName: 'Hệ thống tự động',
      roleTitle: 'Hệ thống',
      roleCode: 'SYSTEM',
      color: 'default',
    };
  }

  const idStr = String(staffId);

  // 1. Check dynamic registry first (loaded from API)
  if (dynamicStaffRegistry.has(idStr)) {
    return dynamicStaffRegistry.get(idStr)!;
  }

  // 2. Check baseline directory
  const found = KNOWN_STAFF_DIRECTORY[idStr];
  if (found) {
    return found;
  }

  // 3. Check current user
  if (currentUser && String(currentUser.id) === idStr) {
    const roleCode = (currentUser.role as Role) || 'STAFF';
    const meta = ROLE_CONFIG[roleCode as Role];

    return {
      id: idStr,
      fullName: currentUser.fullName || `Nhân viên #${idStr}`,
      roleTitle: meta ? meta.label : roleCode,
      roleCode,
      color: meta ? meta.color : 'blue',
    };
  }

  // 4. Safe neutral fallback for historical or deactivated staff without guessing names
  return {
    id: idStr,
    fullName: `Nhân viên #${idStr}`,
    roleTitle: 'Nhân viên',
    roleCode: 'STAFF',
    color: 'default',
  };
};

/**
 * Dictionary hành động buồng phòng (Housekeeping Audit Actions)
 */
export const HOUSEKEEPING_ACTIONS: Record<string, { label: string; color: string }> = {
  TASK_CREATED: { label: 'Tạo nhiệm vụ dọn phòng', color: 'blue' },
  TASK_ASSIGNED: { label: 'Phân công nhân viên', color: 'cyan' },
  TASK_START: { label: 'Bắt đầu làm vệ sinh', color: 'processing' },
  CLEANING_STARTED: { label: 'Bắt đầu làm vệ sinh', color: 'processing' },
  TASK_COMPLETE: { label: 'Đã dọn xong, chờ kiểm tra', color: 'warning' },
  AWAITING_INSPECTION: { label: 'Đã dọn xong, chờ kiểm tra', color: 'warning' },
  INSPECTION_PASSED: { label: 'Nghiệm thu: ĐẠT CHUẨN', color: 'success' },
  INSPECTION_FAILED: { label: 'Nghiệm thu: KHÔNG ĐẠT (Cần dọn lại)', color: 'error' },
  TASK_CANCEL: { label: 'Hủy nhiệm vụ dọn phòng', color: 'default' },
  TASK_CANCELLED: { label: 'Hủy nhiệm vụ dọn phòng', color: 'default' },
  MAINTENANCE_REWORK: { label: 'Yêu cầu dọn lại do bảo trì', color: 'purple' },
};

export const getHousekeepingActionDisplay = (action: string) => {
  return HOUSEKEEPING_ACTIONS[action] || { label: action, color: 'default' };
};

/**
 * Dictionary hành động bảo trì (Maintenance Audit Actions)
 */
export const MAINTENANCE_ACTIONS: Record<string, { label: string; color: string }> = {
  TICKET_REPORTED: { label: 'Báo cáo sự cố bảo trì mới', color: 'warning' },
  TICKET_ASSIGNED: { label: 'Phân công kỹ thuật viên', color: 'cyan' },
  TICKET_START: { label: 'Bắt đầu xử lý sự cố', color: 'processing' },
  TICKET_RESOLVE: { label: 'Đã khắc phục sự cố, chờ đóng', color: 'purple' },
  TICKET_CLOSE: { label: 'Đóng phiếu sự cố thành công', color: 'success' },
  TICKET_CANCEL: { label: 'Hủy phiếu sự cố bảo trì', color: 'default' },
  BLOCK_CREATED: { label: 'Tạo lệnh khóa phòng bảo trì (OOO/OOS)', color: 'error' },
  BLOCK_RELEASE: { label: 'Nghiệm thu & mở khóa phòng', color: 'success' },
  BLOCK_CANCEL: { label: 'Hủy lệnh khóa phòng', color: 'default' },
  BLOCK_AUTO_ACTIVATED: { label: 'Tự động kích hoạt khóa phòng', color: 'volcano' },
  MAINTENANCE_REWORK: { label: 'Yêu cầu buồng phòng dọn lại', color: 'purple' },
};

export const getMaintenanceActionDisplay = (action: string) => {
  return MAINTENANCE_ACTIONS[action] || { label: action, color: 'default' };
};

/**
 * Định dạng ghi chú audit log thân thiện với người dùng tiếng Việt
 */
export const formatAuditNote = (note: string | null | undefined): string => {
  if (!note) return '';
  const trimmed = note.trim();
  if (trimmed === 'Turnover after checkout or room transfer') {
    return 'Dọn dẹp phòng sau khi khách trả phòng hoặc đổi phòng';
  }
  if (trimmed.startsWith('Assigned to staff ')) {
    const staffId = trimmed.replace('Assigned to staff ', '').trim();
    const staff = getStaffDisplay(staffId);
    return `Phân công nhiệm vụ cho: ${staff.fullName} (${staff.roleTitle})`;
  }
  return trimmed;
};
