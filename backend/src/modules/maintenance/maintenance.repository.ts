import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  OperationsRepository,
  historyInclude,
  liveBlockStatuses,
  operationRoomSelect,
  operationsTransaction,
} from '../operations/operations.repository.js';
import type { OperationsScope } from '../operations/operations.shared.js';
import { asDate } from '../reservations/reservation.dates.js';
import { localDateRange } from '../stays/stay.dates.js';
import { inventoryNights, sellableRoomWhere } from '../reservations/inventory.repository.js';
import { ensureTurnoverTask } from '../housekeeping/housekeeping.repository.js';
import type { BlockQuery, CreateTicketInput, TicketQuery } from './maintenance.types.js';
const include = { room: { select: operationRoomSelect }, history: historyInclude } as const;
export class PrismaMaintenanceRepository extends OperationsRepository {
  constructor(prisma: PrismaClient, tx?: Prisma.TransactionClient) {
    super(prisma, tx);
  }
  withHotelLock<T>(
    hotelId: bigint,
    action: (repository: PrismaMaintenanceRepository) => Promise<T>,
  ) {
    return operationsTransaction(this.prisma, hotelId, (tx) =>
      action(new PrismaMaintenanceRepository(this.prisma, tx)),
    );
  }
  async ticket(
    hotelId: bigint,
    id: bigint,
  ): Promise<Prisma.MaintenanceTicketGetPayload<{ include: typeof include }> | null> {
    if (!this.tx)
      return this.prisma.$transaction(
        (tx) => new PrismaMaintenanceRepository(this.prisma, tx).ticket(hotelId, id),
        { isolationLevel: 'RepeatableRead' },
      );
    return this.db.maintenanceTicket.findFirst({ where: { hotelId, id }, include });
  }
  createTicket(scope: OperationsScope, input: CreateTicketInput) {
    return this.db.maintenanceTicket.create({
      data: {
        ...input,
        roomId: BigInt(input.roomId),
        hotelId: scope.hotelId,
        reportedBy: scope.actorId,
      },
    });
  }
  updateTicket(hotelId: bigint, id: bigint, data: Prisma.MaintenanceTicketUncheckedUpdateInput) {
    return this.db.maintenanceTicket.update({ where: { hotelId, id }, data });
  }
  async tickets(scope: OperationsScope, query: TicketQuery) {
    const hotel = await this.db.hotel.findUniqueOrThrow({
      where: { id: scope.hotelId },
      select: { timezone: true },
    });
    const where: Prisma.MaintenanceTicketWhereInput = {
      hotelId: scope.hotelId,
      ...(query.roomId ? { roomId: BigInt(query.roomId) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assignedTo ? { assignedTo: BigInt(query.assignedTo) } : {}),
      ...(scope.role === 'TECHNICIAN' ? { assignedTo: scope.actorId } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            reportedAt: {
              ...(query.fromDate
                ? { gte: localDateRange(query.fromDate, hotel.timezone).gte }
                : {}),
              ...(query.toDate ? { lt: localDateRange(query.toDate, hotel.timezone).lt } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.maintenanceTicket.findMany({
          where,
          include: { room: { select: operationRoomSelect } },
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.maintenanceTicket.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  async block(
    hotelId: bigint,
    id: bigint,
  ): Promise<Prisma.MaintenanceBlockGetPayload<{ include: typeof include }> | null> {
    if (!this.tx)
      return this.prisma.$transaction(
        (tx) => new PrismaMaintenanceRepository(this.prisma, tx).block(hotelId, id),
        { isolationLevel: 'RepeatableRead' },
      );
    return this.db.maintenanceBlock.findFirst({ where: { hotelId, id }, include });
  }
  async blocks(hotelId: bigint, query: BlockQuery) {
    const where: Prisma.MaintenanceBlockWhereInput = {
      hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.roomId ? { roomId: BigInt(query.roomId) } : {}),
      ...(query.maintenanceTicketId
        ? { maintenanceTicketId: BigInt(query.maintenanceTicketId) }
        : {}),
      ...(query.fromDate ? { endDate: { gt: asDate(query.fromDate) } } : {}),
      ...(query.toDate ? { startDate: { lt: asDate(query.toDate) } } : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.maintenanceBlock.findMany({
          where,
          include: { room: { select: operationRoomSelect } },
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.maintenanceBlock.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  overlap(hotelId: bigint, roomId: bigint, from: Date, until: Date) {
    return this.db.maintenanceBlock.findFirst({
      where: {
        hotelId,
        roomId,
        status: { in: [...liveBlockStatuses] },
        startDate: { lt: until },
        endDate: { gt: from },
      },
    });
  }
  liveTicketBlocks(hotelId: bigint, maintenanceTicketId: bigint) {
    return this.db.maintenanceBlock.count({
      where: { hotelId, maintenanceTicketId, status: { in: [...liveBlockStatuses] } },
    });
  }
  assignment(hotelId: bigint, roomId: bigint, from: Date, until: Date) {
    return this.db.reservationRoom.findFirst({
      where: {
        hotelId,
        roomId,
        OR: [{ stay: { is: null } }, { stay: { status: 'CHECKED_IN' } }],
        reservation: {
          status: { in: ['CONFIRMED', 'PARTIALLY_CHECKED_IN', 'CHECKED_IN'] },
          checkInDate: { lt: until },
          checkOutDate: { gt: from },
        },
      },
      select: { id: true },
    });
  }
  async inventory(hotelId: bigint, roomTypeId: bigint, from: Date, until: Date) {
    const capacity = await this.db.room.count({
      where: { hotelId, roomTypeId, ...sellableRoomWhere },
    });
    const nights = await inventoryNights(this.db, hotelId, roomTypeId, from, until);
    return { capacity, peak: nights.reduce((max, n) => Math.max(max, n._count._all), 0) };
  }
  createBlock(data: Prisma.MaintenanceBlockUncheckedCreateInput) {
    return this.db.maintenanceBlock.create({ data });
  }
  updateBlock(hotelId: bigint, id: bigint, data: Prisma.MaintenanceBlockUncheckedUpdateInput) {
    return this.db.maintenanceBlock.update({ where: { hotelId, id }, data });
  }
  pendingTask(hotelId: bigint, roomId: bigint) {
    return this.db.housekeepingTask.findFirst({ where: { hotelId, activeRoomId: roomId } });
  }
  async resetCleaning(hotelId: bigint, roomId: bigint, actorId: bigint) {
    const task = await this.pendingTask(hotelId, roomId);
    if (task && task.status !== 'PENDING') {
      await this.db.housekeepingTask.update({
        where: { id: task.id, hotelId },
        data: { status: 'PENDING' },
      });
      await this.audit({
        hotelId,
        actorId,
        taskId: task.id,
        action: 'MAINTENANCE_REWORK',
        fromStatus: task.status,
        toStatus: 'PENDING',
        notes: 'Room requires cleaning after maintenance',
      });
    }
    await this.roomState(hotelId, roomId, { housekeepingStatus: 'DIRTY' });
  }
  turnover(hotelId: bigint, roomId: bigint, actorId: bigint) {
    return ensureTurnoverTask(
      this.db,
      hotelId,
      roomId,
      actorId,
      'Clean and inspect after maintenance',
    );
  }
  dueHotels() {
    return this.db.maintenanceBlock.findMany({
      where: { status: 'SCHEDULED' },
      distinct: ['hotelId'],
      select: { hotelId: true },
    });
  }
  due(hotelId: bigint, today: Date) {
    return this.db.maintenanceBlock.findMany({
      where: { hotelId, status: 'SCHEDULED', startDate: { lte: today } },
      orderBy: { id: 'asc' },
    });
  }
}
