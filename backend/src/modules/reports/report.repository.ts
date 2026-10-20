import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { BOOKING_SOURCES } from '../reservations/reservation.schema.js';
import type { OutstandingQuery } from './report.schema.js';
import type {
  AggregateRow,
  BalanceRow,
  DbNumber,
  OccupancyRow,
  ReportDay,
  ReportRepository,
} from './report.types.js';

// All input values are bound. The SQL fragments below contain only static identifiers.
// Each query returns aggregates; no payment, guest, or stay ledger is loaded into Node.
export const dayTable = (days: ReportDay[]) =>
  Prisma.join(
    days.map(
      (day) => Prisma.sql`
  SELECT CAST(${day.date} AS CHAR(10)) AS date, CAST(${day.from} AS DATETIME(3)) AS starts,
    CAST(${day.until} AS DATETIME(3)) AS ends`,
    ),
    ' UNION ALL ',
  );

const blockedAtNightEnd = (hotelId: bigint) => Prisma.sql`EXISTS(SELECT 1 FROM maintenance_blocks b
  WHERE b.hotel_id = ${hotelId} AND b.room_id = r.id AND b.status <> 'CANCELLED'
    AND b.start_date <= CAST(d.date AS DATE) AND b.created_at < d.ends
    AND (b.status IN ('ACTIVE', 'SCHEDULED') OR b.released_at >= d.ends))`;

