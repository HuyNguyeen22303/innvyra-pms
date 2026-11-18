import { Prisma } from '../../generated/prisma/client.js';
import { asDate, asDateOnly, hotelToday } from './reservation.dates.js';

// A block-managed MAINTENANCE room stays in base capacity; its date intervals
// are subtracted once by inventoryNights. Independent technical restrictions
// remove the room from base capacity and never subtract a second time.
export const sellableRoomWhere = {
  isActive: true,
  OR: [{ physicalStatus: 'ACTIVE' }, { physicalStatus: 'MAINTENANCE', maintenanceManaged: true }],
} satisfies Prisma.RoomWhereInput;

export async function availableByRoomType(
  db: Prisma.TransactionClient,
  hotelId: bigint,
  typeIds: bigint[],
  from: Date,
  until: Date,
) {
  if (!typeIds.length) return new Map<bigint, number>();
  const capacity = await db.room.groupBy({
    by: ['roomTypeId'],
    where: { hotelId, roomTypeId: { in: typeIds }, ...sellableRoomWhere },
    _count: { _all: true },
  });
  const reserved = await db.$queryRaw<{ roomTypeId: bigint; stayDate: Date; count: bigint }[]>(Prisma.sql`
    SELECT rr.room_type_id AS roomTypeId, n.stay_date AS stayDate, COUNT(*) AS count
    FROM reservation_room_nights n
    JOIN reservation_rooms rr ON rr.id = n.reservation_room_id AND rr.hotel_id = ${hotelId}
    JOIN reservations r ON r.id = rr.reservation_id AND r.hotel_id = rr.hotel_id
    WHERE rr.room_type_id IN (${Prisma.join(typeIds)})
      AND n.stay_date >= CAST(${asDateOnly(from)} AS DATE)
      AND n.stay_date < CAST(${asDateOnly(until)} AS DATE)
      AND r.status IN (${Prisma.join([...inventoryStatuses])})
    GROUP BY rr.room_type_id, n.stay_date
  `);
  const blocks = await db.maintenanceBlock.findMany({
    where: {
      hotelId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      endDate: { gt: from },
      startDate: { lt: until },
      room: { hotelId, roomTypeId: { in: typeIds }, ...sellableRoomWhere },
    },
    select: { roomId: true, startDate: true, endDate: true, room: { select: { roomTypeId: true } } },
  });

  const types = new Map(typeIds.map((id) => [id, new Map<number, number>()]));
  for (const row of reserved)
    types.get(row.roomTypeId)!.set(row.stayDate.getTime(), Number(row.count));
  const blocksByType = new Map<bigint, typeof blocks>();
  for (const block of blocks) {
    const id = block.room.roomTypeId;
    const bucket = blocksByType.get(id) ?? [];
    bucket.push(block);
    blocksByType.set(id, bucket);
  }
  const capacities = new Map(capacity.map((row) => [row.roomTypeId, row._count._all]));
  const result = new Map<bigint, number>();
  for (const [id, counts] of types) {
    addBlockedNights(counts, blocksByType.get(id) ?? [], from, until);
    let peak = 0;
    for (const count of counts.values()) peak = Math.max(peak, count);
    result.set(id, Math.max(0, (capacities.get(id) ?? 0) - peak));
  }
  return result;
}

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
  addBlockedNights(counts, blocks, from, until);
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([day, count]) => ({ stayDate: new Date(day), _count: { _all: count } }));
}

function addBlockedNights(
  counts: Map<number, number>,
  blocks: { roomId: bigint; startDate: Date; endDate: Date }[],
  from: Date,
  until?: Date,
) {
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
