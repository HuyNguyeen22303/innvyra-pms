import type { z } from 'zod';
import type { Room, RoomType } from '../../generated/prisma/client.js';
import type { roomCreateBody, roomUpdateBody, roomListQuery } from './room.schema.js';
import type { PrismaRoomRepository } from './room.repository.js';

export type CreateRoomInput = z.infer<typeof roomCreateBody>;
export type UpdateRoomInput = z.infer<typeof roomUpdateBody>;
export type RoomQuery = z.infer<typeof roomListQuery>;
export type RoomRepository = Pick<PrismaRoomRepository, keyof PrismaRoomRepository>;
export type RoomOperations = Omit<RoomRepository, 'withHotelLock'>;
export type RoomRecord = Room & { roomType: Pick<RoomType, 'id' | 'code' | 'name' | 'isActive'> };
export const roomView = (record: RoomRecord) => ({
  ...record,
  id: record.id.toString(),
  hotelId: record.hotelId.toString(),
  roomTypeId: record.roomTypeId.toString(),
  roomType: { ...record.roomType, id: record.roomType.id.toString() },
});
