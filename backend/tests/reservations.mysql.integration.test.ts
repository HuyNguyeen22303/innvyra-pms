import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { RoomService } from '../src/modules/rooms/room.service.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { RoomTypeService } from '../src/modules/room-types/room-type.service.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { ReservationService } from '../src/modules/reservations/reservation.service.js';
import {
  availabilityQuery,
  createReservationBody,
  reservationListQuery,
} from '../src/modules/reservations/reservation.schema.js';
import type { ReservationScope } from '../src/modules/reservations/reservation.types.js';
import { asDate } from '../src/modules/reservations/reservation.dates.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { futureDay } from './reservation-helpers.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Reservation MySQL: real locks, concurrent HTTP, rollback and isolation',
  () => {
    let prisma: ReturnType<typeof createPrisma>;
    let second: ReturnType<typeof createPrisma>;
    let service: ReservationService;
    let otherService: ReservationService;
    let roomService: RoomService;
    let scope: ReservationScope;
    let foreignHotel: bigint;
    let guestId: bigint;
    let typeId: bigint;
    let roomId: bigint;
    let hotels: bigint[] = [];
    let app: ReturnType<typeof createApp>;
    let otherApp: ReturnType<typeof createApp>;
    let token: string;
    let passwordHash: string;
    const input = (quantity = 1, from = 10, until = 12) =>
      createReservationBody.parse({
        guestId: guestId.toString(),
        checkInDate: futureDay(from),
        checkOutDate: futureDay(until),
        rooms: [{ roomTypeId: typeId.toString(), quantity, adults: 2, children: 0 }],
      });
    const availability = (from = 10, until = 12) =>
      service.availability.search(
        scope,
        availabilityQuery.parse({
          checkInDate: futureDay(from),
          checkOutDate: futureDay(until),
          roomTypeId: typeId.toString(),
        }),
      );
    const post = (target = app) =>
      request(target)
        .post('/api/v1/reservations')
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(input());
    const occupied = () =>
      new PrismaReservationRepository(prisma).occupied(
        scope.hotelId,
        typeId,
        asDate(futureDay(10)),
        asDate(futureDay(12)),
      );
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error(
          'Reservation tests require a separate local TEST_DATABASE_URL ending _test, NODE_ENV=test; never the application database',
        );
      prisma = createPrisma(testUrl!);
      second = createPrisma(testUrl!);
      await prisma.$connect();
      await second.$connect();
      passwordHash = await hashPassword(testPassword);
    });
    beforeEach(async () => {
      hotels = [];
      const prefix = `res_${randomUUID().replaceAll('-', '')}`;
      const hotel = await prisma.hotel.create({
        data: { code: prefix, name: 'Synthetic reservation test hotel' },
      });
      hotels.push(hotel.id);
      const foreign = await prisma.hotel.create({
        data: { code: `${prefix}_b`, name: 'Foreign test hotel' },
      });
      hotels.push(foreign.id);
      foreignHotel = foreign.id;
      const role = await prisma.role.upsert({
        where: { code: 'ADMIN' },
        create: { code: 'ADMIN', name: 'Admin' },
        update: {},
      });
      const staff = await prisma.staffUser.create({
        data: {
          hotelId: hotel.id,
          username: prefix,
          fullName: 'Synthetic staff',
          roleId: role.id,
          passwordHash,
        },
      });
      scope = { hotelId: hotel.id, actorId: staff.id, role: 'ADMIN' };
      guestId = (
        await prisma.guest.create({ data: { hotelId: hotel.id, fullName: 'Synthetic booker' } })
      ).id;
      typeId = (
        await prisma.roomType.create({
          data: {
            hotelId: hotel.id,
            code: 'DELUXE',
            name: 'Deluxe',
            maxAdults: 2,
            maxChildren: 1,
            basePrice: '900000.01',
          },
        })
      ).id;
      roomId = (
        await prisma.room.create({
          data: { hotelId: hotel.id, roomTypeId: typeId, roomNumber: '301', floorNumber: 3 },
        })
      ).id;
      service = new ReservationService(new PrismaReservationRepository(prisma), testEnv);
      otherService = new ReservationService(new PrismaReservationRepository(second), testEnv);
      roomService = new RoomService(new PrismaRoomRepository(prisma));
      const build = (db: typeof prisma) =>
        createApp(
          testEnv,
          new PrismaAuthRepository(db),
          { rooms: new PrismaRoomRepository(db), roomTypes: new PrismaRoomTypeRepository(db) },
          new PrismaGuestRepository(db),
          new PrismaReservationRepository(db),
        );
      app = build(prisma);
      otherApp = build(second);
      token = (
        await new AuthService(new PrismaAuthRepository(prisma), testEnv).login({
          username: prefix,
          password: testPassword,
        })
      ).data.accessToken;
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      if (!prisma || !hotels.length) return;
      const where = { hotelId: { in: hotels } };
      // Only fixtures belonging to this test's random hotel IDs. No reset/drop/truncate.
      await prisma.reservationRoomNight.deleteMany({ where: { reservationRoom: where } });
      await prisma.reservationRoom.deleteMany({ where });
      await prisma.reservation.deleteMany({ where });
      await prisma.guestAuditLog.deleteMany({ where });
      await prisma.guest.deleteMany({ where });
      await prisma.room.deleteMany({ where });
      await prisma.roomType.deleteMany({ where });
      await prisma.authSession.deleteMany({ where: { staffUser: where } });
      await prisma.staffUser.deleteMany({ where });
      await prisma.hotel.deleteMany({ where: { id: { in: hotels } } });
    });
    afterAll(async () => {
      await prisma?.$disconnect();
      await second?.$disconnect();
    });

    it.each([1, 2, 3, 4, 5])(
      'race %i: two independent MySQL-backed HTTP requests for the final room confirm exactly one',
      async () => {
        const results = await Promise.all([post(app), post(otherApp)]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
        expect(results.find((r) => r.status === 409)!.body.error.code).toBe(
          'INSUFFICIENT_AVAILABILITY',
        );
        expect(
          await prisma.reservation.count({
            where: { hotelId: scope.hotelId, status: 'CONFIRMED' },
          }),
        ).toBe(1);
        expect(await prisma.reservationRoom.count({ where: { hotelId: scope.hotelId } })).toBe(1);
        expect((await occupied()).map((row) => row._count._all)).toEqual([1, 1]);
        expect((await availability())[0]!.availableRooms).toBe(0);
      },
    );
    it('creates several room types/units with independent per-night snapshots and stable prices', async () => {
      await prisma.room.create({
        data: { hotelId: scope.hotelId, roomTypeId: typeId, roomNumber: '302', floorNumber: 3 },
      });
      const suite = await prisma.roomType.create({
        data: {
          hotelId: scope.hotelId,
          code: 'SUITE',
          name: 'Suite',
          maxAdults: 2,
          maxChildren: 2,
          basePrice: '1000000.02',
        },
      });
      await prisma.room.create({
        data: { hotelId: scope.hotelId, roomTypeId: suite.id, roomNumber: '401', floorNumber: 4 },
      });
      const booking = await service.create(scope, {
        ...input(2),
        rooms: [
          ...input(2).rooms,
          { roomTypeId: suite.id.toString(), quantity: 1, adults: 2, children: 1 },
        ],
      });
      expect(booking).toMatchObject({ totalAmount: '5600000.08', totalRooms: 3, totalNights: 2 });
      expect(booking.rooms.every((room) => room.roomId === null && room.nights.length === 2)).toBe(
        true,
      );
      await new RoomTypeService(new PrismaRoomTypeRepository(prisma)).updateRoomType(
        scope.hotelId,
        typeId,
        { basePrice: '123.45' },
      );
      expect((await service.detail(scope, BigInt(booking.id))).totalAmount).toBe('5600000.08');
      expect(
        (await service.detail(scope, BigInt(booking.id))).rooms[0]!.nights[0]!.nightlyRate,
      ).toBe('900000.01');
      expect(
        await prisma.reservationRoomNight.count({
          where: {
            reservationRoom: { reservationId: BigInt(booking.id) },
            stayDate: asDate(futureDay(12)),
          },
        }),
      ).toBe(0);
    });
    it('checks each night and permits adjacent bookings without overlap', async () => {
      await service.create(scope, input(1, 11, 13));
      expect((await availability())[0]!.availableRooms).toBe(0);
      await expect(service.create(scope, input())).rejects.toMatchObject({
        code: 'INSUFFICIENT_AVAILABILITY',
      });
      expect((await service.create(scope, input(1, 9, 11))).status).toBe('CONFIRMED');
      expect((await service.create(scope, input(1, 13, 14))).status).toBe('CONFIRMED');
    });
    it('does not count inactive or unavailable physical rooms but ignores housekeeping for future bookings', async () => {
      expect((await availability())[0]!.availableRooms).toBe(1); // fixture is DIRTY
      for (const physicalStatus of ['MAINTENANCE', 'OUT_OF_SERVICE'] as const) {
        await roomService.updateRoom(scope.hotelId, roomId, { physicalStatus });
        expect((await availability())[0]!.availableRooms).toBe(0);
        await expect(service.create(scope, input())).rejects.toMatchObject({
          code: 'INSUFFICIENT_AVAILABILITY',
        });
      }
      await roomService.updateRoom(scope.hotelId, roomId, {
        physicalStatus: 'ACTIVE',
        isActive: false,
      });
      expect((await availability())[0]!.availableRooms).toBe(0);
    });
    it('serializes room capacity reduction with booking and blocks reductions below future commitments', async () => {
      const results = await Promise.allSettled([
        otherService.create(scope, input()),
        roomService.deactivateRoom(scope.hotelId, roomId),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      const counts = await occupied();
      expect(counts.every((row) => row._count._all <= (room.isActive ? 1 : 0))).toBe(true);
      if (!room.isActive) {
        await roomService.updateRoom(scope.hotelId, roomId, { isActive: true });
        await service.create(scope, input());
      }
      for (const change of [
        { isActive: false },
        { physicalStatus: 'MAINTENANCE' as const },
        { physicalStatus: 'OUT_OF_SERVICE' as const },
      ])
        await expect(roomService.updateRoom(scope.hotelId, roomId, change)).rejects.toMatchObject({
          code: 'ROOM_INVENTORY_CONFLICT',
        });
      const otherType = await prisma.roomType.create({
        data: { hotelId: scope.hotelId, code: 'OTHER', name: 'Other', maxAdults: 2, basePrice: 1 },
      });
      await expect(
        roomService.updateRoom(scope.hotelId, roomId, { roomTypeId: otherType.id.toString() }),
      ).rejects.toMatchObject({ code: 'ROOM_INVENTORY_CONFLICT' });
    });
    it('rolls back reservation, room units and nightly inventory on failure after nested insert', async () => {
      const original = PrismaReservationRepository.prototype.create;
      const spy = vi
        .spyOn(PrismaReservationRepository.prototype, 'create')
        .mockImplementation(async function (this: PrismaReservationRepository, ...args) {
          await original.apply(this, args);
          throw new Error('Injected failure after persistence');
        });
      await expect(service.create(scope, input())).rejects.toThrow('Injected failure');
      spy.mockRestore();
      expect(await prisma.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await prisma.reservationRoom.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await occupied()).toEqual([]);
      expect((await availability())[0]!.availableRooms).toBe(1);
    });
    it('fails the entire multi-type request when any type has insufficient inventory', async () => {
      const unavailable = await prisma.roomType.create({
        data: { hotelId: scope.hotelId, code: 'EMPTY', name: 'Empty', maxAdults: 2, basePrice: 1 },
      });
      await expect(
        service.create(scope, {
          ...input(),
          rooms: [
            ...input().rooms,
            { roomTypeId: unavailable.id.toString(), quantity: 1, adults: 1, children: 0 },
          ],
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await prisma.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await occupied()).toEqual([]);
    });
    it('concurrent cancellation releases all nights once and preserves original audit and snapshots', async () => {
      const booking = await service.create(scope, input());
      const id = BigInt(booking.id);
      const cancel = (target: typeof app) =>
        request(target)
          .post(`/api/v1/reservations/${id}/cancel`)
          .auth(token, { type: 'bearer' })
          .set('X-CSRF-Protection', '1')
          .send({ reason: 'Synthetic cancellation' });
      expect((await Promise.all([cancel(app), cancel(otherApp)])).map((r) => r.status)).toEqual([
        200, 200,
      ]);
      const first = await service.detail(scope, id);
      await service.cancel(scope, id, { reason: 'Second reason ignored' });
      expect((await service.detail(scope, id)).cancellation).toEqual(first.cancellation);
      expect(first.rooms).toEqual(booking.rooms);
      expect(await occupied()).toEqual([]);
      expect((await availability())[0]!.availableRooms).toBe(1);
      await roomService.deactivateRoom(scope.hotelId, roomId);
    });
    it('rolls back cancellation status, audit and inventory if a failure occurs after update', async () => {
      const booking = await service.create(scope, input());
      const original = PrismaReservationRepository.prototype.cancel;
      const spy = vi
        .spyOn(PrismaReservationRepository.prototype, 'cancel')
        .mockImplementation(async function (this: PrismaReservationRepository, ...args) {
          await original.apply(this, args);
          throw new Error('Injected cancellation failure');
        });
      await expect(service.cancel(scope, BigInt(booking.id), { reason: 'Cancel' })).rejects.toThrow(
        'Injected cancellation',
      );
      spy.mockRestore();
      expect(await service.detail(scope, BigInt(booking.id))).toMatchObject({
        status: 'CONFIRMED',
        cancellation: null,
      });
      expect((await occupied()).map((r) => r._count._all)).toEqual([1, 1]);
      expect((await availability())[0]!.availableRooms).toBe(0);
    });
    it.each(['CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'] as const)(
      'rejects ordinary cancellation of persisted %s',
      async (status) => {
        const booking = await service.create(scope, input());
        await prisma.reservation.update({ where: { id: BigInt(booking.id) }, data: { status } });
        await expect(
          service.cancel(scope, BigInt(booking.id), { reason: 'Cancel' }),
        ).rejects.toMatchObject({ code: 'RESERVATION_CANNOT_BE_CANCELLED' });
      },
    );
    it('enforces scoped foreign keys, price constraints and unique night/code constraints in MySQL', async () => {
      const booking = await service.create(scope, input());
      const id = BigInt(booking.id);
      const foreignGuest = await prisma.guest.create({
        data: { hotelId: foreignHotel, fullName: 'Foreign booker' },
      });
      await expect(
        prisma.reservation.update({ where: { id }, data: { bookerGuestId: foreignGuest.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      const staff = await prisma.staffUser.findUniqueOrThrow({ where: { id: scope.actorId } });
      const foreignStaff = await prisma.staffUser.create({
        data: {
          hotelId: foreignHotel,
          username: `foreign_${randomUUID()}`,
          fullName: 'Foreign staff',
          roleId: staff.roleId,
          passwordHash,
        },
      });
      await expect(
        prisma.reservation.update({ where: { id }, data: { createdBy: foreignStaff.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        prisma.reservation.update({ where: { id }, data: { totalAmount: '-0.01' } }),
      ).rejects.toThrow();
      const night = await prisma.reservationRoomNight.findFirstOrThrow({
        where: { reservationRoom: { reservationId: id } },
      });
      await expect(
        prisma.reservationRoomNight.create({
          data: {
            reservationRoomId: night.reservationRoomId,
            stayDate: night.stayDate,
            nightlyRate: night.nightlyRate,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        prisma.reservationRoomNight.update({
          where: { id: night.id },
          data: { nightlyRate: '-1' },
        }),
      ).rejects.toThrow();
      const next = await service.create(scope, input(1, 12, 14));
      expect(next.confirmationCode).not.toBe(booking.confirmationCode);
      await expect(
        prisma.reservation.update({
          where: { id: BigInt(next.id) },
          data: { confirmationCode: booking.confirmationCode },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(prisma.guest.delete({ where: { id: guestId } })).rejects.toMatchObject({
        code: 'P2003',
      });
    });
    it('does not expose or accept foreign/deleted resources and retains history after soft deletion', async () => {
      const foreignGuest = await prisma.guest.create({
        data: { hotelId: foreignHotel, fullName: 'Foreign' },
      });
      await expect(
        service.create(scope, { ...input(), guestId: foreignGuest.id.toString() }),
      ).rejects.toMatchObject({ code: 'GUEST_NOT_FOUND' });
      const foreignType = await prisma.roomType.create({
        data: {
          hotelId: foreignHotel,
          code: 'FOREIGN',
          name: 'Foreign',
          maxAdults: 2,
          basePrice: 1,
        },
      });
      await expect(
        service.create(scope, {
          ...input(),
          rooms: [{ ...input().rooms[0]!, roomTypeId: foreignType.id.toString() }],
        }),
      ).rejects.toMatchObject({ code: 'ROOM_TYPE_NOT_FOUND' });
      const booking = await service.create(scope, input());
      const foreignScope = { ...scope, hotelId: foreignHotel };
      await expect(service.detail(foreignScope, BigInt(booking.id))).rejects.toMatchObject({
        status: 404,
      });
      await expect(
        service.cancel(foreignScope, BigInt(booking.id), { reason: 'No' }),
      ).rejects.toMatchObject({ status: 404 });
      expect((await service.list(foreignScope, reservationListQuery.parse({}))).items).toEqual([]);
      await new PrismaGuestRepository(prisma).withHotelLock(scope.hotelId, (repo) =>
        repo.softDelete(scope.hotelId, guestId),
      );
      await expect(service.create(scope, input(1, 12, 14))).rejects.toMatchObject({
        code: 'GUEST_NOT_FOUND',
      });
      expect((await service.detail(scope, BigInt(booking.id))).bookerGuest.id).toBe(
        guestId.toString(),
      );
    });
    it('applies real SQL filters, sorting and pagination without nightly payloads', async () => {
      const first = await service.create(scope, input());
      const secondBooking = await service.create(scope, {
        ...input(1, 12, 14),
        bookingSource: 'PHONE',
      });
      for (const filter of [
        { search: first.confirmationCode },
        { guestSearch: 'Synthetic' },
        { guestId: guestId.toString() },
        { status: 'CONFIRMED' },
        { checkInDate: futureDay(10) },
        { checkOutDate: futureDay(12) },
        { bookingSource: 'PHONE' },
      ]) {
        const result = await service.list(scope, reservationListQuery.parse(filter));
        expect(result.pagination.total).toBeGreaterThan(0);
        expect(result.items.every((r) => r.bookerGuest.id === guestId.toString())).toBe(true);
        expect(result.items[0]).not.toHaveProperty('rooms');
      }
      const page = await service.list(
        scope,
        reservationListQuery.parse({
          limit: '1',
          page: '2',
          sortBy: 'checkInDate',
          sortOrder: 'asc',
        }),
      );
      expect(page.pagination).toMatchObject({ total: 2, totalPages: 2 });
      expect(page.items[0]!.id).toBe(secondBooking.id);
    });
  },
);
