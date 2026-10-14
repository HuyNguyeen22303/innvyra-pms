import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  roomTypeView,
  type RoomTypeRepository,
  type CreateRoomTypeInput,
  type UpdateRoomTypeInput,
  type RoomTypeQuery,
} from './room-type.types.js';

const missing = () => new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
const duplicate = () => new AppError(409, 'ROOM_TYPE_CODE_EXISTS', 'Room type code already exists');
export class RoomTypeService {
  constructor(private readonly repository: RoomTypeRepository) {}
  async createRoomType(hotelId: bigint, input: CreateRoomTypeInput) {
    return this.repository.withHotelLock(hotelId, async (repository) => {
      if (await repository.findByCode(hotelId, input.code)) throw duplicate();
      return roomTypeView(await repository.create(hotelId, input));
    });
  }
  async getRoomTypes(hotelId: bigint, query: RoomTypeQuery) {
    const { items, total } = await this.repository.list(hotelId, query);
    return pageResult(items.map(roomTypeView), total, query);
  }
  async getRoomTypeById(hotelId: bigint, id: bigint) {
    const record = await this.repository.findById(hotelId, id);
    if (!record) throw missing();
    return roomTypeView(record);
  }
  async updateRoomType(hotelId: bigint, id: bigint, input: UpdateRoomTypeInput) {
    return this.repository.withHotelLock(hotelId, async (repository) => {
      if (!(await repository.findById(hotelId, id))) throw missing();
      if (input.code !== undefined) {
        const existing = await repository.findByCode(hotelId, input.code);
        if (existing && existing.id !== id) throw duplicate();
      }
      if (input.isActive === false && (await repository.countActiveRooms(hotelId, id)))
        throw new AppError(
          409,
          'ROOM_TYPE_IN_USE',
          'Deactivate or reassign active rooms before deactivating this room type',
        );
      return roomTypeView(await repository.update(hotelId, id, input));
    });
  }
  deactivateRoomType(hotelId: bigint, id: bigint) {
    return this.updateRoomType(hotelId, id, { isActive: false });
  }
}
