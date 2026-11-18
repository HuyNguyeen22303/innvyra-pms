const formatters = new Map<string, Intl.DateTimeFormat>();

export function hotelClock(timezone: string | undefined, now = new Date()) {
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
        hourCycle: 'h23',
      });
      formatters.set(timezone, formatter);
    }
    const parts = formatter.formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
    return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')), time: `${part('hour')}:${part('minute')}` };
  } catch {
    return null;
  }
}

export function formatHotelDate(value: string, timezone: string | undefined, withTime = false) {
  const clock = hotelClock(timezone, new Date(value));
  if (!clock) return '—';
  const date = clock.date.split('-').reverse().join('/');
  return withTime ? `${date} ${clock.time}` : date;
}
