import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../../shared/utils/password.js';
import { pageResult } from '../../shared/validation/room-input.js';
import { generateTemporaryPassword } from '../employees/employee.service.js';
import type {
  CreateHotelAdminInput,
  CreateHotelInput,
  HotelListQuery,
  UpdateHotelInput,
} from './hotel.schema.js';

const profileSelect = {
  id: true,
  code: true,
  name: true,
  timezone: true,
  status: true,
  contactEmail: true,
  contactPhone: true,
  address: true,
} as const;
const hotelSelect = {
  ...profileSelect,
  agreementReference: true,
  suspendedAt: true,
  suspensionReason: true,
} as const;
const adminSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  createdAt: true,
} as const;
const periodSelect = {
  id: true,
  planName: true,
  startsOn: true,
  endsOn: true,
  feeAmount: true,
  currency: true,
  agreementReference: true,
  paymentReference: true,
  notes: true,
  createdAt: true,
} as const;
const missing = () => new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
const transactionOptions = {
  isolationLevel: 'ReadCommitted',
  maxWait: 5000,
  timeout: 10000,
} as const;
function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}

// Deliberate allowlists: no hotel operational data, password hash or session/token fields.
export class HotelManagementService {
  constructor(private readonly prisma: PrismaClient) {}

  private async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(action, transactionOptions);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new AppError(
            409,
            'DUPLICATE_ENTRY',
            'Hotel code, username or email already exists',
          );
        if (error.code === 'P2034')
          throw new AppError(
            409,
            'CONCURRENT_MODIFICATION',
            'Concurrent change; retry the request',
          );
        if (error.code === 'P2003')
          throw new AppError(409, 'REFERENCE_CONFLICT', 'Related account or hotel is unavailable');
      }
      throw error;
    }
  }
  private async lockHotel(tx: Prisma.TransactionClient, id: bigint) {
    const rows = await tx.$queryRaw<
      { id: bigint }[]
    >`SELECT id FROM hotels WHERE id = ${id} FOR UPDATE`;
    if (!rows.length) throw missing();
  }
  private async createAdmin(
    tx: Prisma.TransactionClient,
    hotelId: bigint,
    input: CreateHotelAdminInput,
    passwordHash: string,
  ) {
    const role = await tx.role.findUnique({ where: { code: 'ADMIN' } });
    if (!role)
      throw new AppError(409, 'ROLE_MISSING', 'Initialize system roles before onboarding a hotel');
    return tx.staffUser.create({
      data: { ...input, hotelId, roleId: role.id, passwordHash, mustChangePassword: true },
      select: adminSelect,
    });
  }
  async create(actorId: bigint, input: CreateHotelInput) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const { admin, subscription, ...hotel } = input;
    const result = await this.transaction(async (tx) => {
      const record = await tx.hotel.create({ data: defined(hotel), select: hotelSelect });
      const staff = await this.createAdmin(tx, record.id, admin, passwordHash);
      const period = await tx.hotelSubscriptionPeriod.create({
        data: defined({
          ...subscription,
          startsOn: new Date(`${subscription.startsOn}T00:00:00Z`),
          endsOn: new Date(`${subscription.endsOn}T00:00:00Z`),
          hotelId: record.id,
          recordedById: actorId,
        }),
        select: periodSelect,
      });
      await tx.platformAuditLog.createMany({
        data: [
          {
            hotelId: record.id,
            actorId,
            action: 'HOTEL_CREATED',
            changes: { code: record.code, name: record.name, timezone: record.timezone },
          },
          {
            hotelId: record.id,
            actorId,
            action: 'HOTEL_ADMIN_CREATED',
            targetStaffUserId: staff.id,
          },
          {
            hotelId: record.id,
            actorId,
            action: 'SUBSCRIPTION_PERIOD_RECORDED',
            subscriptionPeriodId: period.id,
          },
        ],
      });
      return { hotel: record, admin: staff, subscription: period };
    });
    return { ...result, temporaryPassword };
  }
  async list(query: HotelListQuery) {
    const where: Prisma.HotelWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search } },
              { name: { contains: query.search } },
              { contactEmail: { contains: query.search } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.hotel.findMany({
        where,
        select: hotelSelect,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hotel.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async detail(id: bigint) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id },
      select: {
        ...hotelSelect,
        staff: { where: { role: { code: 'ADMIN' } }, select: adminSelect, orderBy: { id: 'asc' } },
        subscriptionPeriods: {
          select: periodSelect,
          orderBy: [{ startsOn: 'desc' }, { id: 'desc' }],
          take: 50,
        },
        platformAudits: {
          select: {
            id: true,
            action: true,
            reason: true,
            changes: true,
            targetStaffUserId: true,
            subscriptionPeriodId: true,
            createdAt: true,
            actor: { select: { fullName: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        },
      },
    });
    if (!hotel) throw missing();
    return hotel;
  }
  async update(actorId: bigint, id: bigint, input: UpdateHotelInput) {
    return this.transaction(async (tx) => {
      await this.lockHotel(tx, id);
      const before = await tx.hotel.findUniqueOrThrow({ where: { id }, select: hotelSelect });
      const hotel = await tx.hotel.update({
        where: { id },
        data: defined(input),
        select: hotelSelect,
      });
      // JSON roundtrip removes Date/BigInt and restricts changes to permitted input keys.
      const changes = Object.fromEntries(
        Object.keys(input).map((key) => [
          key,
          {
            before: before[key as keyof UpdateHotelInput] ?? null,
            after: hotel[key as keyof UpdateHotelInput] ?? null,
          },
        ]),
      );
      await tx.platformAuditLog.create({
        data: { hotelId: id, actorId, action: 'HOTEL_UPDATED', changes },
      });
      return hotel;
    });
  }
  async addAdmin(actorId: bigint, hotelId: bigint, input: CreateHotelAdminInput) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const admin = await this.transaction(async (tx) => {
      await this.lockHotel(tx, hotelId);
      const record = await this.createAdmin(tx, hotelId, input, passwordHash);
      await tx.platformAuditLog.create({
        data: { hotelId, actorId, action: 'HOTEL_ADMIN_CREATED', targetStaffUserId: record.id },
      });
      return record;
    });
    return { admin, temporaryPassword };
  }
  async resetAdmin(actorId: bigint, hotelId: bigint, staffId: bigint, reason: string) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const admin = await this.transaction(async (tx) => {
      await this.lockHotel(tx, hotelId);
      const staff = await tx.staffUser.findFirst({
        where: { id: staffId, hotelId, role: { code: 'ADMIN' } },
        select: { id: true },
      });
      if (!staff) throw new AppError(404, 'HOTEL_ADMIN_NOT_FOUND', 'Hotel administrator not found');
      const record = await tx.staffUser.update({
        where: { id: staffId },
        data: { passwordHash, mustChangePassword: true },
        select: adminSelect,
      });
      await tx.authSession.updateMany({
        where: { staffUserId: staffId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
      });
      await tx.platformAuditLog.create({
        data: {
          hotelId,
          actorId,
          action: 'HOTEL_ADMIN_PASSWORD_RESET',
          targetStaffUserId: staffId,
          reason,
        },
      });
      return record;
    });
    return { admin, temporaryPassword };
  }
  async ownProfile(hotelId: bigint) {
    const hotel = await this.prisma.hotel.findUnique({
      where: { id: hotelId },
      select: profileSelect,
    });
    if (!hotel) throw missing();
    return hotel;
  }
  async updateOwn(
    hotelId: bigint,
    input: Pick<UpdateHotelInput, 'name' | 'address' | 'contactEmail' | 'contactPhone'>,
  ) {
    return this.transaction(async (tx) => {
      await this.lockHotel(tx, hotelId);
      return tx.hotel.update({
        where: { id: hotelId },
        data: defined(input),
        select: profileSelect,
      });
    });
  }
}
