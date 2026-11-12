import { describe, expect, it } from 'vitest';
import {
  asDate,
  dateOnly,
  localDay,
  periodEnd,
  subscriptionTiming,
} from '../src/modules/hotels/subscription-calendar.js';
import { monthlyPeriodBody, planBody } from '../src/modules/hotels/subscription.schema.js';
describe('Monthly subscriptions: calendar and validation', () => {
  it.each([
    ['2026-01-01', 1, '2026-01-31'],
    ['2026-01-31', 1, '2026-02-27'],
    ['2028-01-31', 1, '2028-02-28'],
    ['2028-02-29', 12, '2029-02-27'],
    ['2026-12-31', 2, '2027-02-27'],
    ['2026-11-12', 3, '2027-02-11'],
  ])('starts %s for %i months ends inclusively %s', (start, months, expected) => {
    expect(dateOnly(periodEnd(start, months))).toBe(expected);
  });
  it('rejects an end beyond the MySQL date range', () =>
    expect(() => periodEnd('9999-12-01', 2)).toThrow());
  it('uses hotel timezone at the UTC day boundary', () => {
    const now = new Date('2026-11-12T17:00:00Z');
    expect(localDay('Asia/Ho_Chi_Minh', now)).toBe('2026-11-13');
    expect(localDay('America/Los_Angeles', now)).toBe('2026-11-12');
  });
  it.each([
    [15, null],
    [14, 'FOURTEEN_DAYS'],
    [7, 'SEVEN_DAYS'],
    [1, 'ONE_DAY'],
    [0, 'ONE_DAY'],
    [-1, 'OVERDUE'],
    [-7, 'OVERDUE'],
    [-8, 'FOLLOW_UP'],
  ])('handles %i days remaining', (days, alert) => {
    const end = new Date(asDate('2026-11-12').getTime() + Number(days) * 86400000);
    const result = subscriptionTiming(asDate('2026-01-01'), end, '2026-11-12');
    expect(result.alert).toBe(alert);
    expect(result.daysRemaining).toBe(days);
    if (Number(days) === 0) expect(result.status).toBe('EXPIRING');
  });
  it('does not show expiry alerts before the start', () =>
    expect(
      subscriptionTiming(asDate('2026-11-13'), asDate('2026-11-14'), '2026-11-12'),
    ).toMatchObject({ status: 'UPCOMING', alert: null }));
  it.each(['2026-02-30', '2026-2-01', '0001-01-01'])('rejects invalid date %s', (startsOn) => {
    expect(
      monthlyPeriodBody.safeParse({ planId: '1', startsOn, monthCount: 1, reason: 'Test' }).success,
    ).toBe(false);
  });
  it('rejects injected pricing, zero months and zero staff capacity', () => {
    expect(
      monthlyPeriodBody.safeParse({
        planId: '1',
        startsOn: '2026-11-12',
        monthCount: 0,
        reason: 'Test',
      }).success,
    ).toBe(false);
    expect(
      monthlyPeriodBody.safeParse({
        planId: '1',
        startsOn: '2026-11-12',
        monthCount: 1,
        reason: 'Test',
        feeAmount: '0',
      }).success,
    ).toBe(false);
    expect(
      planBody.safeParse({
        code: 'SMALL',
        name: 'Small',
        monthlyPrice: '-1',
        roomLimit: 1,
        staffLimit: 0,
        isActive: true,
      }).success,
    ).toBe(false);
  });
});
