import { describe, expect, it } from 'vitest';
import {
  checkinSchema,
  checkoutBody,
  transferBody,
  stayListQuery,
} from '../src/modules/stays/stay.schema.js';
import { localDateRange, validateArrival } from '../src/modules/stays/stay.dates.js';
import { asDate } from '../src/modules/reservations/reservation.dates.js';

describe('Stay input and hotel-local date policy', () => {
  it.each(['0', '-1', '1.1', '01', '18446744073709551616', 'abc'])(
    'rejects invalid ID %s',
    (id) => {
      expect(
        checkinSchema.safeParse({
          params: { reservationId: id, reservationRoomId: '2' },
          body: { roomId: '3' },
          query: {},
        }).success,
      ).toBe(false);
      expect(transferBody.safeParse({ toRoomId: id, reason: 'Move' }).success).toBe(false);
    },
  );
  it.each(['hotelId', 'status', 'actualCheckinAt', 'actualCheckoutAt', 'transferredBy', 'role'])(
    'rejects forged %s',
    (field) => {
      expect(checkoutBody.safeParse({ [field]: 'forged' }).success).toBe(false);
      expect(
        transferBody.safeParse({ toRoomId: '3', reason: 'Move', [field]: 'forged' }).success,
      ).toBe(false);
      expect(
        checkinSchema.safeParse({
          params: { reservationId: '1', reservationRoomId: '2' },
          body: { roomId: '3', [field]: 'forged' },
          query: {},
        }).success,
      ).toBe(false);
    },
  );
  it('bounds notes, reason, query dates, pagination and sorting', () => {
    expect(checkoutBody.safeParse({ notes: 'x'.repeat(2001) }).success).toBe(false);
    for (const reason of ['', '  ', 'x'.repeat(2001)])
      expect(transferBody.safeParse({ toRoomId: '3', reason }).success).toBe(false);
    for (const query of [
      { page: '0' },
      { limit: '101' },
      { sortBy: 'passwordHash' },
      { checkInDate: '2026-02-30' },
      { hotelId: '2' },
    ])
      expect(stayListQuery.safeParse(query).success).toBe(false);
    expect(stayListQuery.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      sortBy: 'actualCheckinAt',
      sortOrder: 'desc',
    });
  });
  it('uses hotel arrival day across the UTC midnight boundary', () => {
    const now = new Date('2026-10-19T18:00:00Z');
    expect(() => validateArrival(asDate('2026-10-20'), 'Asia/Ho_Chi_Minh', now)).not.toThrow();
    expect(() => validateArrival(asDate('2026-10-19'), 'Asia/Ho_Chi_Minh', now)).toThrowError(
      expect.objectContaining({ code: 'INVALID_CHECKIN_DATE' }),
    );
    expect(localDateRange('2026-10-20', 'Asia/Ho_Chi_Minh')).toEqual({
      gte: new Date('2026-10-19T17:00:00Z'),
      lt: new Date('2026-10-20T17:00:00Z'),
    });
  });
  it.each([
    ['2026-03-08', 23],
    ['2026-11-01', 25],
  ] as const)('supports DST day %s with %i hours', (date, hours) => {
    const range = localDateRange(date, 'America/New_York');
    expect((range.lt.getTime() - range.gte.getTime()) / 3600000).toBe(hours);
  });
  it('fails closed for invalid hotel timezone', () => {
    expect(() => localDateRange('2026-10-20', 'Invalid/Zone')).toThrowError(
      expect.objectContaining({ code: 'HOTEL_TIMEZONE_INVALID' }),
    );
  });
});
