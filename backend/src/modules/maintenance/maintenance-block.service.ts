import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  allowed,
  conflict,
  managers,
  operationsReaders,
  type OperationsScope,
} from '../operations/operations.shared.js';
import { asDate, asDateOnly } from '../reservations/reservation.dates.js';
import { createBlockBody } from './maintenance.schema.js';
import type { BlockQuery, CreateBlockInput, MaintenanceRepository } from './maintenance.types.js';
const view = <T extends { startDate: Date; endDate: Date }>(block: T) => ({
  ...block,
  startDate: asDateOnly(block.startDate),
  endDate: asDateOnly(block.endDate),
});
export class MaintenanceBlockService {
  constructor(private readonly repository: MaintenanceRepository) {}
  private async requireBlock(repo: MaintenanceRepository, hotelId: bigint, id: bigint) {
    const block = await repo.block(hotelId, id);
    if (!block)
      throw new AppError(404, 'MAINTENANCE_BLOCK_NOT_FOUND', 'Maintenance block not found');
    return block;
  }
  async create(scope: OperationsScope, raw: CreateBlockInput) {
    allowed(scope, managers);
    const input = createBlockBody.parse(raw);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const room = await repo.room(scope.hotelId, BigInt(input.roomId));
      if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      const today = await repo.today(scope.hotelId);
      const from = asDate(input.startDate),
        until = asDate(input.endDate);
      if (from < today)
        throw new AppError(
          422,
          'INVALID_DATE_RANGE',
          'Block cannot start before the hotel current date',
        );
      if (
        !room.isActive ||
        (room.physicalStatus !== 'ACTIVE' &&
          !(room.physicalStatus === 'MAINTENANCE' && room.maintenanceManaged))
      )
        conflict('ROOM_UNDER_MAINTENANCE', 'Room already has an independent physical restriction');
      // Conservative MVP: even future blocks require moving/checking out a current occupant first.
      if (room.occupancy)
        conflict(
          'ROOM_CURRENTLY_OCCUPIED',
          'Handle the current occupant before blocking this room',
        );
      if (input.maintenanceTicketId) {
        const ticket = await repo.ticket(scope.hotelId, BigInt(input.maintenanceTicketId));
        if (!ticket || ticket.roomId !== room.id)
          throw new AppError(404, 'MAINTENANCE_TICKET_NOT_FOUND', 'Ticket not found for this room');
        if (['CLOSED', 'CANCELLED', 'RESOLVED'].includes(ticket.status))
          conflict(
            'INVALID_MAINTENANCE_TRANSITION',
            'Ticket is no longer open for new repair blocks',
          );
      }
      if (await repo.overlap(scope.hotelId, room.id, from, until))
        conflict('MAINTENANCE_BLOCK_CONFLICT', 'Maintenance date ranges overlap');
      if (await repo.assignment(scope.hotelId, room.id, from, until))
        conflict(
          'MAINTENANCE_AFFECTS_RESERVATIONS',
          'Room has a reservation assignment during this interval',
        );
      const { capacity, peak } = await repo.inventory(scope.hotelId, room.roomTypeId, from, until);
      if (peak + 1 > capacity)
        conflict(
          'MAINTENANCE_AFFECTS_RESERVATIONS',
          'Blocking this room would exceed committed room inventory',
        );
      const status = from <= today ? 'ACTIVE' : 'SCHEDULED';
      const block = await repo.createBlock({
        hotelId: scope.hotelId,
        roomId: room.id,
        maintenanceTicketId: input.maintenanceTicketId ? BigInt(input.maintenanceTicketId) : null,
        startDate: from,
        endDate: until,
        reason: input.reason,
        createdBy: scope.actorId,
        status,
      });
      if (status === 'ACTIVE') {
        await repo.roomState(scope.hotelId, room.id, {
          physicalStatus: 'MAINTENANCE',
          maintenanceManaged: true,
        });
        await repo.resetCleaning(scope.hotelId, room.id, scope.actorId);
      }
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        blockId: block.id,
        action: 'BLOCK_CREATED',
        toStatus: status,
        notes: input.reason,
      });
      return view(await this.requireBlock(repo, scope.hotelId, block.id));
    });
  }
  async detail(scope: OperationsScope, id: bigint) {
    allowed(scope, operationsReaders);
    return view(await this.requireBlock(this.repository, scope.hotelId, id));
  }
  async list(scope: OperationsScope, query: BlockQuery) {
    allowed(scope, operationsReaders);
    const { items, total } = await this.repository.blocks(scope.hotelId, query);
    return pageResult(items.map(view), total, query);
  }
  async finish(scope: OperationsScope, id: bigint, action: 'release' | 'cancel', notes: string) {
    allowed(scope, managers);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const block = await this.requireBlock(repo, scope.hotelId, id);
      const today = await repo.today(scope.hotelId);
      if (block.status === 'RELEASED')
        conflict('MAINTENANCE_ALREADY_RELEASED', 'Maintenance block has already been released');
      if (block.status === 'CANCELLED')
        conflict('MAINTENANCE_BLOCK_CONFLICT', 'Maintenance block has already been cancelled');
      if (action === 'cancel' && (block.status !== 'SCHEDULED' || block.startDate <= today))
        conflict('MAINTENANCE_BLOCK_CONFLICT', 'Only a future scheduled block can be cancelled');
      if (action === 'release' && block.startDate > today)
        conflict('MAINTENANCE_BLOCK_CONFLICT', 'Cancel a future scheduled block instead');
      const room = (await repo.room(scope.hotelId, block.roomId))!;
      if (action === 'release') {
        if (room.occupancy)
          conflict('ROOM_CURRENTLY_OCCUPIED', 'Handle the occupant before reopening this room');
        if (block.maintenanceTicketId) {
          const ticket = await repo.ticket(scope.hotelId, block.maintenanceTicketId);
          if (!ticket || !['RESOLVED', 'CLOSED'].includes(ticket.status))
            conflict(
              'INVALID_MAINTENANCE_TRANSITION',
              'Resolve the linked ticket before releasing the block',
            );
        }
      }
      const status = action === 'release' ? 'RELEASED' : 'CANCELLED';
      await repo.updateBlock(scope.hotelId, id, {
        status,
        releasedBy: scope.actorId,
        releasedAt: new Date(),
      });
      if (action === 'release') {
        if (
          room.maintenanceManaged &&
          room.physicalStatus === 'MAINTENANCE' &&
          !(await repo.currentBlock(scope.hotelId, room.id))
        )
          await repo.roomState(scope.hotelId, room.id, {
            physicalStatus: 'ACTIVE',
            maintenanceManaged: false,
          });
        await repo.resetCleaning(scope.hotelId, room.id, scope.actorId);
        await repo.turnover(scope.hotelId, room.id, scope.actorId);
      }
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        blockId: id,
        action: `BLOCK_${action.toUpperCase()}`,
        fromStatus: block.status,
        toStatus: status,
        notes,
      });
      return view(await this.requireBlock(repo, scope.hotelId, id));
    });
  }
  // Durable date guards protect occupancy/availability even while this worker is stopped.
  // No automatic release: a manager must attest safety and initiate cleaning.
  async activateDue(now = new Date()) {
    for (const { hotelId } of await this.repository.dueHotels()) {
      await this.repository.withHotelLock(hotelId, async (repo) => {
        const today = await repo.today(hotelId, now);
        for (const block of await repo.due(hotelId, today)) {
          const room = await repo.room(hotelId, block.roomId);
          if (
            !room ||
            room.occupancy ||
            !room.isActive ||
            (room.physicalStatus !== 'ACTIVE' &&
              !(room.physicalStatus === 'MAINTENANCE' && room.maintenanceManaged))
          )
            continue;
          await repo.updateBlock(hotelId, block.id, { status: 'ACTIVE' });
          await repo.roomState(hotelId, room.id, {
            physicalStatus: 'MAINTENANCE',
            maintenanceManaged: true,
          });
          await repo.resetCleaning(hotelId, room.id, block.createdBy);
          await repo.audit({
            hotelId,
            actorId: block.createdBy,
            blockId: block.id,
            action: 'BLOCK_AUTO_ACTIVATED',
            fromStatus: 'SCHEDULED',
            toStatus: 'ACTIVE',
            notes: 'Scheduled activation under the creator authorization',
          });
        }
      });
    }
  }
}
