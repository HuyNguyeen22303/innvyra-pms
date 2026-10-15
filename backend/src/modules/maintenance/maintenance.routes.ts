import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { assignBody } from '../housekeeping/housekeeping.schema.js';
import { operationsRouter } from '../operations/operations.routes.js';
import { managers, operationsReaders, technicians } from '../operations/operations.shared.js';
import type { MaintenanceService } from './maintenance.service.js';
import type { MaintenanceBlockService } from './maintenance-block.service.js';
import { maintenanceController } from './maintenance.controller.js';
import {
  blockQuery,
  createBlockBody,
  createTicketBody,
  reasonBody,
  releaseBody,
  resolveBody,
  ticketQuery,
} from './maintenance.schema.js';
export function maintenanceRoutes(
  tickets: MaintenanceService,
  blocks: MaintenanceBlockService,
  auth: AuthService,
  env: Env,
) {
  const { router, add } = operationsRouter(auth, env),
    c = maintenanceController(tickets, blocks);
  add('get', '/tickets', operationsReaders, c.tickets, { query: ticketQuery });
  add('get', '/tickets/:id', operationsReaders, c.ticket);
  add('post', '/tickets', operationsReaders, c.createTicket, { body: createTicketBody });
  add('patch', '/tickets/:id/assign', managers, c.assign, { body: assignBody });
  add('post', '/tickets/:id/start', technicians, c.start);
  add('post', '/tickets/:id/resolve', technicians, c.resolve, { body: resolveBody });
  add('post', '/tickets/:id/close', managers, c.close);
  add('post', '/tickets/:id/cancel', managers, c.cancelTicket, { body: reasonBody });
  add('get', '/blocks', operationsReaders, c.blocks, { query: blockQuery });
  add('get', '/blocks/:id', operationsReaders, c.block);
  add('post', '/blocks', managers, c.createBlock, { body: createBlockBody });
  add('post', '/blocks/:id/release', managers, c.release, { body: releaseBody });
  add('post', '/blocks/:id/cancel', managers, c.cancelBlock, { body: reasonBody });
  return router;
}
