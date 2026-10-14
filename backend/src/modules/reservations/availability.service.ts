import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { asDate, stayDates } from './reservation.dates.js';
import { PricingService } from './pricing.service.js';
import {
  reservationPermissions,
  type AvailabilityQuery,
  type ReservationOperations,
  type ReservationRepository,
  type ReservationScope,
} from './reservation.types.js';

export class AvailabilityService {
  constructor(
    private readonly repository: ReservationRepository,
    private readonly env: Pick<Env, 'RESERVATION_MAX_NIGHTS'>,
    private readonly pricing = new PricingService(),
  ) {}
  async dates(
    repository: ReservationOperations,
    hotelId: bigint,
    checkIn: string,
    checkOut: string,
  ) {
    const hotel = await repository.hotel(hotelId);
    if (!hotel) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
    return stayDates(checkIn, checkOut, hotel.timezone, this.env.RESERVATION_MAX_NIGHTS);
  }
  async available(
    repository: ReservationOperations,
    hotelId: bigint,
    typeId: bigint,
    from: Date,
    until: Date,
  ) {
    const capacity = await repository.capacity(hotelId, typeId);
    const occupied = await repository.occupied(hotelId, typeId, from, until);
    // Missing dates have zero occupancy. The busiest night determines whole-stay availability.
    return Math.max(0, capacity - occupied.reduce((max, row) => Math.max(max, row._count._all), 0));
  }
  async search(scope: ReservationScope, query: AvailabilityQuery) {
    if (!(reservationPermissions.availability as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    return this.repository.snapshot(async (repository) => {
      const dates = await this.dates(
        repository,
        scope.hotelId,
        query.checkInDate,
        query.checkOutDate,
      );
      const types = await repository.roomTypes(
        scope.hotelId,
        query.roomTypeId ? [BigInt(query.roomTypeId)] : undefined,
      );
      if (query.roomTypeId && !types.length)
        throw new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
      if (query.roomTypeId && !types[0]!.isActive)
        throw new AppError(409, 'ROOM_TYPE_INACTIVE', 'Room type is inactive');
      const results = [];
      for (const type of types) {
        if (!type.isActive || type.maxAdults < query.adults || type.maxChildren < query.children)
          continue;
        results.push({
          roomTypeId: type.id.toString(),
          roomTypeName: type.name,
          availableRooms: await this.available(
            repository,
            scope.hotelId,
            type.id,
            asDate(query.checkInDate),
            asDate(query.checkOutDate),
          ),
          basePrice: this.pricing.nightlyRate(type).toFixed(2),
          estimatedTotalPerRoom: this.pricing.estimate(type, dates.length).toFixed(2),
          currency: 'VND',
        });
      }
      return results;
    });
  }
}
