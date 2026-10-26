import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  BillingOperations,
  BillingScope,
  LedgerQuery,
  OrderQuery,
  ServiceQuery,
} from './billing.types.js';

const orderInclude = {
  items: { orderBy: { id: 'asc' } },
  reservation: {
    select: {
      confirmationCode: true,
      bookerGuest: { select: { fullName: true } },
    },
  },
  stay: {
    select: {
      currentRoom: {
        select: {
          roomNumber: true,
          roomType: { select: { name: true } },
        },
      },
    },
  },
} as const;
export type OrderRecord = Prisma.ServiceOrderGetPayload<{ include: typeof orderInclude }>;

/**
 * One box for booking code, guest name or physical room. A numeric term is a
 * room-number prefix (so "2" finds 201/202 without also matching 102), never an
 * internal order/reservation/stay ID. Guest-name matching is optional because
 * only front-desk roles are allowed to search guests by name.
 */
function orderSearchFilters(
  search: string,
  matchGuestName: boolean,
): Prisma.ServiceOrderWhereInput[] {
  if (/^\d+$/.test(search))
    return [{ stay: { currentRoom: { roomNumber: { startsWith: search } } } }];

  const filters: Prisma.ServiceOrderWhereInput[] = [
    { reservation: { confirmationCode: { contains: search } } },
    { stay: { currentRoom: { roomNumber: { contains: search } } } },
  ];
  if (matchGuestName)
    filters.push({ reservation: { bookerGuest: { fullName: { contains: search } } } });
  return filters;
}

