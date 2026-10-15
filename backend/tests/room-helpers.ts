import { Prisma, type Room, type RoomType } from '../src/generated/prisma/client.js';
import type { RoomRepositories } from '../src/app.js';
import type { RoomRecord } from '../src/modules/rooms/room.types.js';

// In-memory HTTP test double only. Database constraints and races use the MySQL suite.
export function memoryRooms() {
  const types = new Map<bigint, RoomType>();
  const records = new Map<bigint, Room>();
  let nextId = 9007199254741000n;
  const withType = (room: Room): RoomRecord => {
    const type = types.get(room.roomTypeId)!;
    return {
      ...room,
      occupancy: null,
      roomType: { id: type.id, code: type.code, name: type.name, isActive: type.isActive },
    };
  };
  function sorted<T>(items: T[], key: keyof T, direction: string) {
    return items.sort((a, b) => {
      const left = a[key];
      const right = b[key];
      const comparison =
        left instanceof Prisma.Decimal
          ? left.comparedTo(right as Prisma.Decimal)
          : left < right
            ? -1
            : left > right
              ? 1
              : 0;
      return comparison * (direction === 'asc' ? 1 : -1);
    });
  }
  function page<T>(items: T[], query: { page: number; limit: number }) {
    return {
      items: items.slice((query.page - 1) * query.limit, query.page * query.limit),
      total: items.length,
    };
  }
  const repositories: RoomRepositories = {
    roomTypes: {
      withHotelLock: async (_hotelId, action) => action(repositories.roomTypes),
      findById: async (hotelId, id) => (types.get(id)?.hotelId === hotelId ? types.get(id)! : null),
      findByCode: async (hotelId, code) =>
        [...types.values()].find(
          (r) => r.hotelId === hotelId && r.code.toLowerCase() === code.toLowerCase(),
        ) ?? null,
      countActiveRooms: async (hotelId, roomTypeId) =>
        [...records.values()].filter(
          (r) => r.hotelId === hotelId && r.roomTypeId === roomTypeId && r.isActive,
        ).length,
      list: async (hotelId, query) => {
        const rows = [...types.values()].filter(
          (r) =>
            r.hotelId === hotelId &&
            (query.isActive === undefined || r.isActive === query.isActive) &&
            (!query.search ||
              `${r.code} ${r.name}`.toLowerCase().includes(query.search.toLowerCase())),
        );
        return page(sorted(rows, query.sortBy, query.sortOrder), query);
      },
      create: async (hotelId, input) => {
        const record: RoomType = {
          ...input,
          id: nextId++,
          hotelId,
          description: input.description ?? null,
          basePrice: new Prisma.Decimal(input.basePrice),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        types.set(record.id, record);
        return record;
      },
      update: async (hotelId, id, input) => {
        const record = types.get(id)!;
        if (record.hotelId !== hotelId) throw new Error('Unscoped write');
        const updated = {
          ...record,
          ...input,
          basePrice:
            input.basePrice === undefined ? record.basePrice : new Prisma.Decimal(input.basePrice),
          updatedAt: new Date(),
        } as RoomType;
        types.set(id, updated);
        return updated;
      },
    },
    rooms: {
      operationLocks: async () => ({ task: false, block: false }),
      reservedPeak: async () => 0,
      capacityAfterRemoval: async (hotelId, roomTypeId, excludeId) =>
        [...records.values()].filter(
          (room) =>
            room.hotelId === hotelId &&
            room.roomTypeId === roomTypeId &&
            room.id !== excludeId &&
            room.isActive &&
            room.physicalStatus === 'ACTIVE',
        ).length,
      withHotelLock: async (_hotelId, action) => action(repositories.rooms),
      findById: async (hotelId, id) =>
        records.get(id)?.hotelId === hotelId ? withType(records.get(id)!) : null,
      findByNumber: async (hotelId, number) => {
        const record = [...records.values()].find(
          (r) => r.hotelId === hotelId && r.roomNumber.toLowerCase() === number.toLowerCase(),
        );
        return record ? withType(record) : null;
      },
      findRoomType: async (hotelId, id) => repositories.roomTypes.findById(hotelId, id),
      list: async (hotelId, query) => {
        const rows = [...records.values()].filter(
          (r) =>
            r.hotelId === hotelId &&
            (!query.search || r.roomNumber.toLowerCase().includes(query.search.toLowerCase())) &&
            (query.roomTypeId === undefined || r.roomTypeId.toString() === query.roomTypeId) &&
            (query.floorNumber === undefined || r.floorNumber === query.floorNumber) &&
            (query.physicalStatus === undefined || r.physicalStatus === query.physicalStatus) &&
            (query.housekeepingStatus === undefined ||
              r.housekeepingStatus === query.housekeepingStatus) &&
            (query.isActive === undefined || r.isActive === query.isActive),
        );
        return page(sorted(rows, query.sortBy, query.sortOrder).map(withType), query);
      },
      create: async (hotelId, input) => {
        const record: Room = {
          maintenanceManaged: false,
          ...input,
          roomTypeId: BigInt(input.roomTypeId),
          notes: input.notes ?? null,
          id: nextId++,
          hotelId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        records.set(record.id, record);
        return withType(record);
      },
      update: async (hotelId, id, input) => {
        const record = records.get(id)!;
        if (record.hotelId !== hotelId) throw new Error('Unscoped write');
        const updated = {
          ...record,
          ...input,
          roomTypeId: input.roomTypeId === undefined ? record.roomTypeId : BigInt(input.roomTypeId),
          updatedAt: new Date(),
        } as Room;
        records.set(id, updated);
        return withType(updated);
      },
    },
  };
  return { repositories, types, records };
}
