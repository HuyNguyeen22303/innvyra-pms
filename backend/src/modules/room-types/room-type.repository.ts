import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { roomTransaction } from '../../database/room-transaction.js';
import type {
  CreateRoomTypeInput,
  UpdateRoomTypeInput,
  RoomTypeQuery,
  RoomTypeOperations,
} from './room-type.types.js';

export class PrismaRoomTypeRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  withHotelLock<T>(
    hotelId: bigint,
    action: (repository: RoomTypeOperations) => Promise<T>,
  ): Promise<T> {
    return roomTransaction(
      this.prisma,
      hotelId,
      'ROOM_TYPE_CODE_EXISTS',
      'Room type code already exists',
      (tx) => action(new PrismaRoomTypeRepository(this.prisma, tx)),
    );
  }
  async findById(hotelId: bigint, id: bigint) {
    return this.db.roomType.findFirst({ where: { hotelId, id } });
  }
  async findByCode(hotelId: bigint, code: string) {
    return this.db.roomType.findUnique({ where: { hotelId_code: { hotelId, code } } });
  }
  async countActiveRooms(hotelId: bigint, roomTypeId: bigint) {
    return this.db.room.count({ where: { hotelId, roomTypeId, isActive: true } });
  }
  async list(hotelId: bigint, query: RoomTypeQuery) {
    const where: Prisma.RoomTypeWhereInput = {
      hotelId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? { OR: [{ code: { contains: query.search } }, { name: { contains: query.search } }] }
        : {}),
    };
    // One consistent snapshot for the page and its total.
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.roomType.findMany({
          where,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.roomType.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  async create(hotelId: bigint, input: CreateRoomTypeInput) {
    return this.db.roomType.create({
      data: {
        ...input,
        description: input.description ?? null,
        hotelId,
        basePrice: new Prisma.Decimal(input.basePrice),
      },
    });
  }
  async update(hotelId: bigint, id: bigint, input: UpdateRoomTypeInput) {
    const data: Prisma.RoomTypeUncheckedUpdateInput = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.maxAdults !== undefined) data.maxAdults = input.maxAdults;
    if (input.maxChildren !== undefined) data.maxChildren = input.maxChildren;
    if (input.basePrice !== undefined) data.basePrice = new Prisma.Decimal(input.basePrice);
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.db.roomType.update({ where: { id, hotelId }, data });
  }
}
