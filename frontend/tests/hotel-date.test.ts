import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHotelDate, hotelClock } from '../src/utils/hotelDate.ts';

test('the same instant can be two different operating days', () => {
  const instant = new Date('2026-11-18T07:59:00.000Z');
  assert.equal(hotelClock('Asia/Ho_Chi_Minh', instant)?.date, '2026-11-18');
  assert.deepEqual(hotelClock('America/Los_Angeles', instant), { date: '2026-11-17', hour: 23, time: '23:59' });
  assert.equal(formatHotelDate('2026-02-27T17:00:00.000Z', 'Asia/Ho_Chi_Minh', true), '28/02/2026 00:00');
  assert.equal(hotelClock(undefined, instant), null);
});
