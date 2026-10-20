import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  allowed,
  assignedActor,
  cleaners,
  conflict,
  housekeepingReaders,
  managers,
  requesters,
  type OperationsScope,
} from '../operations/operations.shared.js';
import { createTaskBody, inspectBody } from './housekeeping.schema.js';
import type {
  CreateTaskInput,
  DirtyRoomQuery,
  HousekeepingRepository,
  InspectInput,
  TaskQuery,
} from './housekeeping.types.js';
import type { PrismaHousekeepingRepository } from './housekeeping.repository.js';

const view = <T extends { activeRoomId: bigint | null }>(row: T) => {
  const { activeRoomId: _slot, ...result } = row;
  void _slot;
  return result;
};
export class HousekeepingService {
  constructor(private readonly repository: HousekeepingRepository) {}
  private async requireTask(repo: HousekeepingRepository, scope: OperationsScope, id: bigint) {
    const task = await repo.task(scope.hotelId, id);
    if (!task || (scope.role === 'HOUSEKEEPING' && task.assignedTo !== scope.actorId))
      throw new AppError(404, 'HOUSEKEEPING_TASK_NOT_FOUND', 'Housekeeping task not found');
    return task;
  }
  private async usable(repo: HousekeepingRepository, scope: OperationsScope, roomId: bigint) {
    let room = await repo.room(scope.hotelId, roomId);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    if (room.occupancy)
      conflict('ROOM_CURRENTLY_OCCUPIED', 'Turnover cleaning requires a vacant room');
    const activeBlock = await repo.currentBlock(scope.hotelId, roomId);
    if (activeBlock)
      conflict('ROOM_UNDER_MAINTENANCE', 'Room must be active and free of current maintenance');
    if (room.physicalStatus === 'MAINTENANCE') {
      await repo.roomState(scope.hotelId, roomId, {
        physicalStatus: 'ACTIVE',
        maintenanceManaged: false,
      });
      room = { ...room, physicalStatus: 'ACTIVE', maintenanceManaged: false };
    }
    if (!room.isActive || room.physicalStatus !== 'ACTIVE')
      conflict('ROOM_UNDER_MAINTENANCE', 'Room must be active and free of current maintenance');
    return room;
  }
  async create(scope: OperationsScope, raw: CreateTaskInput) {
    allowed(scope, requesters);
    const input = createTaskBody.parse(raw);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const room = await this.usable(repo, scope, BigInt(input.roomId));
      if (await repo.active(scope.hotelId, room.id))
        conflict('HOUSEKEEPING_TASK_ALREADY_ACTIVE', 'Room already has an active turnover task');
      if (room.housekeepingStatus !== 'DIRTY') conflict('ROOM_NOT_DIRTY', 'Room must be DIRTY');
      const task = await repo.create(scope, input);
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        taskId: task.id,
        action: 'TASK_CREATED',
        toStatus: 'PENDING',
        notes: input.notes ?? null,
      });
      return view(await this.requireTask(repo, scope, task.id));
    });
  }
  async list(scope: OperationsScope, query: TaskQuery) {
    allowed(scope, housekeepingReaders);
    if (
      scope.role === 'HOUSEKEEPING' &&
      query.assignedTo &&
      BigInt(query.assignedTo) !== scope.actorId
    )
      throw new AppError(403, 'FORBIDDEN', 'Only assigned tasks are visible');
    const { items, total } = await this.repository.list(scope, query);
    return pageResult(items.map(view), total, query);
  }
  async detail(scope: OperationsScope, id: bigint) {
    allowed(scope, housekeepingReaders);
    return view(await this.requireTask(this.repository, scope, id));
  }
  async dirtyRooms(scope: OperationsScope, query: DirtyRoomQuery) {
    allowed(scope, requesters);
    const { items, total } = await this.repository.dirtyRooms(scope.hotelId, query);
    return pageResult(items, total, query);
  }
  async assign(scope: OperationsScope, id: bigint, staffId: bigint) {
    allowed(scope, managers);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const task = await this.requireTask(repo, scope, id);
      if (task.status !== 'PENDING')
        conflict('INVALID_HOUSEKEEPING_TRANSITION', 'Only pending tasks can be assigned');
      const staff = await repo.staff(scope.hotelId, staffId);
      if (!staff || !['HOUSEKEEPING', 'ADMIN', 'MANAGER'].includes(staff.role.code))
        throw new AppError(
          422,
          'INVALID_HOUSEKEEPING_ASSIGNEE',
          'Choose active housekeeping staff in this hotel',
        );
      await repo.update(scope.hotelId, id, { assignedTo: staffId });
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        taskId: id,
        action: 'TASK_ASSIGNED',
        fromStatus: task.status,
        toStatus: task.status,
        notes: `Assigned to staff ${staffId}`,
      });
      return view(await this.requireTask(repo, scope, id));
    });
  }
  private async transition(
    scope: OperationsScope,
    id: bigint,
    action: 'start' | 'complete' | 'inspect' | 'cancel',
    input?: InspectInput | string,
  ) {
    allowed(scope, action === 'inspect' || action === 'cancel' ? managers : cleaners);
    return this.repository.withHotelLock(
      scope.hotelId,
      async (repo: PrismaHousekeepingRepository) => {
        const task = await this.requireTask(repo, scope, id);
        const expected =
          action === 'start'
            ? 'PENDING'
            : action === 'complete'
              ? 'IN_PROGRESS'
              : 'AWAITING_INSPECTION';
        if (
          action === 'cancel'
            ? ['COMPLETED', 'CANCELLED'].includes(task.status)
            : task.status !== expected
        )
          conflict('INVALID_HOUSEKEEPING_TRANSITION', 'Task does not allow this transition');
        if (action === 'start' || action === 'complete') assignedActor(scope, task.assignedTo);
        if (action !== 'cancel') {
          const room = await this.usable(repo, scope, task.roomId);
          const roomState =
            action === 'start' ? 'DIRTY' : action === 'complete' ? 'CLEANING' : 'INSPECTION';
          if (room.housekeepingStatus !== roomState)
            conflict('HOUSEKEEPING_TASK_CONFLICT', 'Room and task states do not agree');
        }
        const inspection = action === 'inspect' ? inspectBody.parse(input) : null;
        const status =
          action === 'start'
            ? 'IN_PROGRESS'
            : action === 'complete'
              ? 'AWAITING_INSPECTION'
              : action === 'cancel'
                ? 'CANCELLED'
                : inspection!.passed
                  ? 'COMPLETED'
                  : 'PENDING';
        const housekeepingStatus =
          action === 'start'
            ? 'CLEANING'
            : action === 'complete'
              ? 'INSPECTION'
              : status === 'COMPLETED'
                ? 'READY'
                : 'DIRTY';
        const now = new Date();
        await repo.update(scope.hotelId, id, {
          status,
          ...(['COMPLETED', 'CANCELLED'].includes(status) ? { activeRoomId: null } : {}),
          ...(action === 'start'
            ? { startedAt: now, completedAt: null, inspectedAt: null, inspectedBy: null }
            : {}),
          ...(action === 'complete' ? { completedAt: now } : {}),
          ...(action === 'inspect' ? { inspectedAt: now, inspectedBy: scope.actorId } : {}),
        });
        await repo.roomState(scope.hotelId, task.roomId, { housekeepingStatus });
        await repo.audit({
          hotelId: scope.hotelId,
          actorId: scope.actorId,
          taskId: id,
          action:
            action === 'inspect'
              ? inspection!.passed
                ? 'INSPECTION_PASSED'
                : 'INSPECTION_FAILED'
              : `TASK_${action.toUpperCase()}`,
          fromStatus: task.status,
          toStatus: status,
          notes: typeof input === 'string' ? input : (inspection?.notes ?? null),
        });
        return view(await this.requireTask(repo, scope, id));
      },
    );
  }
  start(scope: OperationsScope, id: bigint, notes?: string) {
    return this.transition(scope, id, 'start', notes);
  }
  complete(scope: OperationsScope, id: bigint, notes?: string) {
    return this.transition(scope, id, 'complete', notes);
  }
  inspect(scope: OperationsScope, id: bigint, input: InspectInput) {
    return this.transition(scope, id, 'inspect', input);
  }
  cancel(scope: OperationsScope, id: bigint, reason: string) {
    return this.transition(scope, id, 'cancel', reason);
  }
}
