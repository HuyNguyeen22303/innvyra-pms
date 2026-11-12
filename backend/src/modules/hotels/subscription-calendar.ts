import { AppError } from '../../shared/errors/app-error.js';

export const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
export const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
export function localDay(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function periodEnd(startsOn: string, months: number) {
  const start = asDate(startsOn);
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(start.getUTCDate(), last));
  target.setUTCDate(target.getUTCDate() - 1);
  if (target.getUTCFullYear() > 9999)
    throw new AppError(422, 'INVALID_PERIOD', 'Subscription end date exceeds supported range');
  return target;
}
export function subscriptionTiming(startsOn: Date, endsOn: Date, today: string) {
  const daysRemaining = Math.round((endsOn.getTime() - asDate(today).getTime()) / 86400000);
  const status =
    dateOnly(startsOn) > today
      ? 'UPCOMING'
      : daysRemaining < 0
        ? 'EXPIRED'
        : daysRemaining <= 14
          ? 'EXPIRING'
          : 'ACTIVE';
  return {
    status,
    daysRemaining,
    alert:
      status === 'UPCOMING'
        ? null
        : daysRemaining < -7
          ? 'FOLLOW_UP'
          : daysRemaining < 0
            ? 'OVERDUE'
            : daysRemaining <= 1
              ? 'ONE_DAY'
              : daysRemaining <= 7
                ? 'SEVEN_DAYS'
                : daysRemaining <= 14
                  ? 'FOURTEEN_DAYS'
                  : null,
  };
}
