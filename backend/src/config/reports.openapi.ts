import {
  financialFields,
  paymentCounts,
  paymentFields,
  reservationFields,
} from '../modules/reports/report.mapper.js';
import { reportRoles } from '../modules/reports/report.service.js';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const obj = (properties: object, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const integer = { type: 'integer', minimum: 0 };
const date = { type: 'string', format: 'date' };
const timestamp = { type: 'string', format: 'date-time' };
const text = { type: 'string' };
const amount = {
  type: 'string',
  pattern: '^-?[0-9]+\\.[0-9]{2}$',
  example: '900000.00',
  description: 'Exact Decimal, rounded half-up to 2 decimals. Never a JSON number.',
};
const counts = (fields: readonly string[]) => Object.fromEntries(fields.map((f) => [f, integer]));
const amounts = (fields: readonly string[]) => Object.fromEntries(fields.map((f) => [f, amount]));
const common = {
  period: obj({ startDate: date, endDate: date, endExclusive: { type: 'boolean', enum: [true] } }),
  timezone: { ...text, example: 'Asia/Ho_Chi_Minh' },
  currency: { ...text, enum: ['VND'] },
  groupBy: { ...text, enum: ['day', 'month'] },
  generatedAt: timestamp,
  dataQuality: obj({
    status: { ...text, enum: ['complete', 'estimated', 'incomplete'] },
    limitations: { type: 'array', items: text },
  }),
};
const balance = {
  ...amounts(['outstandingBalance', 'accountsReceivable', 'customerCredits']),
  folioCount: integer,
};
const balanceAt = obj({
  ...balance,
  cutoffExclusive: timestamp,
  scope: { ...text, enum: ['ALL_PAYMENT_METHODS'] },
});
const financeBasis = obj({
  charges: text,
  cash: text,
  balance: text,
  recognition: text,
  cashPayments: text,
});
const financialMetrics = {
  ...amounts([...financialFields, 'netBilledCharges', 'netCashCollected', 'balanceMovement']),
  ...counts(paymentCounts),
};
const paymentMetrics = {
  ...amounts([...paymentFields, 'netCashCollected']),
  ...counts(paymentCounts),
};
const occupancyMetrics = {
  ...counts([
    'totalRoomNights',
    'sellableRoomNights',
    'maintenanceBlockedRoomNights',
    'missingPriceNights',
    'conflictingRoomNights',
    'unclosedDays',
  ]),
  occupiedRoomNights: { ...integer, nullable: true },
  outOfServiceRoomNights: {
    ...integer,
    nullable: true,
    description: 'Null: historical physical-status ledger unavailable.',
  },
  roomSalesValue: { ...amount, nullable: true },
  operationalAdr: { ...amount, nullable: true },
  operationalRevpar: { ...amount, nullable: true },
  occupancyRate: {
    type: 'number',
    nullable: true,
    description:
      'Occupied / estimated sellable room nights × 100; 2 decimals, null for zero denominator or incomplete occupancy.',
  },
};
const financialReport = (metrics: object) =>
  obj({
    ...common,
    summary: obj(metrics),
    series: { type: 'array', items: obj({ date, ...metrics }) },
    balance: balanceAt,
    filters: obj({
      paymentMethod: { ...text, nullable: true, enum: ['CASH', 'BANK_TRANSFER', null] },
    }),
    basis: financeBasis,
  });
const reservationMetrics = counts(reservationFields);
export const reportSchemas = {
  RevenueReport: financialReport(financialMetrics),
  PaymentReport: financialReport(paymentMetrics),
  OccupancyReport: obj({
    ...common,
    summary: obj(
      occupancyMetrics,
      Object.keys(occupancyMetrics).filter(
        (f) => !['roomSalesValue', 'operationalAdr', 'operationalRevpar'].includes(f),
      ),
    ),
    series: {
      type: 'array',
      items: obj({ date, ...occupancyMetrics }, [
        'date',
        ...Object.keys(occupancyMetrics).filter(
          (f) => !['roomSalesValue', 'operationalAdr', 'operationalRevpar'].includes(f),
        ),
      ]),
    },
    filters: obj({ roomTypeId: { ...text, nullable: true } }),
    basis: text,
  }),
  ReservationReport: obj({
    ...common,
    summary: obj(reservationMetrics),
    series: { type: 'array', items: obj({ date, ...reservationMetrics }) },
    bookingSources: { type: 'array', items: obj({ source: text, reservations: integer }) },
  }),
  OutstandingReport: obj({
    ...common,
    cutoffExclusive: timestamp,
    summary: obj(balance),
    items: { type: 'array', items: obj({ folioId: text, outstandingBalance: amount }) },
    pagination: obj(counts(['page', 'limit', 'total', 'totalPages'])),
  }),
  DashboardReport: obj(
    {
      reportDate: date,
      timezone: text,
      currency: text,
      generatedAt: timestamp,
      rooms: {
        ...obj(
          counts([
            'total',
            'active',
            'occupied',
            'vacant',
            'dirty',
            'cleaning',
            'awaitingInspection',
            'ready',
            'underMaintenance',
            'outOfService',
          ]),
        ),
        nullable: true,
      },
      roomSnapshotAt: { ...timestamp, nullable: true },
      reservations: obj(counts(['expectedArrivals', 'expectedDepartures'])),
      currentGuestsCount: {
        ...integer,
        nullable: true,
        description: 'Null until an actual guest registration ledger exists.',
      },
      finance: obj({ ...paymentMetrics, ...balance, cutoffExclusive: timestamp, scope: text }),
      dataQuality: common.dataQuality,
    },
    [
      'reportDate',
      'timezone',
      'currency',
      'generatedAt',
      'rooms',
      'roomSnapshotAt',
      'reservations',
      'currentGuestsCount',
      'dataQuality',
    ],
  ),
  OperationsReport: obj(
    {
      ...common,
      snapshotAt: timestamp,
      housekeeping: obj({
        snapshot: obj(
          counts([
            'dirtyRooms',
            'readyRooms',
            'cleaningRooms',
            'roomsAwaitingInspection',
            'activeHousekeepingTasks',
            'cleaningTasks',
          ]),
        ),
        period: obj(counts(['completedHousekeepingTasks', 'inspectedHousekeepingTasks'])),
      }),
      maintenance: obj({
        snapshot: obj(
          counts([
            'roomsUnderMaintenance',
            'roomsOutOfService',
            'openMaintenanceTickets',
            'inProgressMaintenanceTickets',
            'activeMaintenanceBlocks',
          ]),
        ),
        period: obj(counts(['maintenanceBlockedRoomNights'])),
      }),
    },
    [...Object.keys(common), 'snapshotAt'],
  ),
};

const param = (name: string, schema: object, required = false, description = '') => ({
  name,
  in: 'query',
  required,
  schema,
  description,
});
const periodParams = [
  param('startDate', date, true, 'Inclusive hotel business date.'),
  param(
    'endDate',
    date,
    true,
    'Exclusive hotel business date; startDate < endDate, default maximum 366 days, configurable by REPORT_MAX_DAYS.',
  ),
  param(
    'groupBy',
    { ...text, enum: ['day', 'month'], default: 'day' },
    false,
    'Hotel calendar grouping; month label YYYY-MM-01. Partial months include only requested days. Missing buckets are zero-filled; unavailable values stay null.',
  ),
];
const roomType = param(
  'roomTypeId',
  { ...text, pattern: '^[1-9][0-9]{0,19}$' },
  false,
  'Must belong to authenticated hotel; foreign IDs return 404.',
);
const method = param(
  'paymentMethod',
  { ...text, enum: ['CASH', 'BANK_TRANSFER'] },
  false,
  'Filters cash activity only. Cumulative balance always includes ALL methods.',
);
const errors = Object.fromEntries(
  [
    ['401', 'UNAUTHORIZED: JWT missing, expired, or session revoked.'],
    ['403', 'FORBIDDEN / REPORT_ACCESS_DENIED: role lacks permission.'],
    ['404', 'HOTEL_NOT_FOUND / ROOM_TYPE_NOT_FOUND.'],
    [
      '422',
      'VALIDATION_ERROR, INVALID_REPORT_DATE_RANGE, REPORT_RANGE_TOO_LARGE. Strict query whitelist rejects invalid dates, filters, sorting and unsupported types.',
    ],
    ['503', 'HOTEL_TIMEZONE_INVALID.'],
    ['500', 'Sanitized internal error; no SQL or stack trace.'],
  ].map(([code, description]) => [
    code,
    { description, content: { 'application/json': { schema: ref('Error') } } },
  ]),
);
const exampleCommon = {
  period: { startDate: '2026-10-01', endDate: '2026-10-02', endExclusive: true },
  timezone: 'Asia/Ho_Chi_Minh',
  currency: 'VND',
  groupBy: 'day',
  generatedAt: '2026-10-15T05:00:00.000Z',
  dataQuality: {
    status: 'complete',
    limitations: ['Illustrative example only; see endpoint definitions.'],
  },
};
const zero = (fields: readonly string[], value: string | number) =>
  Object.fromEntries(fields.map((f) => [f, value]));
const emptyPayments = {
  ...zero([...paymentFields, 'netCashCollected'], '0.00'),
  ...zero(paymentCounts, 0),
};
const emptyBalance = {
  outstandingBalance: '0.00',
  accountsReceivable: '0.00',
  customerCredits: '0.00',
  folioCount: 0,
};
const exampleFinance = (charges: boolean) => {
  const summary = {
    ...emptyPayments,
    ...(charges ? zero([...financialFields, 'netBilledCharges', 'balanceMovement'], '0.00') : {}),
  };
  return {
    ...exampleCommon,
    summary,
    series: [{ date: '2026-10-01', ...summary }],
    filters: { paymentMethod: null },
    balance: {
      ...emptyBalance,
      cutoffExclusive: '2026-10-01T17:00:00.000Z',
      scope: 'ALL_PAYMENT_METHODS',
    },
    basis: {
      charges: 'FOLIO_POSTED_AT',
      cash: 'CONFIRMED_PAYMENT_PROCESSED_AT',
      balance: 'ALL_LEDGER_ACTIVITY_BEFORE_CUTOFF',
      recognition: 'NOT_ACCOUNTING_RECOGNIZED_REVENUE',
      cashPayments: 'CONFIRMED_PAYMENTS_AND_DEPOSITS_BEFORE_REFUNDS',
    },
  };
};
const get = (
  type: keyof typeof reportRoles,
  schema: string,
  summary: string,
  description: string,
  parameters: object[],
  example: object,
) => ({
  get: {
    tags: ['Reports'],
    summary,
    description: `${description} Required roles: ${reportRoles[type].join(', ')}. Hotel scope comes from the authenticated session; hotelId/role query fields are rejected. Read-only consistent snapshot, no guest PII.`,
    security: [{ bearerAuth: [] }],
    parameters,
    responses: {
      200: {
        description: 'Report generated successfully',
        content: {
          'application/json': {
            schema: obj({
              success: { type: 'boolean', enum: [true] },
              message: text,
              data: ref(schema),
            }),
            example: { success: true, message: 'Report generated successfully', data: example },
          },
        },
      },
      ...errors,
    },
  },
});
const occupancyExample = {
  totalRoomNights: 10,
  sellableRoomNights: 9,
  maintenanceBlockedRoomNights: 1,
  occupiedRoomNights: 8,
  roomSalesValue: '7200000.00',
  operationalAdr: '900000.00',
  operationalRevpar: '800000.00',
  occupancyRate: 88.89,
  missingPriceNights: 0,
  conflictingRoomNights: 0,
  unclosedDays: 0,
  outOfServiceRoomNights: null,
};
const reservationExample = zero(reservationFields, 0);
export const reportPaths = {
  '/reports/dashboard': get(
    'dashboard',
    'DashboardReport',
    'Hotel dashboard',
    'date defaults to hotel-local today. Rooms are a current snapshot only; another date returns rooms=null. Occupancy derives from active occupancy/Stay, not housekeeping. Receptionist response omits finance. currentGuestsCount=null because no actual guest-count history exists.',
    [param('date', date)],
    {
      reportDate: '2026-10-01',
      timezone: exampleCommon.timezone,
      currency: 'VND',
      generatedAt: exampleCommon.generatedAt,
      rooms: null,
      roomSnapshotAt: null,
      currentGuestsCount: null,
      reservations: { expectedArrivals: 0, expectedDepartures: 0 },
      dataQuality: {
        status: 'incomplete',
        limitations: ['Historical room snapshot is unavailable.'],
      },
    },
  ),
  '/reports/revenue': get(
    'revenue',
    'RevenueReport',
    'Billed activity and cash collections',
    'Net Billed Charges = total debits − total credits; not recognized accounting revenue. Net Cash Collected = confirmed payments + deposits − refunds. Balance movement = period billed − period cash. Balance = all ledger entries before endDate cutoff (capped at generatedAt), including entries before startDate. Charges group by postedAt (FolioItem.createdAt); cash groups by Payment.processedAt confirmation time. Deposits are cash, not room sales.',
    periodParams,
    exampleFinance(true),
  ),
  '/reports/payments': get(
    'payments',
    'PaymentReport',
    'Payment and refund statistics',
    'CONFIRMED only. Payment count excludes deposits/refunds, which have separate counts. Cash/bank totals include payments + deposits, before refunds. Net Cash Collected = payments + deposits − refunds. Balance is cumulative, unfiltered by paymentMethod.',
    [...periodParams, method],
    exampleFinance(false),
  ),
  '/reports/occupancy': get(
    'occupancy',
    'OccupancyReport',
    'Operational occupancy, ADR and RevPAR',
    'Occupancy Rate = occupied / estimated sellable room nights × 100 (2 decimals). Operational ADR = occupied-night snapshot value / occupied nights. Operational RevPAR = same value / estimated sellable nights = unrounded ADR × occupancy fraction. Zero denominator returns null. Room-night cutoff is next local midnight, transfers counted once; early checkout stops actual nights. Missing prices and unclosed nights return null. Historical capacity excludes known maintenance until explicit release, including overdue blocks. Room activation/status/type history is incomplete: capacity and RevPAR are estimates, outOfServiceRoomNights=null. Current ACTIVE status is never applied backwards. Unallocated adjustments/taxes are not inferred. Receptionist response omits roomSalesValue, operationalAdr, operationalRevpar.',
    [...periodParams, roomType],
    {
      ...exampleCommon,
      summary: occupancyExample,
      series: [{ date: '2026-10-01', ...occupancyExample }],
      filters: { roomTypeId: null },
      basis: 'OPERATIONAL_NIGHT_END_SNAPSHOT_WITH_ESTIMATED_CAPACITY',
      dataQuality: {
        status: 'estimated',
        limitations: ['Historical activation/status history unavailable.'],
      },
    },
  ),
  '/reports/reservations': get(
    'reservations',
    'ReservationReport',
    'Reservation and stay statistics',
    'Created counts use createdAt; cancellation uses cancelledAt; actual check-in/out use Stay timestamps. Reservation rooms are distinct from orders. Confirmed/no-show counts use current status in the creation cohort, not transition dates. Expected arrivals/departures are remaining scheduled rooms at generation time, not reconstructed historical forecasts. Booking-source breakdown covers created orders.',
    periodParams,
    {
      ...exampleCommon,
      summary: reservationExample,
      series: [{ date: '2026-10-01', ...reservationExample }],
      bookingSources: [],
    },
  ),
  '/reports/operations': get(
    'operations',
    'OperationsReport',
    'Operations snapshot and period totals',
    'Snapshots are current at snapshotAt. Period completed/inspected housekeeping totals count distinct tasks with retained TASK_COMPLETE / INSPECTION_PASSED audit events. Maintenance room-nights use explicit releases and deduplicate overlapping blocks. HOUSEKEEPING receives only housekeeping; TECHNICIAN receives only maintenance. Other authorized roles receive both.',
    periodParams,
    {
      ...exampleCommon,
      snapshotAt: exampleCommon.generatedAt,
      housekeeping: {
        snapshot: {
          dirtyRooms: 0,
          readyRooms: 0,
          cleaningRooms: 0,
          roomsAwaitingInspection: 0,
          activeHousekeepingTasks: 0,
          cleaningTasks: 0,
        },
        period: { completedHousekeepingTasks: 0, inspectedHousekeepingTasks: 0 },
      },
      maintenance: {
        snapshot: {
          roomsUnderMaintenance: 0,
          roomsOutOfService: 0,
          openMaintenanceTickets: 0,
          inProgressMaintenanceTickets: 0,
          activeMaintenanceBlocks: 0,
        },
        period: { maintenanceBlockedRoomNights: 0 },
      },
    },
  ),
  '/reports/outstanding': get(
    'outstanding',
    'OutstandingReport',
    'Cumulative balances by folio',
    'All entries before cutoff, including pre-period activity, regardless of folio open/closed state. Only nonzero folios listed, no guest identity. Outstanding Balance = cumulative debits − credits − payments − deposits + refunds. Accounts receivable sums positive balances; customer credits sums absolute negative balances. startDate does not restrict the cumulative ledger. Future cutoffs are capped at generatedAt.',
    [
      ...periodParams.slice(0, 2),
      param('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }),
      param('limit', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
      param('sortBy', {
        ...text,
        enum: ['folioId', 'outstandingBalance'],
        default: 'outstandingBalance',
      }),
      param('sortOrder', { ...text, enum: ['asc', 'desc'], default: 'asc' }),
    ],
    {
      ...exampleCommon,
      cutoffExclusive: '2026-10-01T17:00:00.000Z',
      summary: emptyBalance,
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  ),
  '/reports/export': {
    get: {
      tags: ['Reports'],
      summary: 'Export bounded report series as CSV',
      description:
        'ADMIN/MANAGER: all four types; ACCOUNTANT: revenue/payments only. UTF-8 BOM, quoted cells, exact Decimal strings, formula-prefix protection. No temporary files. Same scope/filters/definitions/limitations as JSON. Maximum REPORT_EXPORT_MAX_ROWS (default 366), in addition to REPORT_MAX_DAYS. Null metrics become blank, never zero. CSV contains period/grouping/quality metadata on every row; it exports series, not cumulative folio balances.',
      security: [{ bearerAuth: [] }],
      parameters: [
        param(
          'type',
          { ...text, enum: ['revenue', 'occupancy', 'reservations', 'payments'] },
          true,
        ),
        ...periodParams,
        roomType,
        method,
      ],
      responses: {
        200: {
          description: 'UTF-8 CSV download',
          headers: {
            'Content-Disposition': {
              schema: text,
              example: 'attachment; filename="innvyra-revenue-2026-10-01-2026-11-01.csv"',
            },
          },
          content: {
            'text/csv': {
              schema: text,
              example: '\uFEFF"date","netCashCollected"\r\n"2026-10-01","100000.00"\r\n',
            },
          },
        },
        ...errors,
      },
    },
  },
};
