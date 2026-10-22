import { operationHandler as handle } from '../operations/operations.shared.js';
import type { MaintenanceService } from './maintenance.service.js';
import type { MaintenanceBlockService } from './maintenance-block.service.js';
import type {
  BlockQuery,
  CreateBlockInput,
  CreateTicketInput,
  TicketQuery,
} from './maintenance.types.js';
export function maintenanceController(
  tickets: MaintenanceService,
  blocks: MaintenanceBlockService,
) {
  return {
    tickets: handle<object, TicketQuery>('Tickets retrieved', (s, { query }) =>
      tickets.list(s, query),
    ),
    ticketStats: handle<object, TicketQuery>('Ticket stats retrieved', (s, { query }) =>
      tickets.stats(s, query),
    ),
    ticket: handle('Ticket retrieved', (s, { params }) => tickets.detail(s, BigInt(params.id!))),
    createTicket: handle<CreateTicketInput>(
      'Ticket reported',
      (s, { body }) => tickets.create(s, body),
      201,
    ),
    assign: handle<{ staffId: string }>('Technician assigned', (s, { params, body }) =>
      tickets.assign(s, BigInt(params.id!), BigInt(body.staffId)),
    ),
    start: handle('Repair started', (s, { params }) =>
      tickets.transition(s, BigInt(params.id!), 'start'),
    ),
    resolve: handle<{ resolutionNotes: string }>('Repair resolved', (s, { params, body }) =>
      tickets.transition(s, BigInt(params.id!), 'resolve', body.resolutionNotes),
    ),
    close: handle('Ticket closed', (s, { params }) =>
      tickets.transition(s, BigInt(params.id!), 'close'),
    ),
    cancelTicket: handle<{ reason: string }>('Ticket cancelled', (s, { params, body }) =>
      tickets.transition(s, BigInt(params.id!), 'cancel', body.reason),
    ),
    blocks: handle<object, BlockQuery>('Blocks retrieved', (s, { query }) => blocks.list(s, query)),
    block: handle('Block retrieved', (s, { params }) => blocks.detail(s, BigInt(params.id!))),
    createBlock: handle<CreateBlockInput>(
      'Block created',
      (s, { body }) => blocks.create(s, body),
      201,
    ),
    release: handle<{ notes: string }>('Block released; cleaning required', (s, { params, body }) =>
      blocks.finish(s, BigInt(params.id!), 'release', body.notes),
    ),
    cancelBlock: handle<{ reason: string }>('Scheduled block cancelled', (s, { params, body }) =>
      blocks.finish(s, BigInt(params.id!), 'cancel', body.reason),
    ),
  };
}
