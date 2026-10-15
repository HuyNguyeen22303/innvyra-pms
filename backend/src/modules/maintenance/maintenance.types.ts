import type { z } from 'zod';
import type {
  createTicketBody,
  createBlockBody,
  ticketQuery,
  blockQuery,
} from './maintenance.schema.js';
import type { PrismaMaintenanceRepository } from './maintenance.repository.js';
export type CreateTicketInput = z.infer<typeof createTicketBody>;
export type CreateBlockInput = z.infer<typeof createBlockBody>;
export type TicketQuery = z.infer<typeof ticketQuery>;
export type BlockQuery = z.infer<typeof blockQuery>;
export type MaintenanceRepository = Pick<
  PrismaMaintenanceRepository,
  keyof PrismaMaintenanceRepository
>;
