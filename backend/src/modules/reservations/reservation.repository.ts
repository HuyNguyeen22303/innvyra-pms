import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { inventoryNights, sellableRoomWhere } from './inventory.repository.js';
import { asDate } from './reservation.dates.js';
import type {
  ReservationOperations,
  ReservationQuery,
  ReservationWrite,
} from './reservation.types.js';

export const summaryInclude = {
  bookerGuest: { select: { id: true, fullName: true } },
  _count: { select: { rooms: true } },
} as const;
export const detailInclude = {
  ...summaryInclude,
  creator: { select: { id: true, fullName: true } },
  canceller: { select: { id: true, fullName: true } },
  rooms: {
    orderBy: { id: 'asc' },
    include: {
      stay: { select: { id: true, status: true, actualCheckinAt: true, actualCheckoutAt: true } },
      roomType: { select: { id: true, name: true, code: true } },
      nights: { orderBy: { stayDate: 'asc' } },
    },
  },
} as const;
export class PrismaReservationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  async withHotelLock<T>(
    hotelId: bigint,
    action: (repository: ReservationOperations) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Same first lock as Room, RoomType and Guest writes; no multi-type lock inversion.
            const rows = await tx.$queryRaw<
              { id: bigint }[]
            >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
            if (!rows.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
            return action(new PrismaReservationRepository(this.prisma, tx));
          },
          { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 20000 },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // Retry the entire rolled-back transaction, including reads and generated code.
          if (['P2034', 'P2002'].includes(error.code) && attempt < 2) {
            await delay(25 * (attempt + 1));
            continue;
          }
          if (['P2034', 'P2002', 'P2003', 'P2028'].includes(error.code))
            throw new AppError(
              409,
              'RESERVATION_CONFLICT',
              'Reservation conflict; refresh and retry',
            );
          if (error.code === 'P2025')
            throw new AppError(
              409,
              'RESERVATION_STATUS_CHANGED',
              'Reservation status changed; refresh and retry',
            );
        }
        throw error;
      }
    }
  }
  snapshot<T>(action: (repository: ReservationOperations) => Promise<T>) {
    return this.prisma.$transaction(
      (tx) => action(new PrismaReservationRepository(this.prisma, tx)),
      { isolationLevel: 'RepeatableRead', timeout: 20000 },
    );
  }
  async hotel(hotelId: bigint) {
    return this.db.hotel.findUnique({ where: { id: hotelId }, select: { timezone: true } });
  }
  async guest(hotelId: bigint, id: bigint) {
    return this.db.guest.findFirst({
      where: { id, hotelId, deletedAt: null },
      select: { id: true },
    });
  }
  async roomTypes(hotelId: bigint, ids?: bigint[]) {
    return this.db.roomType.findMany({
      where: { hotelId, ...(ids ? { id: { in: ids } } : { isActive: true }) },
      orderBy: { id: 'asc' },
    });
  }
  async capacity(hotelId: bigint, roomTypeId: bigint) {
    return this.db.room.count({
      where: { hotelId, roomTypeId, ...sellableRoomWhere },
    });
  }
  async occupied(hotelId: bigint, roomTypeId: bigint, from: Date, until: Date) {
    return inventoryNights(this.db, hotelId, roomTypeId, from, until);
  }
  async findById(hotelId: bigint, id: bigint) {
    return this.db.reservation.findFirst({ where: { id, hotelId }, include: detailInclude });
  }
  async list(hotelId: bigint, query: ReservationQuery) {
    const where: Prisma.ReservationWhereInput = {
      hotelId,
      ...(query.search ? { confirmationCode: { contains: query.search } } : {}),
      ...(query.guestId ? { bookerGuestId: BigInt(query.guestId) } : {}),
      ...(query.guestSearch ? { bookerGuest: { fullName: { contains: query.guestSearch } } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.checkInDate ? { checkInDate: asDate(query.checkInDate) } : {}),
      ...(query.checkOutDate ? { checkOutDate: asDate(query.checkOutDate) } : {}),
      ...(query.bookingSource ? { bookingSource: query.bookingSource } : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.reservation.findMany({
          where,
          include: summaryInclude,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.reservation.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  async create(hotelId: bigint, actorId: bigint, input: ReservationWrite) {
    return this.db.reservation.create({
      data: {
        hotelId,
        createdBy: actorId,
        bookerGuestId: input.guestId,
        // 112 random bits + DB unique index; collision retries the complete transaction.
        confirmationCode: `INN-${randomBytes(14).toString('hex').toUpperCase()}`,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        status: 'CONFIRMED',
        bookingSource: input.bookingSource,
        totalAmount: input.totalAmount,
        currency: 'VND',
        notes: input.notes,
        rooms: {
          create: input.rooms.map(
            (room): Prisma.ReservationRoomUncheckedCreateWithoutReservationInput => ({
              roomTypeId: room.roomTypeId,
              adults: room.adults,
              children: room.children,
              nights: { create: room.nights },
            }),
          ),
        },
      },
      include: detailInclude,
    });
  }
  async cancel(hotelId: bigint, id: bigint, actorId: bigint, reason: string) {
    // Updating status atomically releases every night; snapshots and financial history survive.
    return this.db.reservation.update({
      where: { id, hotelId, status: 'CONFIRMED' },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: actorId,
      },
      include: detailInclude,
    });
  }
  async noShow(hotelId: bigint, id: bigint, actorId: bigint, reason: string) {
    // Same atomic inventory release as cancel; records NO_SHOW instead and preserves audit trail.
    return this.db.reservation.update({
      where: { id, hotelId, status: 'CONFIRMED' },
      data: {
        status: 'NO_SHOW',
        cancellationReason: reason,
        cancelledAt: new Date(),
        cancelledBy: actorId,
      },
      include: detailInclude,
    });
  }
}
