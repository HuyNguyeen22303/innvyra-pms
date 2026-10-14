import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import { asDate, asDateOnly, hotelToday } from '../reservations/reservation.dates.js';
import { validateArrival } from './stay.dates.js';
import { RoomAssignmentService } from './room-assignment.service.js';
import { stayDetail, staySummary, type StayRecord } from './stay.mapper.js';
import {
  stayPermissions,
  type CheckinInput,
  type CheckoutInput,
  type TransferInput,
  type StayScope,
  type StayQuery,
  type StayOperations,
  type StayRepository,
} from './stay.types.js';

export class StayService {
  constructor(
    private readonly repository: StayRepository,
    private readonly assignment = new RoomAssignmentService(),
    private readonly clock: () => Date = () => new Date(),
  ) {}
  private authorize(scope: StayScope, permission: 'read' | 'write') {
    if (!(stayPermissions[permission] as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  private async requireStay(repository: StayOperations, scope: StayScope, id: bigint) {
    const stay = await repository.findById(scope.hotelId, id);
    if (!stay) throw new AppError(404, 'STAY_NOT_FOUND', 'Stay not found');
    return stay;
  }
  private requireActive(stay: StayRecord) {
    if (stay.status === 'CHECKED_OUT' || stay.actualCheckoutAt)
      throw new AppError(409, 'STAY_ALREADY_CHECKED_OUT', 'Stay has already checked out');
    if (!stay.occupancy || stay.occupancy.roomId !== stay.currentRoomId)
      throw new AppError(
        409,
        'STAY_CONFLICT',
        'Stay occupancy is inconsistent; review before proceeding',
      );
  }
  async checkin(
    scope: StayScope,
    reservationId: bigint,
    reservationRoomId: bigint,
    input: CheckinInput,
  ) {
    this.authorize(scope, 'write');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const reservation = await repository.reservation(scope.hotelId, reservationId);
      if (!reservation) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
      const booked = reservation.rooms.find((room) => room.id === reservationRoomId);
      if (!booked)
        throw new AppError(404, 'RESERVATION_ROOM_NOT_FOUND', 'Reservation room not found');
      if (booked.stay)
        throw new AppError(
          409,
          booked.stay.status === 'CHECKED_OUT'
            ? 'STAY_ALREADY_CHECKED_OUT'
            : 'STAY_ALREADY_CHECKED_IN',
          'Reservation room already has a stay',
        );
      if (!['CONFIRMED', 'PARTIALLY_CHECKED_IN'].includes(reservation.status))
        throw new AppError(
          409,
          'RESERVATION_NOT_CONFIRMED',
          'Reservation is not eligible for check-in',
        );
      const now = this.clock();
      const { timezone } = await repository.hotel(scope.hotelId);
      validateArrival(reservation.checkInDate, timezone, now);
      const room = await this.assignment.eligible(
        repository,
        scope.hotelId,
        BigInt(input.roomId),
        booked.roomTypeId,
        booked.id,
        reservation.checkInDate,
        reservation.checkOutDate,
      );
      const stay = await repository.createStay(
        scope,
        booked.id,
        booked.roomTypeId,
        room.id,
        now,
        input.notes ?? null,
      );
      await repository.occupy(stay, now);
      await repository.assign(scope.hotelId, booked.id, room.id);
      await repository.syncReservation(scope.hotelId, reservation.id);
      return stayDetail(await this.requireStay(repository, scope, stay.id), scope.role);
    });
  }
  async list(scope: StayScope, query: StayQuery) {
    this.authorize(scope, 'read');
    const { items, total } = await this.repository.list(scope.hotelId, query);
    return pageResult(
      items.map((stay) => staySummary(stay, scope.role)),
      total,
      query,
    );
  }
  async detail(scope: StayScope, id: bigint) {
    this.authorize(scope, 'read');
    return stayDetail(await this.requireStay(this.repository, scope, id), scope.role);
  }
  async checkout(scope: StayScope, id: bigint, input: CheckoutInput) {
    this.authorize(scope, 'write');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const stay = await this.requireStay(repository, scope, id);
      this.requireActive(stay);
      const now = this.clock();
      // Early and late physical departure allowed; never modify booked dates, nights or prices.
      if (now < stay.actualCheckinAt)
        throw new AppError(409, 'INVALID_CHECKOUT_OPERATION', 'Checkout cannot precede check-in');
      await repository.checkout(stay, scope.actorId, now, input.notes ?? null);
      await repository.release(stay);
      await repository.dirty(scope.hotelId, stay.currentRoomId);
      await repository.syncReservation(scope.hotelId, stay.reservationRoom.reservationId);
      return stayDetail(await this.requireStay(repository, scope, id), scope.role);
    });
  }
  async transfer(scope: StayScope, id: bigint, input: TransferInput) {
    this.authorize(scope, 'write');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const stay = await this.requireStay(repository, scope, id);
      this.requireActive(stay);
      const toRoomId = BigInt(input.toRoomId);
      if (toRoomId === stay.currentRoomId)
        throw new AppError(
          409,
          'INVALID_ROOM_TRANSFER',
          'Destination must differ from the current room',
        );
      const now = this.clock();
      const { timezone } = await repository.hotel(scope.hotelId);
      const today = hotelToday(timezone, now);
      const reservation = stay.reservationRoom.reservation;
      // Overdue transfers require a future reservation-extension workflow to protect inventory.
      if (now < stay.actualCheckinAt || today >= asDateOnly(reservation.checkOutDate))
        throw new AppError(
          409,
          'INVALID_ROOM_TRANSFER',
          'Transfer must be within the booked stay dates',
        );
      await this.assignment.eligible(
        repository,
        scope.hotelId,
        toRoomId,
        stay.roomTypeId,
        stay.reservationRoomId,
        asDate(today),
        reservation.checkOutDate,
        true,
      );
      await repository.transfer(stay, toRoomId, scope.actorId, now, input.reason);
      await repository.assign(scope.hotelId, stay.reservationRoomId, toRoomId);
      await repository.dirty(scope.hotelId, stay.currentRoomId);
      return stayDetail(await this.requireStay(repository, scope, id), scope.role);
    });
  }
}
