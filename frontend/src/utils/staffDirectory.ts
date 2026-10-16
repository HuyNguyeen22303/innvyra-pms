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
 * Known baseline staff from initial database seed for backwards compatibility
 */
export const KNOWN_STAFF_DIRECTORY: Record<string, StaffMemberInfo> = {
  // Legacy / 1-digit seed IDs
  '1': {
    id: '1',
    fullName: 'Nguyễn Minh Anh',
    roleTitle: 'Quản lý KS',
    roleCode: 'MANAGER',
    color: 'blue',
  },
  '2': {
    id: '2',
    fullName: 'Trần Ngọc Linh',
    roleTitle: 'Lễ tân',
    roleCode: 'RECEPTIONIST',
    color: 'cyan',
  },
  '3': {
    id: '3',
    fullName: 'Lê Thu Hà',
    roleTitle: 'Kế toán',
    roleCode: 'ACCOUNTANT',
    color: 'green',
  },
  '4': {
    id: '4',
    fullName: 'Phạm Thị Lan',
    roleTitle: 'Buồng phòng',
    roleCode: 'HOUSEKEEPING',
    color: 'orange',
  },
  '5': {
    id: '5',
    fullName: 'Hoàng Văn Nam',
    roleTitle: 'Kỹ thuật viên',
    roleCode: 'TECHNICIAN',
    color: 'purple',
  },
  '6': {
    id: '6',
    fullName: 'System Administrator',
    roleTitle: 'Quản trị viên',
    roleCode: 'ADMIN',
    color: 'red',
  },
  // MariaDB autoincrement baseline seed IDs (101 - 117)
  '101': {
    id: '101',
    fullName: 'System Administrator',
    roleTitle: 'Quản trị viên',
    roleCode: 'ADMIN',
    color: 'red',
  },
  '102': {
    id: '102',
    fullName: 'Nguyễn Minh Anh',
    roleTitle: 'Quản lý KS',
    roleCode: 'MANAGER',
    color: 'blue',
  },
  '103': {
    id: '103',
    fullName: 'Hoàng Tiến Dũng',
    roleTitle: 'Phó QL Ca Tối',
    roleCode: 'MANAGER',
    color: 'blue',
  },
  '104': {
    id: '104',
    fullName: 'Trần Ngọc Linh',
    roleTitle: 'Lễ tân Ca Sáng',
    roleCode: 'RECEPTIONIST',
    color: 'cyan',
  },
  '105': {
    id: '105',
    fullName: 'Phạm Thị Lan',
    roleTitle: 'Buồng phòng',
    roleCode: 'HOUSEKEEPING',
    color: 'orange',
  },
  '106': {
    id: '106',
    fullName: 'Lê Thu Hà',
    roleTitle: 'Kế toán Tổng hợp',
    roleCode: 'ACCOUNTANT',
    color: 'green',
  },
  '107': {
    id: '107',
    fullName: 'Hoàng Văn Nam',
    roleTitle: 'Kỹ thuật Điện lạnh',
    roleCode: 'TECHNICIAN',
    color: 'purple',
  },
  '108': {
    id: '108',
    fullName: 'Lê Hải Nam',
    roleTitle: 'Lễ tân Ca Chiều',
    roleCode: 'RECEPTIONIST',
    color: 'cyan',
  },
  '109': {
    id: '109',
    fullName: 'Nguyễn Tuyết Mai',
    roleTitle: 'Buồng phòng Ca Sáng',
    roleCode: 'HOUSEKEEPING',
    color: 'orange',
  },
  '110': {
    id: '110',
    fullName: 'Nguyễn Việt Dũng',
    roleTitle: 'Kế toán Thu ngân',
    roleCode: 'ACCOUNTANT',
    color: 'green',
  },
};

/**
 * React hook to globally load, cache, and subscribe to staff members.
 * Any consuming component will automatically re-render when staff members are loaded.
 */
export const useStaffDirectory = () => {
  const { data: staffRes, isLoading, refetch } = useQuery({
    queryKey: ['staff-directory-global'],
    queryFn: () => employeesApi.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const staffItems = staffRes?.data?.items;

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
