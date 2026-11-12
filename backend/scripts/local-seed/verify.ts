import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Env } from '../../src/config/env.js';
import { GuestCrypto } from '../../src/modules/guests/guest.crypto.js';
import { localDay, dateOnly } from '../../src/modules/hotels/subscription-calendar.js';
import { sqlIdentifier } from './dataset.js';

const checks: [string, string][] = [
  [
    'reservation_nights',
    `SELECT COUNT(*) n FROM (
    SELECT r.id FROM reservations r LEFT JOIN reservation_rooms rr ON rr.reservation_id=r.id
    LEFT JOIN reservation_room_nights n ON n.reservation_room_id=rr.id
    GROUP BY r.id,r.total_amount,r.check_in_date,r.check_out_date
    HAVING COUNT(n.id)<>COUNT(DISTINCT rr.id)*DATEDIFF(r.check_out_date,r.check_in_date) OR COALESCE(SUM(n.nightly_rate),0)<>r.total_amount) invalid`,
  ],
  [
    'night_dates',
    `SELECT COUNT(*) n FROM reservation_room_nights n JOIN reservation_rooms rr ON rr.id=n.reservation_room_id JOIN reservations r ON r.id=rr.reservation_id WHERE n.stay_date<r.check_in_date OR n.stay_date>=r.check_out_date`,
  ],
  [
    'future_inventory_capacity',
    `SELECT COUNT(*) n FROM (
    SELECT rr.hotel_id,rr.room_type_id,n.stay_date,COUNT(*) busy FROM reservation_room_nights n JOIN reservation_rooms rr ON rr.id=n.reservation_room_id JOIN reservations r ON r.id=rr.reservation_id
    WHERE n.stay_date>=CURRENT_DATE() AND r.status IN ('CONFIRMED','PARTIALLY_CHECKED_IN','CHECKED_IN','CHECKED_OUT') GROUP BY rr.hotel_id,rr.room_type_id,n.stay_date) booked
    LEFT JOIN (SELECT hotel_id,room_type_id,COUNT(*) capacity FROM rooms WHERE is_active=1 AND physical_status='ACTIVE' GROUP BY hotel_id,room_type_id) available
    ON available.hotel_id=booked.hotel_id AND available.room_type_id=booked.room_type_id WHERE booked.busy>COALESCE(available.capacity,0)`,
  ],
  [
    'stay_occupancy',
    `SELECT COUNT(*) n FROM stays s LEFT JOIN room_occupancies o ON o.stay_id=s.id JOIN reservation_rooms rr ON rr.id=s.reservation_room_id
    WHERE (s.status='CHECKED_IN' AND (o.stay_id IS NULL OR o.room_id<>s.current_room_id OR o.hotel_id<>s.hotel_id OR o.room_type_id<>s.room_type_id OR s.actual_checkout_at IS NOT NULL))
    OR (s.status='CHECKED_OUT' AND (o.stay_id IS NOT NULL OR s.actual_checkout_at IS NULL OR s.actual_checkout_at<s.actual_checkin_at)) OR rr.room_id<>s.current_room_id`,
  ],
  [
    'overlapping_stays',
    `SELECT COUNT(*) n FROM stays a JOIN stays b ON a.hotel_id=b.hotel_id AND a.current_room_id=b.current_room_id AND a.id<b.id
    WHERE a.actual_checkin_at<COALESCE(b.actual_checkout_at,'9999-12-31 00:00:00') AND b.actual_checkin_at<COALESCE(a.actual_checkout_at,'9999-12-31 00:00:00')`,
  ],
  [
    'folio_room_sources',
    `SELECT COUNT(*) n FROM folio_items f LEFT JOIN reservation_room_nights n ON n.id=f.room_night_id
    LEFT JOIN reservation_rooms rr ON rr.id=n.reservation_room_id LEFT JOIN folios fl ON fl.id=f.folio_id
    WHERE f.source_type='ROOM_NIGHT' AND (n.id IS NULL OR f.source_id<>n.id OR f.hotel_id<>rr.hotel_id OR fl.reservation_id<>rr.reservation_id OR (f.entry_type='DEBIT' AND f.amount<>ROUND(n.nightly_rate,0)))`,
  ],
  [
    'folio_service_sources',
    `SELECT COUNT(*) n FROM folio_items f LEFT JOIN service_order_items i ON i.id=f.service_order_item_id
    LEFT JOIN service_orders s ON s.id=i.service_order_id LEFT JOIN folios fl ON fl.id=f.folio_id
    WHERE f.source_type='SERVICE_ORDER_ITEM' AND (i.id IS NULL OR f.source_id<>i.id OR s.reservation_id<>fl.reservation_id OR s.status<>'COMPLETED' OR (f.entry_type='DEBIT' AND f.amount<>i.line_total))`,
  ],
  [
    'closed_folio_balance',
    `SELECT COUNT(*) n FROM folios f
    LEFT JOIN (SELECT folio_id,SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE -amount END) total FROM folio_items GROUP BY folio_id) l ON l.folio_id=f.id
    LEFT JOIN (SELECT folio_id,SUM(CASE WHEN payment_type='REFUND' THEN -amount ELSE amount END) total FROM payments WHERE status='CONFIRMED' GROUP BY folio_id) p ON p.folio_id=f.id
    WHERE f.status='CLOSED' AND (COALESCE(l.total,0)<>COALESCE(p.total,0) OR f.closed_at IS NULL OR EXISTS (SELECT 1 FROM payments pending WHERE pending.folio_id=f.id AND pending.status='PENDING'))`,
  ],
  [
    'closed_folio_active_stay',
    `SELECT COUNT(*) n FROM folios f JOIN reservation_rooms rr ON rr.reservation_id=f.reservation_id JOIN stays s ON s.reservation_room_id=rr.id WHERE f.status='CLOSED' AND s.status='CHECKED_IN'`,
  ],
  [
    'refund_totals',
    `SELECT COUNT(*) n FROM payments p JOIN (SELECT original_payment_id,SUM(amount) total FROM payments WHERE payment_type='REFUND' AND status IN ('CONFIRMED','PENDING') GROUP BY original_payment_id) r ON r.original_payment_id=p.id WHERE r.total>p.amount OR p.payment_type='REFUND'`,
  ],
  [
    'receipt_totals',
    `SELECT COUNT(*) n FROM stock_receipts r LEFT JOIN (SELECT receipt_id,SUM(line_total) total FROM stock_receipt_items GROUP BY receipt_id) l ON l.receipt_id=r.id WHERE r.total_amount<>COALESCE(l.total,0)`,
  ],
  [
    'receipt_line_totals',
    `SELECT COUNT(*) n FROM stock_receipt_items WHERE line_total<>ROUND(quantity*unit_price,2) OR quantity<=0`,
  ],
  [
    'stock_ledger',
    `SELECT COUNT(*) n FROM inventory_items i LEFT JOIN (SELECT item_id,SUM(quantity) stock FROM inventory_movements GROUP BY item_id) m ON m.item_id=i.id WHERE i.current_stock<>COALESCE(m.stock,0) OR i.current_stock<0`,
  ],
  [
    'stock_movement_chain',
    `SELECT COUNT(*) n FROM (SELECT previous_stock,current_stock,quantity,LAG(current_stock,1,0) OVER (PARTITION BY item_id ORDER BY id) prior_stock FROM inventory_movements) m WHERE previous_stock<>prior_stock OR current_stock<>previous_stock+quantity OR current_stock<0`,
  ],
  [
    'stock_receipt_references',
    `SELECT COUNT(*) n FROM inventory_movements m LEFT JOIN stock_receipts r ON r.id=m.reference_id AND r.hotel_id=m.hotel_id
    WHERE m.reference_type='STOCK_RECEIPT' AND (r.id IS NULL OR m.quantity<>(SELECT COALESCE(SUM(quantity),0) FROM stock_receipt_items l WHERE l.receipt_id=r.id AND l.item_id=m.item_id))`,
  ],
  [
    'stock_issue_references',
    `SELECT COUNT(*) n FROM inventory_movements m LEFT JOIN stock_issues r ON r.id=m.reference_id AND r.hotel_id=m.hotel_id
    WHERE m.reference_type='STOCK_ISSUE' AND (r.id IS NULL OR m.quantity<>-(SELECT COALESCE(SUM(quantity),0) FROM stock_issue_items l WHERE l.issue_id=r.id AND l.item_id=m.item_id))`,
  ],
  [
    'stock_adjustment_references',
    `SELECT COUNT(*) n FROM inventory_movements m LEFT JOIN stock_adjustments a ON a.id=m.reference_id AND a.hotel_id=m.hotel_id
    WHERE m.reference_type='STOCK_ADJUSTMENT' AND (a.id IS NULL OR m.quantity<>a.difference OR m.current_stock<>a.actual_quantity OR m.previous_stock<>a.system_quantity)`,
  ],
  [
    'housekeeping_links',
    `SELECT COUNT(*) n FROM housekeeping_tasks t JOIN rooms r ON r.id=t.room_id
    WHERE (t.status IN ('COMPLETED','CANCELLED') AND t.active_room_id IS NOT NULL)
    OR (t.status NOT IN ('COMPLETED','CANCELLED') AND (t.active_room_id IS NULL OR t.active_room_id<>t.room_id))
    OR (t.status='PENDING' AND r.housekeeping_status<>'DIRTY') OR (t.status='IN_PROGRESS' AND r.housekeeping_status<>'CLEANING') OR (t.status='AWAITING_INSPECTION' AND r.housekeeping_status<>'INSPECTION')`,
  ],
  [
    'maintenance_links',
    `SELECT COUNT(*) n FROM maintenance_blocks b JOIN rooms r ON r.id=b.room_id LEFT JOIN room_occupancies o ON o.room_id=r.id WHERE b.status='ACTIVE' AND (r.physical_status<>'MAINTENANCE' OR o.room_id IS NOT NULL)`,
  ],
  [
    'subscription_overlaps',
    `SELECT COUNT(*) n FROM hotel_subscription_periods a JOIN hotel_subscription_periods b ON a.hotel_id=b.hotel_id AND a.id<b.id WHERE a.starts_on<=b.ends_on AND b.starts_on<=a.ends_on`,
  ],
];

