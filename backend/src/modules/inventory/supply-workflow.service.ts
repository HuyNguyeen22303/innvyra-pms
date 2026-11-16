import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient, type HousekeepingTask } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { operationsTransaction } from '../operations/operations.repository.js';
import { allowed, assignedActor, cleaners, managers } from '../operations/operations.shared.js';
import { reportDays } from '../reports/report.dates.js';
import { postStockIssue } from './inventory-posting.js';
import { PrismaInventoryRepository } from './inventory.repository.js';
import type { InventoryScope } from './inventory.types.js';
import {
  completeMaterialsBody,
  supplierPaymentBody,
  type CompleteMaterialsInput,
  type SupplierPaymentInput,
} from './supply-workflow.schema.js';

const financial = ['ADMIN', 'MANAGER', 'ACCOUNTANT'] as const;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const money = (value: Prisma.Decimal | string | number) => new Prisma.Decimal(value).toFixed(2);
const fail = (code: string, message: string): never => {
  throw new AppError(409, code, message);
};
const itemSelect = {
  id: true,
  code: true,
  name: true,
  unit: true,
  currentStock: true,
  isActive: true,
  materialType: true,
  description: true,
} as const;
const materialLines = (lines: { itemId: string; quantity: string }[]) => {
  const totals = new Map<string, Prisma.Decimal>();
  for (const line of lines)
    totals.set(line.itemId, (totals.get(line.itemId) ?? new Prisma.Decimal(0)).add(line.quantity));
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([itemId, quantity]) => ({ itemId, quantity: quantity.toFixed(2) }));
};

