import { Prisma, type RoomType } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { CreateReservationInput, PricedRoom } from './reservation.types.js';

const maxMoney = new Prisma.Decimal('999999999999.99');
export class PricingService {
  // Isolated rate selection allows a future daily-rate provider without recalculating history.
  nightlyRate(type: Pick<RoomType, 'basePrice'>) {
    const rate = new Prisma.Decimal(type.basePrice);
    if (
      !rate.isFinite() ||
      rate.isNegative() ||
      rate.greaterThan(maxMoney) ||
      rate.decimalPlaces() > 2
    )
      throw new AppError(409, 'INVALID_ROOM_PRICE', 'Room price is invalid');
    return rate;
  }
  estimate(type: Pick<RoomType, 'basePrice'>, nights: number) {
    return this.nightlyRate(type).mul(nights);
  }
  price(lines: CreateReservationInput['rooms'], types: RoomType[], dates: Date[]) {
    const rooms: PricedRoom[] = [];
    let totalAmount = new Prisma.Decimal(0);
    for (const line of lines) {
      const type = types.find((item) => item.id === BigInt(line.roomTypeId))!;
      const nightlyRate = this.nightlyRate(type);
      for (let index = 0; index < line.quantity; index++) {
        rooms.push({
          roomTypeId: type.id,
          adults: line.adults,
          children: line.children,
          nights: dates.map((stayDate) => ({ stayDate, nightlyRate })),
        });
        totalAmount = totalAmount.add(nightlyRate.mul(dates.length));
      }
    }
    if (totalAmount.greaterThan(maxMoney))
      throw new AppError(
        422,
        'RESERVATION_TOTAL_TOO_LARGE',
        'Reservation total exceeds the supported amount',
      );
    return { rooms, totalAmount };
  }
}
