import type { Env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { RoleCode } from '../../shared/types/roles.js';
import { hotelToday } from '../reservations/reservation.dates.js';
import { nextDate, reportDays } from './report.dates.js';
import {
  aggregateSeries,
  balanceDto,
  count,
  financialDerived,
  financialFields,
  money,
  occupancyDto,
  paymentCounts,
  paymentFields,
  reservationFields,
} from './report.mapper.js';
import type {
  OccupancyQuery,
  OutstandingQuery,
  PaymentQuery,
  PeriodQuery,
  ProcurementQuery,
  ReportType,
} from './report.schema.js';
import type {
  DataQuality,
  ProcurementCategoryItem,
  ProcurementReportDto,
  ProcurementSeriesItem,
  ProcurementSummary,
  ProcurementSupplierItem,
  ReportRepository,
  ReportScope,
} from './report.types.js';
import { Money } from '../billing/billing.money.js';

const managers: RoleCode[] = ['ADMIN', 'MANAGER'];
const frontDesk: RoleCode[] = [...managers, 'RECEPTIONIST'];
const financial: RoleCode[] = [...managers, 'ACCOUNTANT'];
export const reportRoles = {
  dashboard: frontDesk,
  revenue: financial,
  payments: financial,
  outstanding: financial,
  procurement: financial,
  occupancy: frontDesk,
  reservations: frontDesk,
  operations: [...frontDesk, 'HOUSEKEEPING', 'TECHNICIAN'] as RoleCode[],
};
export function reportAccess(
  scope: ReportScope,
  type: keyof typeof reportRoles,
  exporting = false,
) {
  if (!reportRoles[type].includes(scope.role) || (exporting && !financial.includes(scope.role)))
    throw new AppError(403, 'REPORT_ACCESS_DENIED', 'This report is not available for your role');
}
const capacityLimitations = [
  'Historical capacity is an estimate: existing room records created before each night cutoff, less recorded maintenance blocks. Room activation, deactivation and room-type changes have no complete history; current ACTIVE flags are never projected backwards.',
  'Maintenance is unavailable at the night cutoff until explicit release, including overdue blocks, matching Operations safety policy. Planned endDate is not a safety release. Cancelled future blocks contribute zero.',
];
const occupancyLimitations = [
  ...capacityLimitations,
  'Operational ADR/RevPAR use reservation nightly price snapshots for actual overnight stays; these are not accounting recognized revenue. Services, deposits and refunds are excluded. Unallocated folio adjustments and tax components cannot be assigned to nights.',
  'A room-night is measured immediately before the next hotel-local midnight. Day-use and check-ins exactly at the cutoff belong to no prior night. Checkout exactly at the cutoff includes the prior night. Transfers select one room at that instant.',
  'Missing price snapshots, unsupported snapshot currencies, overlapping stays in the same physical room, and unclosed nights produce null KPIs. Rate estimates can exceed 100% if historical inventory is incomplete; values are not clamped.',
];

export class ReportService {
  constructor(
    private readonly repository: ReportRepository,
    private readonly env: Env,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async context(repo: ReportRepository, scope: ReportScope, query: PeriodQuery) {
    const hotel = await repo.hotel(scope.hotelId);
    if (!hotel) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
    const now = this.clock();
    const days = reportDays(
      query.startDate,
      query.endDate,
      hotel.timezone,
      this.env.REPORT_MAX_DAYS,
    );
    const cutoff = new Date(Math.min(days.at(-1)!.until.getTime(), now.getTime()));
    return {
      now,
      days,
      cutoff,
      timezone: hotel.timezone,
      meta: {
        period: { startDate: query.startDate, endDate: query.endDate, endExclusive: true },
        groupBy: query.groupBy,
        timezone: hotel.timezone,
        currency: 'VND',
        generatedAt: now.toISOString(),
      },
    };
  }
  private async finance(
    repo: ReportRepository,
    scope: ReportScope,
    query: PaymentQuery,
    charges: boolean,
  ) {
    const ctx = await this.context(repo, scope, query);
    const rows = await repo.financialActivity(
      scope.hotelId,
      ctx.days.map((d) => ({
        ...d,
        until: new Date(Math.min(d.until.getTime(), ctx.now.getTime())),
      })),
      charges,
      query.paymentMethod,
    );
    const result = aggregateSeries(
      ctx.days,
      rows,
      query.groupBy,
      charges ? financialFields : paymentFields,
      paymentCounts,
    );
    for (const row of [result.summary, ...result.series]) financialDerived(row, charges);
    const balances = balanceDto(await repo.balance(scope.hotelId, ctx.cutoff));
    return {
      ...ctx.meta,
      ...result,
      balance: {
        ...balances,
        cutoffExclusive: ctx.cutoff.toISOString(),
        scope: 'ALL_PAYMENT_METHODS',
      },
      filters: { paymentMethod: query.paymentMethod ?? null },
      basis: {
        charges: 'FOLIO_POSTED_AT',
        cash: 'CONFIRMED_PAYMENT_PROCESSED_AT',
        balance: 'ALL_LEDGER_ACTIVITY_BEFORE_CUTOFF',
        recognition: 'NOT_ACCOUNTING_RECOGNIZED_REVENUE',
        cashPayments: 'CONFIRMED_PAYMENTS_AND_DEPOSITS_BEFORE_REFUNDS',
      },
      dataQuality: {
        status: 'complete',
        limitations: [
          'Billed activity is grouped by posting time, not by the nights the charges relate to.',
          'Payment.processedAt is confirmation time in the current billing workflow; externally imported or later-transitioned payments must preserve this contract.',
          'Balance includes all earlier ledger entries and all payment methods; period balanceMovement is a different metric. Future cutoffs are capped at generatedAt.',
        ],
      } satisfies DataQuality,
    };
  }
  revenue(scope: ReportScope, query: PeriodQuery) {
    reportAccess(scope, 'revenue');
    return this.repository.snapshot((repo) => this.finance(repo, scope, query, true));
  }
  payments(scope: ReportScope, query: PaymentQuery) {
    reportAccess(scope, 'payments');
    return this.repository.snapshot((repo) => this.finance(repo, scope, query, false));
  }
  occupancy(scope: ReportScope, query: OccupancyQuery) {
    reportAccess(scope, 'occupancy');
    return this.repository.snapshot(async (repo) => {
      const ctx = await this.context(repo, scope, query);
      const typeId = query.roomTypeId ? BigInt(query.roomTypeId) : undefined;
      if (typeId && !(await repo.roomTypeExists(scope.hotelId, typeId)))
        throw new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
      const rows = await repo.occupancy(scope.hotelId, ctx.days, typeId);
      const result = occupancyDto(ctx.days, rows, query.groupBy, ctx.now);
      // Operational room prices are financial information too.
      const redact = <
        T extends {
          roomSalesValue: string | null;
          operationalAdr: string | null;
          operationalRevpar: string | null;
        },
      >(
        row: T,
      ) => {
        if (scope.role !== 'RECEPTIONIST') return row;
        const {
          roomSalesValue: _sales,
          operationalAdr: _adr,
          operationalRevpar: _revpar,
          ...rest
        } = row;
        void _sales;
        void _adr;
        void _revpar;
        return rest;
      };
      return {
        ...ctx.meta,
        filters: { roomTypeId: query.roomTypeId ?? null },
        summary: redact(result.summary),
        series: result.series.map(redact),
        basis: 'OPERATIONAL_NIGHT_END_SNAPSHOT_WITH_ESTIMATED_CAPACITY',
        dataQuality: {
          status:
            result.summary.unclosedDays ||
            result.summary.missingPriceNights ||
            result.summary.conflictingRoomNights
              ? 'incomplete'
              : 'estimated',
          limitations: occupancyLimitations,
        } satisfies DataQuality,
      };
    });
  }
  reservations(scope: ReportScope, query: PeriodQuery) {
    reportAccess(scope, 'reservations');
    return this.repository.snapshot(async (repo) => {
      const ctx = await this.context(repo, scope, query);
      const rows = await repo.reservations(scope.hotelId, ctx.days);
      const sources = new Map<string, number>();
      for (const row of rows.filter((r) => r.metric === 'bookingSource'))
        sources.set(row.category, (sources.get(row.category) ?? 0) + count(row.value));
      return {
        ...ctx.meta,
        ...aggregateSeries(ctx.days, rows, query.groupBy, [], reservationFields),
        bookingSources: [...sources].map(([source, reservations]) => ({ source, reservations })),
        dataQuality: {
          status: 'complete',
          limitations: [
            'Creation uses createdAt, cancellation uses cancelledAt, actual arrivals/departures use Stay timestamps. Reservation rooms and reservation orders are counted separately.',
            'Booking sources use the existing six-source allowlist; unsupported legacy/imported source labels are grouped into OTHER.',
            'Confirmed and no-show counts describe current status of the created-in-period cohort; confirmation/no-show transition times are not recorded.',
            'Expected arrivals are reservation rooms with no Stay. Expected departures are rooms without actual checkout. Both use the booked business date and current non-cancelled/non-no-show status, not a reconstructed historical forecast.',
          ],
        } satisfies DataQuality,
      };
    });
  }
  dashboard(scope: ReportScope, query: { date?: string | undefined }) {
    reportAccess(scope, 'dashboard');
    return this.repository.snapshot(async (repo) => {
      const hotel = await repo.hotel(scope.hotelId);
      if (!hotel) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
      const now = this.clock(),
        today = hotelToday(hotel.timezone, now),
        date = query.date ?? today;
      const days = reportDays(date, nextDate(date), hotel.timezone, this.env.REPORT_MAX_DAYS);
      const current = date === today;
      const rooms = current
        ? Object.fromEntries(
            Object.entries(await repo.roomSnapshot(scope.hotelId, today)).map(([key, value]) => [
              key,
              count(value),
            ]),
          )
        : null;
      const reservations = aggregateSeries(
        days,
        await repo.reservations(scope.hotelId, days),
        'day',
        [],
        reservationFields,
      ).summary;
      const finance =
        scope.role === 'RECEPTIONIST'
          ? undefined
          : await this.finance(
              repo,
              scope,
              { startDate: date, endDate: nextDate(date), groupBy: 'day' },
              false,
            );
      return {
        reportDate: date,
        timezone: hotel.timezone,
        currency: 'VND',
        generatedAt: now.toISOString(),
        rooms,
        roomSnapshotAt: current ? now.toISOString() : null,
        reservations: {
          expectedArrivals: reservations.expectedArrivals,
          expectedDepartures: reservations.expectedDepartures,
        },
        currentGuestsCount: null,
        ...(finance ? { finance: { ...finance.summary, ...finance.balance } } : {}),
        dataQuality: {
          status: current ? 'complete' : 'incomplete',
          limitations: [
            'Room state is a current snapshot only. Historical/future dashboard room state is null; use occupancy for completed overnight counts.',
            'Actual guest registration/count history is unavailable; booked adults/children are not presented as actual in-house guests.',
            'Expected arrivals/departures are remaining scheduled rooms as of generation, not historical forecasts. Financial totals use the selected hotel day; balance is cumulative to its effective cutoff.',
          ],
        } satisfies DataQuality,
      };
    });
  }
  operations(scope: ReportScope, query: PeriodQuery) {
    reportAccess(scope, 'operations');
    return this.repository.snapshot(async (repo) => {
      const ctx = await this.context(repo, scope, query),
        today = hotelToday(ctx.timezone, ctx.now);
      const rows = await repo.operations(scope.hotelId, ctx.days[0]!.from, ctx.cutoff, today);
      const metrics = Object.fromEntries(rows.map((row) => [row.metric, count(row.value)]));
      const rooms = await repo.roomSnapshot(scope.hotelId, today);
      const blockedNights =
        scope.role === 'HOUSEKEEPING'
          ? 0
          : count(await repo.maintenanceRoomNights(scope.hotelId, ctx.days));
      return {
        ...ctx.meta,
        snapshotAt: ctx.now.toISOString(),
        ...(scope.role !== 'TECHNICIAN'
          ? {
              housekeeping: {
                snapshot: {
                  dirtyRooms: count(rooms.dirty),
                  readyRooms: count(rooms.ready),
                  cleaningRooms: count(rooms.cleaning),
                  roomsAwaitingInspection: count(rooms.awaitingInspection),
                  activeHousekeepingTasks: metrics.activeHousekeepingTasks,
                  cleaningTasks: metrics.cleaningTasks,
                },
                period: {
                  completedHousekeepingTasks: metrics.completedHousekeepingTasks,
                  inspectedHousekeepingTasks: metrics.inspectedHousekeepingTasks,
                },
              },
            }
          : {}),
        ...(scope.role !== 'HOUSEKEEPING'
          ? {
              maintenance: {
                snapshot: {
                  roomsUnderMaintenance: count(rooms.underMaintenance),
                  roomsOutOfService: count(rooms.outOfService),
                  openMaintenanceTickets: metrics.openMaintenanceTickets,
                  inProgressMaintenanceTickets: metrics.inProgressMaintenanceTickets,
                  activeMaintenanceBlocks: metrics.activeMaintenanceBlocks,
                },
                period: {
                  maintenanceBlockedRoomNights: blockedNights,
                },
              },
            }
          : {}),
        dataQuality: {
          status: 'estimated',
          limitations: [
            ...capacityLimitations,
            'Housekeeping period totals count distinct tasks with TASK_COMPLETE / INSPECTION_PASSED audit events in the interval, retaining rework history. They do not use mutable current completion fields.',
            'Snapshot values are current at snapshotAt, independent of the requested period. No guest data is selected.',
          ],
        } satisfies DataQuality,
      };
    });
  }
  outstanding(scope: ReportScope, query: OutstandingQuery) {
    reportAccess(scope, 'outstanding');
    return this.repository.snapshot(async (repo) => {
      const ctx = await this.context(repo, scope, { ...query, groupBy: 'day' });
      const summary = balanceDto(await repo.balance(scope.hotelId, ctx.cutoff));
      const rows = await repo.outstanding(scope.hotelId, ctx.cutoff, query);
      return {
        ...ctx.meta,
        cutoffExclusive: ctx.cutoff.toISOString(),
        summary,
        items: rows.map((r) => ({
          folioId: r.folioId.toString(),
          outstandingBalance: money(r.outstandingBalance),
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: summary.folioCount,
          totalPages: Math.ceil(summary.folioCount / query.limit),
        },
        dataQuality: {
          status: 'complete',
          limitations: [
            'Cumulative ledger balance before cutoff; startDate only identifies the requested period. All payment methods and closed/unsettled folios are included. Negative balances are customer credits.',
          ],
        } satisfies DataQuality,
      };
    });
  }
  procurement(scope: ReportScope, query: ProcurementQuery) {
    reportAccess(scope, 'procurement');
    return this.repository.snapshot(async (repo) => {
      const ctx = await this.context(repo, scope, query);
      const from = ctx.days[0]!.from;
      const until = ctx.days.at(-1)!.until;
      const [seriesRows, byCategory, bySupplier, topItems] = await Promise.all([
        repo.procurementSeries(scope.hotelId, ctx.days, query.supplierId, query.categoryId),
        repo.procurementByCategory(scope.hotelId, from, until, query.supplierId),
        repo.procurementBySupplier(scope.hotelId, from, until, query.categoryId),
        repo.procurementTopItems(scope.hotelId, from, until, query.supplierId),
      ]);

      // Aggregate series by groupBy
      const key = (date: string) =>
        query.groupBy === 'month' ? date.slice(0, 7) + '-01' : date;
      const seriesBuckets = new Map<string, ProcurementSeriesItem>();
      for (const day of ctx.days) {
        const dk = key(day.date);
        if (!seriesBuckets.has(dk))
          seriesBuckets.set(dk, { date: dk, totalExpense: '0.00', receiptCount: 0 });
      }
      for (const row of seriesRows) {
        const bucket = seriesBuckets.get(key(row.date));
        if (!bucket) continue;
        bucket.totalExpense = new Money(bucket.totalExpense)
          .add(String(row.totalExpense))
          .toFixed(2);
        bucket.receiptCount += count(row.receiptCount);
      }
      const series = [...seriesBuckets.values()];

      // Summary calculations
      let totalExpense = new Money(0);
      let totalReceipts = 0;
      let totalItems = 0;
      for (const row of series) {
        totalExpense = totalExpense.add(row.totalExpense);
        totalReceipts += row.receiptCount;
      }
      for (const item of byCategory) {
        totalItems += count(item.totalQuantity);
      }

      // Top supplier
      const bySupplierMapped: ProcurementSupplierItem[] = bySupplier.map((s) => ({
        supplierId: String(s.supplierId),
        supplierName: s.supplierName,
        receiptCount: count(s.receiptCount),
        totalAmount: money(String(s.totalAmount)),
        percentage: 0,
      }));
      const topSupplier =
        bySupplierMapped.length > 0
          ? {
              id: bySupplierMapped[0]!.supplierId,
              name: bySupplierMapped[0]!.supplierName,
              totalAmount: bySupplierMapped[0]!.totalAmount,
            }
          : null;

      // Compute percentages
      const totalStr = totalExpense.toFixed(2);
      const pct = (value: string) =>
        totalExpense.isZero()
          ? 0
          : new Money(value).div(totalExpense).mul(100).toDecimalPlaces(2).toNumber();

      const byCategoryMapped: ProcurementCategoryItem[] = byCategory.map((c) => ({
        categoryId: String(c.categoryId),
        categoryName: c.categoryName,
        totalAmount: money(String(c.totalAmount)),
        percentage: pct(money(String(c.totalAmount))),
      }));
      for (const s of bySupplierMapped) {
        s.percentage = pct(s.totalAmount);
      }

      const avg =
        totalReceipts > 0
          ? new Money(totalExpense).div(totalReceipts).toFixed(2)
          : '0.00';

      const summary: ProcurementSummary = {
        totalExpense: totalStr,
        receiptCount: totalReceipts,
        averageReceiptValue: avg,
        totalItemsPurchased: totalItems,
        topSupplier,
      };

      return {
        hotelId: String(scope.hotelId),
        timezone: ctx.timezone,
        currency: ctx.meta.currency,
        startDate: query.startDate,
        endDate: query.endDate,
        groupBy: query.groupBy,
        generatedAt: ctx.now.toISOString(),
        summary,
        series,
        byCategory: byCategoryMapped,
        bySupplier: bySupplierMapped,
        topItems: topItems.map((item) => ({
          itemId: String(item.itemId),
          sku: item.sku,
          name: item.name,
          categoryName: item.categoryName,
          unit: item.unit,
          totalQuantity: count(item.totalQuantity),
          totalAmount: money(String(item.totalAmount)),
        })),
      } satisfies ProcurementReportDto;
    });
  }
  report(type: ReportType, scope: ReportScope, query: OccupancyQuery & PaymentQuery) {
    switch (type) {
      case 'revenue':
        return this.revenue(scope, query);
      case 'payments':
        return this.payments(scope, query);
      case 'occupancy':
        return this.occupancy(scope, query);
      case 'reservations':
        return this.reservations(scope, query);
    }
  }
}
