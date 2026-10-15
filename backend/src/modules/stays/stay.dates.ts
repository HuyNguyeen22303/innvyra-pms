import { AppError } from '../../shared/errors/app-error.js';
import { asDate, asDateOnly, hotelToday } from '../reservations/reservation.dates.js';

// Policy: arrival only on the booked hotel-local calendar day; no early/late arrival override.
export function validateArrival(checkInDate: Date, timezone: string, now: Date) {
  if (asDateOnly(checkInDate) !== hotelToday(timezone, now))
    throw new AppError(
      409,
      'INVALID_CHECKIN_DATE',
      'Check-in is only allowed on the booked hotel-local arrival date',
    );
}

// Find calendar boundaries using IANA formatting, including 23/25-hour DST days.
// Binary search also handles timezones whose offset changes at local midnight.
export function localDateRange(day: string, timezone: string) {
  hotelToday(timezone); // Reject invalid hotel configuration before constructing a query.
  const boundary = (target: string) => {
    const anchor = asDate(target).getTime();
    let low = anchor - 2 * 86400000;
    let high = anchor + 2 * 86400000;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (hotelToday(timezone, new Date(mid)) < target) low = mid + 1;
      else high = mid;
    }
    return new Date(low);
  };
  const next = asDateOnly(new Date(asDate(day).getTime() + 86400000));
  return { gte: boundary(day), lt: boundary(next) };
}
