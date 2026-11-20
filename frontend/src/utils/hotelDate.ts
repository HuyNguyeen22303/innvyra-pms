const formatters = new Map<string, Intl.DateTimeFormat>();

function hotelDateParts(timezone: string | undefined, now: Date) {
  if (!timezone) return null;
  try {
    let formatter = formatters.get(timezone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      });
      formatters.set(timezone, formatter);
    }
    const parts = formatter.formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
    return {
      date: `${part('year')}-${part('month')}-${part('day')}`,
      hour: Number(part('hour')),
      time: `${part('hour')}:${part('minute')}`,
      seconds: part('second'),
    };
  } catch {
    return null;
  }
}

export function hotelClock(timezone: string | undefined, now = new Date()) {
  const parts = hotelDateParts(timezone, now);
  return parts && { date: parts.date, hour: parts.hour, time: parts.time };
}

export function formatHotelDate(value: string, timezone: string | undefined, withTime: boolean | 'seconds' = false) {
  const clock = hotelDateParts(timezone, new Date(value));
  if (!clock) return '—';
  const date = clock.date.split('-').reverse().join('/');
  if (withTime === 'seconds') return `${date} ${clock.time}:${clock.seconds}`;
  return withTime ? `${date} ${clock.time}` : date;
}
