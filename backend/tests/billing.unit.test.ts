import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  calculateBalance,
  checkedAmount,
  Money,
  roomCharge,
} from '../src/modules/billing/billing.money.js';
import {
  adjustmentBody,
  createOrderBody,
  createServiceBody,
  idempotencyKey,
  ledgerQuery,
  moneyInput,
  orderQuery,
  paymentBody,
  refundBody,
  serviceQuery,
} from '../src/modules/billing/billing.schema.js';
import { canonicalJson } from '../src/modules/billing/billing.service.js';
import { openApiDocument } from '../src/config/swagger.js';
import { billingPaths } from '../src/config/billing.openapi.js';

describe('Billing Decimal and validation policy', () => {
  it('verifies the requested 1,950,000 - 500,000 - 1,000,000 = 450,000 example', () => {
    const items = ['900000', '900000', '100000', '50000'].map((amount) => ({
      entryType: 'DEBIT' as const,
      amount: new Money(amount),
    }));
    const payments = [
      {
        paymentType: 'DEPOSIT' as const,
        status: 'CONFIRMED' as const,
        amount: new Money('500000'),
      },
      {
        paymentType: 'PAYMENT' as const,
        status: 'CONFIRMED' as const,
        amount: new Money('1000000'),
      },
    ];
    expect(calculateBalance(items, payments).outstandingBalance.toFixed(2)).toBe('450000.00');
    payments.push({ paymentType: 'PAYMENT', status: 'CONFIRMED', amount: new Money('450000') });
    expect(calculateBalance(items, payments).outstandingBalance.toFixed(2)).toBe('0.00');
  });
  it('excludes failed/pending payments and refunds, counts deposits once, and surfaces negative balances', () => {
    const result = calculateBalance(
      [
        { entryType: 'DEBIT', amount: new Money('100') },
        { entryType: 'CREDIT', amount: new Money('20') },
      ],
      [
        { paymentType: 'PAYMENT', status: 'CONFIRMED', amount: new Money('80') },
        { paymentType: 'DEPOSIT', status: 'CONFIRMED', amount: new Money('30') },
        { paymentType: 'REFUND', status: 'CONFIRMED', amount: new Money('10') },
        { paymentType: 'PAYMENT', status: 'FAILED', amount: new Money('900') },
        { paymentType: 'DEPOSIT', status: 'PENDING', amount: new Money('900') },
        { paymentType: 'REFUND', status: 'PENDING', amount: new Money('900') },
      ],
    );
    expect(result.netCharges.toFixed(2)).toBe('80.00');
    expect(result.netPaid.toFixed(2)).toBe('100.00');
    expect(result.outstandingBalance.toFixed(2)).toBe('-20.00');
  });
  it('preserves amounts above safe integer and large aggregates exactly', () => {
    const amount = new Money('9999999999999999');
    const result = calculateBalance(
      Array.from({ length: 1000 }, () => ({ entryType: 'DEBIT' as const, amount })),
      [],
    );
    expect(result.outstandingBalance.toFixed(2)).toBe('9999999999999999000.00');
    expect(checkedAmount(amount).toFixed(2)).toBe('9999999999999999.00');
    expect(() => checkedAmount(amount.mul(2))).toThrow();
  });
  it.each([
    ['900000.49', '900000.00'],
    ['900000.50', '900001.00'],
    ['0.00', '0.00'],
  ])('rounds legacy snapshot %s per night to %s without mutating it', (before, after) => {
    const snapshot = new Prisma.Decimal(before!);
    expect(roomCharge(snapshot).toFixed(2)).toBe(after);
    expect(snapshot.toFixed(2)).toBe(before);
  });
  it.each([
    '-1',
    '0.01',
    '1.10',
    '1.001',
    '1e3',
    '01',
    ' 1',
    'NaN',
    'Infinity',
    '10000000000000000',
    '',
    100,
  ])('rejects invalid VND amount %s', (amount) => {
    expect(moneyInput.safeParse(amount).success).toBe(false);
  });
  it.each(['0', '0.0', '0.00', '-1', '1.01'])(
    'rejects nonpositive or fractional transaction %s',
    (amount) => {
      expect(
        paymentBody.safeParse({
          paymentType: 'PAYMENT',
          paymentMethod: 'CASH',
          amount,
          confirmedReceived: true,
        }).success,
      ).toBe(false);
      expect(
        refundBody.safeParse({ amount, reason: 'Approved', confirmedRefunded: true }).success,
      ).toBe(false);
      expect(
        adjustmentBody.safeParse({ entryType: 'CREDIT', amount, reason: 'Approved' }).success,
      ).toBe(false);
    },
  );
  it('normalizes whole monetary strings before idempotency hashing', () => {
    expect(moneyInput.parse('10')).toBe('10.00');
    expect(moneyInput.parse('10.0')).toBe('10.00');
    expect(canonicalJson({ b: 1, a: [{ c: 3, b: 2 }] })).toBe(
      canonicalJson({ a: [{ b: 2, c: 3 }], b: 1 }),
    );
  });
  it.each([
    'hotelId',
    'processedBy',
    'status',
    'role',
    'staffId',
    'originalPaymentId',
    'cardNumber',
    'cvv',
  ])('rejects injected field %s', (field) => {
    expect(
      paymentBody.safeParse({
        paymentType: 'PAYMENT',
        paymentMethod: 'CASH',
        amount: '1',
        confirmedReceived: true,
        [field]: 'forged',
      }).success,
    ).toBe(false);
    expect(
      createServiceBody.safeParse({
        code: 'A',
        name: 'A',
        unit: 'item',
        price: '0',
        [field]: 'forged',
      }).success,
    ).toBe(false);
  });
  it.each([0, -1, 1.5, 10001, '1'])('rejects invalid quantity %s', (quantity) => {
    expect(
      createOrderBody.safeParse({ reservationId: '1', items: [{ serviceId: '1', quantity }] })
        .success,
    ).toBe(false);
  });
  it('requires actual receipt/refund attestations, bank reference, reasons, unique services and safe IDs', () => {
    expect(
      paymentBody.safeParse({ paymentType: 'PAYMENT', paymentMethod: 'CASH', amount: '1' }).success,
    ).toBe(false);
    expect(
      paymentBody.safeParse({
        paymentType: 'PAYMENT',
        paymentMethod: 'BANK_TRANSFER',
        amount: '1',
        confirmedReceived: true,
      }).success,
    ).toBe(false);
    expect(
      refundBody.safeParse({ amount: '1', reason: '   ', confirmedRefunded: true }).success,
    ).toBe(false);
    expect(
      createOrderBody.safeParse({
        reservationId: '18446744073709551616',
        items: [{ serviceId: '1', quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      createOrderBody.safeParse({
        reservationId: '1',
        items: [
          { serviceId: '1', quantity: 1 },
          { serviceId: '1', quantity: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      createOrderBody.safeParse({
        reservationId: '1',
        items: [{ serviceId: '1', quantity: 1, unitPrice: '1' }],
      }).success,
    ).toBe(false);
  });
  it.each(['', 'short', ' key0001', 'x'.repeat(129), 'unicode-đ', 'comma,key'])(
    'rejects invalid idempotency key %s',
    (key) => {
      expect(idempotencyKey.safeParse(key).success).toBe(false);
    },
  );
  it('validates list filters and stable sort allowlists', () => {
    for (const query of [{ page: '0' }, { limit: '101' }, { hotelId: '1' }, { page: ['1', '2'] }]) {
      expect(ledgerQuery.safeParse(query).success).toBe(false);
      expect(orderQuery.safeParse(query).success).toBe(false);
      expect(serviceQuery.safeParse(query).success).toBe(false);
    }
    expect(serviceQuery.safeParse({ sortBy: 'passwordHash' }).success).toBe(false);
    expect(orderQuery.safeParse({ status: 'PAID' }).success).toBe(false);
    expect(orderQuery.parse({ search: '  Mai  ' }).search).toBe('Mai');
    for (const search of ['', '   ', 'x'.repeat(101)])
      expect(orderQuery.safeParse({ search }).success).toBe(false);
    expect(orderQuery.safeParse({ search: ['101'] }).success).toBe(false);
    expect(orderQuery.safeParse({ search: 'Nguyễn Văn An' }).success).toBe(true);
  });
  it('documents all 19 Billing operations, auth, roles, errors and resolvable references', () => {
    const operations = Object.values(billingPaths).flatMap(Object.values);
    expect(operations).toHaveLength(19);
    for (const operation of operations) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation['x-required-roles'].length).toBeGreaterThan(0);
      expect(operation.responses).toHaveProperty('409');
    }
    const spec = JSON.stringify(openApiDocument);
    for (const match of spec.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g))
      expect(openApiDocument.components.schemas).toHaveProperty(match[1]!);
  });
});
