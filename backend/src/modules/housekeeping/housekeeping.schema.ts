import { z } from 'zod';
import { HousekeepingPriority, HousekeepingTaskStatus } from '../../generated/prisma/enums.js';
import { floorQuerySchema, idSchema } from '../../shared/validation/room-input.js';
import { notes, pageFields } from '../operations/operations.shared.js';
export const createTaskBody = z
  .object({
    roomId: idSchema,
    taskType: z.literal('TURNOVER_CLEANING').default('TURNOVER_CLEANING'),
    priority: z.enum(HousekeepingPriority).default('NORMAL'),
    notes: notes.optional(),
  })
  .strict();
export const assignBody = z.object({ staffId: idSchema }).strict();
export const inspectBody = z
  .object({ passed: z.boolean(), notes: notes.optional() })
  .strict()
  .refine((v) => v.passed || !!v.notes, {
    message: 'A failed inspection requires a reason',
    path: ['notes'],
  });
export const taskNotesBody = z
  .object({ notes: notes.optional() })
  .strict();
export const cancelTaskBody = z.object({ reason: notes }).strict();
export const taskQuery = z
  .object({
    ...pageFields,
    status: z.enum(HousekeepingTaskStatus).optional(),
    priority: z.enum(HousekeepingPriority).optional(),
    roomId: idSchema.optional(),
    assignedTo: idSchema.optional(),
    taskType: z.literal('TURNOVER_CLEANING').optional(),
    floorNumber: floorQuerySchema.optional(),
    sortBy: z.enum(['createdAt', 'priority', 'status']).default('createdAt'),
  })
  .strict();
export const dirtyRoomQuery = z
  .object({
    ...pageFields,
    floorNumber: floorQuerySchema.optional(),
    sortBy: z.enum(['roomNumber', 'floorNumber']).default('roomNumber'),
  })
  .strict();
