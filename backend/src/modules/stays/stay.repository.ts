import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient, type Stay } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { StayOperations, StayQuery, StayScope } from './stay.types.js';
import { localDateRange } from './stay.dates.js';
import { ensureTurnoverTask } from '../housekeeping/housekeeping.repository.js';
import { asDate, hotelToday } from '../reservations/reservation.dates.js';
import { PrismaBillingRepository } from '../billing/billing.repository.js';

const identity = { select: { id: true, fullName: true } } as const;
const roomIdentity = { select: { id: true, roomNumber: true } } as const;
const staySortColumns = {
  actualCheckinAt: Prisma.sql`s.actual_checkin_at`,
  actualCheckoutAt: Prisma.sql`s.actual_checkout_at`,
  createdAt: Prisma.sql`s.created_at`,
  id: Prisma.sql`s.id`,
};
type StayStatusCount = { status: Stay['status']; count: number | bigint };
function countByStayStatus(rows: StayStatusCount[]) {
  const counts = { CHECKED_IN: 0, CHECKED_OUT: 0 };
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}
export const staySummaryInclude = {
  currentRoom: {
    select: {
      id: true,
      roomNumber: true,
      housekeepingStatus: true,
      roomType: { select: { id: true, code: true, name: true } },
    },
  },
  reservationRoom: {
    select: {
      reservationId: true,
      reservation: {
        select: {
          id: true,
          confirmationCode: true,
          checkInDate: true,
          checkOutDate: true,
          status: true,
          bookerGuest: identity,
        },
      },
    },
  },
} as const;
export const stayDetailInclude = {
  ...staySummaryInclude,
  checkinStaff: identity,
  checkoutStaff: identity,
  occupancy: true,
  transfers: {
    orderBy: [{ transferredAt: 'asc' }, { id: 'asc' }],
    include: { fromRoom: roomIdentity, toRoom: roomIdentity, staff: identity },
  },
} satisfies Prisma.StayInclude;

