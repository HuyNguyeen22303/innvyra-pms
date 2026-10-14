import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type {
  createReservationBody,
  availabilityQuery,
  reservationListQuery,
  cancelReservationBody,
} from './reservation.schema.js';
import type { PrismaReservationRepository } from './reservation.repository.js';

export type CreateReservationInput = z.infer<typeof createReservationBody>;
export type AvailabilityQuery = z.infer<typeof availabilityQuery>;
export type ReservationQuery = z.infer<typeof reservationListQuery>;
export type CancelReservationInput = z.infer<typeof cancelReservationBody>;
export type ReservationScope = { hotelId: bigint; actorId: bigint; role: RoleCode };
export const reservationPermissions = {
  read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  write: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  availability: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
} as const;
export type ReservationRepository = Pick<
  PrismaReservationRepository,
  keyof PrismaReservationRepository
>;
export type ReservationOperations = Omit<
  ReservationRepository,
  'withHotelLock' | 'snapshot' | 'list'
>;
export type PricedRoom = {
  roomTypeId: bigint;
  adults: number;
  children: number;
  nights: { stayDate: Date; nightlyRate: Prisma.Decimal }[];
};
export type ReservationWrite = {
  guestId: bigint;
  checkInDate: Date;
  checkOutDate: Date;
  bookingSource: string;
  notes: string | null;
  totalAmount: Prisma.Decimal;
  rooms: PricedRoom[];
};
