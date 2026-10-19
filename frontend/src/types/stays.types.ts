import type { ReservationStatus } from './reservations.types.ts';
import type { HousekeepingStatus } from './rooms.types.ts';

export type StayStatus = 'CHECKED_IN' | 'CHECKED_OUT';

export interface StaySummaryItem {
  stayId: string;
  reservationId: string;
  reservationRoomId: string;
  confirmationCode: string;
  bookerGuest?: {
    id: string;
    fullName: string;
  };
  room: {
    id: string;
    roomNumber: string;
    housekeepingStatus: HousekeepingStatus;
  };
  roomType: {
    id: string;
    code: string;
    name: string;
  };
  status: StayStatus;
  actualCheckinAt: string;
  actualCheckoutAt: string | null;
}

export interface StayDetailItem extends StaySummaryItem {
  reservation: {
    id: string;
    confirmationCode: string;
    status: ReservationStatus;
    checkInDate: string;
    checkOutDate: string;
  };
  checkinNotes?: string | null;
  checkoutNotes?: string | null;
  checkinStaff?: {
    id: string;
    fullName: string;
  };
  checkoutStaff?: {
    id: string;
    fullName: string;
  } | null;
  transfers?: Array<{
    id: string;
    fromRoom: {
      id: string;
      roomNumber: string;
    };
    toRoom: {
      id: string;
      roomNumber: string;
    };
    transferredAt: string;
    transferredBy: {
      id: string;
      fullName: string;
    };
    reason: string;
  }>;
}

export interface CheckinDto {
  roomId: string;
  notes?: string | null;
}

export interface CheckoutDto {
  notes?: string | null;
}

export interface TransferRoomDto {
  toRoomId: string;
  reason: string;
}

export interface StayFilterParams {
  page?: number;
  limit?: number;
  status?: StayStatus;
  roomId?: string;
  roomNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  search?: string;
  sortBy?: 'actualCheckinAt' | 'actualCheckoutAt' | 'createdAt' | 'id';
  sortOrder?: 'asc' | 'desc';
}
