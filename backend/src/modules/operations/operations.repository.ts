import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asDate, hotelToday } from '../reservations/reservation.dates.js';

export const liveBlockStatuses = ['SCHEDULED', 'ACTIVE'] as const;
export const operationRoomSelect = {
  id: true,
  roomNumber: true,
  floorNumber: true,
  roomTypeId: true,
  physicalStatus: true,
  housekeepingStatus: true,
  isActive: true,
} as const;
export const historyInclude = {
  orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
} satisfies Prisma.HousekeepingTask$historyArgs;
export async function operationsTransaction<T>(
  prisma: PrismaClient,
  hotelId: bigint,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            { id: bigint }[]
          >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
          if (!rows.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
          return action(tx);
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 20000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034' && attempt < 2) {
          await delay(25 * (attempt + 1));
          continue;
        }
        if (['P2002', 'P2003', 'P2024', 'P2025', 'P2028', 'P2034'].includes(error.code))
          throw new AppError(
            409,
            'OPERATIONS_CONFLICT',
            'Concurrent or related record conflict; refresh before retrying',
          );
      }
      throw error;
    }
  }
}
export class OperationsRepository {
  constructor(
    protected readonly prisma: PrismaClient,
    protected readonly tx?: Prisma.TransactionClient,
  ) {}
  protected get db() {
    return this.tx ?? this.prisma;
  }
  room(hotelId: bigint, id: bigint) {
    return this.db.room.findFirst({
      where: { hotelId, id },
      include: { occupancy: { select: { roomId: true } } },
    });
  }
  async today(hotelId: bigint, now = new Date()) {
    const hotel = await this.db.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      select: { timezone: true },
    });
    return asDate(hotelToday(hotel.timezone, now));
  }
  staff(hotelId: bigint, id: bigint) {
    return this.db.staffUser.findFirst({
      where: { hotelId, id, isActive: true },
      select: { id: true, role: { select: { code: true } } },
    });
  }
  audit(data: Prisma.OperationsAuditLogUncheckedCreateInput) {
    return this.db.operationsAuditLog.create({ data });
  }
  roomState(
    hotelId: bigint,
    id: bigint,
    data: Pick<
      Prisma.RoomUncheckedUpdateInput,
      'physicalStatus' | 'housekeepingStatus' | 'maintenanceManaged'
    >,
  ) {
    return this.db.room.update({ where: { id, hotelId }, data });
  }
  async currentBlock(hotelId: bigint, roomId: bigint) {
    const today = await this.today(hotelId);
    return this.db.maintenanceBlock.findFirst({
      where: {
        hotelId,
        roomId,
        OR: [{ status: 'ACTIVE' }, { status: 'SCHEDULED', startDate: { lte: today } }],
      },
      select: { id: true },
    });
  }
}
