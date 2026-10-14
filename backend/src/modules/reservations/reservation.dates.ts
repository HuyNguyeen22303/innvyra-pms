import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      value >= '1000-01-01' &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, 'Use a valid YYYY-MM-DD calendar date');
export const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
export const asDateOnly = (value: Date) => value.toISOString().slice(0, 10);
export function hotelToday(timezone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    throw new AppError(503, 'HOTEL_TIMEZONE_INVALID', 'Hotel timezone must be configured');
  }
}
export function stayDates(
  checkIn: string,
  checkOut: string,
  timezone: string,
  maxNights: number,
  now = new Date(),
) {
  const valid = dateOnly.safeParse(checkIn).success && dateOnly.safeParse(checkOut).success;
  const nights = (asDate(checkOut).getTime() - asDate(checkIn).getTime()) / 86400000;
  if (!valid || nights < 1 || nights > maxNights || checkIn < hotelToday(timezone, now))
    throw new AppError(
      422,
      'INVALID_DATE_RANGE',
      `Use a future or current hotel date and 1–${maxNights} nights`,
    );
  return Array.from(
    { length: nights },
    (_, index) => new Date(asDate(checkIn).getTime() + index * 86400000),
  );
}