export class SupplyWorkflow {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  private write<T>(hotelId: bigint, action: (service: SupplyWorkflow) => Promise<T>) {
    if (this.tx) return action(this);
    return operationsTransaction(this.prisma, hotelId, (tx) =>
      action(new SupplyWorkflow(this.prisma, tx)),
    );
  }
  private read<T>(action: (service: SupplyWorkflow) => Promise<T>) {
    if (this.tx) return action(this);
    return this.prisma.$transaction((tx) => action(new SupplyWorkflow(this.prisma, tx)), {
      isolationLevel: 'RepeatableRead',
    });
  }
  async presets(scope: InventoryScope, roomTypeId: bigint) {
    allowed(scope, [...managers, 'HOUSEKEEPING']);
    return this.read(async (service) => {
      const type = await service.db.roomType.findFirst({
        where: { hotelId: scope.hotelId, id: roomTypeId },
      });
      if (!type) throw new AppError(404, 'ROOM_TYPE_NOT_FOUND', 'Room type not found');
      const materials = await service.db.housekeepingMaterialPreset.findMany({
        where: { hotelId: scope.hotelId, roomTypeId },
        include: { item: { select: itemSelect } },
        orderBy: { id: 'asc' },
      });
      const reusableItems = await service.db.inventoryItem.findMany({
        where: { hotelId: scope.hotelId, isActive: true, materialType: 'REUSABLE' },
        select: itemSelect,
        orderBy: { name: 'asc' },
      });
      return {
        roomTypeId,
        roomType: {
          id: type.id,
          code: type.code,
          name: type.name,
          maxAdults: type.maxAdults,
          maxChildren: type.maxChildren,
        },
        reusableItems: reusableItems.map((item) => ({
          ...item,
          currentStock: money(item.currentStock),
        })),
        materials: materials.map((row) => ({
          itemId: row.itemId,
          quantity: money(row.quantity),
          usageBasis: row.usageBasis,
          item: { ...row.item, currentStock: money(row.item.currentStock) },
        })),
      };
    });
  }
  async setPresets(
    scope: InventoryScope,
    roomTypeId: bigint,
    materials: { itemId: string; quantity: string; usageBasis?: 'PER_GUEST' | 'PER_ROOM' }[],
  ) {
    allowed(scope, managers);
    return this.write(scope.hotelId, async (service) => {
      await service.presets(scope, roomTypeId);
      if (new Set(materials.map((row) => row.itemId)).size !== materials.length)
        throw new AppError(422, 'DUPLICATE_MATERIAL', 'Choose each material once');
      await service.validateConsumables(scope, materials);
      await service.db.housekeepingMaterialPreset.deleteMany({
        where: { hotelId: scope.hotelId, roomTypeId },
      });
      if (materials.length)
        await service.db.housekeepingMaterialPreset.createMany({
          data: materials.map((row) => ({
            hotelId: scope.hotelId,
            roomTypeId,
            itemId: BigInt(row.itemId),
            quantity: row.quantity,
            usageBasis: row.usageBasis ?? 'PER_ROOM',
          })),
        });
      return service.presets(scope, roomTypeId);
    });
  }
  private async validateConsumables(scope: InventoryScope, materials: { itemId: string }[]) {
    const ids = [...new Set(materials.map((row) => row.itemId))].map(BigInt);
    const items = await this.db.inventoryItem.findMany({
      where: { hotelId: scope.hotelId, id: { in: ids } },
      select: itemSelect,
    });
    if (items.length !== ids.length)
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Material not found in this hotel');
    if (items.some((item) => !item.isActive || item.materialType !== 'CONSUMABLE'))
      fail('MATERIAL_NOT_CONSUMABLE', 'Choose active consumable materials');
  }
  async taskMaterials(scope: InventoryScope, taskId: bigint) {
    allowed(scope, cleaners);
    return this.read(async (service) => {
      const task = await service.db.housekeepingTask.findFirst({
        where: { hotelId: scope.hotelId, id: taskId },
        include: { room: true },
      });
      if (!task || (scope.role === 'HOUSEKEEPING' && task.assignedTo !== scope.actorId))
        throw new AppError(404, 'HOUSEKEEPING_TASK_NOT_FOUND', 'Task not found');
      const presets = await service.presets(scope, task.room.roomTypeId);
      const history = await service.db.housekeepingMaterialCompletion.findMany({
        where: { hotelId: scope.hotelId, taskId },
        orderBy: { id: 'asc' },
        include: {
          actor: { select: { id: true, fullName: true } },
          stockIssue: { include: { items: { include: { item: { select: itemSelect } } } } },
        },
      });
      return {
        taskId,
        workToken: task.workToken,
        ...presets,
        preparation: {
          adults: presets.roomType.maxAdults,
          children: 0,
          source: 'ROOM_TYPE_STANDARD',
        },
        materials: presets.materials.map((line) => ({
          ...line,
          presetQuantity: line.quantity,
          quantity: money(
            new Prisma.Decimal(line.quantity).mul(
              line.usageBasis === 'PER_GUEST' ? presets.roomType.maxAdults : 1,
            ),
          ),
        })),
        history: history.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          actor: row.actor,
          noMaterialsReason: row.noMaterialsReason,
          preparedAdults: row.preparedAdults,
          preparedChildren: row.preparedChildren,
          stockIssueId: row.stockIssue?.id ?? null,
          issueNumber: row.stockIssue?.issueNumber ?? null,
          materials:
            row.stockIssue?.items.map((line) => ({
              itemId: line.itemId,
              quantity: money(line.quantity),
              item: { ...line.item, currentStock: money(line.item.currentStock) },
            })) ?? [],
        })),
      };
    });
  }
  private completionHash(scope: InventoryScope, taskId: bigint, input: CompleteMaterialsInput) {
    return hash({
      actorId: String(scope.actorId),
      taskId: String(taskId),
      workToken: input.workToken,
      materials: materialLines(input.materials),
      reason: input.noMaterialsReason ?? null,
      notes: input.notes ?? null,
      ...(input.preparedAdults != null
        ? { preparedAdults: input.preparedAdults, preparedChildren: input.preparedChildren }
        : {}),
    });
  }
  async replayCompletion(
    scope: InventoryScope,
    task: HousekeepingTask,
    input: CompleteMaterialsInput,
  ) {
    const previous = await this.db.housekeepingMaterialCompletion.findUnique({
      where: { hotelId_workToken: { hotelId: scope.hotelId, workToken: input.workToken } },
    });
    if (!previous) return false;
    assignedActor(scope, task.assignedTo);
    if (
      previous.taskId !== task.id ||
      previous.requestHash !== this.completionHash(scope, task.id, input)
    )
      fail(
        'IDEMPOTENCY_CONFLICT',
        'This cleaning attempt was already submitted with different materials',
      );
    return true;
  }
  async recordCompletion(
    scope: InventoryScope,
    task: HousekeepingTask,
    raw: CompleteMaterialsInput,
  ) {
    if (!this.tx) throw new Error('Cleaning materials must share the task transaction');
    const input = completeMaterialsBody.parse(raw);
    if (input.workToken !== task.workToken)
      fail('HOUSEKEEPING_ATTEMPT_CHANGED', 'Refresh the current cleaning attempt');
    const materials = materialLines(input.materials);
    await this.validateConsumables(scope, materials);
    const room = await this.db.room.findFirstOrThrow({
      where: { hotelId: scope.hotelId, id: task.roomId },
      select: { roomNumber: true, roomType: { select: { maxAdults: true, maxChildren: true } } },
    });
    if (
      input.preparedAdults != null &&
      (input.preparedAdults > room.roomType.maxAdults ||
        input.preparedChildren! > room.roomType.maxChildren)
    )
      throw new AppError(
        422,
        'PREPARATION_EXCEEDS_CAPACITY',
        'Preparation guest counts exceed room capacity',
      );
    const completion = await this.db.housekeepingMaterialCompletion.create({
      data: {
        hotelId: scope.hotelId,
        taskId: task.id,
        actorId: scope.actorId,
        workToken: input.workToken,
        requestHash: this.completionHash(scope, task.id, input),
        noMaterialsReason: input.noMaterialsReason ?? null,
        preparedAdults: input.preparedAdults ?? null,
        preparedChildren: input.preparedChildren ?? null,
      },
    });
    if (materials.length)
      await postStockIssue(
        new PrismaInventoryRepository(this.prisma, this.tx),
        scope,
        {
          items: materials,
          department: 'HOUSEKEEPING',
          purpose: `Dọn phòng ${room.roomNumber} · Nhiệm vụ #${task.id}`,
          notes: input.notes,
        },
        completion.id,
      );
  }
  async settlement(scope: InventoryScope, receiptId: bigint) {
    allowed(scope, financial);
    return this.read(async (service) => {
      const receipt = await service.db.stockReceipt.findFirst({
        where: { hotelId: scope.hotelId, id: receiptId },
        include: {
          supplier: { select: { id: true, name: true } },
          supplierPayments: {
            include: {
              actor: { select: { id: true, fullName: true } },
              reversal: { include: { actor: { select: { id: true, fullName: true } } } },
            },
            orderBy: { id: 'asc' },
          },
        },
      });
      if (!receipt) throw new AppError(404, 'RECEIPT_NOT_FOUND', 'Receipt not found');
      const paid = receipt.supplierPayments.reduce(
        (sum, row) => (row.reversal ? sum : sum.add(row.amount)),
        new Prisma.Decimal(0),
      );
      return {
        receiptId,
        receiptNumber: receipt.receiptNumber,
        supplier: receipt.supplier,
        totalAmount: money(receipt.totalAmount),
        paymentTracking: receipt.paymentTracking,
        reconciledAt: receipt.reconciledAt,
        reconciliationReason: receipt.reconciliationReason,
        paidAmount: money(paid),
        outstandingAmount:
          receipt.paymentTracking === 'TRACKED' ? money(receipt.totalAmount.sub(paid)) : null,
        status:
          receipt.paymentTracking !== 'TRACKED'
            ? 'UNRECONCILED'
            : paid.equals(receipt.totalAmount)
              ? 'PAID'
              : paid.isZero()
                ? 'UNPAID'
                : 'PARTIAL',
        payments: receipt.supplierPayments.map((row) => ({
          id: row.id,
          amount: money(row.amount),
          paymentMethod: row.paymentMethod,
          paidAt: row.paidAt,
          referenceNumber: row.referenceNumber,
          notes: row.notes,
          actor: row.actor,
          reversal: row.reversal
            ? {
                reason: row.reversal.reason,
                reversedAt: row.reversal.reversedAt,
                actor: row.reversal.actor,
              }
            : null,
        })),
      };
    });
  }
  async pay(scope: InventoryScope, receiptId: bigint, raw: SupplierPaymentInput) {
    allowed(scope, financial);
    const input = supplierPaymentBody.parse(raw);
    return this.write(scope.hotelId, async (service) => {
      const requestHash = hash({
        receiptId: String(receiptId),
        actorId: String(scope.actorId),
        amount: money(input.amount),
        method: input.paymentMethod,
        paidAt: new Date(input.paidAt).toISOString(),
        reference: input.referenceNumber ?? null,
        notes: input.notes ?? null,
      });
      const previous = await service.db.supplierPayment.findUnique({
        where: { hotelId_requestKey: { hotelId: scope.hotelId, requestKey: input.requestKey } },
      });
      if (previous) {
        if (previous.requestHash !== requestHash)
          fail('IDEMPOTENCY_CONFLICT', 'Payment key was already used with different data');
        return service.settlement(scope, receiptId);
      }
      const receipt = await service.settlement(scope, receiptId);
      if (receipt.paymentTracking !== 'TRACKED')
        fail('RECEIPT_UNRECONCILED', 'Reconcile historical receipt payments first');
      if (new Date(input.paidAt).getTime() > Date.now())
        throw new AppError(422, 'PAYMENT_DATE_IN_FUTURE', 'Payment date cannot be in the future');
      if (new Prisma.Decimal(input.amount).greaterThan(receipt.outstandingAmount!))
        fail('SUPPLIER_PAYMENT_EXCEEDS_BALANCE', 'Payment exceeds the remaining balance');
      await service.db.supplierPayment.create({
        data: {
          hotelId: scope.hotelId,
          receiptId,
          actorId: scope.actorId,
          requestKey: input.requestKey,
          requestHash,
          amount: input.amount,
          paymentMethod: input.paymentMethod,
          paidAt: new Date(input.paidAt),
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
        },
      });
      return service.settlement(scope, receiptId);
    });
  }
  async reverse(scope: InventoryScope, paymentId: bigint, reason: string) {
    allowed(scope, financial);
    return this.write(scope.hotelId, async (service) => {
      const payment = await service.db.supplierPayment.findFirst({
        where: { hotelId: scope.hotelId, id: paymentId },
        include: { reversal: true },
      });
      if (!payment) throw new AppError(404, 'SUPPLIER_PAYMENT_NOT_FOUND', 'Payment not found');
      if (!payment.reversal)
        await service.db.supplierPaymentReversal.create({
          data: { hotelId: scope.hotelId, paymentId, actorId: scope.actorId, reason },
        });
      else if (payment.reversal.reason !== reason)
        fail('IDEMPOTENCY_CONFLICT', 'Payment was already reversed with a different reason');
      return service.settlement(scope, payment.receiptId);
    });
  }
  async reconcile(
    scope: InventoryScope,
    receiptId: bigint,
    reason: string,
    payment?: SupplierPaymentInput,
  ) {
    allowed(scope, financial);
    return this.write(scope.hotelId, async (service) => {
      const receipt = await service.settlement(scope, receiptId);
      if (receipt.paymentTracking === 'TRACKED')
        fail('RECEIPT_ALREADY_RECONCILED', 'Receipt was already reconciled');
      await service.db.stockReceipt.update({
        where: { hotelId: scope.hotelId, id: receiptId },
        data: {
          paymentTracking: 'TRACKED',
          reconciledAt: new Date(),
          reconciledById: scope.actorId,
          reconciliationReason: reason,
        },
      });
      if (payment) await service.pay(scope, receiptId, payment);
      return service.settlement(scope, receiptId);
    });
  }
  async supplierFinance(
    scope: InventoryScope,
    query: { startDate: string; endDate: string; page: number; limit: number },
  ) {
    allowed(scope, financial);
    return this.read(async (service) => {
      const hotel = await service.db.hotel.findUniqueOrThrow({
        where: { id: scope.hotelId },
        select: { timezone: true },
      });
      const days = reportDays(query.startDate, query.endDate, hotel.timezone, 366);
      const from = days[0]!.from,
        cutoff = new Date(Math.min(days.at(-1)!.until.getTime(), Date.now()));
      const rows = await service.db.$queryRaw<
        { paid: Prisma.Decimal; reversed: Prisma.Decimal }[]
      >(Prisma.sql`
        SELECT COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE hotel_id=${scope.hotelId} AND paid_at>=${from} AND paid_at<${cutoff}),0) paid,
        COALESCE((SELECT SUM(p.amount) FROM supplier_payment_reversals r JOIN supplier_payments p ON p.hotel_id=r.hotel_id AND p.id=r.payment_id
          WHERE r.hotel_id=${scope.hotelId} AND r.reversed_at>=${from} AND r.reversed_at<${cutoff}),0) reversed`);
      const balanceCte = Prisma.sql`WITH balances AS (
        SELECT s.id,s.receipt_number,s.receipt_date,s.total_amount,s.payment_tracking,sp.name supplier_name,
          s.total_amount-COALESCE((SELECT SUM(p.amount) FROM supplier_payments p WHERE p.hotel_id=s.hotel_id AND p.receipt_id=s.id AND p.paid_at<${cutoff}
            AND NOT EXISTS(SELECT 1 FROM supplier_payment_reversals r WHERE r.hotel_id=p.hotel_id AND r.payment_id=p.id AND r.reversed_at<${cutoff})),0) outstanding
        FROM stock_receipts s LEFT JOIN suppliers sp ON sp.hotel_id=s.hotel_id AND sp.id=s.supplier_id
        WHERE s.hotel_id=${scope.hotelId} AND s.receipt_date<${cutoff})`;
      const balances = await service.db.$queryRaw<
        {
          outstanding: Prisma.Decimal;
          unknownValue: Prisma.Decimal;
          unknownCount: bigint;
          count: bigint;
        }[]
      >(Prisma.sql`${balanceCte}
        SELECT COALESCE(SUM(CASE WHEN payment_tracking='TRACKED' THEN outstanding ELSE 0 END),0) outstanding,
        COALESCE(SUM(CASE WHEN payment_tracking<>'TRACKED' THEN total_amount ELSE 0 END),0) unknownValue,
        SUM(payment_tracking<>'TRACKED') unknownCount, SUM(payment_tracking<>'TRACKED' OR outstanding>0) count FROM balances`);
      const items = await service.db.$queryRaw<
        {
          id: bigint;
          receipt_number: string;
          receipt_date: Date;
          total_amount: Prisma.Decimal;
          payment_tracking: string;
          supplier_name: string | null;
          outstanding: Prisma.Decimal;
        }[]
      >(Prisma.sql`${balanceCte}
        SELECT * FROM balances WHERE payment_tracking<>'TRACKED' OR outstanding>0 ORDER BY receipt_date DESC,id DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`);
      const paid = rows[0]!.paid,
        reversed = rows[0]!.reversed;
      return {
        timezone: hotel.timezone,
        startDate: query.startDate,
        endDate: query.endDate,
        cutoffExclusive: cutoff.toISOString(),
        paidOut: money(paid),
        reversedAmount: money(reversed),
        netPaidOut: money(new Prisma.Decimal(paid).sub(reversed)),
        outstandingAmount: money(balances[0]!.outstanding),
        unreconciledValue: money(balances[0]!.unknownValue),
        unreconciledCount: Number(balances[0]!.unknownCount ?? 0),
        items: items.map((row) => ({
          id: String(row.id),
          receiptNumber: row.receipt_number,
          receiptDate: row.receipt_date,
          supplierName: row.supplier_name,
          totalAmount: money(row.total_amount),
          outstandingAmount: row.payment_tracking === 'TRACKED' ? money(row.outstanding) : null,
          paymentTracking: row.payment_tracking,
        })),
        pagination: {
          total: Number(balances[0]!.count ?? 0),
          page: query.page,
          limit: query.limit,
        },
      };
    });
  }
}
