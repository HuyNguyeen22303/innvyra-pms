import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import {
  OperationsRepository,
  operationsTransaction,
  historyInclude,
  operationRoomSelect,
} from '../operations/operations.repository.js';
import type { CreateTaskInput, TaskQuery, DirtyRoomQuery } from './housekeeping.types.js';
import type { OperationsScope } from '../operations/operations.shared.js';
const include = { room: { select: operationRoomSelect }, history: historyInclude } as const;

// Caller already holds the shared hotel lock. Checkout, transfer and reopening use this
// helper inside their own transaction: failure rolls back the entire originating action.
export async function ensureTurnoverTask(
  tx: Prisma.TransactionClient,
  hotelId: bigint,
  roomId: bigint,
  actorId: bigint,
  notes: string,
) {
  const existing = await tx.housekeepingTask.findFirst({
    where: { hotelId, activeRoomId: roomId },
  });
  if (existing) return existing;
  const task = await tx.housekeepingTask.create({
    data: { hotelId, roomId, activeRoomId: roomId, createdBy: actorId, notes },
  });
  await tx.operationsAuditLog.create({
    data: { hotelId, actorId, taskId: task.id, action: 'TASK_CREATED', toStatus: 'PENDING', notes },
  });
  return task;
}
export class PrismaHousekeepingRepository extends OperationsRepository {
  constructor(prisma: PrismaClient, tx?: Prisma.TransactionClient) {
    super(prisma, tx);
  }
  withHotelLock<T>(
    hotelId: bigint,
    action: (repository: PrismaHousekeepingRepository) => Promise<T>,
  ) {
    return operationsTransaction(this.prisma, hotelId, (tx) =>
      action(new PrismaHousekeepingRepository(this.prisma, tx)),
    );
  }
  active(hotelId: bigint, roomId: bigint) {
    return this.db.housekeepingTask.findFirst({ where: { hotelId, activeRoomId: roomId } });
  }
  task(
    hotelId: bigint,
    id: bigint,
  ): Promise<Prisma.HousekeepingTaskGetPayload<{ include: typeof include }> | null> {
    if (!this.tx)
      return this.prisma.$transaction(
        (tx) => new PrismaHousekeepingRepository(this.prisma, tx).task(hotelId, id),
        { isolationLevel: 'RepeatableRead' },
      );
    return this.db.housekeepingTask.findFirst({ where: { hotelId, id }, include });
  }
  create(scope: OperationsScope, input: CreateTaskInput) {
    return this.db.housekeepingTask.create({
      data: {
        ...input,
        notes: input.notes ?? null,
        roomId: BigInt(input.roomId),
        hotelId: scope.hotelId,
        createdBy: scope.actorId,
        activeRoomId: BigInt(input.roomId),
      },
    });
  }
  update(hotelId: bigint, id: bigint, data: Prisma.HousekeepingTaskUncheckedUpdateInput) {
    return this.db.housekeepingTask.update({ where: { hotelId, id }, data });
  }
  async list(scope: OperationsScope, query: TaskQuery) {
    const where: Prisma.HousekeepingTaskWhereInput = {
      hotelId: scope.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.roomId ? { roomId: BigInt(query.roomId) } : {}),
      ...(query.assignedTo ? { assignedTo: BigInt(query.assignedTo) } : {}),
      ...(scope.role === 'HOUSEKEEPING' ? { assignedTo: scope.actorId } : {}),
      ...(query.taskType ? { taskType: query.taskType } : {}),
      ...(query.floorNumber !== undefined ? { room: { floorNumber: query.floorNumber } } : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.housekeepingTask.findMany({
          where,
          include: { room: { select: operationRoomSelect } },
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.housekeepingTask.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  async dirtyRooms(hotelId: bigint, query: DirtyRoomQuery) {
    const where: Prisma.RoomWhereInput = {
      hotelId,
      isActive: true,
      housekeepingStatus: 'DIRTY',
      ...(query.floorNumber !== undefined ? { floorNumber: query.floorNumber } : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.room.findMany({
          where,
          select: { ...operationRoomSelect, occupancy: { select: { roomId: true } } },
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.room.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      items: items.map(({ occupancy, ...room }) => ({
        ...room,
        occupancyStatus: occupancy ? 'OCCUPIED' : 'VACANT',
      })),
      total,
    };
  }
}
