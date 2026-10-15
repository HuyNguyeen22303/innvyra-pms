import { AppError } from '../../shared/errors/app-error.js';
import type { StayOperations } from './stay.types.js';

// Called only inside the shared hotel transaction, after determining the booked type/dates.
export class RoomAssignmentService {
  async eligible(
    repository: StayOperations,
    hotelId: bigint,
    roomId: bigint,
    roomTypeId: bigint,
    reservationRoomId: bigint,
    from: Date,
    until: Date,
    transfer = false,
  ) {
    const room = await repository.room(hotelId, roomId);
    if (!room) throw new AppError(404, 'ROOM_NOT_FOUND', 'Room not found');
    if (room.roomTypeId !== roomTypeId)
      throw new AppError(
        409,
        transfer ? 'CROSS_ROOM_TYPE_TRANSFER_NOT_SUPPORTED' : 'ROOM_TYPE_MISMATCH',
        transfer
          ? 'Transfers must keep the booked room type'
          : 'Room must match the booked room type',
      );
    if (await repository.maintenanceConflict(hotelId, roomId, from, until))
      throw new AppError(
        409,
        'ROOM_UNDER_MAINTENANCE',
        'Room has an unreleased current block or a block overlapping this stay',
      );
    if (!room.isActive || room.physicalStatus !== 'ACTIVE' || !room.roomType.isActive)
      throw new AppError(409, 'ROOM_UNAVAILABLE', 'Room is not available for occupancy');
    if (room.occupancy)
      throw new AppError(409, 'ROOM_ALREADY_OCCUPIED', 'Room already has an active stay');
    if (room.housekeepingStatus !== 'READY')
      throw new AppError(409, 'ROOM_NOT_READY', 'Room must be READY');
    if (await repository.assignmentConflict(hotelId, roomId, reservationRoomId, from, until))
      throw new AppError(409, 'ROOM_UNAVAILABLE', 'Room has a conflicting reservation assignment');
    return room;
  }
}
