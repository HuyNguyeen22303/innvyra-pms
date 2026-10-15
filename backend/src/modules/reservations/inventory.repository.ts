import type { Prisma } from '../../generated/prisma/client.js';
import { asDate, hotelToday } from './reservation.dates.js';

// A block-managed MAINTENANCE room stays in base capacity; its date intervals
// are subtracted once by inventoryNights. Independent technical restrictions
// remove the room from base capacity and never subtract a second time.
export const sellableRoomWhere = {
  isActive: true,
  OR: [{ physicalStatus: 'ACTIVE' }, { physicalStatus: 'MAINTENANCE', maintenanceManaged: true }],
} satisfies Prisma.RoomWhereInput;

export async function inventoryNights(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  roomTypeId: bigint,
  from: Date,
  until?: Date,
) {
  const reserved = await reservedNights(db, hotelId, roomTypeId, from, until);
  const counts = new Map(reserved.map((row) => [row.stayDate.getTime(), row._count._all]));
  const blocks = await db.maintenanceBlock.findMany({
    where: {
      hotelId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      endDate: { gt: from },
      ...(until ? { startDate: { lt: until } } : {}),
      room: { hotelId, roomTypeId, ...sellableRoomWhere },
    },
    select: { roomId: true, startDate: true, endDate: true },
  });
  // Distinct rooms per night also protects reads of legacy overlapping intervals.
  const blocked = new Map<number, Set<bigint>>();
  for (const block of blocks) {
    const end = Math.min(block.endDate.getTime(), until?.getTime() ?? Infinity);
    for (
      let day = Math.max(from.getTime(), block.startDate.getTime());
      day < end;
      day += 86400000
    ) {
      const rooms = blocked.get(day) ?? new Set<bigint>();
      rooms.add(block.roomId);
      blocked.set(day, rooms);
    }
  }
  for (const [day, rooms] of blocked) counts.set(day, (counts.get(day) ?? 0) + rooms.size);
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([day, count]) => ({ stayDate: new Date(day), _count: { _all: count } }));
}

// Night rows are the inventory ledger. Only these states consume capacity.
// All decisions that change capacity or occupancy hold the hotel row lock first.
// Physical checkout (including early departure) never releases booked nights.
export const inventoryStatuses = [
  'CONFIRMED',
  'PARTIALLY_CHECKED_IN',
  'CHECKED_IN',
  'CHECKED_OUT',
] as const;
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
  const counts = await inventoryNights(db, hotelId, roomTypeId, asDate(hotelToday(hotel.timezone)));
  return counts.reduce((peak, row) => Math.max(peak, row._count._all), 0);
}
