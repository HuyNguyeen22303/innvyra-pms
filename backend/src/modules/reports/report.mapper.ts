import { Money } from '../billing/billing.money.js';
import type {
  AggregateRow,
  BalanceRow,
  MetricRecord,
  OccupancyRow,
  ReportDay,
  SeriesRow,
} from './report.types.js';

export const financialFields = [
  'roomCharges',
  'serviceCharges',
  'adjustmentDebits',
  'adjustmentCredits',
  'totalDebits',
  'totalCredits',
  'successfulPayments',
  'successfulDeposits',
  'successfulRefunds',
  'cashPayments',
  'bankTransferPayments',
] as const;
export const paymentFields = [
  'successfulPayments',
  'successfulDeposits',
  'successfulRefunds',
  'cashPayments',
  'bankTransferPayments',
] as const;
export const paymentCounts = ['paymentCount', 'depositCount', 'refundCount'] as const;
export const reservationFields = [
  'reservationsCreated',
  'confirmedReservationsInCreatedCohort',
  'noShowReservationsInCreatedCohort',
  'cancelledReservations',
  'reservationRoomsCreated',
  'expectedArrivals',
  'expectedDepartures',
  'actualCheckins',
  'actualCheckouts',
] as const;
export const money = (value: unknown) => new Money(String(value ?? 0)).toFixed(2);
export const count = (value: unknown) => {
  const result = Number(String(value ?? 0));
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error('Report count exceeds safe integer range');
  return result;
};
export function zeroMetrics(
  moneyFields: readonly string[],
  countFields: readonly string[],
): MetricRecord {
  return Object.fromEntries([
    ...moneyFields.map((f) => [f, '0.00']),
    ...countFields.map((f) => [f, 0]),
  ]);
}
export function aggregateSeries(
  days: ReportDay[],
  rows: AggregateRow[],
  groupBy: 'day' | 'month',
  moneyFields: readonly string[],
  countFields: readonly string[],
) {
  const key = (date: string) => (groupBy === 'month' ? date.slice(0, 7) + '-01' : date);
  const buckets = new Map<string, SeriesRow>();
  for (const day of days) {
    const date = key(day.date);
    if (!buckets.has(date)) buckets.set(date, { date, ...zeroMetrics(moneyFields, countFields) });
  }
  for (const row of rows) {
    const bucket = buckets.get(key(row.date));
    if (!bucket) continue;
    if (moneyFields.includes(row.metric))
      bucket[row.metric] = new Money(String(bucket[row.metric])).add(String(row.value)).toFixed(2);
    if (countFields.includes(row.metric))
      bucket[row.metric] = count(bucket[row.metric]) + count(row.value);
  }
  const series = [...buckets.values()];
  const summary = zeroMetrics(moneyFields, countFields);
  for (const row of series) {
    for (const field of moneyFields)
      summary[field] = new Money(String(summary[field])).add(String(row[field])).toFixed(2);
    for (const field of countFields) summary[field] = count(summary[field]) + count(row[field]);
  }
  return { summary, series };
}
export function financialDerived(row: MetricRecord, charges: boolean) {
  row.netCashCollected = new Money(String(row.successfulPayments))
    .add(String(row.successfulDeposits))
    .sub(String(row.successfulRefunds))
    .toFixed(2);
  if (charges) {
    row.totalDebits = new Money(String(row.roomCharges))
      .add(String(row.serviceCharges))
      .add(String(row.adjustmentDebits))
      .toFixed(2);
    row.totalCredits = money(row.adjustmentCredits);
    row.netBilledCharges = new Money(String(row.totalDebits))
      .sub(String(row.totalCredits))
      .toFixed(2);
    row.balanceMovement = new Money(row.netBilledCharges).sub(row.netCashCollected).toFixed(2);
  }
}
export const balanceDto = (row: BalanceRow) => ({
  outstandingBalance: money(row.outstandingBalance),
  accountsReceivable: money(row.accountsReceivable),
  customerCredits: money(row.customerCredits),
  folioCount: count(row.folioCount),
});
export function operationalKpis(value: string | null, occupied: number | null, sellable: number) {
  return {
    occupancyRate:
      occupied !== null && sellable > 0
        ? new Money(occupied).div(sellable).mul(100).toDecimalPlaces(2).toNumber()
        : null,
    operationalAdr:
      value !== null && occupied !== null && occupied > 0
        ? new Money(value).div(occupied).toFixed(2)
        : null,
    operationalRevpar:
      value !== null && sellable > 0 ? new Money(value).div(sellable).toFixed(2) : null,
  };
}
export function occupancyDto(
  days: ReportDay[],
  rows: OccupancyRow[],
  groupBy: 'day' | 'month',
  now: Date,
) {
  const map = new Map(rows.map((r) => [r.date, r]));
  const daily = days.map((day) => {
    const row = map.get(day.date);
    const closed = day.until <= now;
    const total = count(row?.totalRoomNights),
      blocked = count(row?.maintenanceBlockedRoomNights);
    const conflicts = count(row?.conflictingRoomNights),
      missing = count(row?.missingPriceNights);
    return {
      date: day.date,
      totalRoomNights: total,
      sellableRoomNights: total - blocked,
      maintenanceBlockedRoomNights: blocked,
      occupiedRoomNights: closed && !conflicts ? count(row?.occupiedRoomNights) : null,
      roomSalesValue: closed && !missing && !conflicts ? money(row?.roomSalesValue) : null,
      missingPriceNights: missing,
      conflictingRoomNights: conflicts,
      unclosedDays: closed ? 0 : 1,
    };
  });
  type Totals = Omit<(typeof daily)[number], 'date'>;
  const empty = (): Totals => ({
    totalRoomNights: 0,
    sellableRoomNights: 0,
    maintenanceBlockedRoomNights: 0,
    occupiedRoomNights: 0,
    roomSalesValue: '0.00',
    missingPriceNights: 0,
    conflictingRoomNights: 0,
    unclosedDays: 0,
  });
  const add = (target: Totals, row: Totals) => {
    for (const field of [
      'totalRoomNights',
      'sellableRoomNights',
      'maintenanceBlockedRoomNights',
      'missingPriceNights',
      'conflictingRoomNights',
      'unclosedDays',
    ] as const)
      target[field] += row[field];
    target.occupiedRoomNights =
      target.occupiedRoomNights === null || row.occupiedRoomNights === null
        ? null
        : target.occupiedRoomNights + row.occupiedRoomNights;
    target.roomSalesValue =
      target.roomSalesValue === null || row.roomSalesValue === null
        ? null
        : new Money(target.roomSalesValue).add(row.roomSalesValue).toFixed(2);
  };
  const summary = empty(),
    buckets = new Map<string, Totals>();
  for (const row of daily) {
    const key = groupBy === 'day' ? row.date : row.date.slice(0, 7) + '-01';
    const bucket = buckets.get(key) ?? empty();
    add(bucket, row);
    add(summary, row);
    buckets.set(key, bucket);
  }
  const dto = (row: Totals) => ({
    ...row,
    outOfServiceRoomNights: null,
    ...operationalKpis(row.roomSalesValue, row.occupiedRoomNights, row.sellableRoomNights),
  });
  return {
    summary: dto(summary),
    series: [...buckets].map(([date, row]) => ({ date, ...dto(row) })),
  };
}
