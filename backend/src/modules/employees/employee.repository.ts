import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { EmployeeQuery } from './employee.types.js';

const staffInclude = { role: true } as const;

function filter(hotelId: bigint, query: EmployeeQuery): Prisma.StaffUserWhereInput {
  return {
    hotelId,
    ...(query.search
      ? {
          OR: [
            { fullName: { contains: query.search } },
            { username: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        }
      : {}),
    ...(query.role ? { role: { code: query.role } } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
  };
}

export class PrismaEmployeeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}

  private get db() {
    return this.tx ?? this.prisma;
  }

  async withHotelLock<T>(
    hotelId: bigint,
    action: (repository: PrismaEmployeeRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const hotels = await tx.$queryRaw<
            { id: bigint }[]
          >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
          if (!hotels.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
          return action(new PrismaEmployeeRepository(this.prisma, tx));
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta as { target?: string[] })?.target;
          if (target?.includes('username'))
            throw new AppError(409, 'USERNAME_EXISTS', 'Username already exists');
          if (target?.includes('email'))
            throw new AppError(409, 'EMAIL_EXISTS', 'Email already exists');
          throw new AppError(409, 'DUPLICATE_ENTRY', 'Duplicate entry');
        }
        if (error.code === 'P2025')
          throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
        if (error.code === 'P2003')
          throw new AppError(409, 'EMPLOYEE_REFERENCE_CONFLICT', 'Related record is unavailable');
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

  async findById(hotelId: bigint, id: bigint) {
    return this.db.staffUser.findFirst({
      where: { hotelId, id },
      include: staffInclude,
    });
  }

  async findByUsername(username: string) {
    return this.db.staffUser.findUnique({
      where: { username },
      include: staffInclude,
    });
  }

  async findByEmail(email: string) {
    return this.db.staffUser.findUnique({
      where: { email },
      include: staffInclude,
    });
  }

  async findRoleByCode(code: string) {
    return this.db.role.findUnique({ where: { code } });
  }

  async create(data: {
    hotelId: bigint;
    roleId: bigint;
    fullName: string;
    username: string;
    email: string | null;
    passwordHash: string;
  }) {
    return this.db.staffUser.create({
      data: {
        hotelId: data.hotelId,
        roleId: data.roleId,
        fullName: data.fullName,
        username: data.username,
        email: data.email ?? null,
        passwordHash: data.passwordHash,
      },
      include: staffInclude,
    });
  }

  async update(hotelId: bigint, id: bigint, data: Prisma.StaffUserUpdateInput) {
    return this.db.staffUser.update({
      where: { hotelId_id: { hotelId, id } },
      data,
      include: staffInclude,
    });
  }

  async deactivate(hotelId: bigint, id: bigint) {
    return this.db.staffUser.update({
      where: { hotelId_id: { hotelId, id } },
      data: { isActive: false },
      include: staffInclude,
    });
  }

  async revokeAllSessions(staffUserId: bigint, now: Date, reason: string) {
    await this.db.authSession.updateMany({
      where: { staffUserId, revokedAt: null },
      data: { revokedAt: now, revokedReason: reason },
    });
  }

  async countActiveByRoleInHotel(hotelId: bigint, roleCode: string) {
    return this.db.staffUser.count({
      where: {
        hotelId,
        isActive: true,
        role: { code: roleCode },
      },
    });
  }

  async findMany(hotelId: bigint, query: EmployeeQuery) {
    return this.db.staffUser.findMany({
      where: filter(hotelId, query),
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        isActive: true,
        createdAt: true,
        role: { select: { code: true, name: true } },
      },
    });
  }

  async count(hotelId: bigint, query: EmployeeQuery) {
    return this.db.staffUser.count({ where: filter(hotelId, query) });
  }

  list(hotelId: bigint, query: EmployeeQuery) {
    return this.prisma.$transaction(
      async (tx) => {
        const repository = new PrismaEmployeeRepository(this.prisma, tx);
        return {
          items: await repository.findMany(hotelId, query),
          total: await repository.count(hotelId, query),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
