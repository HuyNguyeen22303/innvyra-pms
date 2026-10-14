import type { z } from 'zod';
import type { RoomType } from '../../generated/prisma/client.js';
import type {
  roomTypeCreateBody,
  roomTypeUpdateBody,
  roomTypeListQuery,
} from './room-type.schema.js';
import type { PrismaRoomTypeRepository } from './room-type.repository.js';

export type CreateRoomTypeInput = z.infer<typeof roomTypeCreateBody>;
export type UpdateRoomTypeInput = z.infer<typeof roomTypeUpdateBody>;
export type RoomTypeQuery = z.infer<typeof roomTypeListQuery>;
// Derived structural contracts provide a test seam without duplicating the Prisma model.
export type RoomTypeRepository = Pick<PrismaRoomTypeRepository, keyof PrismaRoomTypeRepository>;
export type RoomTypeOperations = Omit<RoomTypeRepository, 'withHotelLock'>;
export const roomTypeView = (record: RoomType) => ({
  ...record,
  id: record.id.toString(),
  hotelId: record.hotelId.toString(),
  basePrice: record.basePrice.toFixed(2),
});
