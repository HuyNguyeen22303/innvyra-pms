import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import { AvailabilityService } from './availability.service.js';
import { PricingService } from './pricing.service.js';
import { asDate } from './reservation.dates.js';
import { createReservationBody } from './reservation.schema.js';
import { reservationDetail, reservationSummary } from './reservation.mapper.js';
import {
  reservationPermissions,
  type CancelReservationInput,
  type CreateReservationInput,
  type NoShowReservationInput,
  type ReservationQuery,
  type ReservationRepository,
  type ReservationScope,
} from './reservation.types.js';

export class ReservationService {
  readonly availability: AvailabilityService;
  constructor(
    private readonly repository: ReservationRepository,
    private readonly env: Pick<Env, 'RESERVATION_MAX_NIGHTS' | 'RESERVATION_MAX_ROOMS'>,
    private readonly pricing = new PricingService(),
  ) {
    this.availability = new AvailabilityService(repository, env, pricing);
  }
  private authorize(scope: ReservationScope, permission: 'read' | 'write') {
    if (!(reservationPermissions[permission] as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  async create(scope: ReservationScope, raw: CreateReservationInput) {
    this.authorize(scope, 'write');
    const input = createReservationBody.parse(raw);
    if (input.rooms.reduce((sum, line) => sum + line.quantity, 0) > this.env.RESERVATION_MAX_ROOMS)
      throw new AppError(
        422,
        'RESERVATION_ROOM_LIMIT',
        `At most ${this.env.RESERVATION_MAX_ROOMS} rooms per reservation`,
      );
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const dates = await this.availability.dates(
        repository,
        scope.hotelId,
        input.checkInDate,
        input.checkOutDate,
      );
      if (!(await repository.guest(scope.hotelId, BigInt(input.guestId))))
        throw new AppError(404, 'GUEST_NOT_FOUND', 'Guest not found');
      const types = await repository.roomTypes(
        scope.hotelId,
        input.rooms.map((line) => BigInt(line.roomTypeId)),
      );
      for (const line of input.rooms) {
        const type = types.find((row) => row.id === BigInt(line.roomTypeId));
        if (!type) throw new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
        if (!type.isActive) throw new AppError(409, 'ROOM_TYPE_INACTIVE', 'Room type is inactive');
        if (line.adults > type.maxAdults || line.children > type.maxChildren)
          throw new AppError(
            422,
            'ROOM_CAPACITY_EXCEEDED',
            'Guest count exceeds capacity per room',
          );
        if (
          (await this.availability.available(
            repository,
            scope.hotelId,
            type.id,
            asDate(input.checkInDate),
            asDate(input.checkOutDate),
          )) < line.quantity
        )
          throw new AppError(
            409,
            'INSUFFICIENT_AVAILABILITY',
            'Insufficient rooms for one or more nights',
          );
      }
      const priced = this.pricing.price(input.rooms, types, dates);
      const reservation = await repository.create(scope.hotelId, scope.actorId, {
        ...priced,
        guestId: BigInt(input.guestId),
        checkInDate: asDate(input.checkInDate),
        checkOutDate: asDate(input.checkOutDate),
        bookingSource: input.bookingSource,
        notes: input.notes ?? null,
      });
      return reservationDetail(reservation, scope.role);
    });
  }
  async list(scope: ReservationScope, query: ReservationQuery) {
    this.authorize(scope, 'read');
    if (scope.role === 'ACCOUNTANT' && query.guestSearch)
      throw new AppError(403, 'FORBIDDEN', 'Guest name search is restricted to front desk staff');
    const { items, total } = await this.repository.list(scope.hotelId, query);
    return pageResult(items.map(reservationSummary), total, query);
  }
  async detail(scope: ReservationScope, id: bigint) {
    this.authorize(scope, 'read');
    const record = await this.repository.findById(scope.hotelId, id);
    if (!record) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
    return reservationDetail(record, scope.role);
  }
  async cancel(scope: ReservationScope, id: bigint, input: CancelReservationInput) {
    this.authorize(scope, 'write');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
      if (record.status === 'CANCELLED') return { id: record.id.toString(), status: record.status };
      if (record.status !== 'CONFIRMED')
        throw new AppError(
          409,
          'RESERVATION_CANNOT_BE_CANCELLED',
          'Only confirmed reservations can be cancelled',
        );
      const cancelled = await repository.cancel(scope.hotelId, id, scope.actorId, input.reason);
      return { id: cancelled.id.toString(), status: cancelled.status };
    });
  }
  async noShow(scope: ReservationScope, id: bigint, input: NoShowReservationInput) {
    this.authorize(scope, 'write');
    return this.repository.withHotelLock(scope.hotelId, async (repository) => {
      const record = await repository.findById(scope.hotelId, id);
      if (!record) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
      if (record.status === 'NO_SHOW') return { id: record.id.toString(), status: record.status };
      if (record.status !== 'CONFIRMED')
        throw new AppError(
          409,
          'RESERVATION_CANNOT_BE_NO_SHOW',
          'Only confirmed reservations can be marked as no-show',
        );
      const updated = await repository.noShow(scope.hotelId, id, scope.actorId, input.reason);
      return { id: updated.id.toString(), status: updated.status };
    });
  }
}