export class PrismaReportRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  snapshot<T>(action: (repository: ReportRepository) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => action(new PrismaReportRepository(this.prisma, tx)), {
      isolationLevel: 'RepeatableRead',
      maxWait: 5000,
      timeout: 20000,
    });
  }
  async hotel(hotelId: bigint) {
    return this.db.hotel.findUnique({ where: { id: hotelId }, select: { timezone: true } });
  }
  async roomTypeExists(hotelId: bigint, id: bigint) {
    return !!(await this.db.roomType.findFirst({ where: { hotelId, id }, select: { id: true } }));
  }
  async financialActivity(hotelId: bigint, days: ReportDay[], charges: boolean, method?: string) {
    const chargeQuery = charges
      ? Prisma.sql`
      UNION ALL
      SELECT d.date, CASE WHEN i.entry_type = 'CREDIT' THEN 'adjustmentCredits'
        WHEN i.source_type = 'ROOM_NIGHT' THEN 'roomCharges'
        WHEN i.source_type = 'SERVICE_ORDER_ITEM' THEN 'serviceCharges'
        ELSE 'adjustmentDebits' END AS metric, SUM(i.amount) AS value, '' AS category
      FROM days d JOIN folio_items i ON i.hotel_id = ${hotelId}
        AND i.created_at >= d.starts AND i.created_at < d.ends
      GROUP BY d.date, metric`
      : Prisma.empty;
    return this.db.$queryRaw<AggregateRow[]>(Prisma.sql`
      WITH days AS (${dayTable(days)}), receipts AS (
        SELECT d.date, p.payment_type, p.payment_method, SUM(p.amount) AS amount, COUNT(*) AS n
        FROM days d JOIN payments p ON p.hotel_id = ${hotelId} AND p.status = 'CONFIRMED'
          AND p.processed_at >= d.starts AND p.processed_at < d.ends
          ${method ? Prisma.sql`AND p.payment_method = ${method}` : Prisma.empty}
        GROUP BY d.date, p.payment_type, p.payment_method
      )
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ date,
        CASE payment_type WHEN 'PAYMENT' THEN 'successfulPayments' WHEN 'DEPOSIT' THEN 'successfulDeposits'
          ELSE 'successfulRefunds' END AS metric, amount AS value, '' AS category FROM receipts
      UNION ALL SELECT date,
        CASE payment_type WHEN 'PAYMENT' THEN 'paymentCount' WHEN 'DEPOSIT' THEN 'depositCount'
          ELSE 'refundCount' END, n, '' FROM receipts
      UNION ALL SELECT date, CASE payment_method WHEN 'CASH' THEN 'cashPayments' ELSE 'bankTransferPayments' END,
        amount, '' FROM receipts WHERE payment_type <> 'REFUND'
      ${chargeQuery}`);
  }
  private balanceTable(hotelId: bigint, cutoff: Date) {
    return Prisma.sql`
      ledger AS (
        SELECT folio_id, SUM(CASE entry_type WHEN 'DEBIT' THEN amount ELSE -amount END) AS amount
        FROM folio_items WHERE hotel_id = ${hotelId} AND created_at < ${cutoff} GROUP BY folio_id
        UNION ALL
        SELECT folio_id, SUM(CASE payment_type WHEN 'REFUND' THEN amount ELSE -amount END)
        FROM payments WHERE hotel_id = ${hotelId} AND status = 'CONFIRMED' AND processed_at < ${cutoff}
        GROUP BY folio_id
      ), balances AS (
        SELECT folio_id, SUM(amount) AS balance FROM ledger GROUP BY folio_id
      )`;
  }
  async balance(hotelId: bigint, cutoff: Date): Promise<BalanceRow> {
    const rows = await this.db.$queryRaw<BalanceRow[]>(Prisma.sql`
      WITH ${this.balanceTable(hotelId, cutoff)}
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ COALESCE(SUM(balance), 0) AS outstandingBalance,
        COALESCE(SUM(GREATEST(balance, 0)), 0) AS accountsReceivable,
        COALESCE(SUM(GREATEST(-balance, 0)), 0) AS customerCredits,
        COUNT(CASE WHEN balance <> 0 THEN 1 END) AS folioCount FROM balances`);
    return rows[0]!;
  }
  async outstanding(hotelId: bigint, cutoff: Date, query: OutstandingQuery) {
    const sort = query.sortBy === 'folioId' ? Prisma.sql`folio_id` : Prisma.sql`balance`;
    const direction = query.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.db.$queryRaw<{ folioId: bigint; outstandingBalance: Prisma.Decimal }[]>(Prisma.sql`
      WITH ${this.balanceTable(hotelId, cutoff)}
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ folio_id AS folioId, balance AS outstandingBalance
      FROM balances WHERE balance <> 0 ORDER BY ${sort} ${direction}, folio_id ASC
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`);
  }
  async occupancy(hotelId: bigint, days: ReportDay[], roomTypeId?: bigint) {
    // A night belongs to the room occupied immediately before the next local midnight.
    // The first transfer at/after that instant identifies the earlier room. Transfers
    // before that instant never multiply the stay. Same-day use is not an overnight.
    return this.db.$queryRaw<OccupancyRow[]>(Prisma.sql`
      WITH days AS (${dayTable(days)}), capacity AS (
        SELECT d.date, COUNT(r.id) AS total,
          COALESCE(SUM(${blockedAtNightEnd(hotelId)}), 0) AS blocked
        FROM days d LEFT JOIN rooms r ON r.hotel_id = ${hotelId} AND r.created_at < d.ends
          ${roomTypeId ? Prisma.sql`AND r.room_type_id = ${roomTypeId}` : Prisma.empty}
        GROUP BY d.date
      ), overnight AS (
        SELECT d.date, s.id, CASE WHEN r.currency = 'VND' THEN n.nightly_rate ELSE NULL END AS nightly_rate,
          COALESCE((SELECT t.from_room_id FROM room_transfers t
            WHERE t.hotel_id = ${hotelId} AND t.stay_id = s.id AND t.transferred_at >= d.ends
            ORDER BY t.transferred_at ASC, t.id ASC LIMIT 1), s.current_room_id) AS room_id
        FROM days d JOIN stays s ON s.hotel_id = ${hotelId} AND s.actual_checkin_at < d.ends
          AND (s.actual_checkout_at IS NULL OR s.actual_checkout_at >= d.ends)
          ${roomTypeId ? Prisma.sql`AND s.room_type_id = ${roomTypeId}` : Prisma.empty}
        JOIN reservation_rooms rr ON rr.id = s.reservation_room_id AND rr.hotel_id = ${hotelId}
        JOIN reservations r ON r.id = rr.reservation_id AND r.hotel_id = ${hotelId}
          AND r.status NOT IN ('CANCELLED', 'NO_SHOW')
        LEFT JOIN reservation_room_nights n ON n.reservation_room_id = rr.id AND n.stay_date = CAST(d.date AS DATE)
      ), occupied AS (
        SELECT date, COUNT(DISTINCT room_id) AS n, SUM(nightly_rate) AS value,
          SUM(nightly_rate IS NULL) AS missing, COUNT(*) - COUNT(DISTINCT room_id) AS conflicts
        FROM overnight GROUP BY date
      )
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ c.date, c.total AS totalRoomNights,
        c.blocked AS maintenanceBlockedRoomNights, COALESCE(o.n, 0) AS occupiedRoomNights,
        COALESCE(o.value, 0) AS roomSalesValue, COALESCE(o.missing, 0) AS missingPriceNights,
        COALESCE(o.conflicts, 0) AS conflictingRoomNights
      FROM capacity c LEFT JOIN occupied o ON o.date = c.date ORDER BY c.date`);
  }
  async maintenanceRoomNights(hotelId: bigint, days: ReportDay[]) {
    const rows = await this.db.$queryRaw<{ nights: DbNumber }[]>(Prisma.sql`
      WITH days AS (${dayTable(days)})
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ COUNT(*) AS nights FROM days d
      JOIN rooms r ON r.hotel_id = ${hotelId} AND r.created_at < d.ends
      WHERE ${blockedAtNightEnd(hotelId)}`);
    return rows[0]!.nights;
  }
  async reservations(hotelId: bigint, days: ReportDay[]) {
    return this.db.$queryRaw<AggregateRow[]>(Prisma.sql`
      WITH days AS (${dayTable(days)}), created AS (
        SELECT d.date, CASE WHEN r.booking_source IN (${Prisma.join([...BOOKING_SOURCES])})
          THEN UPPER(r.booking_source) ELSE 'OTHER' END AS source, COUNT(*) AS n,
          SUM(r.status = 'CONFIRMED') AS confirmed, SUM(r.status = 'NO_SHOW') AS noShows
        FROM days d JOIN reservations r ON r.hotel_id = ${hotelId}
          AND r.created_at >= d.starts AND r.created_at < d.ends GROUP BY d.date, source
      ), planned AS (
        SELECT d.date,
          SUM(r.check_in_date = CAST(d.date AS DATE) AND s.id IS NULL) AS arrivals,
          SUM(r.check_out_date = CAST(d.date AS DATE) AND s.actual_checkout_at IS NULL) AS departures
        FROM days d JOIN reservations r ON r.hotel_id = ${hotelId}
          AND r.status NOT IN ('CANCELLED', 'NO_SHOW')
          AND (r.check_in_date = CAST(d.date AS DATE) OR r.check_out_date = CAST(d.date AS DATE))
        JOIN reservation_rooms rr ON rr.reservation_id = r.id AND rr.hotel_id = ${hotelId}
        LEFT JOIN stays s ON s.reservation_room_id = rr.id AND s.hotel_id = ${hotelId} GROUP BY d.date
      )
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ date, 'reservationsCreated' AS metric, n AS value, '' AS category FROM created
      UNION ALL SELECT date, 'bookingSource', n, source FROM created
      UNION ALL SELECT date, 'confirmedReservationsInCreatedCohort', confirmed, '' FROM created
      UNION ALL SELECT date, 'noShowReservationsInCreatedCohort', noShows, '' FROM created
      UNION ALL SELECT d.date, 'cancelledReservations', COUNT(*), ''
        FROM days d JOIN reservations r ON r.hotel_id = ${hotelId}
          AND r.cancelled_at >= d.starts AND r.cancelled_at < d.ends GROUP BY d.date
      UNION ALL SELECT d.date, 'reservationRoomsCreated', COUNT(*), ''
        FROM days d JOIN reservation_rooms rr ON rr.hotel_id = ${hotelId}
          AND rr.created_at >= d.starts AND rr.created_at < d.ends GROUP BY d.date
      UNION ALL SELECT date, 'expectedArrivals', arrivals, '' FROM planned
      UNION ALL SELECT date, 'expectedDepartures', departures, '' FROM planned
      UNION ALL SELECT d.date, 'actualCheckins', COUNT(*), ''
        FROM days d JOIN stays s ON s.hotel_id = ${hotelId}
          AND s.actual_checkin_at >= d.starts AND s.actual_checkin_at < d.ends GROUP BY d.date
      UNION ALL SELECT d.date, 'actualCheckouts', COUNT(*), ''
        FROM days d JOIN stays s ON s.hotel_id = ${hotelId}
          AND s.actual_checkout_at >= d.starts AND s.actual_checkout_at < d.ends GROUP BY d.date`);
  }
  async roomSnapshot(hotelId: bigint, today: string) {
    const rows = await this.db.$queryRaw<Record<string, DbNumber>[]>(Prisma.sql`
      WITH state AS (
        SELECT r.is_active, r.physical_status, r.housekeeping_status,
          EXISTS(SELECT 1 FROM room_occupancies o JOIN stays s ON s.id = o.stay_id AND s.hotel_id = ${hotelId}
            AND s.status = 'CHECKED_IN' WHERE o.hotel_id = ${hotelId} AND o.room_id = r.id) AS occupied,
          EXISTS(SELECT 1 FROM maintenance_blocks b WHERE b.hotel_id = ${hotelId} AND b.room_id = r.id
            AND b.status IN ('ACTIVE', 'SCHEDULED') AND b.start_date <= CAST(${today} AS DATE)) AS blocked
        FROM rooms r WHERE r.hotel_id = ${hotelId}
      )
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ COUNT(*) AS total,
        COALESCE(SUM(is_active), 0) AS active, COALESCE(SUM(occupied), 0) AS occupied,
        COALESCE(SUM(NOT occupied), 0) AS vacant,
        COALESCE(SUM(housekeeping_status = 'DIRTY'), 0) AS dirty,
        COALESCE(SUM(housekeeping_status = 'CLEANING'), 0) AS cleaning,
        COALESCE(SUM(housekeeping_status = 'INSPECTION'), 0) AS awaitingInspection,
        COALESCE(SUM(is_active AND physical_status = 'ACTIVE' AND housekeeping_status = 'READY' AND NOT occupied AND NOT blocked), 0) AS ready,
        COALESCE(SUM(physical_status = 'MAINTENANCE' OR blocked), 0) AS underMaintenance,
        COALESCE(SUM(physical_status = 'OUT_OF_SERVICE'), 0) AS outOfService FROM state`);
    return rows[0]!;
  }
  async operations(hotelId: bigint, from: Date, until: Date, today: string) {
    return this.db.$queryRaw<{ metric: string; value: DbNumber }[]>(Prisma.sql`
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ 'activeHousekeepingTasks' AS metric, COUNT(*) AS value
        FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND status IN ('PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION')
      UNION ALL SELECT 'cleaningTasks', COUNT(*) FROM housekeeping_tasks WHERE hotel_id = ${hotelId} AND status = 'IN_PROGRESS'
      UNION ALL SELECT 'completedHousekeepingTasks', COUNT(DISTINCT task_id) FROM operations_audit_logs
        WHERE hotel_id = ${hotelId} AND action = 'TASK_COMPLETE' AND created_at >= ${from} AND created_at < ${until}
      UNION ALL SELECT 'inspectedHousekeepingTasks', COUNT(DISTINCT task_id) FROM operations_audit_logs
        WHERE hotel_id = ${hotelId} AND action = 'INSPECTION_PASSED' AND created_at >= ${from} AND created_at < ${until}
      UNION ALL SELECT 'openMaintenanceTickets', COUNT(*) FROM maintenance_tickets WHERE hotel_id = ${hotelId} AND status IN ('OPEN', 'ASSIGNED')
      UNION ALL SELECT 'inProgressMaintenanceTickets', COUNT(*) FROM maintenance_tickets WHERE hotel_id = ${hotelId} AND status = 'IN_PROGRESS'
      UNION ALL SELECT 'activeMaintenanceBlocks', COUNT(*) FROM maintenance_blocks
        WHERE hotel_id = ${hotelId} AND status IN ('ACTIVE', 'SCHEDULED') AND start_date <= CAST(${today} AS DATE)`);
  }
  async procurementSeries(
    hotelId: bigint,
    days: ReportDay[],
    supplierId?: string,
    categoryId?: string,
  ) {
    return this.db.$queryRaw<{ date: string; totalExpense: Prisma.Decimal; receiptCount: DbNumber }[]>(
      Prisma.sql`
      WITH days AS (${dayTable(days)})
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ d.date,
        COALESCE(SUM(sr.total_amount), 0) AS totalExpense,
        COUNT(sr.id) AS receiptCount
      FROM days d
      LEFT JOIN stock_receipts sr ON sr.hotel_id = ${hotelId}
        AND sr.receipt_date >= d.starts AND sr.receipt_date < d.ends
        ${supplierId ? Prisma.sql`AND sr.supplier_id = ${BigInt(supplierId)}` : Prisma.empty}
        ${
          categoryId
            ? Prisma.sql`AND EXISTS(SELECT 1 FROM stock_receipt_items sri
                JOIN inventory_items ii ON ii.id = sri.item_id
                WHERE sri.receipt_id = sr.id AND ii.category_id = ${BigInt(categoryId)})`
            : Prisma.empty
        }
      GROUP BY d.date
      ORDER BY d.date ASC`,
    );
  }
  async procurementByCategory(
    hotelId: bigint,
    from: Date,
    until: Date,
    supplierId?: string,
  ) {
    return this.db.$queryRaw<
      { categoryId: DbNumber; categoryName: string; totalAmount: Prisma.Decimal; totalQuantity: Prisma.Decimal }[]
    >(Prisma.sql`
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ c.id AS categoryId,
        c.name AS categoryName,
        SUM(sri.line_total) AS totalAmount,
        SUM(sri.quantity) AS totalQuantity
      FROM stock_receipt_items sri
      JOIN stock_receipts sr ON sr.id = sri.receipt_id
      JOIN inventory_items ii ON ii.id = sri.item_id
      JOIN inventory_categories c ON c.id = ii.category_id
      WHERE sr.hotel_id = ${hotelId}
        AND sr.receipt_date >= ${from} AND sr.receipt_date < ${until}
        ${supplierId ? Prisma.sql`AND sr.supplier_id = ${BigInt(supplierId)}` : Prisma.empty}
      GROUP BY c.id, c.name
      ORDER BY totalAmount DESC`);
  }
  async procurementBySupplier(
    hotelId: bigint,
    from: Date,
    until: Date,
    categoryId?: string,
  ) {
    return this.db.$queryRaw<
      {
        supplierId: DbNumber;
        supplierName: string;
        receiptCount: DbNumber;
        totalAmount: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ s.id AS supplierId,
        s.name AS supplierName,
        COUNT(DISTINCT sr.id) AS receiptCount,
        SUM(sr.total_amount) AS totalAmount
      FROM stock_receipts sr
      LEFT JOIN suppliers s ON s.id = sr.supplier_id AND s.hotel_id = ${hotelId}
      WHERE sr.hotel_id = ${hotelId}
        AND sr.receipt_date >= ${from} AND sr.receipt_date < ${until}
        ${
          categoryId
            ? Prisma.sql`AND EXISTS(SELECT 1 FROM stock_receipt_items sri
                JOIN inventory_items ii ON ii.id = sri.item_id
                WHERE sri.receipt_id = sr.id AND ii.category_id = ${BigInt(categoryId)})`
            : Prisma.empty
        }
      GROUP BY s.id, s.name
      ORDER BY totalAmount DESC`);
  }
  async procurementTopItems(hotelId: bigint, from: Date, until: Date, supplierId?: string) {
    return this.db.$queryRaw<
      {
        itemId: DbNumber;
        sku: string;
        name: string;
        categoryName: string;
        unit: string;
        totalQuantity: Prisma.Decimal;
        totalAmount: Prisma.Decimal;
      }[]
    >(Prisma.sql`
      SELECT /*+ MAX_EXECUTION_TIME(10000) */ ii.id AS itemId,
        ii.code AS sku,
        ii.name,
        c.name AS categoryName,
        ii.unit,
        SUM(sri.quantity) AS totalQuantity,
        SUM(sri.line_total) AS totalAmount
      FROM stock_receipt_items sri
      JOIN stock_receipts sr ON sr.id = sri.receipt_id
      JOIN inventory_items ii ON ii.id = sri.item_id
      JOIN inventory_categories c ON c.id = ii.category_id
      WHERE sr.hotel_id = ${hotelId}
        AND sr.receipt_date >= ${from} AND sr.receipt_date < ${until}
        ${supplierId ? Prisma.sql`AND sr.supplier_id = ${BigInt(supplierId)}` : Prisma.empty}
      GROUP BY ii.id, ii.code, ii.name, c.name, ii.unit
      ORDER BY totalAmount DESC
      LIMIT 10`);
  }
}
