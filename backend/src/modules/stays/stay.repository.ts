import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient, type Stay } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { StayOperations, StayQuery, StayScope } from './stay.types.js';
import { localDateRange } from './stay.dates.js';

const identity = { select: { id: true, fullName: true } } as const;
const roomIdentity = { select: { id: true, roomNumber: true } } as const;
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
  async list(hotelId: bigint, query: StayQuery) {
    const { timezone } = await this.hotel(hotelId);
    const where: Prisma.StayWhereInput = {
      hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { currentRoomId: BigInt(query.roomId) } : {}),
      ...(query.roomNumber ? { currentRoom: { roomNumber: query.roomNumber } } : {}),
      ...(query.search
        ? { reservationRoom: { reservation: { confirmationCode: { contains: query.search } } } }
        : {}),
      ...(query.checkInDate
        ? { actualCheckinAt: localDateRange(query.checkInDate, timezone) }
        : {}),
      ...(query.checkOutDate
        ? { actualCheckoutAt: localDateRange(query.checkOutDate, timezone) }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.stay.findMany({
          where,
          include: staySummaryInclude,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.stay.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
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
  dirty(hotelId: bigint, id: bigint) {
    return this.db.room.update({ where: { id, hotelId }, data: { housekeepingStatus: 'DIRTY' } });
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
