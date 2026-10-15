import { createHash } from 'node:crypto';
import { type Prisma, type Folio } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { pageResult } from '../../shared/validation/room-input.js';
import {
  billingPermissions,
  type BillingPermission,
  type BillingScope,
  type BillingOperations,
  type BillingRepository,
  type CreateServiceInput,
  type UpdateServiceInput,
  type CreateOrderInput,
  type ServiceQuery,
  type OrderQuery,
  type LedgerQuery,
  type PaymentInput,
  type RefundInput,
  type AdjustmentInput,
} from './billing.types.js';
import {
  adjustmentBody,
  createOrderBody,
  createServiceBody,
  idempotencyKey,
  paymentBody,
  refundBody,
  reasonInput,
  updateServiceBody,
} from './billing.schema.js';
import { Money, calculateBalance, checkedAmount, roomCharge } from './billing.money.js';
import { folioDto, itemDto, orderDto, paymentDto, serviceDto } from './billing.mapper.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
// Sort object keys recursively; only validated JSON is fingerprinted, never staff/client identity.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export class BillingService {
  constructor(private readonly repository: BillingRepository) {}
  private authorize(scope: BillingScope, permission: BillingPermission) {
    if (!(billingPermissions[permission] as readonly string[]).includes(scope.role))
      throw new AppError(403, 'FORBIDDEN', 'Forbidden');
  }
  private async requireFolio(repository: BillingOperations, scope: BillingScope, id: bigint) {
    const folio = await repository.folio(scope.hotelId, id);
    if (!folio) throw new AppError(404, 'FOLIO_NOT_FOUND', 'Folio not found');
    return folio;
  }
  private open(folio: Folio) {
    if (folio.status !== 'OPEN') throw new AppError(409, 'FOLIO_NOT_OPEN', 'Folio is closed');
    if (folio.currency !== 'VND')
      throw new AppError(409, 'UNSUPPORTED_CURRENCY', 'Only VND is supported');
  }
  private async balance(repository: BillingOperations, scope: BillingScope, id: bigint) {
    const ledger = await repository.ledger(scope.hotelId, id);
    return calculateBalance(ledger.items, ledger.payments);
  }
  private async idempotent<T extends Prisma.InputJsonObject>(
    repository: BillingOperations,
    scope: BillingScope,
    key: string,
    operation: string,
    target: bigint,
    input: unknown,
    action: () => Promise<T>,
  ): Promise<T> {
    const parsed = idempotencyKey.safeParse(key);
    if (!parsed.success)
      throw new AppError(
        422,
        'INVALID_IDEMPOTENCY_KEY',
        'Idempotency-Key must contain 8-128 permitted ASCII characters',
      );
    const keyHash = hash(parsed.data);
    const requestHash = hash(canonicalJson({ operation, target: target.toString(), input }));
    const existing = await repository.key(scope.hotelId, keyHash);
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new AppError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Key was already used for a different request',
        );
      return existing.response as T;
    }
    const result = await action();
    await repository.saveKey(scope.hotelId, keyHash, requestHash, result);
    return result;
  }
  async listServices(scope: BillingScope, query: ServiceQuery) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      const result = await r.services(scope.hotelId, query);
      return pageResult(result.items.map(serviceDto), result.total, query);
    });
  }
  async getService(scope: BillingScope, id: bigint) {
    this.authorize(scope, 'read');
    const row = await this.repository.service(scope.hotelId, id);
    if (!row) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found');
    return serviceDto(row);
  }
  async createService(scope: BillingScope, raw: CreateServiceInput) {
    this.authorize(scope, 'catalog');
    const input = createServiceBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      if (await r.serviceCode(scope.hotelId, input.code))
        throw new AppError(409, 'SERVICE_CODE_EXISTS', 'Service code already exists');
      const row = await r.createService({
        ...input,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        hotelId: scope.hotelId,
      });
      await r.audit(scope, 'SERVICE_CREATED', row.id);
      return serviceDto(row);
    });
  }
  async updateService(scope: BillingScope, id: bigint, raw: UpdateServiceInput) {
    this.authorize(scope, 'catalog');
    const input = updateServiceBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      if (!(await r.service(scope.hotelId, id)))
        throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found');
      if (input.code && (await r.serviceCode(scope.hotelId, input.code, id)))
        throw new AppError(409, 'SERVICE_CODE_EXISTS', 'Service code already exists');
      const data: Prisma.ServiceUncheckedUpdateInput = {};
      if (input.code !== undefined) data.code = input.code;
      if (input.name !== undefined) data.name = input.name;
      if (input.unit !== undefined) data.unit = input.unit;
      if (input.price !== undefined) data.price = input.price;
      if (input.description !== undefined) data.description = input.description;
      if (input.isActive !== undefined) data.isActive = input.isActive;
      const row = await r.updateService(scope.hotelId, id, data);
      await r.audit(scope, 'SERVICE_UPDATED', id);
      return serviceDto(row);
    });
  }
  async listOrders(scope: BillingScope, query: OrderQuery) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      const result = await r.orders(scope.hotelId, query);
      return pageResult(result.items.map(orderDto), result.total, query);
    });
  }
  async getOrder(scope: BillingScope, id: bigint) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      const row = await r.order(scope.hotelId, id);
      if (!row) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'Service order not found');
      return orderDto(row);
    });
  }
  async createOrder(scope: BillingScope, raw: CreateOrderInput) {
    this.authorize(scope, 'orders');
    const input = createOrderBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      const reservation = await r.reservation(scope.hotelId, BigInt(input.reservationId));
      if (!reservation) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
      const folio = await r.reservationFolio(scope.hotelId, reservation.id);
      if (folio) this.open(folio);
      if (!['CHECKED_IN', 'PARTIALLY_CHECKED_IN'].includes(reservation.status))
        throw new AppError(409, 'SERVICE_NOT_ALLOWED', 'Services require an active stay');
      if (input.stayId) {
        const stay = await r.stay(scope.hotelId, BigInt(input.stayId));
        if (!stay || stay.reservationRoom.reservationId !== reservation.id)
          throw new AppError(404, 'STAY_NOT_FOUND', 'Stay not found for this reservation');
        if (stay.status !== 'CHECKED_IN' || !stay.occupancy)
          throw new AppError(409, 'SERVICE_NOT_ALLOWED', 'Services require an active stay');
      } else if (!reservation.rooms.some((room) => room.stay?.status === 'CHECKED_IN'))
        throw new AppError(409, 'SERVICE_NOT_ALLOWED', 'Services require an active stay');
      const items: Prisma.ServiceOrderItemUncheckedCreateWithoutOrderInput[] = [];
      for (const line of input.items) {
        const service = await r.service(scope.hotelId, BigInt(line.serviceId));
        if (!service) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found');
        if (!service.isActive) throw new AppError(409, 'SERVICE_INACTIVE', 'Service is inactive');
        const price = checkedAmount(new Money(service.price));
        if (!price.isInteger())
          throw new AppError(409, 'INVALID_SERVICE_PRICE', 'Service price must be whole VND');
        items.push({
          serviceId: service.id,
          nameSnapshot: service.name,
          unitSnapshot: service.unit,
          quantity: line.quantity,
          unitPriceSnapshot: price,
          lineTotal: checkedAmount(price.mul(line.quantity)),
        });
      }
      const row = await r.createOrder({
        hotelId: scope.hotelId,
        reservationId: reservation.id,
        stayId: input.stayId ? BigInt(input.stayId) : null,
        notes: input.notes ?? null,
        createdBy: scope.actorId,
        items: { create: items },
      });
      await r.audit(scope, 'ORDER_REQUESTED', row.id);
      return orderDto(row);
    });
  }
  async completeOrder(scope: BillingScope, id: bigint) {
    this.authorize(scope, 'orders');
    return this.repository.write(scope.hotelId, async (r) => {
      const order = await r.order(scope.hotelId, id);
      if (!order) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'Service order not found');
      if (order.status === 'COMPLETED') return orderDto(order);
      if (order.status !== 'REQUESTED')
        throw new AppError(409, 'INVALID_ORDER_STATUS', 'Only requested orders can be completed');
      const folio = await r.reservationFolio(scope.hotelId, order.reservationId);
      if (!folio)
        throw new AppError(
          409,
          'FOLIO_NOT_OPEN',
          'Open the reservation folio before completing services',
        );
      this.open(folio);
      await r.createItems(
        order.items.map((item) => ({
          hotelId: scope.hotelId,
          folioId: folio.id,
          entryType: 'DEBIT',
          sourceType: 'SERVICE_ORDER_ITEM',
          sourceId: item.id,
          serviceOrderItemId: item.id,
          amount: item.lineTotal,
          description: `${item.nameSnapshot} (${item.quantity} ${item.unitSnapshot})`,
          createdBy: scope.actorId,
        })),
      );
      const row = await r.updateOrder(scope.hotelId, id, {
        status: 'COMPLETED',
        completedBy: scope.actorId,
        completedAt: new Date(),
      });
      await r.audit(scope, 'ORDER_COMPLETED', id);
      return orderDto(row);
    });
  }
  async cancelOrder(scope: BillingScope, id: bigint, rawReason: string) {
    this.authorize(scope, 'orders');
    const reason = reasonInput.parse(rawReason);
    return this.repository.write(scope.hotelId, async (r) => {
      const row = await r.order(scope.hotelId, id);
      if (!row) throw new AppError(404, 'SERVICE_ORDER_NOT_FOUND', 'Service order not found');
      if (row.status !== 'REQUESTED')
        throw new AppError(409, 'INVALID_ORDER_STATUS', 'Only requested orders can be cancelled');
      const result = await r.updateOrder(scope.hotelId, id, {
        status: 'CANCELLED',
        cancelledBy: scope.actorId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      });
      await r.audit(scope, 'ORDER_CANCELLED', id, reason);
      return orderDto(result);
    });
  }
  async openFolio(scope: BillingScope, reservationId: bigint) {
    this.authorize(scope, 'pay');
    return this.repository.write(scope.hotelId, async (r) => {
      const existing = await r.reservationFolio(scope.hotelId, reservationId);
      if (existing) return folioDto(existing, await this.balance(r, scope, existing.id));
      const reservation = await r.reservation(scope.hotelId, reservationId);
      if (!reservation) throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
      if (
        !['CONFIRMED', 'CHECKED_IN', 'PARTIALLY_CHECKED_IN', 'CHECKED_OUT'].includes(
          reservation.status,
        )
      )
        throw new AppError(
          409,
          'RESERVATION_NOT_BILLABLE',
          'Cannot open a folio for this reservation status',
        );
      if (reservation.currency !== 'VND')
        throw new AppError(409, 'UNSUPPORTED_CURRENCY', 'Only VND is supported');
      const expectedNights =
        (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86400000;
      if (
        !reservation.rooms.length ||
        !Number.isInteger(expectedNights) ||
        expectedNights <= 0 ||
        reservation.rooms.some(
          (room) =>
            room.nights.length !== expectedNights ||
            room.nights.some(
              (night, index) =>
                night.stayDate.getTime() !== reservation.checkInDate.getTime() + index * 86400000,
            ),
        )
      )
        throw new AppError(
          409,
          'ROOM_SNAPSHOTS_MISSING',
          'Reservation price snapshots are missing',
        );
      const folio = await r.createFolio(scope.hotelId, reservationId);
      await r.createItems(
        reservation.rooms.flatMap((room) =>
          room.nights.map((night) => ({
            hotelId: scope.hotelId,
            folioId: folio.id,
            entryType: 'DEBIT',
            sourceType: 'ROOM_NIGHT',
            sourceId: night.id,
            roomNightId: night.id,
            amount: roomCharge(night.nightlyRate),
            description: `Reservation room ${room.id}, ${night.stayDate.toISOString().slice(0, 10)}`,
            createdBy: scope.actorId,
          })),
        ),
      );
      await r.audit(scope, 'FOLIO_OPENED', folio.id);
      return folioDto(folio, await this.balance(r, scope, folio.id));
    });
  }
  async getFolio(scope: BillingScope, id: bigint, byReservation = false) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      const folio = byReservation
        ? await r.reservationFolio(scope.hotelId, id)
        : await r.folio(scope.hotelId, id);
      if (!folio)
        throw new AppError(404, 'FOLIO_NOT_FOUND', 'Folio not found; GET never opens a folio');
      return folioDto(folio, await this.balance(r, scope, folio.id));
    });
  }
  async listItems(scope: BillingScope, id: bigint, query: LedgerQuery) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      await this.requireFolio(r, scope, id);
      const result = await r.items(scope.hotelId, id, query);
      return pageResult(result.items.map(itemDto), result.total, query);
    });
  }
  async adjust(scope: BillingScope, id: bigint, raw: AdjustmentInput, key: string) {
    this.authorize(scope, 'settle');
    const input = adjustmentBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      const folio = await this.requireFolio(r, scope, id);
      return this.idempotent(r, scope, key, 'ADJUSTMENT', id, input, async () => {
        this.open(folio);
        const balance = await this.balance(r, scope, id);
        if (input.entryType === 'CREDIT' && new Money(input.amount).gt(balance.outstandingBalance))
          throw new AppError(
            409,
            'INSUFFICIENT_OUTSTANDING_BALANCE',
            'Credit must not create a negative balance; record an approved refund first if needed',
          );
        if (input.relatedItemId && !(await r.item(scope.hotelId, id, BigInt(input.relatedItemId))))
          throw new AppError(404, 'FOLIO_ITEM_NOT_FOUND', 'Related folio item not found');
        const item = await r.createItem({
          hotelId: scope.hotelId,
          folioId: id,
          entryType: input.entryType,
          sourceType: 'MANUAL_ADJUSTMENT',
          amount: input.amount,
          description: input.reason,
          relatedItemId: input.relatedItemId ? BigInt(input.relatedItemId) : null,
          createdBy: scope.actorId,
        });
        await r.audit(scope, 'FOLIO_ADJUSTED', item.id, input.reason);
        return itemDto(item);
      });
    });
  }
  async closeFolio(scope: BillingScope, id: bigint) {
    this.authorize(scope, 'settle');
    return this.repository.write(scope.hotelId, async (r) => {
      const folio = await this.requireFolio(r, scope, id);
      const balance = await this.balance(r, scope, id);
      if (folio.status === 'CLOSED') return folioDto(folio, balance);
      this.open(folio);
      if (!balance.outstandingBalance.isZero())
        throw new AppError(409, 'FOLIO_UNSETTLED', 'Folio balance must be exactly zero');
      if (
        (await r.pendingOrders(scope.hotelId, folio.reservationId)) ||
        (await r.pendingPayments(scope.hotelId, id))
      )
        throw new AppError(
          409,
          'FOLIO_PENDING_ACTIVITY',
          'Resolve pending orders and payments before closing',
        );
      const reservation = await r.reservation(scope.hotelId, folio.reservationId);
      if (
        !reservation ||
        !(
          reservation.status === 'CANCELLED' ||
          (reservation.status === 'CHECKED_OUT' &&
            reservation.rooms.every((room) => room.stay?.status === 'CHECKED_OUT'))
        )
      )
        throw new AppError(
          409,
          'STAYS_NOT_FINISHED',
          'All stays must end or the reservation must be cancelled',
        );
      const closed = await r.closeFolio(scope.hotelId, id);
      await r.audit(scope, 'FOLIO_CLOSED', id);
      return folioDto(closed, balance);
    });
  }
  async recordPayment(scope: BillingScope, id: bigint, raw: PaymentInput, key: string) {
    this.authorize(scope, 'pay');
    const input = paymentBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      const folio = await this.requireFolio(r, scope, id);
      return this.idempotent(
        r,
        scope,
        key,
        'PAYMENT',
        id,
        { ...input, referenceNumber: input.referenceNumber ?? null },
        async () => {
          this.open(folio);
          if (input.paymentType === 'DEPOSIT') {
            const reservation = await r.reservation(scope.hotelId, folio.reservationId);
            if (
              !reservation ||
              !['CONFIRMED', 'PARTIALLY_CHECKED_IN', 'CHECKED_IN'].includes(reservation.status)
            )
              throw new AppError(
                409,
                'DEPOSIT_NOT_ALLOWED',
                'Deposits require a confirmed reservation or active stay',
              );
          }
          if (await r.pendingPayments(scope.hotelId, id))
            throw new AppError(409, 'FOLIO_PENDING_ACTIVITY', 'Resolve pending payments first');
          const balance = await this.balance(r, scope, id);
          if (new Money(input.amount).gt(balance.outstandingBalance))
            throw new AppError(
              409,
              'INSUFFICIENT_OUTSTANDING_BALANCE',
              'Payment exceeds outstanding balance',
            );
          const payment = await r.createPayment({
            hotelId: scope.hotelId,
            folioId: id,
            paymentType: input.paymentType,
            paymentMethod: input.paymentMethod,
            amount: input.amount,
            status: 'CONFIRMED',
            referenceNumber: input.referenceNumber ?? null,
            processedBy: scope.actorId,
          });
          await r.audit(scope, `${input.paymentType}_RECORDED`, payment.id);
          return paymentDto(payment);
        },
      );
    });
  }
  async listPayments(scope: BillingScope, id: bigint, query: LedgerQuery) {
    this.authorize(scope, 'read');
    return this.repository.snapshot(async (r) => {
      await this.requireFolio(r, scope, id);
      const result = await r.payments(scope.hotelId, id, query);
      return pageResult(result.items.map(paymentDto), result.total, query);
    });
  }
  async refund(scope: BillingScope, id: bigint, raw: RefundInput, key: string) {
    this.authorize(scope, 'settle');
    const input = refundBody.parse(raw);
    return this.repository.write(scope.hotelId, async (r) => {
      const payment = await r.payment(scope.hotelId, id);
      if (!payment) throw new AppError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
      return this.idempotent(
        r,
        scope,
        key,
        'REFUND',
        id,
        { ...input, referenceNumber: input.referenceNumber ?? null },
        async () => {
          const folio = await this.requireFolio(r, scope, payment.folioId);
          this.open(folio);
          if (payment.status !== 'CONFIRMED' || payment.paymentType === 'REFUND')
            throw new AppError(
              409,
              'REFUND_NOT_ALLOWED',
              'Only confirmed receipts can be refunded',
            );
          if (payment.paymentMethod === 'BANK_TRANSFER' && !input.referenceNumber)
            throw new AppError(
              422,
              'REFUND_REFERENCE_REQUIRED',
              'Bank refunds require the actual outgoing transfer reference',
            );
          if (await r.pendingPayments(scope.hotelId, folio.id))
            throw new AppError(409, 'FOLIO_PENDING_ACTIVITY', 'Resolve pending payments first');
          const refunded = await r.refunds(scope.hotelId, id);
          const available = new Money(payment.amount).sub(refunded._sum.amount ?? 0);
          if (available.isZero())
            throw new AppError(409, 'PAYMENT_ALREADY_REFUNDED', 'Payment has been fully refunded');
          if (new Money(input.amount).gt(available))
            throw new AppError(
              409,
              'REFUND_AMOUNT_EXCEEDED',
              'Refund exceeds the unrefunded receipt amount',
            );
          const balance = await this.balance(r, scope, folio.id);
          if (new Money(input.amount).gt(balance.netPaid))
            throw new AppError(409, 'REFUND_NOT_ALLOWED', 'Refund exceeds net money received');
          // MVP manual approval by ADMIN/MANAGER/ACCOUNTANT with reason and actual refund attestation.
          // Returning a receipt increases debt; a separate authorized credit may reduce charges.
          const refund = await r.createPayment({
            hotelId: scope.hotelId,
            folioId: folio.id,
            paymentType: 'REFUND',
            paymentMethod: payment.paymentMethod,
            amount: input.amount,
            status: 'CONFIRMED',
            referenceNumber: input.referenceNumber ?? null,
            originalPaymentId: id,
            reason: input.reason,
            processedBy: scope.actorId,
          });
          await r.audit(scope, 'REFUND_RECORDED', refund.id, input.reason);
          return paymentDto(refund);
        },
      );
    });
  }
}
