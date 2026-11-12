import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import {
  asDate,
  dateOnly,
  localDay,
  periodEnd,
  subscriptionTiming,
} from './subscription-calendar.js';
import { currentPeriod } from './subscription-capacity.js';
import type { MonthlyPeriodInput, PlanInput } from './subscription.schema.js';

const clean = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? String(v) : v)));
export const subscriptionPeriodSelect = {
  id: true,
  planId: true,
  planName: true,
  monthlyPrice: true,
  monthCount: true,
  roomLimit: true,
  staffLimit: true,
  startsOn: true,
  endsOn: true,
  feeAmount: true,
  currency: true,
  agreementReference: true,
  paymentReference: true,
  notes: true,
  createdAt: true,
} as const;
export class SubscriptionService {
  constructor(private readonly prisma: PrismaClient) {}
  async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>) {
    try {
      return await this.prisma.$transaction(action, {
        isolationLevel: 'ReadCommitted',
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new AppError(409, 'PLAN_CODE_EXISTS', 'Plan code already exists');
        if (error.code === 'P2034')
          throw new AppError(
            409,
            'CONCURRENT_MODIFICATION',
            'Concurrent change; retry the request',
          );
      }
      throw error;
    }
  }
  async lockHotel(tx: Prisma.TransactionClient, id: bigint) {
    const rows = await tx.$queryRaw<
      { id: bigint }[]
    >`SELECT id FROM hotels WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
    return tx.hotel.findUniqueOrThrow({ where: { id } });
  }
  plans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { id: 'asc' } });
  }
  createPlan(actorId: bigint, input: PlanInput) {
    return this.transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: { ...input, description: input.description ?? null },
      });
      await tx.subscriptionPlanAudit.create({
        data: { planId: plan.id, actorId, changes: json({ after: plan }) },
      });
      return plan;
    });
  }
  updatePlan(actorId: bigint, id: bigint, input: Partial<Omit<PlanInput, 'code'>>) {
    return this.transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: bigint }[]
      >`SELECT id FROM subscription_plans WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found');
      const before = await tx.subscriptionPlan.findUniqueOrThrow({ where: { id } });
      const after = await tx.subscriptionPlan.update({ where: { id }, data: clean(input) });
      await tx.subscriptionPlanAudit.create({
        data: { planId: id, actorId, changes: json({ before, after }) },
      });
      return after;
    });
  }
  // Hotel lock is held by both onboarding and subsequent renewals.
  async recordInTransaction(
    tx: Prisma.TransactionClient,
    actorId: bigint,
    hotelId: bigint,
    input: MonthlyPeriodInput,
  ) {
    const planId = BigInt(input.planId);
    await tx.$queryRaw`SELECT id FROM subscription_plans WHERE id = ${planId} FOR UPDATE`;
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive)
      throw new AppError(409, 'PLAN_UNAVAILABLE', 'Choose an active subscription plan');
    const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId } });
    if (input.startsOn < localDay(hotel.timezone))
      throw new AppError(422, 'PERIOD_IN_PAST', 'New service periods must start today or later');
    const startsOn = asDate(input.startsOn);
    const endsOn = periodEnd(input.startsOn, input.monthCount);
    const overlap = await tx.hotelSubscriptionPeriod.findFirst({
      where: { hotelId, startsOn: { lte: endsOn }, endsOn: { gte: startsOn } },
    });
    if (overlap)
      throw new AppError(
        409,
        'SUBSCRIPTION_OVERLAP',
        'Service period overlaps a recorded period; choose a date after its end',
      );
    const [rooms, staff] = await Promise.all([
      tx.room.count({ where: { hotelId, isActive: true } }),
      tx.staffUser.count({ where: { hotelId, isActive: true } }),
    ]);
    if (rooms > plan.roomLimit || staff > plan.staffLimit)
      throw new AppError(
        409,
        'PLAN_BELOW_USAGE',
        'Deactivate surplus rooms or accounts before choosing this plan',
      );
    const feeAmount = plan.monthlyPrice.mul(input.monthCount);
    if (feeAmount.greaterThan('999999999999.99'))
      throw new AppError(422, 'FEE_TOO_LARGE', 'Total subscription fee exceeds supported range');
    const period = await tx.hotelSubscriptionPeriod.create({
      data: {
        hotelId,
        recordedById: actorId,
        planId,
        planName: plan.name,
        monthlyPrice: plan.monthlyPrice,
        monthCount: input.monthCount,
        roomLimit: plan.roomLimit,
        staffLimit: plan.staffLimit,
        startsOn,
        endsOn,
        feeAmount,
        agreementReference: input.agreementReference ?? null,
        paymentReference: input.paymentReference ?? null,
        notes: input.notes ?? null,
      },
      select: subscriptionPeriodSelect,
    });
    await tx.platformAuditLog.create({
      data: {
        hotelId,
        actorId,
        action: 'SUBSCRIPTION_PERIOD_RECORDED',
        subscriptionPeriodId: period.id,
        reason: input.reason,
        changes: json({ effectiveOn: input.startsOn, planId, feeAmount }),
      },
    });
    return period;
  }
  record(actorId: bigint, hotelId: bigint, input: MonthlyPeriodInput) {
    return this.transaction(async (tx) => {
      await this.lockHotel(tx, hotelId);
      return this.recordInTransaction(tx, actorId, hotelId, input);
    });
  }
  setStatus(actorId: bigint, hotelId: bigint, status: 'ACTIVE' | 'SUSPENDED', reason: string) {
    return this.transaction(async (tx) => {
      const before = await this.lockHotel(tx, hotelId);
      if (before.status === status)
        throw new AppError(409, 'HOTEL_STATUS_UNCHANGED', 'Hotel already has this status');
      const hotel = await tx.hotel.update({
        where: { id: hotelId },
        data: {
          status,
          suspendedAt: status === 'SUSPENDED' ? new Date() : null,
          suspensionReason: status === 'SUSPENDED' ? reason : null,
        },
        select: { id: true, status: true, suspendedAt: true, suspensionReason: true },
      });
      await tx.platformAuditLog.create({
        data: {
          actorId,
          hotelId,
          action: status === 'SUSPENDED' ? 'HOTEL_SUSPENDED' : 'HOTEL_REACTIVATED',
          reason,
          changes: { before: before.status, after: status },
        },
      });
      return hotel;
    });
  }
  async summary(hotelId: bigint) {
    return this.prisma.$transaction(
      async (tx) => {
        const hotel = await tx.hotel.findUnique({
          where: { id: hotelId },
          select: { id: true, status: true, timezone: true, suspensionReason: true },
        });
        if (!hotel) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
        const current = await currentPeriod(tx, hotelId, hotel.timezone);
        const upcoming = await tx.hotelSubscriptionPeriod.findFirst({
          where: { hotelId, startsOn: { gt: asDate(localDay(hotel.timezone)) } },
          orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
          select: subscriptionPeriodSelect,
        });
        const history = await tx.hotelSubscriptionPeriod.findMany({
          where: { hotelId },
          orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
          take: 100,
          select: subscriptionPeriodSelect,
        });
        const rooms = await tx.room.count({ where: { hotelId, isActive: true } });
        const staff = await tx.staffUser.count({ where: { hotelId, isActive: true } });
        const selected = current ?? upcoming;
        const timing = selected
          ? subscriptionTiming(selected.startsOn, selected.endsOn, localDay(hotel.timezone))
          : { status: 'UNCONFIGURED', daysRemaining: null, alert: null };
        const safeCurrent = current
          ? Object.fromEntries(
              Object.keys(subscriptionPeriodSelect).map((key) => [
                key,
                current[key as keyof typeof current],
              ]),
            )
          : null;
        return {
          id: hotel.id,
          today: localDay(hotel.timezone),
          hotelStatus: hotel.status,
          timezone: hotel.timezone,
          suspensionReason: hotel.suspensionReason,
          ...timing,
          current: safeCurrent,
          upcoming,
          usage: {
            rooms,
            staff,
            roomLimit: current?.roomLimit ?? null,
            staffLimit: current?.staffLimit ?? null,
          },
          history,
          nextStartsOn: history[0]
            ? dateOnly(new Date(history[0].endsOn.getTime() + 86400000))
            : localDay(hotel.timezone),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
