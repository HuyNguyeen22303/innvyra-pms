import { randomBytes } from 'node:crypto';

export const RESERVATION_CODE_PATTERN = /^INN-[0-9A-F]{12}$/;

// 48 random bits, with a global database unique index and transaction retry.
export function generateReservationCode() {
  return `INN-${randomBytes(6).toString('hex').toUpperCase()}`;
}
