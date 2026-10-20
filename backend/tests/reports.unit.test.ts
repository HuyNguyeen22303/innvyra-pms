import { describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { reportDays } from '../src/modules/reports/report.dates.js';
import {
  dashboardQuery,
  exportQuery,
  occupancyQuery,
  outstandingQuery,
  paymentQuery,
  periodQuery,
} from '../src/modules/reports/report.schema.js';
import {
  aggregateSeries,
  financialDerived,
  financialFields,
  occupancyDto,
  operationalKpis,
  paymentCounts,
} from '../src/modules/reports/report.mapper.js';
import { csvCell, ExportService } from '../src/modules/reports/export.service.js';
import { reportAccess, ReportService } from '../src/modules/reports/report.service.js';
import { openApiDocument } from '../src/config/swagger.js';
import { reportPaths } from '../src/config/reports.openapi.js';
import { testEnv } from './helpers.js';
import type { OccupancyRow, ReportRepository } from '../src/modules/reports/report.types.js';

const period = { startDate: '2026-10-01', endDate: '2026-10-06', groupBy: 'day' as const };
const days = reportDays(period.startDate, period.endDate, 'Asia/Ho_Chi_Minh', 366);
describe('Reports validation, money and calendar policies', () => {
  it.each([
    '2026-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-1-01',
    '2026-10-01T00:00:00Z',
    'invalid',
    '0001-01-01',
  ])('rejects nonexistent/malformed date %s', (date) => {
    expect(periodQuery.safeParse({ ...period, startDate: date }).success).toBe(false);
    expect(dashboardQuery.safeParse({ date }).success).toBe(false);
  });
  it.each([
    { startDate: '2026-10-02', endDate: '2026-10-01' },
    { startDate: '2026-10-01', endDate: '2026-10-01' },
  ])('rejects nonpositive interval %j', (q) => {
    expect(() => reportDays(q.startDate, q.endDate, 'UTC', 366)).toThrow('startDate must precede');
  });
  it('bounds calendar days with configurable maximum and rejects invalid timezone', () => {
    expect(() => reportDays('2026-01-01', '2028-01-01', 'UTC', 366)).toThrow('exceeds');
    expect(() => reportDays(period.startDate, period.endDate, 'UTC', 4)).toThrow('exceeds');
    expect(() => reportDays(period.startDate, period.endDate, 'not/a_zone', 366)).toThrow(
      'timezone',
    );
    expect(periodQuery.safeParse({ ...period, startDate: '2024-02-29' }).success).toBe(true);
  });
  it.each([
    { hotelId: '2' },
    { role: 'ADMIN' },
    { groupBy: 'week' },
    { sortBy: 'createdAt; DROP TABLE rooms' },
    { page: '1' },
    { startDate: ['2026-10-01'] },
  ])('rejects unbounded or privileged query %j', (q) => {
    expect(periodQuery.safeParse({ ...period, ...q }).success).toBe(false);
  });
  it('validates scope IDs, payment methods, pagination and export filter compatibility', () => {
    for (const roomTypeId of ['0', '01', '-1', '18446744073709551616', '1 OR 1=1'])
      expect(occupancyQuery.safeParse({ ...period, roomTypeId }).success).toBe(false);
    expect(paymentQuery.safeParse({ ...period, paymentMethod: 'CRYPTO' }).success).toBe(false);
    const { groupBy: _groupBy, ...range } = period;
    void _groupBy;
    for (const q of [
      { page: '0' },
      { limit: '101' },
      { sortBy: 'passwordHash' },
      { sortOrder: 'random' },
    ])
      expect(outstandingQuery.safeParse({ ...range, ...q }).success).toBe(false);
    expect(exportQuery.safeParse({ ...period, type: 'pdf' }).success).toBe(false);
    expect(
      exportQuery.safeParse({ ...period, type: 'revenue', paymentMethod: 'CASH' }).success,
    ).toBe(false);
    expect(exportQuery.safeParse({ ...period, type: 'payments', roomTypeId: '1' }).success).toBe(
      false,
    );
  });
  it('uses hotel boundaries, including 23/25 hour DST days and half-hour zones', () => {
    expect(days[0]!.from.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(days.at(-1)!.until.toISOString()).toBe('2026-10-05T17:00:00.000Z');
    for (const [date, end, hours] of [
      ['2026-03-08', '2026-03-09', 23],
      ['2026-11-01', '2026-11-02', 25],
    ] as const) {
      const day = reportDays(date, end, 'America/New_York', 366)[0]!;
      expect((day.until.getTime() - day.from.getTime()) / 3600000).toBe(hours);
    }
    expect(reportDays('2026-10-01', '2026-10-02', 'Asia/Kolkata', 366)[0]!.from.toISOString()).toBe(
      '2026-09-30T18:30:00.000Z',
    );
  });
  it('aggregates exact large Decimal money, separate deposits, refunds, credits and zero buckets', () => {
    const rows = [
      ['roomCharges', '9999999999999999.00'],
      ['serviceCharges', '0.02'],
      ['adjustmentCredits', '0.01'],
      ['successfulPayments', '10.01'],
      ['successfulDeposits', '2.02'],
      ['successfulRefunds', '1.01'],
    ].map(([metric, value]) => ({
      date: days[0]!.date,
      metric: metric!,
      value: new Prisma.Decimal(value!),
      category: '',
    }));
    const data = aggregateSeries(days, rows, 'day', financialFields, paymentCounts);
    for (const row of [data.summary, ...data.series]) financialDerived(row, true);
    expect(data.summary.netBilledCharges).toBe('9999999999999999.01');
    expect(data.summary.netCashCollected).toBe('11.02');
    expect(data.series[1]!.netBilledCharges).toBe('0.00');
    const monthly = aggregateSeries(days, rows, 'month', financialFields, paymentCounts);
    expect(monthly.series).toHaveLength(1);
    expect(monthly.series[0]!.date).toBe('2026-10-01');
  });
  it('45 sellable and 36 occupied = 80%; ADR 900000 and RevPAR 720000', () => {
    const rows: OccupancyRow[] = days.map((d, index) => ({
      date: d.date,
      totalRoomNights: 10n,
      maintenanceBlockedRoomNights: 1n,
      occupiedRoomNights: index ? 7 : 8,
      roomSalesValue: new Prisma.Decimal(index ? '6300000' : '7200000'),
      missingPriceNights: 0n,
      conflictingRoomNights: 0n,
    }));
    const result = occupancyDto(days, rows, 'day', new Date('2026-10-15T00:00:00Z'));
    expect(result.summary).toMatchObject({
      totalRoomNights: 50,
      sellableRoomNights: 45,
      occupiedRoomNights: 36,
      occupancyRate: 80,
      roomSalesValue: '32400000.00',
      operationalAdr: '900000.00',
      operationalRevpar: '720000.00',
      outOfServiceRoomNights: null,
    });
    expect(operationalKpis('36000000', 40, 50)).toEqual({
      occupancyRate: 80,
      operationalAdr: '900000.00',
      operationalRevpar: '720000.00',
    });
    expect(occupancyDto(days, rows, 'month', new Date('2026-10-15')).summary).toEqual(
      result.summary,
    );
  });
  it('returns null for zero denominators, missing price, conflicting occupancy and unclosed nights', () => {
    expect(operationalKpis('0', 0, 0)).toEqual({
      occupancyRate: null,
      operationalAdr: null,
      operationalRevpar: null,
    });
    expect(operationalKpis('0', 0, 10)).toEqual({
      occupancyRate: 0,
      operationalAdr: null,
      operationalRevpar: '0.00',
    });
    expect(occupancyDto(days, [], 'day', days[0]!.from).summary.occupiedRoomNights).toBeNull();
    const row: OccupancyRow = {
      date: days[0]!.date,
      totalRoomNights: 1,
      maintenanceBlockedRoomNights: 0,
      occupiedRoomNights: 1,
      roomSalesValue: new Prisma.Decimal(0),
      missingPriceNights: 1,
      conflictingRoomNights: 0,
    };
    expect(
      occupancyDto(days, [row], 'day', new Date('2026-11-01')).summary.operationalAdr,
    ).toBeNull();
    expect(
      occupancyDto(
        days,
        [{ ...row, missingPriceNights: 0, conflictingRoomNights: 1 }],
        'day',
        new Date('2026-11-01'),
      ).summary.occupiedRoomNights,
    ).toBeNull();
  });
  it.each(['=HYPERLINK("evil")', '+cmd', '-1+cmd', '@SUM(A1)', '\t=1', '\r\n @cmd'])(
    'neutralizes CSV formula %j',
    (input) => {
      expect(csvCell(input).startsWith('"\'')).toBe(true);
    },
  );
  it('preserves UTF-8, escaping, negative balances and exact decimal strings', () => {
    expect(csvCell('Phòng "Đẹp",\nTầng 2')).toBe('"Phòng ""Đẹp"",\nTầng 2"');
    expect(csvCell('9999999999999999.01')).toBe('"9999999999999999.01"');
    expect(csvCell('-1000.00')).toBe('"-1000.00"');
    expect(csvCell(null)).toBe('""');
  });
  it('enforces report and export access in the service as well as the HTTP router', () => {
    expect(() => reportAccess({ hotelId: 1n, role: 'HOUSEKEEPING' }, 'revenue')).toThrow();
    expect(() => reportAccess({ hotelId: 1n, role: 'ACCOUNTANT' }, 'payments', true)).not.toThrow();
    expect(() => reportAccess({ hotelId: 1n, role: 'ACCOUNTANT' }, 'occupancy', true)).toThrow();
    expect(() =>
      reportAccess({ hotelId: 1n, role: 'RECEPTIONIST' }, 'reservations', true),
    ).toThrow();
  });
  it('enforces CSV row bounds before returning a file', async () => {
    const repo: ReportRepository = {
      snapshot: async <T>(fn: (r: ReportRepository) => Promise<T>) => fn(repo),
      hotel: async () => ({ timezone: 'UTC' }),
      reservations: async () => [],
      roomTypeExists: async () => false,
      financialActivity: async () => [],
      balance: async () => ({
        outstandingBalance: new Prisma.Decimal(0),
        accountsReceivable: new Prisma.Decimal(0),
        customerCredits: new Prisma.Decimal(0),
        folioCount: 0,
      }),
      outstanding: async () => [],
      occupancy: async () => [],
      roomSnapshot: async () => ({}),
      operations: async () => [],
      maintenanceRoomNights: async () => 0,
      procurementSeries: async () => [],
      procurementByCategory: async () => [],
      procurementBySupplier: async () => [],
      procurementTopItems: async () => [],
    };
    const exporter = new ExportService(new ReportService(repo, testEnv), {
      ...testEnv,
      REPORT_EXPORT_MAX_ROWS: 1,
    });
    await expect(
      exporter.export({ hotelId: 1n, role: 'ADMIN' }, { ...period, type: 'reservations' }),
    ).rejects.toMatchObject({ code: 'REPORT_RANGE_TOO_LARGE' });
  });
  it('documents every endpoint, role, query, example, error and response schema without breaking earlier references', () => {
    for (const path of [
      'dashboard',
      'revenue',
      'occupancy',
      'reservations',
      'payments',
      'procurement',
      'operations',
      'outstanding',
      'export',
    ]) {
      const spec = reportPaths[`/reports/${path}` as keyof typeof reportPaths].get;
      expect(openApiDocument.paths).toHaveProperty(`/reports/${path}`);
      expect(spec.security).toEqual([{ bearerAuth: [] }]);
      expect(spec.tags).toEqual(['Reports']);
      expect(spec.responses).toHaveProperty('401');
      expect(spec.responses).toHaveProperty('403');
      expect(spec.responses).toHaveProperty('200.content');
      expect(spec.parameters).toBeTruthy();
    }
    for (const match of JSON.stringify(openApiDocument).matchAll(
      /"\$ref":"#\/components\/schemas\/([^"]+)"/g,
    ))
      expect(openApiDocument.components.schemas).toHaveProperty(match[1]!);
  });
});
