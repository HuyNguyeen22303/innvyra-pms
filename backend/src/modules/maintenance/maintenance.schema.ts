import { z } from 'zod';
import {
  MaintenanceBlockStatus,
  MaintenancePriority,
  MaintenanceTicketStatus,
} from '../../generated/prisma/enums.js';
import { idSchema } from '../../shared/validation/room-input.js';
import { dateOnly } from '../reservations/reservation.dates.js';
import { notes, pageFields } from '../operations/operations.shared.js';
export const createTicketBody = z
  .object({
    roomId: idSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    priority: z.enum(MaintenancePriority).default('NORMAL'),
  })
  .strict();
export const resolveBody = z.object({ resolutionNotes: notes }).strict();
export const reasonBody = z.object({ reason: notes }).strict();
export const releaseBody = z.object({ notes }).strict();
export const ticketQuery = z
  .object({
    ...pageFields,
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(MaintenanceTicketStatus).optional(),
    priority: z.enum(MaintenancePriority).optional(),
    roomId: idSchema.optional(),
    assignedTo: idSchema.optional(),
    fromDate: dateOnly.optional(),
    toDate: dateOnly.optional(),
    sortBy: z.enum(['reportedAt', 'priority', 'status']).default('reportedAt'),
  })
  .strict()
  .refine((v) => !v.fromDate || !v.toDate || v.fromDate <= v.toDate, 'Invalid date range');
export const createBlockBody = z
  .object({
    roomId: idSchema,
    maintenanceTicketId: idSchema.optional(),
    startDate: dateOnly,
    endDate: dateOnly,
    reason: notes,
  })
  .strict()
  .refine(
    (v) => {
      const days = (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000;
      return days > 0 && days <= 365;
    },
    { message: 'Use a half-open interval of 1–365 nights', path: ['endDate'] },
  );
export const blockQuery = z
  .object({
    ...pageFields,
    status: z.enum(MaintenanceBlockStatus).optional(),
    roomId: idSchema.optional(),
    maintenanceTicketId: idSchema.optional(),
    fromDate: dateOnly.optional(),
    toDate: dateOnly.optional(),
    sortBy: z.enum(['startDate', 'createdAt']).default('startDate'),
  })
  .strict()
  .refine((v) => !v.fromDate || !v.toDate || v.fromDate < v.toDate, 'Invalid half-open date range');
