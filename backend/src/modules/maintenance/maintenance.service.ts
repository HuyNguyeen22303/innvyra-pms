import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  allowed,
  assignedActor,
  conflict,
  managers,
  operationsReaders,
  technicians,
  type OperationsScope,
} from '../operations/operations.shared.js';
import { createTicketBody } from './maintenance.schema.js';
import type { CreateTicketInput, MaintenanceRepository, TicketQuery } from './maintenance.types.js';
export class MaintenanceService {
  constructor(private readonly repository: MaintenanceRepository) {}
  private async requireTicket(repo: MaintenanceRepository, scope: OperationsScope, id: bigint) {
    const ticket = await repo.ticket(scope.hotelId, id);
    if (!ticket || (scope.role === 'TECHNICIAN' && ticket.assignedTo !== scope.actorId))
      throw new AppError(404, 'MAINTENANCE_TICKET_NOT_FOUND', 'Maintenance ticket not found');
    return ticket;
  }
  async create(scope: OperationsScope, raw: CreateTicketInput) {
    allowed(scope, operationsReaders);
    const input = createTicketBody.parse(raw);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      if (!(await repo.room(scope.hotelId, BigInt(input.roomId))))
        throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
      const ticket = await repo.createTicket(scope, input);
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        ticketId: ticket.id,
        action: 'TICKET_REPORTED',
        toStatus: 'OPEN',
      });
      // Reporters receive their submission even if they cannot browse unassigned technician work.
      return (await repo.ticket(scope.hotelId, ticket.id))!;
    });
  }
  async detail(scope: OperationsScope, id: bigint) {
    allowed(scope, operationsReaders);
    return this.requireTicket(this.repository, scope, id);
  }
  async list(scope: OperationsScope, query: TicketQuery) {
    allowed(scope, operationsReaders);
    if (
      scope.role === 'TECHNICIAN' &&
      query.assignedTo &&
      BigInt(query.assignedTo) !== scope.actorId
    )
      throw new AppError(403, 'FORBIDDEN', 'Only assigned tickets are visible');
    const { items, total } = await this.repository.tickets(scope, query);
    return pageResult(items, total, query);
  }
  async stats(scope: OperationsScope, query: TicketQuery) {
    allowed(scope, operationsReaders);
    if (
      scope.role === 'TECHNICIAN' &&
      query.assignedTo &&
      BigInt(query.assignedTo) !== scope.actorId
    )
      throw new AppError(403, 'FORBIDDEN', 'Only assigned tickets are visible');
    return this.repository.ticketStats(scope, query);
  }
  async assign(scope: OperationsScope, id: bigint, staffId: bigint) {
    allowed(scope, managers);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const ticket = await this.requireTicket(repo, scope, id);
      if (!['OPEN', 'ASSIGNED'].includes(ticket.status))
        conflict('INVALID_MAINTENANCE_TRANSITION', 'Only open or assigned tickets can be assigned');
      const staff = await repo.staff(scope.hotelId, staffId);
      if (!staff || !['TECHNICIAN', 'ADMIN', 'MANAGER'].includes(staff.role.code))
        throw new AppError(
          422,
          'INVALID_MAINTENANCE_ASSIGNEE',
          'Choose active technical staff in this hotel',
        );
      await repo.updateTicket(scope.hotelId, id, { assignedTo: staffId, status: 'ASSIGNED' });
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        ticketId: id,
        action: 'TICKET_ASSIGNED',
        fromStatus: ticket.status,
        toStatus: 'ASSIGNED',
        notes: `Assigned to staff ${staffId}`,
      });
      return this.requireTicket(repo, scope, id);
    });
  }
  async transition(
    scope: OperationsScope,
    id: bigint,
    action: 'start' | 'resolve' | 'close' | 'cancel',
    notes?: string,
  ) {
    allowed(scope, action === 'start' || action === 'resolve' ? technicians : managers);
    return this.repository.withHotelLock(scope.hotelId, async (repo) => {
      const ticket = await this.requireTicket(repo, scope, id);
      const expected =
        action === 'start' ? 'ASSIGNED' : action === 'resolve' ? 'IN_PROGRESS' : 'RESOLVED';
      if (
        action === 'cancel'
          ? !['OPEN', 'ASSIGNED'].includes(ticket.status)
          : ticket.status !== expected
      )
        conflict('INVALID_MAINTENANCE_TRANSITION', 'Ticket does not allow this transition');
      if (action === 'start' || action === 'resolve') assignedActor(scope, ticket.assignedTo);
      if (
        (action === 'cancel' || action === 'close') &&
        (await repo.liveTicketBlocks(scope.hotelId, id))
      )
        conflict(
          'MAINTENANCE_BLOCK_CONFLICT',
          'Release or cancel the associated maintenance blocks first',
        );
      const status =
        action === 'start'
          ? 'IN_PROGRESS'
          : action === 'resolve'
            ? 'RESOLVED'
            : action === 'close'
              ? 'CLOSED'
              : 'CANCELLED';
      const now = new Date();
      await repo.updateTicket(scope.hotelId, id, {
        status,
        ...(action === 'start' ? { startedAt: now } : {}),
        ...(action === 'resolve'
          ? { resolvedAt: now, resolvedBy: scope.actorId, resolutionNotes: notes! }
          : {}),
        ...(action === 'close' ? { closedAt: now } : {}),
      });
      await repo.audit({
        hotelId: scope.hotelId,
        actorId: scope.actorId,
        ticketId: id,
        action: `TICKET_${action.toUpperCase()}`,
        fromStatus: ticket.status,
        toStatus: status,
        notes: notes ?? null,
      });
      return this.requireTicket(repo, scope, id);
    });
  }
}
