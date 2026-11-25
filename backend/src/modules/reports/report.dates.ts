import { AppError } from '../../shared/errors/app-error.js';
import { asDate, asDateOnly } from '../reservations/reservation.dates.js';
import type { ReportDay } from './report.types.js';

const DAY_MS = 86_400_000;

export const nextDate = (date: string) => asDateOnly(new Date(asDate(date).getTime() + DAY_MS));

// One IANA formatter per report. No dependency on the host timezone or MySQL timezone tables.
export function reportDays(
  start: string,
  end: string,
  timezone: string,
  maximum: number,
): ReportDay[] {
  const length = (asDate(end).getTime() - asDate(start).getTime()) / DAY_MS;
  if (!Number.isInteger(length) || length < 1)
    throw new AppError(422, 'INVALID_REPORT_DATE_RANGE', 'startDate must precede endDate');
  if (length > maximum)
    throw new AppError(422, 'REPORT_RANGE_TOO_LARGE', `Report range exceeds ${maximum} days`);
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    throw new AppError(503, 'HOTEL_TIMEZONE_INVALID', 'Hotel timezone must be configured');
  }
  const localDate = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  };
  const boundary = (date: string) => {
    const anchor = asDate(date).getTime();
    let low = anchor - 2 * DAY_MS,
      high = anchor + 2 * DAY_MS;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (localDate(mid) < date) low = mid + 1;
      else high = mid;
    }
    return new Date(low);
  };
  const days: ReportDay[] = [];
  let from = boundary(start);
  for (let date = start; date < end; date = nextDate(date)) {
    const next = nextDate(date);
    const candidate = from.getTime() + DAY_MS;
    const until =
      localDate(candidate) === next && localDate(candidate - 1) === date
        ? new Date(candidate)
        : boundary(next);
    if (from >= until)
      throw new AppError(
        422,
        'INVALID_REPORT_DATE_RANGE',
        'Period includes a skipped hotel calendar date',
      );
    days.push({ date, from, until });
    from = until;
  }
  return days;
}
