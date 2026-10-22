export type ReservationStatus =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'NO_SHOW'
  | 'PARTIALLY_CHECKED_IN';

export type BookingSource =
  | 'DIRECT'
  | 'PHONE'
  | 'EMAIL'
  | 'WALK_IN'
  | 'AGENT'
  | 'OTHER';

export interface RoomAvailabilityItem {
  roomTypeId: string;
  roomTypeName: string;
  availableRooms: number;
  basePrice: string;
  estimatedTotalPerRoom: string;
  currency: string;
}

export interface ReservationSummaryItem {
  id: string;
  confirmationCode: string;
  bookerGuest: {
    id: string;
    fullName: string;
  };
  checkInDate: string;
  checkOutDate: string;
  totalNights: number;
  totalRooms: number;
  status: ReservationStatus;
  bookingSource: BookingSource;
  totalAmount: string;
  currency: string;
  createdAt: string;
}

export interface ReservationDetailItem extends ReservationSummaryItem {
  createdBy: {
    id: string;
    fullName: string;
  };
  updatedAt: string;
  notes?: string | null;
  cancellation?: {
    cancelledAt: string;
    cancelledBy: {
      id: string;
      fullName: string;
    } | null;
    reason?: string | null;
  } | null;
  rooms: Array<{
    id: string;
    roomType: {
      id: string;
      code: string;
      name: string;
    };
    roomId: string | null;
    stay: {
      id: string;
      status: string;
    } | null;
    adults: number;
    children: number;
    nights: Array<{
      stayDate: string;
      nightlyRate: string;
    }>;
  }>;
}

export interface CreateReservationDto {
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: Array<{
    roomTypeId: string;
    quantity: number;
    adults: number;
    children?: number;
  }>;
  bookingSource?: BookingSource;
  notes?: string | null;
}

export interface CancelReservationDto {
  reason: string;
}

export interface NoShowReservationDto {
  reason: string;
}

export interface AvailabilityQueryParams {
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  roomTypeId?: string;
}

export interface ReservationFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  guestId?: string;
  guestSearch?: string;
  status?: ReservationStatus;
  checkInDate?: string;
  checkOutDate?: string;
  bookingSource?: BookingSource;
  sortBy?: 'createdAt' | 'checkInDate' | 'checkOutDate' | 'totalAmount' | 'confirmationCode';
  sortOrder?: 'asc' | 'desc';
}
