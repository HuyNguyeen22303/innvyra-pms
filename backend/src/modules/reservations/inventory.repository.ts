import type { Prisma } from '../../generated/prisma/client.js';
import { asDate, hotelToday } from './reservation.dates.js';

// Night rows are the inventory ledger. Only these states consume capacity.
// All decisions that change capacity or occupancy hold the hotel row lock first.
export const inventoryStatuses = ['CONFIRMED', 'CHECKED_IN'] as const;
export function reservedNights(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  roomTypeId: bigint,
  from: Date,
  until?: Date,
) {
  return db.reservationRoomNight.groupBy({
    by: ['stayDate'],
    where: {
      stayDate: { gte: from, ...(until ? { lt: until } : {}) },
      reservationRoom: {
        hotelId,
        roomTypeId,
        reservation: { hotelId, status: { in: [...inventoryStatuses] } },
      },
    },
    _count: { _all: true },
  });
}
export async function futureReservedPeak(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  roomTypeId: bigint,
) {
  const hotel = await db.hotel.findUniqueOrThrow({
    where: { id: hotelId },
    select: { timezone: true },
  });
  const counts = await reservedNights(db, hotelId, roomTypeId, asDate(hotelToday(hotel.timezone)));
  return counts.reduce((peak, row) => Math.max(peak, row._count._all), 0);
}
