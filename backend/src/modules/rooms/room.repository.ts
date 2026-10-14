import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { roomTransaction } from '../../database/room-transaction.js';
import type { CreateRoomInput, UpdateRoomInput, RoomQuery, RoomOperations } from './room.types.js';

const include = {
  roomType: { select: { id: true, code: true, name: true, isActive: true } },
} as const;
export class PrismaRoomRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tx?: Prisma.TransactionClient,
  ) {}
  private get db() {
    return this.tx ?? this.prisma;
  }
  withHotelLock<T>(
    hotelId: bigint,
    action: (repository: RoomOperations) => Promise<T>,
  ): Promise<T> {
    return roomTransaction(
      this.prisma,
      hotelId,
      'ROOM_NUMBER_EXISTS',
      'Room number already exists',
      (tx) => action(new PrismaRoomRepository(this.prisma, tx)),
    );
  }
  async findById(hotelId: bigint, id: bigint) {
    return this.db.room.findFirst({ where: { hotelId, id }, include });
  }
  async findByNumber(hotelId: bigint, roomNumber: string) {
    return this.db.room.findUnique({
      where: { hotelId_roomNumber: { hotelId, roomNumber } },
      include,
    });
  }
  async findRoomType(hotelId: bigint, id: bigint) {
    return this.db.roomType.findFirst({ where: { hotelId, id } });
  }
  async list(hotelId: bigint, query: RoomQuery) {
    const where: Prisma.RoomWhereInput = {
      hotelId,
      ...(query.search ? { roomNumber: { contains: query.search } } : {}),
      ...(query.roomTypeId !== undefined ? { roomTypeId: BigInt(query.roomTypeId) } : {}),
      ...(query.floorNumber !== undefined ? { floorNumber: query.floorNumber } : {}),
      ...(query.physicalStatus !== undefined ? { physicalStatus: query.physicalStatus } : {}),
      ...(query.housekeepingStatus !== undefined
        ? { housekeepingStatus: query.housekeepingStatus }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const [items, total] = await this.prisma.$transaction(
      [
        this.prisma.room.findMany({
          where,
          include,
          orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.room.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return { items, total };
  }
  async create(hotelId: bigint, input: CreateRoomInput) {
    return this.db.room.create({
      data: { ...input, notes: input.notes ?? null, hotelId, roomTypeId: BigInt(input.roomTypeId) },
      include,
    });
  }
  async update(hotelId: bigint, id: bigint, input: UpdateRoomInput) {
    const data: Prisma.RoomUncheckedUpdateInput = {};
    if (input.roomNumber !== undefined) data.roomNumber = input.roomNumber;
    if (input.floorNumber !== undefined) data.floorNumber = input.floorNumber;
    if (input.roomTypeId !== undefined) data.roomTypeId = BigInt(input.roomTypeId);
    if (input.physicalStatus !== undefined) data.physicalStatus = input.physicalStatus;
    if (input.housekeepingStatus !== undefined) data.housekeepingStatus = input.housekeepingStatus;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    return this.db.room.update({ where: { id, hotelId }, data, include });
  }
}
