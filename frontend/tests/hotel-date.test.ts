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

test('receipt timestamps include seconds in the hotel timezone', () => {
  const instant = '2026-11-19T09:34:49.402Z';
  assert.equal(formatHotelDate(instant, 'Asia/Ho_Chi_Minh', 'seconds'), '19/11/2026 16:34:49');
  assert.equal(formatHotelDate(instant, 'Pacific/Pago_Pago', 'seconds'), '18/11/2026 22:34:49');
});
