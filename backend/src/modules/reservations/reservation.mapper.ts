import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import type { detailInclude, summaryInclude } from './reservation.repository.js';
import { asDateOnly } from './reservation.dates.js';

export type ReservationRecord = Prisma.ReservationGetPayload<{ include: typeof detailInclude }>;
type SummaryRecord = Prisma.ReservationGetPayload<{ include: typeof summaryInclude }>;
export function reservationSummary(record: SummaryRecord) {
  return {
    id: record.id.toString(),
    confirmationCode: record.confirmationCode,
    bookerGuest: { id: record.bookerGuest.id.toString(), fullName: record.bookerGuest.fullName },
    checkInDate: asDateOnly(record.checkInDate),
    checkOutDate: asDateOnly(record.checkOutDate),
    totalNights: (record.checkOutDate.getTime() - record.checkInDate.getTime()) / 86400000,
    totalRooms: record._count.rooms,
    status: record.status,
    bookingSource: record.bookingSource,
    totalAmount: record.totalAmount.toFixed(2),
    currency: record.currency,
    createdAt: record.createdAt,
  };
}
export function reservationDetail(record: ReservationRecord, role: RoleCode) {
  return {
    ...reservationSummary(record),
    createdBy: { id: record.creator.id.toString(), fullName: record.creator.fullName },
    updatedAt: record.updatedAt,
    ...(role !== 'ACCOUNTANT' ? { notes: record.notes } : {}),
    cancellation: record.cancelledAt
      ? {
          cancelledAt: record.cancelledAt,
          cancelledBy: record.canceller
            ? { id: record.canceller.id.toString(), fullName: record.canceller.fullName }
            : null,
          ...(role !== 'ACCOUNTANT' ? { reason: record.cancellationReason } : {}),
        }
      : null,
    rooms: record.rooms.map((room) => ({
      id: room.id.toString(),
      roomType: { ...room.roomType, id: room.roomType.id.toString() },
      roomId: room.roomId?.toString() ?? null,
      adults: room.adults,
      children: room.children,
      nights: room.nights.map((night) => ({
        stayDate: asDateOnly(night.stayDate),
        nightlyRate: night.nightlyRate.toFixed(2),
      })),
    })),
  };
}
