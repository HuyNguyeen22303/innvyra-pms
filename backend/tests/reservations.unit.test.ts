import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { parseEnv } from '../src/config/env.js';
import { dateOnly, hotelToday, stayDates } from '../src/modules/reservations/reservation.dates.js';
import {
  createReservationBody,
  availabilityQuery,
  reservationListQuery,
} from '../src/modules/reservations/reservation.schema.js';
import { PricingService } from '../src/modules/reservations/pricing.service.js';
import { ReservationService } from '../src/modules/reservations/reservation.service.js';
import { testEnv } from './helpers.js';
import { memoryReservations, reservationInput } from './reservation-helpers.js';

describe('reservation DATE, validation and Decimal pricing', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-1-01', '2026-10-20T00:00:00Z', '0999-12-31'])(
    'rejects invalid DATE %s',
    (value) => expect(dateOnly.safeParse(value).success).toBe(false),
  );
  it('uses hotel local date at UTC midnight and across DST', () => {
    const now = new Date('2026-10-19T18:00:00Z');
    expect(hotelToday('Asia/Ho_Chi_Minh', now)).toBe('2026-10-20');
    expect(hotelToday('America/Los_Angeles', now)).toBe('2026-10-19');
    expect(() => stayDates('2026-10-19', '2026-10-21', 'Asia/Ho_Chi_Minh', 30, now)).toThrow();
    expect(
      stayDates('2026-03-07', '2026-03-10', 'America/New_York', 30, new Date('2026-03-01')),
    ).toHaveLength(3);
    expect(stayDates('2028-02-28', '2028-03-01', 'UTC', 30, now)).toHaveLength(2);
  });
  it('rejects invalid timezone and all invalid ranges', () => {
    expect(() => hotelToday('invalid/timezone')).toThrow();
    const now = new Date('2026-10-20T00:00:00Z');
    for (const [start, end] of [
      ['2026-10-20', '2026-10-20'],
      ['2026-10-21', '2026-10-20'],
      ['2026-10-20', '2026-12-01'],
    ])
      expect(() => stayDates(start!, end!, 'UTC', 30, now)).toThrow();
  });
  it.each([0, -1, 1.5, '2'])('rejects invalid quantity %s', (quantity) => {
    expect(
      createReservationBody.safeParse({
        ...reservationInput(),
        rooms: [{ roomTypeId: '2', quantity, adults: 1 }],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate room types, empty rooms, unsafe IDs and unknown fields', () => {
    const input = reservationInput();
    for (const body of [
      { ...input, rooms: [] },
      { ...input, rooms: [...input.rooms, ...input.rooms] },
      { ...input, guestId: '18446744073709551616' },
      ...['hotelId', 'createdBy', 'cancelledBy', 'status', 'totalAmount', 'currency', 'roomId'].map(
        (field) => ({ ...input, [field]: '1' }),
      ),
      { ...input, rooms: [{ ...input.rooms[0], nightlyRate: '0' }] },
    ])
      expect(createReservationBody.safeParse(body).success).toBe(false);
    expect(
      availabilityQuery.safeParse({
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        hotelId: '2',
      }).success,
    ).toBe(false);
    expect(reservationListQuery.safeParse({ sortBy: 'DROP TABLE' }).success).toBe(false);
    expect(reservationListQuery.safeParse({ page: '1.5' }).success).toBe(false);
  });
  it('snapshots each room/night with exact Decimal arithmetic and no checkout night', () => {
    const store = memoryReservations();
    const types = [...store.types.values()].map((t) => ({
      ...t,
      basePrice: new Prisma.Decimal('0.10'),
    }));
    const dates = stayDates('2028-02-28', '2028-03-01', 'UTC', 30, new Date('2026-01-01'));
    const priced = new PricingService().price(
      [{ roomTypeId: '2', quantity: 3, adults: 2, children: 0 }],
      types,
      dates,
    );
    expect(priced.totalAmount.toFixed(2)).toBe('0.60');
    expect(priced.rooms).toHaveLength(3);
    expect(priced.rooms[0]!.nights.map((n) => n.stayDate.toISOString().slice(0, 10))).toEqual([
      '2028-02-28',
      '2028-02-29',
    ]);
  });
  it('rejects negative, excessive precision and overflowing prices/totals', () => {
    const pricing = new PricingService();
    for (const amount of ['-0.01', '0.001', '1000000000000.00', 'NaN'])
      expect(() => pricing.nightlyRate({ basePrice: new Prisma.Decimal(amount) })).toThrow();
    const types = [...memoryReservations().types.values()].map((t) => ({
      ...t,
      basePrice: new Prisma.Decimal('999999999999.99'),
    }));
    expect(() =>
      pricing.price(reservationInput().rooms, types, [new Date(), new Date()]),
    ).toThrow();
  });
  it('enforces configurable total rooms and night limits', async () => {
    const store = memoryReservations();
    const service = new ReservationService(store.repository, {
      RESERVATION_MAX_NIGHTS: 1,
      RESERVATION_MAX_ROOMS: 1,
    });
    const scope = { hotelId: 9007199254740995n, actorId: 1n, role: 'ADMIN' as const };
    await expect(service.create(scope, reservationInput())).rejects.toMatchObject({
      code: 'INVALID_DATE_RANGE',
    });
    await expect(
      service.create(scope, {
        ...reservationInput(),
        rooms: [{ ...reservationInput().rooms[0]!, quantity: 2 }],
      }),
    ).rejects.toMatchObject({ code: 'RESERVATION_ROOM_LIMIT' });
    expect(() =>
      parseEnv({
        DATABASE_URL: testEnv.DATABASE_URL,
        JWT_ACCESS_SECRET: testEnv.JWT_ACCESS_SECRET,
        RESERVATION_MAX_NIGHTS: '0',
      }),
    ).toThrow();
  });
});
