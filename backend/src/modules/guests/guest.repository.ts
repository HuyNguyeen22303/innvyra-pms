import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { GuestAudit, GuestOperations, GuestQuery, GuestWrite } from './guest.types.js';

function filter(hotelId: bigint, query: GuestQuery): Prisma.GuestWhereInput {
  return {
    hotelId,
    deletedAt: null,
    ...(query.search ? { fullName: { contains: query.search } } : {}),
    ...(query.nationality ? { nationality: query.nationality } : {}),
  };
}
export class PrismaGuestRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  async withHotelLock<T>(
    hotelId: bigint,
    action: (repository: GuestOperations) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const hotels = await tx.$queryRaw<
            { id: bigint }[]
          >`SELECT id FROM hotels WHERE id = ${hotelId} FOR UPDATE`;
          if (!hotels.length) throw new AppError(404, 'HOTEL_NOT_FOUND', 'Hotel not found');
          return action(new PrismaGuestRepository(this.prisma, tx));
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') throw new AppError(404, 'GUEST_NOT_FOUND', 'Guest not found');
        if (error.code === 'P2003')
          throw new AppError(409, 'GUEST_REFERENCE_CONFLICT', 'Related record is unavailable');
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
    return this.db.guest.findFirst({ where: { hotelId, id, deletedAt: null } });
  }
  async findMany(hotelId: bigint, query: GuestQuery) {
    return this.db.guest.findMany({
      where: filter(hotelId, query),
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // List queries never fetch identity documents, DOB, address or private notes.
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        nationality: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async count(hotelId: bigint, query: GuestQuery) {
    return this.db.guest.count({ where: filter(hotelId, query) });
  }
  list(hotelId: bigint, query: GuestQuery) {
    return this.prisma.$transaction(
      async (tx) => {
        const repository = new PrismaGuestRepository(this.prisma, tx);
        return {
          items: await repository.findMany(hotelId, query),
          total: await repository.count(hotelId, query),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async create(hotelId: bigint, input: GuestWrite) {
    return this.db.guest.create({ data: { ...input, hotelId } });
  }
  async update(hotelId: bigint, id: bigint, input: Partial<GuestWrite>) {
    return this.db.guest.update({ where: { id, hotelId, deletedAt: null }, data: input });
  }
  async softDelete(hotelId: bigint, id: bigint) {
    // Always retain the primary key and every reference, including future booking/payment links.
    return this.db.guest.update({
      where: { id, hotelId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
  async findPossibleDuplicates(
    hotelId: bigint,
    input: Pick<GuestWrite, 'fullName' | 'phone' | 'email' | 'documentNumberHash' | 'documentType'>,
    excludeId?: bigint,
  ) {
    const OR: Prisma.GuestWhereInput[] = [{ fullName: input.fullName }];
    if (input.phone) OR.push({ phone: input.phone });
    if (input.email) OR.push({ email: input.email });
    if (input.documentNumberHash)
      OR.push({ documentNumberHash: input.documentNumberHash, documentType: input.documentType });
    return this.db.guest.findMany({
      where: {
        hotelId,
        deletedAt: null,
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
        OR,
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 5,
    });
  }
  async audit(hotelId: bigint, input: GuestAudit): Promise<void> {
    await this.db.guestAuditLog.create({ data: { ...input, hotelId } });
  }
}
