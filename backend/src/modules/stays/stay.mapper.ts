import type { Prisma } from '../../generated/prisma/client.js';
import type { RoleCode } from '../../shared/types/roles.js';
import { asDateOnly } from '../reservations/reservation.dates.js';
import type { stayDetailInclude, staySummaryInclude } from './stay.repository.js';

type Summary = Prisma.StayGetPayload<{ include: typeof staySummaryInclude }>;
export type StayRecord = Prisma.StayGetPayload<{ include: typeof stayDetailInclude }>;
const identity = (value: { id: bigint; fullName: string }) => ({
  id: value.id.toString(),
  fullName: value.fullName,
});
const room = (value: { id: bigint; roomNumber: string }) => ({
  id: value.id.toString(),
  roomNumber: value.roomNumber,
});
export function staySummary(record: Summary, role: RoleCode) {
  const reservation = record.reservationRoom.reservation;
  return {
    stayId: record.id.toString(),
    reservationId: reservation.id.toString(),
    reservationRoomId: record.reservationRoomId.toString(),
    confirmationCode: reservation.confirmationCode,
    ...(role !== 'ACCOUNTANT' ? { bookerGuest: identity(reservation.bookerGuest) } : {}),
    room: {
      ...room(record.currentRoom),
      housekeepingStatus: record.currentRoom.housekeepingStatus,
    },
    roomType: { ...record.currentRoom.roomType, id: record.currentRoom.roomType.id.toString() },
    status: record.status,
    actualCheckinAt: record.actualCheckinAt,
    actualCheckoutAt: record.actualCheckoutAt,
  };
}
export function stayDetail(record: StayRecord, role: RoleCode) {
  const reservation = record.reservationRoom.reservation;
  return {
    ...staySummary(record, role),
    reservation: {
      id: reservation.id.toString(),
      confirmationCode: reservation.confirmationCode,
      status: reservation.status,
      checkInDate: asDateOnly(reservation.checkInDate),
      checkOutDate: asDateOnly(reservation.checkOutDate),
    },
    // Physical checkout deliberately makes no claim about payment or settlement.
    ...(role !== 'ACCOUNTANT'
      ? {
          checkinNotes: record.checkinNotes,
          checkoutNotes: record.checkoutNotes,
          checkinStaff: identity(record.checkinStaff),
          checkoutStaff: record.checkoutStaff ? identity(record.checkoutStaff) : null,
          transfers: record.transfers.map((transfer) => ({
            id: transfer.id.toString(),
            fromRoom: room(transfer.fromRoom),
            toRoom: room(transfer.toRoom),
            transferredAt: transfer.transferredAt,
            transferredBy: identity(transfer.staff),
            reason: transfer.reason,
          })),
        }
      : {}),
  };
}
