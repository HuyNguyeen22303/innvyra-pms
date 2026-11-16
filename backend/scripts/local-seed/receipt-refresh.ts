import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../../src/generated/prisma/client.js';
import type { Env } from '../../src/config/env.js';
import { localDay } from '../../src/modules/hotels/subscription-calendar.js';
import { localHotels } from './catalog.js';
import { localStaff } from './staff.js';
import { localMaterialDefaults } from './supply-defaults.js';
import { isLocalDatabaseName } from './config.js';
import { localPurchaseReceiptNumber } from './receipt-number.js';

const legacyNumbers = ['NHAP-1', 'NHAP-2', 'NHAP-CHUYENTIEP'];
const include = {
  hotel: { select: { code: true, timezone: true } },
  supplier: { select: { code: true } },
  creator: { select: { username: true } },
  items: {
    include: { item: { select: { code: true, name: true, unit: true } } },
    orderBy: { id: 'asc' },
  },
  supplierPayments: { include: { reversal: true }, orderBy: { id: 'asc' } },
} as const satisfies Prisma.StockReceiptInclude;
const fingerprint = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, value) => (typeof value === 'bigint' ? String(value) : value)),
    )
    .digest('hex');
function invalid(): never {
  throw new Error('Receipt refresh refused an unrecognized local receipt; no records were changed');
}