export class PrismaBillingRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  async write<T>(
    hotelId: bigint,
    action: (repository: BillingOperations) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // Same first lock as Reservation/Stay writes. Includes orders created before a folio.
            const hotels = await tx.$queryRaw<
              { id: bigint }[]
            >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
            if (!hotels.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
            return action(new PrismaBillingRepository(this.prisma, tx));
          },
          { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 },
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          // Only replay transactions for which the database guarantees rollback.
          if (error.code === 'P2034' && attempt < 2) {
            await delay(25 * (attempt + 1));
            continue;
          }
          if (['P2002', 'P2003', 'P2024', 'P2025', 'P2028', 'P2034'].includes(error.code))
            throw new AppError(
              409,
              'FINANCIAL_CONFLICT',
              'Financial conflict; retry with the same idempotency key',
            );
        }
        throw error;
      }
    }
  }
  snapshot<T>(action: (repository: BillingOperations) => Promise<T>) {
    return this.prisma.$transaction((tx) => action(new PrismaBillingRepository(this.prisma, tx)), {
      isolationLevel: 'RepeatableRead',
      timeout: 20000,
    });
  }
  service(hotelId: bigint, id: bigint) {
    return this.db.service.findFirst({ where: { hotelId, id } });
  }
  serviceCode(hotelId: bigint, code: string, exclude?: bigint) {
    return this.db.service.findFirst({
      where: { hotelId, code, ...(exclude ? { id: { not: exclude } } : {}) },
    });
  }
  async services(hotelId: bigint, query: ServiceQuery) {
    const where: Prisma.ServiceWhereInput = {
      hotelId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }
        : {}),
    };
    return {
      items: await this.db.service.findMany({
        where,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      total: await this.db.service.count({ where }),
    };
  }
  createService(data: Prisma.ServiceUncheckedCreateInput) {
    return this.db.service.create({ data });
  }
  updateService(hotelId: bigint, id: bigint, data: Prisma.ServiceUncheckedUpdateInput) {
    return this.db.service.update({ where: { id, hotelId }, data });
  }
  reservation(hotelId: bigint, id: bigint) {
    return this.db.reservation.findFirst({
      where: { hotelId, id },
      include: { rooms: { include: { nights: { orderBy: { stayDate: 'asc' } }, stay: true } } },
    });
  }
  stay(hotelId: bigint, id: bigint) {
    return this.db.stay.findFirst({
      where: { hotelId, id },
      include: { reservationRoom: { select: { reservationId: true } }, occupancy: true },
    });
  }
  order(hotelId: bigint, id: bigint) {
    return this.db.serviceOrder.findFirst({ where: { hotelId, id }, include: orderInclude });
  }
  async orders(
    hotelId: bigint,
    query: OrderQuery,
    options: { matchGuestName: boolean } = { matchGuestName: true },
  ) {
    const where: Prisma.ServiceOrderWhereInput = {
      hotelId,
      ...(query.reservationId ? { reservationId: BigInt(query.reservationId) } : {}),
      ...(query.stayId ? { stayId: BigInt(query.stayId) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { OR: orderSearchFilters(query.search, options.matchGuestName) } : {}),
    };
    return {
      items: await this.db.serviceOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      total: await this.db.serviceOrder.count({ where }),
    };
  }
  createOrder(data: Prisma.ServiceOrderUncheckedCreateInput) {
    return this.db.serviceOrder.create({ data, include: orderInclude });
  }
  updateOrder(hotelId: bigint, id: bigint, data: Prisma.ServiceOrderUncheckedUpdateInput) {
    return this.db.serviceOrder.update({
      where: { id, hotelId, status: 'REQUESTED' },
      data,
      include: orderInclude,
    });
  }
  pendingOrders(hotelId: bigint, reservationId: bigint) {
    return this.db.serviceOrder.count({ where: { hotelId, reservationId, status: 'REQUESTED' } });
  }
  folio(hotelId: bigint, id: bigint) {
    return this.db.folio.findFirst({ where: { hotelId, id } });
  }
  reservationFolio(hotelId: bigint, reservationId: bigint) {
    return this.db.folio.findFirst({ where: { hotelId, reservationId } });
  }
  createFolio(hotelId: bigint, reservationId: bigint) {
    return this.db.folio.create({ data: { hotelId, reservationId, currency: 'VND' } });
  }
  closeFolio(hotelId: bigint, id: bigint) {
    return this.db.folio.update({
      where: { hotelId, id, status: 'OPEN' },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
  item(hotelId: bigint, folioId: bigint, id: bigint) {
    return this.db.folioItem.findFirst({ where: { hotelId, folioId, id } });
  }
  createItem(data: Prisma.FolioItemUncheckedCreateInput) {
    return this.db.folioItem.create({ data });
  }
  createItems(data: Prisma.FolioItemCreateManyInput[]) {
    return this.db.folioItem.createMany({ data });
  }
  async items(hotelId: bigint, folioId: bigint, query: LedgerQuery) {
    const where = { hotelId, folioId };
    return {
      items: await this.db.folioItem.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      total: await this.db.folioItem.count({ where }),
    };
  }
  async ledger(hotelId: bigint, folioId: bigint) {
    // Aggregate by entry category in SQL, then calculate with Decimal. No mutable balance column.
    const items = await this.db.folioItem.groupBy({
      by: ['entryType'],
      where: { hotelId, folioId },
      _sum: { amount: true },
    });
    const payments = await this.db.payment.groupBy({
      by: ['paymentType', 'status'],
      where: { hotelId, folioId },
      _sum: { amount: true },
    });
    return {
      items: items.map((item) => ({
        entryType: item.entryType,
        amount: item._sum.amount ?? new Prisma.Decimal(0),
      })),
      payments: payments.map((payment) => ({
        paymentType: payment.paymentType,
        status: payment.status,
        amount: payment._sum.amount ?? new Prisma.Decimal(0),
      })),
    };
  }
  payment(hotelId: bigint, id: bigint) {
    return this.db.payment.findFirst({ where: { hotelId, id } });
  }
  createPayment(data: Prisma.PaymentUncheckedCreateInput) {
    return this.db.payment.create({ data });
  }
  refunds(hotelId: bigint, originalPaymentId: bigint) {
    return this.db.payment.aggregate({
      where: {
        hotelId,
        originalPaymentId,
        paymentType: 'REFUND',
        status: { in: ['CONFIRMED', 'PENDING'] },
      },
      _sum: { amount: true },
    });
  }
  pendingPayments(hotelId: bigint, folioId: bigint) {
    return this.db.payment.count({ where: { hotelId, folioId, status: 'PENDING' } });
  }
  async payments(hotelId: bigint, folioId: bigint, query: LedgerQuery) {
    const where = { hotelId, folioId };
    return {
      items: await this.db.payment.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      total: await this.db.payment.count({ where }),
    };
  }
  key(hotelId: bigint, keyHash: string) {
    return this.db.billingIdempotency.findUnique({
      where: { hotelId_keyHash: { hotelId, keyHash } },
    });
  }
  saveKey(hotelId: bigint, keyHash: string, requestHash: string, response: Prisma.InputJsonValue) {
    return this.db.billingIdempotency.create({ data: { hotelId, keyHash, requestHash, response } });
  }
  audit(scope: BillingScope, action: string, entityId: bigint, reason: string | null = null) {
    return this.db.billingAuditLog.create({
      data: { hotelId: scope.hotelId, actorId: scope.actorId, action, entityId, reason },
    });
  }
}
