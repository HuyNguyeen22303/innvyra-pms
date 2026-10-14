import { z } from 'zod';
import { PhysicalStatus, HousekeepingStatus } from '../../generated/prisma/enums.js';
import {
  emptyQuery,
  idParams,
  idSchema,
  paginationFields,
  floorSchema,
  floorQuerySchema,
  textSchema,
} from '../../shared/validation/room-input.js';

// Reject control characters while allowing human room labels, including Unicode.
const roomLabel = /^[^\u0000-\u001f\u007f]+$/; // eslint-disable-line no-control-regex
const fields = {
  roomNumber: z.string().trim().min(1).max(20).regex(roomLabel),
  floorNumber: floorSchema,
  roomTypeId: idSchema,
  physicalStatus: z.enum(PhysicalStatus),
  housekeepingStatus: z.enum(HousekeepingStatus),
  notes: textSchema,
  isActive: z.boolean(),
};
export const roomCreateBody = z
  .object({
    ...fields,
    physicalStatus: fields.physicalStatus.default('ACTIVE'),
    housekeepingStatus: fields.housekeepingStatus.default('DIRTY'),
    notes: fields.notes.optional(),
    isActive: fields.isActive.default(true),
  })
  .strict();
export const roomUpdateBody = z
  .object(fields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field');
export const roomListQuery = z
  .object({
    ...paginationFields,
    search: z.string().trim().min(1).max(20).optional(),
    roomTypeId: idSchema.optional(),
    floorNumber: floorQuerySchema.optional(),
    physicalStatus: fields.physicalStatus.optional(),
    housekeepingStatus: fields.housekeepingStatus.optional(),
    sortBy: z.enum(['roomNumber', 'floorNumber', 'createdAt']).default('roomNumber'),
  })
  .strict();
export const createRoomSchema = z.object({ body: roomCreateBody, query: emptyQuery });
export const updateRoomSchema = z.object({
  body: roomUpdateBody,
  params: idParams,
  query: emptyQuery,
});
export const roomIdSchema = z.object({ params: idParams, query: emptyQuery });
export const listRoomsSchema = z.object({ query: roomListQuery });