export class PrismaStayRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  transactionBilling() {
    if (!this.tx) throw new Error('Billing requires the active hotel transaction');
    return new PrismaBillingRepository(this.prisma, this.tx);
  }

  async withHotelLock<T>(
    hotelId: bigint,
    action: (repository: StayOperations) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Shared first lock with Reservations, Rooms, RoomTypes and Guests. Serializes
            // all writes within one hotel, including cancellation and capacity changes.
            const rows = await tx.$queryRaw<
              { id: bigint }[]
            >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
            if (!rows.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
            return action(new PrismaStayRepository(this.prisma, tx));
          },
          { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 20000 },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // Only retry a database-confirmed rollback, never an ambiguous commit/network error.
          if (error.code === 'P2034' && attempt < 2) {
            await delay(25 * (attempt + 1));
            continue;
          }
          if (['P2002', 'P2003', 'P2024', 'P2025', 'P2028', 'P2034'].includes(error.code))
            throw new AppError(
              409,
              'STAY_CONFLICT',
              'Concurrent or related record conflict; refresh before retrying',
            );
        }
        throw error;
      }
    }
  }
  hotel(hotelId: bigint) {
    return this.db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true } });
  }
  reservation(hotelId: bigint, id: bigint) {
    return this.db.reservation.findFirst({
      where: { hotelId, id },
      include: { rooms: { include: { stay: true } } },
    });
  }
  room(hotelId: bigint, id: bigint) {
    return this.db.room.findFirst({
      where: { hotelId, id },
      include: { occupancy: true, roomType: true },
    });
  }
  assignmentConflict(
    hotelId: bigint,
    roomId: bigint,
    excludeReservationRoomId: bigint,
    from: Date,
    until: Date,
  ) {
    return this.db.reservationRoom.findFirst({
      where: {
        hotelId,
        roomId,
        id: { not: excludeReservationRoomId },
        // Ended stays do not block physical reuse; their inventory remains reserved.
        OR: [{ stay: { is: null } }, { stay: { is: { status: 'CHECKED_IN' } } }],
        reservation: {
          hotelId,
          status: { in: ['CONFIRMED', 'PARTIALLY_CHECKED_IN', 'CHECKED_IN'] },
          checkInDate: { lt: until },
          checkOutDate: { gt: from },
        },
      },
      select: { id: true },
    });
  }
  async maintenanceConflict(hotelId: bigint, roomId: bigint, from: Date, until: Date) {
    const { timezone } = await this.hotel(hotelId);
    const today = asDate(hotelToday(timezone));
    return this.db.maintenanceBlock.findFirst({
      where: {
        hotelId,
        roomId,
        OR: [
          { status: 'ACTIVE' },
          { status: 'SCHEDULED', startDate: { lte: today } },
          { status: 'SCHEDULED', startDate: { lt: until }, endDate: { gt: from } },
        ],
      },
      select: { id: true },
    });
  }
  findById(
    hotelId: bigint,
    id: bigint,
  ): Promise<Prisma.StayGetPayload<{ include: typeof stayDetailInclude }> | null> {
    // Includes can issue multiple SQL queries; details need one consistent read snapshot.
    if (!this.tx)
      return this.prisma.$transaction(
        (tx) => new PrismaStayRepository(this.prisma, tx).findById(hotelId, id),
        { isolationLevel: 'RepeatableRead', timeout: 20000 },
      );
    return this.db.stay.findFirst({ where: { hotelId, id }, include: stayDetailInclude });
  }
  async list(hotelId: bigint, query: StayQuery, matchGuestName: boolean) {
    const { timezone } = await this.hotel(hotelId);
    const checkIn = query.checkInDate ? localDateRange(query.checkInDate, timezone) : undefined;
    const checkOut = query.checkOutDate ? localDateRange(query.checkOutDate, timezone) : undefined;
    const skip = (query.page - 1) * query.limit;
    const orderBy: Prisma.StayOrderByWithRelationInput[] = [
      { [query.sortBy]: query.sortOrder },
      { id: 'asc' },
    ];
    if (query.search) {
      // This collation folds Đ/đ to D/d as well as accents. ESCAPE keeps the search literal.
      const pattern = `%${query.search.replace(/[!%_]/g, '!$&')}%`;
      const matches = [
        Prisma.sql`r.confirmation_code COLLATE utf8mb4_0900_ai_ci LIKE ${pattern} ESCAPE '!'`,
        Prisma.sql`rm.room_number COLLATE utf8mb4_0900_ai_ci LIKE ${pattern} ESCAPE '!'`,
      ];
      if (matchGuestName) {
        matches.push(Prisma.sql`g.full_name COLLATE utf8mb4_0900_ai_ci LIKE ${pattern} ESCAPE '!'`);
      }
      const scope = Prisma.sql`
        FROM stays s
        JOIN reservation_rooms rr ON rr.hotel_id = s.hotel_id AND rr.id = s.reservation_room_id
        JOIN reservations r ON r.hotel_id = s.hotel_id AND r.id = rr.reservation_id
        JOIN rooms rm ON rm.hotel_id = s.hotel_id AND rm.id = s.current_room_id
        ${matchGuestName ? Prisma.sql`JOIN guests g ON g.hotel_id = s.hotel_id AND g.id = r.booker_guest_id` : Prisma.empty}
        WHERE s.hotel_id = ${hotelId}
          ${query.status ? Prisma.sql`AND s.status = ${query.status}` : Prisma.empty}
          ${query.reservationId ? Prisma.sql`AND rr.reservation_id = ${BigInt(query.reservationId)}` : Prisma.empty}
          ${query.roomId ? Prisma.sql`AND s.current_room_id = ${BigInt(query.roomId)}` : Prisma.empty}
          ${query.roomNumber ? Prisma.sql`AND rm.room_number = ${query.roomNumber}` : Prisma.empty}
          ${checkIn ? Prisma.sql`AND s.actual_checkin_at >= ${checkIn.gte} AND s.actual_checkin_at < ${checkIn.lt}` : Prisma.empty}
          ${checkOut ? Prisma.sql`AND s.actual_checkout_at >= ${checkOut.gte} AND s.actual_checkout_at < ${checkOut.lt}` : Prisma.empty}
          AND (${Prisma.join(matches, ' OR ')})`;
      const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
      return this.prisma.$transaction(async (tx) => {
        const ids = await tx.$queryRaw<{ id: bigint }[]>`
          SELECT s.id ${scope}
          ORDER BY ${staySortColumns[query.sortBy]} ${direction}, s.id ASC
          LIMIT ${query.limit} OFFSET ${skip}`;
        const items = ids.length ? await tx.stay.findMany({
          where: { hotelId, id: { in: ids.map(({ id }) => id) } },
          include: staySummaryInclude,
          orderBy,
        }) : [];
        const counts = countByStayStatus(await tx.$queryRaw<StayStatusCount[]>`
          SELECT s.status, COUNT(*) AS count ${scope} GROUP BY s.status`);
        return {
          items,
          total: counts.CHECKED_IN + counts.CHECKED_OUT,
          statusCounts: query.includeStatusCounts ? counts : undefined,
        };
      }, { isolationLevel: 'RepeatableRead' });
    }
    const where: Prisma.StayWhereInput = {
      hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.reservationId
        ? { reservationRoom: { reservationId: BigInt(query.reservationId) } }
        : {}),
      ...(query.roomId ? { currentRoomId: BigInt(query.roomId) } : {}),
      ...(query.roomNumber ? { currentRoom: { roomNumber: query.roomNumber } } : {}),
      ...(checkIn ? { actualCheckinAt: checkIn } : {}),
      ...(checkOut ? { actualCheckoutAt: checkOut } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const items = await tx.stay.findMany({ where, include: staySummaryInclude, orderBy, skip, take: query.limit });
      if (!query.includeStatusCounts) {
        return { items, total: await tx.stay.count({ where }), statusCounts: undefined };
      }
      const rows = await tx.stay.groupBy({ by: ['status'], where, _count: { _all: true } });
      const statusCounts = countByStayStatus(rows.map(({ status, _count }) => ({ status, count: _count._all })));
      return { items, total: statusCounts.CHECKED_IN + statusCounts.CHECKED_OUT, statusCounts };
    }, { isolationLevel: 'RepeatableRead' });
  }
  createStay(
    scope: StayScope,
    reservationRoomId: bigint,
    roomTypeId: bigint,
    roomId: bigint,
    now: Date,
    notes: string | null,
  ) {
    return this.db.stay.create({
      data: {
        hotelId: scope.hotelId,
        roomTypeId,
        reservationRoomId,
        currentRoomId: roomId,
        actualCheckinAt: now,
        checkinStaffId: scope.actorId,
        checkinNotes: notes,
      },
    });
  }
  occupy(stay: Stay, now: Date) {
    return this.db.roomOccupancy.create({
      data: {
        hotelId: stay.hotelId,
        roomTypeId: stay.roomTypeId,
        stayId: stay.id,
        roomId: stay.currentRoomId,
        occupiedAt: now,
      },
    });
  }
  assign(hotelId: bigint, reservationRoomId: bigint, roomId: bigint) {
    return this.db.reservationRoom.update({
      where: { id: reservationRoomId, hotelId },
      data: { roomId },
    });
  }
  async syncReservation(hotelId: bigint, id: bigint) {
    const rooms = await this.db.reservationRoom.findMany({
      where: { hotelId, reservationId: id },
      select: { stay: { select: { status: true } } },
    });
    const status = rooms.every((room) => room.stay?.status === 'CHECKED_OUT')
      ? 'CHECKED_OUT'
      : rooms.every((room) => room.stay !== null)
        ? 'CHECKED_IN'
        : 'PARTIALLY_CHECKED_IN';
    await this.db.reservation.update({ where: { id, hotelId }, data: { status } });
  }
  checkout(stay: Stay, actorId: bigint, now: Date, notes: string | null) {
    return this.db.stay.update({
      where: { id: stay.id, hotelId: stay.hotelId, status: 'CHECKED_IN', actualCheckoutAt: null },
      data: {
        status: 'CHECKED_OUT',
        actualCheckoutAt: now,
        checkoutStaffId: actorId,
        checkoutNotes: notes,
      },
    });
  }
  release(stay: Stay) {
    return this.db.roomOccupancy.delete({
      where: { roomId: stay.currentRoomId, stayId: stay.id, hotelId: stay.hotelId },
    });
  }
  async dirty(hotelId: bigint, id: bigint, actorId: bigint) {
    const room = await this.db.room.update({
      where: { id, hotelId },
      data: { housekeepingStatus: 'DIRTY' },
    });
    await ensureTurnoverTask(
      this.db,
      hotelId,
      id,
      actorId,
      'Turnover after checkout or room transfer',
    );
    return room;
  }
  async transfer(stay: Stay, toRoomId: bigint, actorId: bigint, now: Date, reason: string) {
    // Updating the unique room key atomically claims the destination and releases the source.
    await this.db.roomOccupancy.update({
      where: { stayId: stay.id, hotelId: stay.hotelId, roomId: stay.currentRoomId },
      data: { roomId: toRoomId, occupiedAt: now },
    });
    await this.db.stay.update({
      where: { id: stay.id, hotelId: stay.hotelId, status: 'CHECKED_IN' },
      data: { currentRoomId: toRoomId },
    });
    return this.db.roomTransfer.create({
      data: {
        hotelId: stay.hotelId,
        roomTypeId: stay.roomTypeId,
        stayId: stay.id,
        fromRoomId: stay.currentRoomId,
        toRoomId,
        transferredBy: actorId,
        transferredAt: now,
        reason,
      },
    });
  }
}
