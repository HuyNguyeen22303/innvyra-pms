/**
 * Innvyra PMS - Staff Directory & Formatter
 * Cung cấp thông tin tên và chức vụ của nhân viên khách sạn
 */

export interface StaffMemberInfo {
  id: string;
  fullName: string;
  roleTitle: string;
  roleCode: string;
  color: string;
}

export const KNOWN_STAFF_DIRECTORY: Record<string, StaffMemberInfo> = {
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
};

/**
 * Trả về thông tin hiển thị gồm Họ tên, Chức vụ và Màu sắc Tag
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
  const found = KNOWN_STAFF_DIRECTORY[idStr];
  if (found) {
    return found;
  }

  if (currentUser && String(currentUser.id) === idStr) {
    const roleCode = currentUser.role || 'STAFF';
    const roleTitle =
      roleCode === 'MANAGER'
        ? 'Quản lý KS'
        : roleCode === 'RECEPTIONIST'
        ? 'Lễ tân'
        : roleCode === 'ACCOUNTANT'
        ? 'Kế toán'
        : roleCode === 'HOUSEKEEPING'
        ? 'Buồng phòng'
        : roleCode === 'TECHNICIAN'
        ? 'Kỹ thuật viên'
        : roleCode === 'ADMIN'
        ? 'Quản trị viên'
        : 'Nhân viên';

    return {
      id: idStr,
      fullName: currentUser.fullName || `Nhân viên #${idStr}`,
      roleTitle,
      roleCode,
      color: 'blue',
    };
  }

  return {
    id: idStr,
    fullName: `Nhân viên #${idStr}`,
    roleTitle: 'Nhân sự KS',
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