export async function verifyLocalDataset(prisma: PrismaClient, env: Env) {
  const results: { name: string; failures: number }[] = [];
  const target = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
  )
    throw new Error('Local verification only');
  const actual = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
  if (actual[0]?.name !== target.pathname.slice(1))
    throw new Error('Verification database mismatch');
  const relations = await prisma.$queryRaw<
    {
      constraintName: string;
      childTable: string;
      childColumn: string;
      parentTable: string;
      parentColumn: string;
    }[]
  >`
    SELECT CONSTRAINT_NAME constraintName,TABLE_NAME childTable,COLUMN_NAME childColumn,REFERENCED_TABLE_NAME parentTable,REFERENCED_COLUMN_NAME parentColumn
    FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION`;
  const grouped = new Map<string, typeof relations>();
  for (const row of relations) {
    const key = `${row.childTable}.${row.constraintName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  for (const [name, columns] of grouped) {
    const row = columns[0]!;
    const join = columns
      .map(
        (column) =>
          `c.${sqlIdentifier(column.childColumn)}=p.${sqlIdentifier(column.parentColumn)}`,
      )
      .join(' AND ');
    const required = columns
      .map((column) => `c.${sqlIdentifier(column.childColumn)} IS NOT NULL`)
      .join(' AND ');
    const counts = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) n FROM ${sqlIdentifier(row.childTable)} c LEFT JOIN ${sqlIdentifier(row.parentTable)} p ON ${join} WHERE ${required} AND p.${sqlIdentifier(row.parentColumn)} IS NULL`,
    );
    results.push({ name: `foreign_key:${name}`, failures: Number(counts[0]!.n) });
  }
  for (const [name, sql] of checks) {
    const counts = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql);
    results.push({ name, failures: Number(counts[0]!.n) });
  }
  const hotels = new Map(
    (await prisma.hotel.findMany({ select: { id: true, timezone: true } })).map((hotel) => [
      String(hotel.id),
      hotel.timezone,
    ]),
  );
  const stays = await prisma.stay.findMany({
    include: { reservationRoom: { include: { reservation: true } } },
  });
  results.push({
    name: 'stay_calendar_dates',
    failures: stays.filter((stay) => {
      const arrived = localDay(hotels.get(String(stay.hotelId))!, stay.actualCheckinAt);
      return (
        arrived < dateOnly(stay.reservationRoom.reservation.checkInDate) ||
        arrived >= dateOnly(stay.reservationRoom.reservation.checkOutDate)
      );
    }).length,
  });
  const crypto = new GuestCrypto(env);
  const guests = await prisma.guest.findMany({
    where: { documentNumberCiphertext: { not: null } },
  });
  let cryptoFailures = 0;
  for (const guest of guests) {
    try {
      const plaintext = crypto.decrypt(guest.hotelId, guest.documentNumberCiphertext!);
      if (crypto.fingerprint(guest.hotelId, plaintext) !== guest.documentNumberHash)
        cryptoFailures++;
    } catch {
      cryptoFailures++;
    }
  }
  results.push({ name: 'guest_document_roundtrip', failures: cryptoFailures });
  const tables = await prisma.$queryRaw<
    { name: string }[]
  >`SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`;
  const counts: Record<string, number> = {};
  for (const table of tables)
    counts[table.name] = Number(
      (
        await prisma.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT COUNT(*) n FROM ${sqlIdentifier(table.name)}`,
        )
      )[0]!.n,
    );
  const hotelCounts = await prisma.hotel.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { staff: true, rooms: true, guests: true, reservations: true } },
    },
    orderBy: { id: 'asc' },
  });
  let limitFailures = 0;
  for (const hotel of await prisma.hotel.findMany()) {
    const period = await prisma.hotelSubscriptionPeriod.findFirst({
      where: {
        hotelId: hotel.id,
        startsOn: { lte: new Date(`${localDay(hotel.timezone)}T00:00:00Z`) },
      },
      orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
    });
    if (!period) {
      limitFailures++;
      continue;
    }
    const activeRooms = await prisma.room.count({ where: { hotelId: hotel.id, isActive: true } });
    const activeStaff = await prisma.staffUser.count({
      where: { hotelId: hotel.id, isActive: true },
    });
    if (
      (period.roomLimit != null && activeRooms > period.roomLimit) ||
      (period.staffLimit != null && activeStaff > period.staffLimit)
    )
      limitFailures++;
  }
  results.push({ name: 'hotel_plan_limits', failures: limitFailures });
  return {
    ok: results.every((result) => result.failures === 0),
    checkedAt: new Date().toISOString(),
    database: actual[0]!.name,
    foreignKeyCount: grouped.size,
    checks: results,
    counts,
    hotels: hotelCounts.map((hotel) => ({
      id: String(hotel.id),
      code: hotel.code,
      name: hotel.name,
      counts: hotel._count,
    })),
  };
}