async function assertTarget(prisma: PrismaClient, env: Env) {
  const url = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !isLocalDatabaseName(url.pathname.slice(1))
  )
    throw new Error('Receipt refresh requires a local Innvyra database');
  const actual = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() name`;
  if (actual[0]?.name !== url.pathname.slice(1))
    throw new Error('Receipt refresh database mismatch');
}

async function readPlan(db: Prisma.TransactionClient) {
  const receipts = await db.stockReceipt.findMany({
    where: {
      receiptNumber: { in: legacyNumbers },
      hotel: { code: { in: localHotels.map((hotel) => hotel.code) } },
    },
    include,
    orderBy: [{ hotelId: 'asc' }, { id: 'asc' }],
  });
  const changes = [];
  for (const receipt of receipts) {
    const config = localHotels.find((hotel) => hotel.code === receipt.hotel.code)!;
    const sequence =
      receipt.receiptNumber === 'NHAP-1' ? 1 : receipt.receiptNumber === 'NHAP-2' ? 2 : 3;
    const quantities =
      sequence === 1 ? [200, 300, 150, 90, 20] : sequence === 2 ? [100, 100, 50, 30, 10] : [10];
    const prices = sequence === 3 ? [5000] : [75000, 5000, 15000, 45000, 120000];
    if (
      receipt.creator.username !==
        localStaff(config).find((person) => person.role === 'ADMIN')!.username ||
      receipt.supplier?.code !== `SUPPLIER_${sequence === 2 ? 2 : 1}` ||
      receipt.items.length !== quantities.length
    )
      invalid();
    for (const [index, base] of quantities.entries()) {
      const code = sequence === 3 ? 'ITEM_2' : `ITEM_${index + 1}`;
      const line = receipt.items.find((line) => line.item.code === code);
      const definition = localMaterialDefaults.find((item) => item.code === code)!;
      if (!line || line.item.name !== definition.name) invalid();
      const measured = index >= 3 && sequence !== 3;
      if (
        measured
          ? !['chai', 'ml'].includes(line.item.unit)
          : code === 'ITEM_2'
            ? !['cái', 'chai'].includes(line.item.unit)
            : line.item.unit !== 'cái'
      )
        invalid();
      const factor = measured && line.item.unit === 'ml' ? 1000 : 1;
      if (
        !line.quantity.equals(new Prisma.Decimal(base).mul(factor)) ||
        !line.unitPrice.equals(new Prisma.Decimal(prices[index]!).div(factor)) ||
        !line.lineTotal.equals(line.quantity.mul(line.unitPrice).toDecimalPlaces(2))
      )
        invalid();
    }
    if (
      !receipt.totalAmount.equals(
        receipt.items.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0)),
      )
    )
      invalid();
    if (
      !['UNRECONCILED', 'TRACKED'].includes(receipt.paymentTracking) ||
      (receipt.paymentTracking === 'UNRECONCILED' && receipt.supplierPayments.length)
    )
      invalid();
    const movements = await db.inventoryMovement.findMany({
      where: { hotelId: receipt.hotelId, referenceType: 'STOCK_RECEIPT', referenceId: receipt.id },
      orderBy: { id: 'asc' },
    });
    if (
      movements.length !== receipt.items.length ||
      receipt.items.some((line) => {
        const movement = movements.find((movement) => movement.itemId === line.itemId);
        return (
          !movement ||
          movement.type !== 'RECEIPT' ||
          movement.referenceNumber !== receipt.receiptNumber ||
          !movement.quantity.equals(line.quantity)
        );
      })
    )
      invalid();
    const newNumber = localPurchaseReceiptNumber(
      localDay(receipt.hotel.timezone, receipt.receiptDate),
      sequence,
    );
    if (
      await db.stockReceipt.findUnique({
        where: { hotelId_receiptNumber: { hotelId: receipt.hotelId, receiptNumber: newNumber } },
        select: { id: true },
      })
    )
      throw new Error('Receipt refresh target number already exists; no records were changed');
    changes.push({
      receipt,
      movements,
      newNumber,
      mode:
        receipt.paymentTracking === 'TRACKED'
          ? ('RENAME_TRACKED' as const)
          : ('REPLACE_UNRECONCILED' as const),
    });
  }
  return changes;
}
export type ReceiptRefreshPlan = Awaited<ReturnType<typeof readPlan>>;
export async function planLocalReceiptRefresh(prisma: PrismaClient, env: Env) {
  await assertTarget(prisma, env);
  return prisma.$transaction((tx) => readPlan(tx), {
    isolationLevel: 'RepeatableRead',
    timeout: 30000,
  });
}

export async function applyLocalReceiptRefresh(
  prisma: PrismaClient,
  env: Env,
  expected: ReceiptRefreshPlan,
) {
  await assertTarget(prisma, env);
  return prisma.$transaction(
    async (tx) => {
      const hotels = [...new Set(expected.map((change) => change.receipt.hotelId))].sort((a, b) =>
        a < b ? -1 : a > b ? 1 : 0,
      );
      if (hotels.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM hotels WHERE id IN (${Prisma.join(hotels)}) ORDER BY id FOR UPDATE`,
        );
      const changes = await readPlan(tx);
      if (fingerprint(changes) !== fingerprint(expected))
        throw new Error(
          'Receipt refresh plan changed; refresh the preview and backup before applying',
        );
      const result = [];
      for (const change of changes) {
        const { receipt, newNumber, mode } = change;
        let newId = receipt.id;
        if (mode === 'REPLACE_UNRECONCILED') {
          const replacement = await tx.stockReceipt.create({
            data: {
              hotelId: receipt.hotelId,
              supplierId: receipt.supplierId,
              receiptNumber: newNumber,
              receiptDate: receipt.receiptDate,
              totalAmount: receipt.totalAmount,
              paymentTracking: 'TRACKED',
              createdBy: receipt.createdBy,
              createdAt: receipt.createdAt,
              updatedAt: receipt.updatedAt,
              notes:
                receipt.receiptNumber === 'NHAP-CHUYENTIEP'
                  ? 'Nhập bổ sung dầu gội cho buồng phòng.'
                  : receipt.notes,
            },
          });
          newId = replacement.id;
          await tx.stockReceiptItem.updateMany({
            where: { hotelId: receipt.hotelId, receiptId: receipt.id },
            data: { receiptId: newId },
          });
        } else {
          await tx.stockReceipt.update({
            where: { hotelId: receipt.hotelId, id: receipt.id },
            data: { receiptNumber: newNumber, updatedAt: receipt.updatedAt },
          });
        }
        // Repoint the existing ledger entries. Never post a second receipt or
        // adjust quantity/balances; all received goods were already in stock.
        for (const movement of change.movements)
          await tx.inventoryMovement.update({
            where: { hotelId: receipt.hotelId, id: movement.id },
            data: {
              referenceId: newId,
              referenceNumber: newNumber,
              notes:
                movement.notes === `Stock Receipt ${receipt.receiptNumber}`
                  ? `Stock Receipt ${newNumber}`
                  : movement.notes,
            },
          });
        if (mode === 'REPLACE_UNRECONCILED')
          await tx.stockReceipt.delete({ where: { hotelId: receipt.hotelId, id: receipt.id } });
        result.push({
          hotelCode: receipt.hotel.code,
          oldId: receipt.id,
          newId,
          oldNumber: receipt.receiptNumber,
          newNumber,
          mode,
        });
      }
      return result;
    },
    { isolationLevel: 'ReadCommitted', timeout: 30000 },
  );
}
