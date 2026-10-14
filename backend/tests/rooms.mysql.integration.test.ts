import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import 'dotenv/config';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { RoomTypeService } from '../src/modules/room-types/room-type.service.js';
import { RoomService } from '../src/modules/rooms/room.service.js';
import { roomTypeCreateBody } from '../src/modules/room-types/room-type.schema.js';
import { roomCreateBody } from '../src/modules/rooms/room.schema.js';
import { roomTypeListQuery } from '../src/modules/room-types/room-type.schema.js';
import { roomListQuery } from '../src/modules/rooms/room.schema.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Room management MySQL: constraints, transactions, persistence and real HTTP',
  () => {
    let prisma: ReturnType<typeof createPrisma>;
    let typeService: RoomTypeService;
    let roomService: RoomService;
    let app: ReturnType<typeof createApp>;
    let token: string;
    const hotelIds: bigint[] = [];
    let hotelId: bigint;
    let otherHotelId: bigint;
    let typeId: bigint;
    let code: string;
    let number = 0;
    const prefix = `rooms_${randomUUID().replaceAll('-', '')}`;
    const input = () =>
      roomTypeCreateBody.parse({ code, name: code, maxAdults: 2, basePrice: '900000.01' });
    const roomInput = (roomNumber: string, roomTypeId = typeId) =>
      roomCreateBody.parse({ roomNumber, roomTypeId: roomTypeId.toString(), floorNumber: 3 });
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error(
          'Room MySQL tests require a separate local TEST_DATABASE_URL ending _test; never use the application database',
        );
      prisma = createPrisma(testUrl!);
      await prisma.$connect();
      const role = await prisma.role.upsert({
        where: { code: 'ADMIN' },
        create: { code: 'ADMIN', name: 'Administrator' },
        update: {},
      });
      for (const suffix of ['a', 'b']) {
        const hotel = await prisma.hotel.create({
          data: { code: `${prefix}_${suffix}`, name: 'Temporary room integration fixture' },
        });
        hotelIds.push(hotel.id);
      }
      hotelId = hotelIds[0]!;
      otherHotelId = hotelIds[1]!;
      await prisma.staffUser.create({
        data: {
          username: prefix,
          fullName: 'Rooms test',
          hotelId,
          roleId: role.id,
          passwordHash: await hashPassword(testPassword),
        },
      });
      const auth = new PrismaAuthRepository(prisma);
      const repositories = {
        roomTypes: new PrismaRoomTypeRepository(prisma),
        rooms: new PrismaRoomRepository(prisma),
      };
      typeService = new RoomTypeService(repositories.roomTypes);
      roomService = new RoomService(repositories.rooms);
      app = createApp(
        { ...testEnv, DATABASE_URL: testUrl! },
        auth,
        repositories,
        new PrismaGuestRepository(prisma),
        new PrismaReservationRepository(prisma),
      );
      token = (
        await new AuthService(auth, testEnv).login({ username: prefix, password: testPassword })
      ).data.accessToken;
    });
    beforeEach(async () => {
      code = `TYPE_${++number}`;
      typeId = BigInt((await typeService.createRoomType(hotelId, input())).id);
    });
    afterAll(async () => {
      if (!prisma) return;
      try {
        if (hotelIds.length) {
          const where = { hotelId: { in: hotelIds } };
          // Delete only this suite's own disposable fixtures, never tables or existing data.
          await prisma.room.deleteMany({ where });
          await prisma.roomType.deleteMany({ where });
          await prisma.authSession.deleteMany({ where: { staffUser: where } });
          await prisma.staffUser.deleteMany({ where });
          await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } });
        }
      } finally {
        await prisma.$disconnect();
      }
    });
    it('persists Decimal without precision loss and serializes BIGINT through HTTP', async () => {
      const result = await request(app)
        .patch(`/api/v1/room-types/${typeId}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send({ basePrice: '999999999999.99' });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({
        data: { id: typeId.toString(), basePrice: '999999999999.99' },
      });
      expect(
        (await prisma.roomType.findUniqueOrThrow({ where: { id: typeId } })).basePrice.toFixed(2),
      ).toBe('999999999999.99');
    });
    it('enforces unique hotel/code and hotel/number constraints while allowing cross-hotel duplicates', async () => {
      const otherType = await typeService.createRoomType(otherHotelId, input());
      await expect(
        prisma.roomType.create({ data: { ...input(), description: null, hotelId } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await roomService.createRoom(hotelId, roomInput(code));
      await expect(
        prisma.room.create({
          data: { ...roomInput(code), notes: null, hotelId, roomTypeId: typeId },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      expect(
        (await roomService.createRoom(otherHotelId, roomInput(code, BigInt(otherType.id))))
          .roomNumber,
      ).toBe(code);
    });
    it('enforces composite foreign keys even when bypassing services', async () => {
      await expect(
        prisma.room.create({
          data: { ...roomInput(code), notes: null, hotelId: otherHotelId, roomTypeId: typeId },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(roomService.createRoom(otherHotelId, roomInput(code))).rejects.toMatchObject({
        status: 404,
        code: 'ROOM_TYPE_NOT_FOUND',
      });
    });
    it('maps database unique violations to safe HTTP 409 even if prechecks miss a conflict', async () => {
      const spy = vi
        .spyOn(PrismaRoomTypeRepository.prototype, 'findByCode')
        .mockResolvedValue(null);
      try {
        const response = await request(app)
          .post('/api/v1/room-types')
          .auth(token, { type: 'bearer' })
          .set('X-CSRF-Protection', '1')
          .send(input());
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({ error: { code: 'ROOM_TYPE_CODE_EXISTS' } });
        expect(response.text).not.toMatch(/P2002|Prisma|constraint|INSERT/);
      } finally {
        spy.mockRestore();
      }
      await roomService.createRoom(hotelId, roomInput(code));
      const roomSpy = vi
        .spyOn(PrismaRoomRepository.prototype, 'findByNumber')
        .mockResolvedValue(null);
      try {
        const response = await request(app)
          .post('/api/v1/rooms')
          .auth(token, { type: 'bearer' })
          .set('X-CSRF-Protection', '1')
          .send(roomInput(code));
        expect(response.status).toBe(409);
        expect(response.body).toMatchObject({ error: { code: 'ROOM_NUMBER_EXISTS' } });
      } finally {
        roomSpy.mockRestore();
      }
    });
    it('serializes concurrent creation of identical types and room numbers', async () => {
      const types = await Promise.allSettled(
        [0, 1].map(() => typeService.createRoomType(hotelId, { ...input(), code: `${code}_RACE` })),
      );
      expect(types.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(types.find((r) => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
      const rooms = await Promise.allSettled(
        [0, 1].map(() => roomService.createRoom(hotelId, roomInput(code))),
      );
      expect(rooms.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(rooms.find((r) => r.status === 'rejected')).toMatchObject({ reason: { status: 409 } });
    });
    it('cannot create an active room concurrently with deactivating its type', async () => {
      const results = await Promise.allSettled([
        roomService.createRoom(hotelId, roomInput(code)),
        typeService.deactivateRoomType(hotelId, typeId),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { status: 409 },
      });
      const type = await prisma.roomType.findUniqueOrThrow({ where: { id: typeId } });
      const active = await prisma.room.count({
        where: { hotelId, roomTypeId: typeId, isActive: true },
      });
      expect(type.isActive || active === 0).toBe(true);
    });
    it('cannot reactivate a room concurrently with deactivating its type', async () => {
      const room = await roomService.createRoom(hotelId, { ...roomInput(code), isActive: false });
      const results = await Promise.allSettled([
        roomService.updateRoom(hotelId, BigInt(room.id), { isActive: true }),
        typeService.deactivateRoomType(hotelId, typeId),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { status: 409 },
      });
    });
    it('rolls back a conflicting partial update and retains all records on deactivation', async () => {
      const room = await roomService.createRoom(hotelId, roomInput(code));
      await expect(
        typeService.updateRoomType(hotelId, typeId, { name: 'Should roll back', isActive: false }),
      ).rejects.toMatchObject({ status: 409 });
      expect((await typeService.getRoomTypeById(hotelId, typeId)).name).toBe(code);
      await roomService.deactivateRoom(hotelId, BigInt(room.id));
      await typeService.deactivateRoomType(hotelId, typeId);
      expect((await roomService.getRoomById(hotelId, BigInt(room.id))).isActive).toBe(false);
      expect((await typeService.getRoomTypeById(hotelId, typeId)).isActive).toBe(false);
      await expect(prisma.roomType.delete({ where: { id: typeId } })).rejects.toMatchObject({
        code: 'P2003',
      });
    });
    it('applies real SQL search, filters, sort and pagination within a hotel', async () => {
      await typeService.createRoomType(otherHotelId, input());
      const typePage = await typeService.getRoomTypes(
        hotelId,
        roomTypeListQuery.parse({
          search: code,
          limit: '1',
          sortBy: 'basePrice',
          sortOrder: 'desc',
          isActive: 'true',
        }),
      );
      expect(typePage.pagination.total).toBe(1);
      expect(typePage.items[0]!.id).toBe(typeId.toString());
      await roomService.createRoom(hotelId, roomInput(`${code}A`));
      const target = await roomService.createRoom(hotelId, {
        ...roomInput(`${code}B`),
        floorNumber: -1,
        housekeepingStatus: 'READY',
        physicalStatus: 'MAINTENANCE',
      });
      for (const filter of [
        { floorNumber: '-1' },
        { housekeepingStatus: 'READY' },
        { physicalStatus: 'MAINTENANCE' },
        { search: `${code}B` },
      ]) {
        const page = await roomService.getRooms(
          hotelId,
          roomListQuery.parse({ ...filter, roomTypeId: typeId.toString(), isActive: 'true' }),
        );
        expect(page.pagination.total).toBe(1);
        expect(page.items[0]!.id).toBe(target.id);
      }
      const page = await roomService.getRooms(
        hotelId,
        roomListQuery.parse({
          roomTypeId: typeId.toString(),
          limit: '1',
          page: '2',
          sortBy: 'roomNumber',
        }),
      );
      expect(page.pagination).toMatchObject({ total: 2, totalPages: 2 });
      expect(page.items[0]!.id).toBe(target.id);
    });
    it('hides foreign records and blocks reassignment across hotels through real HTTP', async () => {
      const other = await typeService.createRoomType(otherHotelId, input());
      const room = await roomService.createRoom(otherHotelId, roomInput(code, BigInt(other.id)));
      for (const path of [`rooms/${room.id}`, `room-types/${other.id}`]) {
        expect(
          (await request(app).get(`/api/v1/${path}`).auth(token, { type: 'bearer' })).status,
        ).toBe(404);
        expect(
          (
            await request(app)
              .patch(`/api/v1/${path}`)
              .auth(token, { type: 'bearer' })
              .set('X-CSRF-Protection', '1')
              .send({ isActive: false })
          ).status,
        ).toBe(404);
      }
      const own = await roomService.createRoom(hotelId, roomInput(code));
      await expect(
        roomService.updateRoom(hotelId, BigInt(own.id), { roomTypeId: other.id }),
      ).rejects.toMatchObject({ status: 404 });
    });
  },
);
