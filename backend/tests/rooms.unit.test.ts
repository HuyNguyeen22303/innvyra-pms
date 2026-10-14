import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';
import { roomTransaction } from '../src/database/room-transaction.js';
import { idSchema, priceSchema } from '../src/shared/validation/room-input.js';

describe('Room boundary and transaction error handling', () => {
  it.each([
    ['P2002', 409, 'ROOM_NUMBER_EXISTS'],
    ['P2003', 409, 'ROOM_REFERENCE_CONFLICT'],
    ['P2025', 404, 'NOT_FOUND'],
    ['P2034', 409, 'CONCURRENT_MODIFICATION'],
  ])('translates %s without leaking database diagnostics', async (code, status, expected) => {
    const internal = new Prisma.PrismaClientKnownRequestError('Private database diagnostic', {
      code,
      clientVersion: 'test',
    });
    const prisma = { $transaction: vi.fn().mockRejectedValue(internal) } as unknown as PrismaClient;
    const result = roomTransaction(
      prisma,
      1n,
      'ROOM_NUMBER_EXISTS',
      'Room number already exists',
      async () => undefined,
    );
    await expect(result).rejects.toMatchObject({ status, code: expected });
    await expect(result).rejects.not.toHaveProperty('message', internal.message);
  });
  it('passes unexpected failures to the existing sanitized global error handler', async () => {
    const internal = new Error('Database unavailable');
    const prisma = { $transaction: vi.fn().mockRejectedValue(internal) } as unknown as PrismaClient;
    await expect(
      roomTransaction(prisma, 1n, 'ROOM_NUMBER_EXISTS', 'Conflict', async () => undefined),
    ).rejects.toBe(internal);
  });
  it('validates ID boundaries without unsafe Number conversion or throwing on invalid strings', () => {
    expect(idSchema.parse('18446744073709551615')).toBe('18446744073709551615');
    for (const value of ['abc', '1e3', '0', '-1', '01', '18446744073709551616'])
      expect(idSchema.safeParse(value).success).toBe(false);
  });
  it('keeps subunit and maximum money values exact through Prisma Decimal', () => {
    for (const value of ['0', '0.01', '999999999999.99']) {
      const price = priceSchema.parse(value);
      expect(new Prisma.Decimal(price).toFixed(2)).toBe(value === '0' ? '0.00' : value);
    }
    for (const value of ['-0.01', '1e3', '0.001', '1000000000000', 900000])
      expect(priceSchema.safeParse(value).success).toBe(false);
  });
});
