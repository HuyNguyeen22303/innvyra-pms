/**
 * Types & Data Transfer Objects for Operations Management
 * Phase 7: Housekeeping & Maintenance
 */

// ==========================================
// COMMON OPERATIONS TYPES
// ==========================================

export interface OperationsAuditLogItem {
  id: string;
  hotelId: string;
  actorId: string;
  taskId: string | null;
  ticketId: string | null;
  blockId: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface OperationRoomInfo {
  id: string;
  roomNumber: string;
  floorNumber: number;
  roomTypeId: string;
  physicalStatus: string;
  housekeepingStatus: string;
  isActive: boolean;
}

export interface StaffOption {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

// ==========================================
// HOUSEKEEPING TYPES
// ==========================================

export type HousekeepingPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type HousekeepingTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'AWAITING_INSPECTION'
  | 'COMPLETED'
  | 'CANCELLED';

export type HousekeepingTaskType = 'TURNOVER_CLEANING';

export interface HousekeepingTaskItem {
  id: string;
  hotelId: string;
  roomId: string;
  taskType: HousekeepingTaskType;
  status: HousekeepingTaskStatus;
  priority: HousekeepingPriority;
  assignedTo: string | null;
  createdBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  inspectedAt?: string | null;
  room: OperationRoomInfo;
  history?: OperationsAuditLogItem[];
}

export interface DirtyRoomItem {
  id: string;
  roomNumber: string;
  floorNumber: number;
  roomTypeId: string;
  physicalStatus: string;
  housekeepingStatus: string;
  isActive: boolean;
}

export interface CreateHousekeepingTaskDto {
  roomId: string;
  taskType?: 'TURNOVER_CLEANING';
  priority?: HousekeepingPriority;
  notes?: string;
}

export interface AssignHousekeepingTaskDto {
  staffId: string;
}

export interface InspectHousekeepingTaskDto {
  passed: boolean;
  notes?: string;
}

export interface CancelHousekeepingTaskDto {
  reason: string;
}

export interface HousekeepingFilterParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  sortBy?: 'createdAt' | 'priority' | 'status';
  status?: HousekeepingTaskStatus;
  priority?: HousekeepingPriority;
  roomId?: string;
  assignedTo?: string;
  taskType?: 'TURNOVER_CLEANING';
  floorNumber?: number;
}

export interface DirtyRoomFilterParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  sortBy?: 'roomNumber' | 'floorNumber';
  floorNumber?: number;
}

// ==========================================
// MAINTENANCE TICKETS TYPES
// ==========================================

export type MaintenancePriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type MaintenanceTicketStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELLED';

export interface MaintenanceTicketItem {
  id: string;
  hotelId: string;
  roomId: string;
  title: string;
  description: string;
  status: MaintenanceTicketStatus;
  priority: MaintenancePriority;
  assignedTo: string | null;
  reportedBy: string;
  reportedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNotes: string | null;
  closingNotes?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  room: OperationRoomInfo;
  history?: OperationsAuditLogItem[];
}

export interface CreateMaintenanceTicketDto {
  roomId: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
}

export interface AssignMaintenanceTicketDto {
  staffId: string;
}

export interface ResolveMaintenanceTicketDto {
  resolutionNotes: string;
}

export interface CloseMaintenanceTicketDto {
  closingNotes?: string;
}

export interface CancelMaintenanceTicketDto {
  cancellationReason: string;
}

export interface TicketFilterParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  sortBy?: 'reportedAt' | 'priority' | 'status';
  search?: string;
  status?: MaintenanceTicketStatus;
  priority?: MaintenancePriority;
  roomId?: string;
  assignedTo?: string;
  fromDate?: string;
  toDate?: string;
}

// ==========================================
// MAINTENANCE BLOCKS TYPES
// ==========================================

export type MaintenanceBlockStatus = 'SCHEDULED' | 'ACTIVE' | 'RELEASED' | 'CANCELLED';

export interface MaintenanceBlockItem {
  id: string;
  hotelId: string;
  roomId: string;
  maintenanceTicketId: string | null;
  status: MaintenanceBlockStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  createdBy: string;
  releasedBy: string | null;
  releasedAt: string | null;
  releaseNotes?: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  room: OperationRoomInfo;
  ticket?: {
    id: string;
    title: string;
    status: string;
  } | null;
  history?: OperationsAuditLogItem[];
}

export interface CreateMaintenanceBlockDto {
  roomId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  maintenanceTicketId?: string;
}

export interface ReleaseMaintenanceBlockDto {
  notes: string;
}

export interface CancelMaintenanceBlockDto {
  reason: string;
}

export interface BlockFilterParams {
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  sortBy?: 'startDate' | 'createdAt';
  status?: MaintenanceBlockStatus;
  roomId?: string;
  maintenanceTicketId?: string;
  fromDate?: string;
  toDate?: string;
}
