import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  roomView,
  type RoomRepository,
  type RoomOperations,
  type CreateRoomInput,
  type UpdateRoomInput,
  type RoomQuery,
} from './room.types.js';

const missing = () => new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
const duplicate = () => new AppError(409, 'ROOM_NUMBER_EXISTS', 'Room number already exists');
export class RoomService {
  constructor(private readonly repository: RoomRepository) {}
  private async requireActiveType(repository: RoomOperations, hotelId: bigint, roomTypeId: bigint) {
    const roomType = await repository.findRoomType(hotelId, roomTypeId);
    if (!roomType) throw new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
    if (!roomType.isActive) throw new AppError(409, 'ROOM_TYPE_INACTIVE', 'Room type is inactive');
  }
  async createRoom(hotelId: bigint, input: CreateRoomInput) {
    if (input.housekeepingStatus !== 'DIRTY')
      throw new AppError(
        409,
        'HOUSEKEEPING_WORKFLOW_REQUIRED',
        'New rooms must be DIRTY; use cleaning and inspection to confirm readiness',
      );
    if (input.physicalStatus === 'MAINTENANCE')
      throw new AppError(
        409,
        'MAINTENANCE_WORKFLOW_REQUIRED',
        'Create a maintenance block to put a room into maintenance',
      );
    return this.repository.withHotelLock(hotelId, async (repository) => {
      await this.requireActiveType(repository, hotelId, BigInt(input.roomTypeId));
      if (await repository.findByNumber(hotelId, input.roomNumber)) throw duplicate();
      return roomView(await repository.create(hotelId, input));
    });
  }
  async getRooms(hotelId: bigint, query: RoomQuery) {
    const { items, total } = await this.repository.list(hotelId, query);
    return pageResult(items.map(roomView), total, query);
  }
  async getRoomById(hotelId: bigint, id: bigint) {
    const record = await this.repository.findById(hotelId, id);
    if (!record) throw missing();
    return roomView(record);
  }
  async updateRoom(hotelId: bigint, id: bigint, input: UpdateRoomInput) {
    return this.repository.withHotelLock(hotelId, async (repository) => {
      const record = await repository.findById(hotelId, id);
      if (!record) throw missing();
      if (input.housekeepingStatus !== undefined && input.housekeepingStatus !== 'DIRTY')
        throw new AppError(
          409,
          'HOUSEKEEPING_WORKFLOW_REQUIRED',
          'Use the housekeeping task workflow',
        );
      if (input.physicalStatus === 'MAINTENANCE' && record.physicalStatus !== 'MAINTENANCE')
        throw new AppError(409, 'MAINTENANCE_WORKFLOW_REQUIRED', 'Use maintenance blocks');
      const locks = await repository.operationLocks(hotelId, id);
      if (
        (locks.block &&
          (input.physicalStatus !== undefined ||
            input.isActive === false ||
            input.roomTypeId !== undefined)) ||
        (locks.task &&
          (input.housekeepingStatus !== undefined ||
            input.physicalStatus !== undefined ||
            input.isActive === false ||
            input.roomTypeId !== undefined))
      )
        throw new AppError(
          409,
          'ROOM_OPERATIONS_CONFLICT',
          'Resolve active operations before changing room state or type',
        );
      if (record.occupancy && input.housekeepingStatus !== undefined)
        throw new AppError(
          409,
          'ROOM_OCCUPIED',
          'Turnover state cannot be changed for an occupied room',
        );
      // Reopening an independently restricted room always requires a fresh inspection.
      if (input.physicalStatus === 'ACTIVE' && record.physicalStatus !== 'ACTIVE')
        input = { ...input, housekeepingStatus: 'DIRTY' };
      if (
        record.occupancy &&
        (input.isActive === false ||
          (input.physicalStatus !== undefined && input.physicalStatus !== 'ACTIVE') ||
          (input.roomTypeId !== undefined && BigInt(input.roomTypeId) !== record.roomTypeId))
      )
        throw new AppError(
          409,
          'ROOM_OCCUPIED',
          'Transfer or check out the active stay before changing room operation or type',
        );
      if (input.roomTypeId !== undefined || input.isActive === true)
        await this.requireActiveType(
          repository,
          hotelId,
          input.roomTypeId !== undefined ? BigInt(input.roomTypeId) : record.roomTypeId,
        );
      if (input.roomNumber !== undefined) {
        const existing = await repository.findByNumber(hotelId, input.roomNumber);
        if (existing && existing.id !== id) throw duplicate();
      }
      const removesCapacity =
        record.isActive &&
        record.physicalStatus === 'ACTIVE' &&
        (input.isActive === false ||
          (input.physicalStatus !== undefined && input.physicalStatus !== 'ACTIVE') ||
          (input.roomTypeId !== undefined && BigInt(input.roomTypeId) !== record.roomTypeId));
      if (
        removesCapacity &&
        (await repository.capacityAfterRemoval(hotelId, record.roomTypeId, id)) <
          (await repository.reservedPeak(hotelId, record.roomTypeId))
      )
        throw new AppError(
          409,
          'ROOM_INVENTORY_CONFLICT',
          'Room change would reduce capacity below existing reservations',
        );
      return roomView(await repository.update(hotelId, id, input));
    });
  }
  deactivateRoom(hotelId: bigint, id: bigint) {
    return this.updateRoom(hotelId, id, { isActive: false });
  }
}
