import { expect, it } from 'vitest';
import { localPurchaseReceiptNumber } from '../scripts/local-seed/receipt-number.js';
it('uses a dated current receipt number for every local purchase scenario', () => {
  expect(localPurchaseReceiptNumber('2026-11-16', 1)).toBe('NHAP-VT-20261116-01');
  expect(localPurchaseReceiptNumber('2026-11-16', 3)).toBe('NHAP-VT-20261116-03');
});
it.each([
  ['2026-02-30', 1],
  ['2026/11/16', 1],
  ['2026-11-16', 0],
  ['2026-11-16', 4],
] as const)('rejects invalid receipt date/sequence %s/%s', (day, sequence) => {
  expect(() => localPurchaseReceiptNumber(day, sequence)).toThrow();
});
