import type { z } from 'zod';
import type {
  createTaskBody,
  taskQuery,
  dirtyRoomQuery,
  inspectBody,
} from './housekeeping.schema.js';
import type { PrismaHousekeepingRepository } from './housekeeping.repository.js';
export type CreateTaskInput = z.infer<typeof createTaskBody>;
export type TaskQuery = z.infer<typeof taskQuery>;
export type DirtyRoomQuery = z.infer<typeof dirtyRoomQuery>;
export type InspectInput = z.infer<typeof inspectBody>;
export type HousekeepingRepository = Omit<
  Pick<PrismaHousekeepingRepository, keyof PrismaHousekeepingRepository>,
  'workflow'
> & { workflow?: PrismaHousekeepingRepository['workflow'] };
