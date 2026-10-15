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
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { ReservationService } from '../src/modules/reservations/reservation.service.js';
import { createReservationBody } from '../src/modules/reservations/reservation.schema.js';
import { asDate, asDateOnly, hotelToday } from '../src/modules/reservations/reservation.dates.js';
import { PrismaStayRepository } from '../src/modules/stays/stay.repository.js';
import { StayService } from '../src/modules/stays/stay.service.js';
import { HousekeepingService } from '../src/modules/housekeeping/housekeeping.service.js';
import { PrismaHousekeepingRepository } from '../src/modules/housekeeping/housekeeping.repository.js';
import type { StayScope } from '../src/modules/stays/stay.types.js';
import { hashPassword } from '../src/shared/utils/password.js';
import type { RoleCode } from '../src/shared/types/roles.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Stay MySQL: HTTP workflows, constraints, real transactions and races',
  () => {
    let db: ReturnType<typeof createPrisma>;
    let second: ReturnType<typeof createPrisma>;
    let app: ReturnType<typeof createApp>;
    let otherApp: ReturnType<typeof createApp>;
    let service: StayService;
    let bookings: ReservationService;
    let booking: Awaited<ReturnType<ReservationService['create']>>;
    let scope: StayScope;
    let token: string;
    let username: string;
    let passwordHash: string;
    let guestId: bigint;
    let typeId: bigint;
    let roomIds: bigint[];
    let foreignRoom: bigint;
    let suiteRoom: bigint;
    let hotels: bigint[] = [];
    let today: string;
    let tomorrow: string;
    let departure: string;
    const missing = '18446744073709551615';
    const checkinPath = (
      index = 0,
      reservationId = booking.id,
      reservationRoomId = booking.rooms[index]!.id,
    ) => `/api/v1/reservations/${reservationId}/rooms/${reservationRoomId}/check-in`;
    const post = (path: string, body: object, target = app, accessToken = token) =>
      request(target)
        .post(path)
        .auth(accessToken, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const arrive = (index = 0, roomId = roomIds[index]!, target = app) =>
      post(checkinPath(index), { roomId: roomId.toString() }, target);
    const get = (path: string, accessToken = token) =>
      request(app).get(path).auth(accessToken, { type: 'bearer' });
    const active = async (index = 0) => {
      const response = await arrive(index);
      expect(response.status).toBe(201);
      return String(response.body.data.stayId);
    };
    const snapshots = async () => ({
      nights: await db.reservationRoomNight.findMany({
        where: { reservationRoom: { hotelId: scope.hotelId } },
        orderBy: { id: 'asc' },
      }),
      amount: (
        await db.reservation.findUniqueOrThrow({ where: { id: BigInt(booking.id) } })
      ).totalAmount.toFixed(2),
      reserved: await new PrismaReservationRepository(db).occupied(
        scope.hotelId,
        typeId,
        asDate(today),
        asDate(departure),
      ),
    });
    const assertConsistent = async () => {
      const stays = await db.stay.findMany({
        where: { hotelId: scope.hotelId },
        include: { occupancy: true, reservationRoom: true, transfers: { orderBy: { id: 'asc' } } },
      });
      for (const stay of stays) {
        expect(stay.reservationRoom.roomId).toBe(stay.currentRoomId);
        if (stay.status === 'CHECKED_IN') {
          expect(stay.occupancy?.roomId).toBe(stay.currentRoomId);
          expect(stay.actualCheckoutAt).toBeNull();
        } else {
          expect(stay.occupancy).toBeNull();
          expect(stay.actualCheckoutAt).not.toBeNull();
        }
        if (stay.transfers.length) expect(stay.transfers.at(-1)!.toRoomId).toBe(stay.currentRoomId);
      }
      expect(await db.roomOccupancy.count({ where: { hotelId: scope.hotelId } })).toBe(
        stays.filter((stay) => stay.status === 'CHECKED_IN').length,
      );
    };
    const changeRole = async (code: RoleCode) => {
      const role = await db.role.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
      await db.staffUser.update({ where: { id: scope.actorId }, data: { roleId: role.id } });
      // Same token must reflect current DB role, not stale JWT authorization.
    };
    const createBooking = (quantity = 1) =>
      bookings.create(
        scope,
        createReservationBody.parse({
          guestId: guestId.toString(),
          checkInDate: today,
          checkOutDate: departure,
          rooms: [{ roomTypeId: typeId.toString(), quantity, adults: 2 }],
        }),
      );
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error('Stay tests require a separate local _test database and NODE_ENV=test');
      db = createPrisma(testUrl!);
      second = createPrisma(testUrl!);
      await db.$connect();
      await second.$connect();
      passwordHash = await hashPassword(testPassword);
    });
    beforeEach(async () => {
      hotels = [];
      username = `stay_${randomUUID().replaceAll('-', '')}`;
      for (const code of [username, `${username}_b`]) {
        const hotel = await db.hotel.create({ data: { code, name: 'Synthetic stay test hotel' } });
        hotels.push(hotel.id);
      }
      const hotelId = hotels[0]!;
      const role = await db.role.upsert({
        where: { code: 'RECEPTIONIST' },
        create: { code: 'RECEPTIONIST', name: 'Receptionist' },
        update: {},
      });
      const staff = await db.staffUser.create({
        data: {
          hotelId,
          roleId: role.id,
          username,
          fullName: 'Synthetic receptionist',
          passwordHash,
        },
      });
      scope = { hotelId, actorId: staff.id, role: 'RECEPTIONIST' };
      guestId = (
        await db.guest.create({
          data: {
            hotelId,
            fullName: 'Synthetic booker',
            phone: 'private phone',
            notes: 'private guest notes',
            documentNumberCiphertext: 'private ciphertext',
          },
        })
      ).id;
      typeId = (
        await db.roomType.create({
          data: { hotelId, code: 'DLX', name: 'Deluxe', maxAdults: 2, basePrice: '900000.01' },
        })
      ).id;
      roomIds = [];
      for (const roomNumber of ['301', '302', '303', '304'])
        roomIds.push(
          (
            await db.room.create({
              data: {
                hotelId,
                roomTypeId: typeId,
                roomNumber,
                floorNumber: 3,
                housekeepingStatus: 'READY',
              },
            })
          ).id,
        );
      const suite = await db.roomType.create({
        data: { hotelId, code: 'SUITE', name: 'Suite', maxAdults: 2, basePrice: '1900000' },
      });
      suiteRoom = (
        await db.room.create({
          data: {
            hotelId,
            roomTypeId: suite.id,
            roomNumber: '401',
            floorNumber: 4,
            housekeepingStatus: 'READY',
          },
        })
      ).id;
      const foreignType = await db.roomType.create({
        data: {
          hotelId: hotels[1]!,
          code: 'DLX',
          name: 'Foreign',
          maxAdults: 2,
          basePrice: '900000',
        },
      });
      foreignRoom = (
        await db.room.create({
          data: {
            hotelId: hotels[1]!,
            roomTypeId: foreignType.id,
            roomNumber: '301',
            floorNumber: 3,
            housekeepingStatus: 'READY',
          },
        })
      ).id;
      today = hotelToday('Asia/Ho_Chi_Minh');
      tomorrow = asDateOnly(new Date(asDate(today).getTime() + 86400000));
      departure = asDateOnly(new Date(asDate(today).getTime() + 2 * 86400000));
      bookings = new ReservationService(new PrismaReservationRepository(db), testEnv);
      service = new StayService(new PrismaStayRepository(db));
      booking = await createBooking(2);
      const build = (prisma: typeof db) =>
        createApp(
          testEnv,
          new PrismaAuthRepository(prisma),
          {
            rooms: new PrismaRoomRepository(prisma),
            roomTypes: new PrismaRoomTypeRepository(prisma),
          },
          new PrismaGuestRepository(prisma),
          new PrismaReservationRepository(prisma),
          new PrismaStayRepository(prisma),
        );
      app = build(db);
      otherApp = build(second);
      token = (
        await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username,
          password: testPassword,
        })
      ).data.accessToken;
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      if (!db || !hotels.length) return;
      const where = { hotelId: { in: hotels } };
      await db.operationsAuditLog.deleteMany({ where });
      await db.housekeepingTask.deleteMany({ where });
      // Delete only synthetic fixtures created by this test, in foreign-key order.
      await db.roomOccupancy.deleteMany({ where });
      await db.roomTransfer.deleteMany({ where });
      await db.stay.deleteMany({ where });
      await db.reservationRoomNight.deleteMany({ where: { reservationRoom: where } });
      await db.reservationRoom.deleteMany({ where });
      await db.reservation.deleteMany({ where });
      await db.guestAuditLog.deleteMany({ where });
      await db.guest.deleteMany({ where });
      await db.room.deleteMany({ where });
      await db.roomType.deleteMany({ where });
      await db.authSession.deleteMany({ where: { staffUser: where } });
      await db.staffUser.deleteMany({ where });
      await db.hotel.deleteMany({ where: { id: { in: hotels } } });
    });
    afterAll(async () => {
      await db?.$disconnect();
      await second?.$disconnect();
    });

    it('checks in each booked room independently, derives aggregate state and protects inventory/prices', async () => {
      const before = await snapshots();
      const response = await arrive();
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        status: 'CHECKED_IN',
        reservation: { status: 'PARTIALLY_CHECKED_IN' },
        checkinStaff: { id: scope.actorId.toString() },
      });
      expect(response.body.data.actualCheckinAt).toBeTruthy();
      const detail = await bookings.detail(scope, BigInt(booking.id));
      expect(detail.rooms[0]!.stay?.status).toBe('CHECKED_IN');
      expect(detail.rooms[1]!.stay).toBeNull();
      expect((await arrive(1)).body.data.reservation.status).toBe('CHECKED_IN');
      expect(await snapshots()).toEqual(before);
      await expect(
        bookings.cancel(scope, BigInt(booking.id), { reason: 'Cannot cancel active booking' }),
      ).rejects.toMatchObject({ code: 'RESERVATION_CANNOT_BE_CANCELLED' });
      await assertConsistent();
    });
    it('missing reservation and room membership return distinct 404s', async () => {
      expect(
        (await post(checkinPath(0, missing), { roomId: roomIds[0]!.toString() })).body.error.code,
      ).toBe('RESERVATION_NOT_FOUND');
      const other = await createBooking();
      const response = await post(checkinPath(0, booking.id, other.rooms[0]!.id), {
        roomId: roomIds[0]!.toString(),
      });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('RESERVATION_ROOM_NOT_FOUND');
    });
    it.each(['CANCELLED', 'NO_SHOW'] as const)('refuses arrival for %s booking', async (status) => {
      if (status === 'CANCELLED')
        await bookings.cancel(scope, BigInt(booking.id), { reason: 'Guest cancelled' });
      else await db.reservation.update({ where: { id: BigInt(booking.id) }, data: { status } });
      expect((await arrive()).body.error.code).toBe('RESERVATION_NOT_CONFIRMED');
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it.each([
      'missing',
      'foreign',
      'maintenance',
      'out-of-service',
      'inactive',
      'dirty',
      'cleaning',
      'inspection',
      'type',
      'occupied',
    ] as const)('refuses check-in room: %s', async (condition) => {
      let target = roomIds[0]!;
      let code = 'ROOM_UNAVAILABLE';
      if (condition === 'missing') {
        target = BigInt(missing);
        code = 'ROOM_NOT_FOUND';
      }
      if (condition === 'foreign') {
        target = foreignRoom;
        code = 'ROOM_NOT_FOUND';
      }
      if (condition === 'type') {
        target = suiteRoom;
        code = 'ROOM_TYPE_MISMATCH';
      }
      if (condition === 'occupied') {
        await active(1);
        target = roomIds[1]!;
        code = 'ROOM_ALREADY_OCCUPIED';
      }
      if (condition === 'maintenance' || condition === 'out-of-service')
        await db.room.update({
          where: { id: target },
          data: { physicalStatus: condition === 'maintenance' ? 'MAINTENANCE' : 'OUT_OF_SERVICE' },
        });
      if (condition === 'inactive')
        await db.room.update({ where: { id: target }, data: { isActive: false } });
      if (['dirty', 'cleaning', 'inspection'].includes(condition)) {
        await db.room.update({
          where: { id: target },
          data: {
            housekeepingStatus:
              condition === 'dirty'
                ? 'DIRTY'
                : condition === 'cleaning'
                  ? 'CLEANING'
                  : 'INSPECTION',
          },
        });
        code = 'ROOM_NOT_READY';
      }
      const response = await arrive(0, target);
      expect(response.status).toBe(condition === 'missing' || condition === 'foreign' ? 404 : 409);
      expect(response.body.error.code).toBe(code);
      expect(
        await db.stay.count({ where: { reservationRoomId: BigInt(booking.rooms[0]!.id) } }),
      ).toBe(0);
    });
    it.each([-1, 1])('rejects arrival %i day outside booked arrival', async (offset) => {
      const checkInDate = new Date(asDate(today).getTime() + offset * 86400000);
      await db.reservation.update({ where: { id: BigInt(booking.id) }, data: { checkInDate } });
      expect((await arrive()).body.error.code).toBe('INVALID_CHECKIN_DATE');
    });
    it('rejects arrival into an overlapping physical assignment, permits a back-to-back assignment', async () => {
      const other = await createBooking();
      await db.reservationRoom.update({
        where: { id: BigInt(other.rooms[0]!.id) },
        data: { roomId: roomIds[0]! },
      });
      expect((await arrive()).body.error.code).toBe('ROOM_UNAVAILABLE');
      await db.reservation.update({
        where: { id: BigInt(other.id) },
        data: {
          checkInDate: asDate(departure),
          checkOutDate: new Date(asDate(departure).getTime() + 86400000),
        },
      });
      expect((await arrive()).status).toBe(201);
    });
    it('does not create another Stay on repeated check-in or after checkout', async () => {
      const id = await active();
      expect((await arrive()).body.error.code).toBe('STAY_ALREADY_CHECKED_IN');
      expect((await post(`/api/v1/stays/${id}/check-out`, {})).status).toBe(200);
      expect((await arrive()).body.error.code).toBe('STAY_ALREADY_CHECKED_OUT');
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(1);
    });
    it('keeps a partial reservation protected after early departure while other rooms have not arrived', async () => {
      const first = await active();
      const response = await post(`/api/v1/stays/${first}/check-out`, {});
      expect(response.body.data.reservation.status).toBe('PARTIALLY_CHECKED_IN');
      await expect(
        bookings.cancel(scope, BigInt(booking.id), { reason: 'Not allowed' }),
      ).rejects.toMatchObject({ code: 'RESERVATION_CANNOT_BE_CANCELLED' });
      expect((await arrive(1)).body.data.reservation.status).toBe('CHECKED_IN');
      await assertConsistent();
    });
    it('allows another booked stay to reuse a vacated room only after housekeeping marks it READY', async () => {
      const first = await active();
      await post(`/api/v1/stays/${first}/check-out`, {});
      const another = await createBooking();
      const path = checkinPath(0, another.id, another.rooms[0]!.id);
      const body = { roomId: roomIds[0]!.toString() };
      expect((await post(path, body)).body.error.code).toBe('ROOM_NOT_READY');
      await changeRole('MANAGER');
      const operationsScope = { ...scope, role: 'MANAGER' as const };
      const housekeeping = new HousekeepingService(new PrismaHousekeepingRepository(db));
      const task = await db.housekeepingTask.findFirstOrThrow({
        where: { hotelId: scope.hotelId, activeRoomId: roomIds[0]! },
      });
      await housekeeping.assign(operationsScope, task.id, scope.actorId);
      await housekeeping.start(operationsScope, task.id);
      await housekeeping.complete(operationsScope, task.id);
      await housekeeping.inspect(operationsScope, task.id, { passed: true });
      expect((await post(path, body)).status).toBe(201);
      await assertConsistent();
    });
    it('checks out physically, keeps history/prices/all reserved nights even on early full checkout', async () => {
      const before = await snapshots();
      const first = await active();
      const next = await active(1);
      const response = await post(`/api/v1/stays/${first}/check-out`, { notes: 'Key returned' });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'CHECKED_OUT',
        room: { housekeepingStatus: 'DIRTY' },
        checkoutStaff: { id: scope.actorId.toString() },
        checkoutNotes: 'Key returned',
      });
      expect(response.body.data.actualCheckoutAt).toBeTruthy();
      expect((await get(`/api/v1/stays/${next}`)).body.data.status).toBe('CHECKED_IN');
      expect((await post(`/api/v1/stays/${next}/check-out`, {})).body.data.reservation.status).toBe(
        'CHECKED_OUT',
      );
      expect(await snapshots()).toEqual(before);
      expect(await db.roomOccupancy.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(2);
      await assertConsistent();
    });
    it('rejects nonexistent stay and repeated physical checkout', async () => {
      expect((await post(`/api/v1/stays/${missing}/check-out`, {})).status).toBe(404);
      const id = await active();
      await post(`/api/v1/stays/${id}/check-out`, {});
      const before = await db.stay.findUniqueOrThrow({ where: { id: BigInt(id) } });
      expect(
        (await post(`/api/v1/stays/${id}/check-out`, { notes: 'Second checkout' })).body.error.code,
      ).toBe('STAY_ALREADY_CHECKED_OUT');
      expect(await db.stay.findUniqueOrThrow({ where: { id: BigInt(id) } })).toEqual(before);
    });
    it('transfers twice under one stay, retains chronological history after checkout and keeps inventory', async () => {
      const before = await snapshots();
      const id = await active();
      const original = await db.stay.findUniqueOrThrow({ where: { id: BigInt(id) } });
      for (const target of [roomIds[2]!, roomIds[3]!]) {
        const response = await post(`/api/v1/stays/${id}/transfers`, {
          toRoomId: target.toString(),
          reason: 'Air conditioner malfunction',
        });
        expect(response.status).toBe(201);
        expect(response.body.data.stayId).toBe(id);
      }
      const stay = await db.stay.findUniqueOrThrow({
        where: { id: BigInt(id) },
        include: { transfers: true },
      });
      expect(stay.currentRoomId).toBe(roomIds[3]);
      expect(stay.actualCheckinAt).toEqual(original.actualCheckinAt);
      expect(stay.transfers).toHaveLength(2);
      expect(stay.transfers[0]!.transferredBy).toBe(scope.actorId);
      expect(
        (await db.room.findUniqueOrThrow({ where: { id: roomIds[0]! } })).housekeepingStatus,
      ).toBe('DIRTY');
      expect(
        (
          await new RoomService(new PrismaRoomRepository(db)).getRoomById(
            scope.hotelId,
            roomIds[0]!,
          )
        ).occupancyStatus,
      ).toBe('VACANT');
      expect((await post(`/api/v1/stays/${id}/check-out`, {})).body.data.transfers).toHaveLength(2);
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      expect(await snapshots()).toEqual(before);
      await assertConsistent();
    });
    it.each([
      'same',
      'occupied',
      'dirty',
      'maintenance',
      'out-of-service',
      'inactive',
      'foreign',
      'missing',
      'type',
      'checked-out',
      'assignment',
    ] as const)('refuses transfer: %s', async (condition) => {
      const id = await active();
      let target = roomIds[2]!;
      let code = 'ROOM_UNAVAILABLE';
      if (condition === 'same') {
        target = roomIds[0]!;
        code = 'INVALID_ROOM_TRANSFER';
      }
      if (condition === 'occupied') {
        await active(1);
        target = roomIds[1]!;
        code = 'ROOM_ALREADY_OCCUPIED';
      }
      if (condition === 'dirty') {
        await db.room.update({ where: { id: target }, data: { housekeepingStatus: 'DIRTY' } });
        code = 'ROOM_NOT_READY';
      }
      if (condition === 'maintenance' || condition === 'out-of-service')
        await db.room.update({
          where: { id: target },
          data: { physicalStatus: condition === 'maintenance' ? 'MAINTENANCE' : 'OUT_OF_SERVICE' },
        });
      if (condition === 'inactive')
        await db.room.update({ where: { id: target }, data: { isActive: false } });
      if (condition === 'foreign') {
        target = foreignRoom;
        code = 'ROOM_NOT_FOUND';
      }
      if (condition === 'missing') {
        target = BigInt(missing);
        code = 'ROOM_NOT_FOUND';
      }
      if (condition === 'type') {
        target = suiteRoom;
        code = 'CROSS_ROOM_TYPE_TRANSFER_NOT_SUPPORTED';
      }
      if (condition === 'checked-out') {
        await post(`/api/v1/stays/${id}/check-out`, {});
        code = 'STAY_ALREADY_CHECKED_OUT';
      }
      if (condition === 'assignment') {
        const other = await createBooking();
        await db.reservationRoom.update({
          where: { id: BigInt(other.rooms[0]!.id) },
          data: { roomId: target },
        });
      }
      const response = await post(`/api/v1/stays/${id}/transfers`, {
        toRoomId: target.toString(),
        reason: 'Move',
      });
      expect(response.body.error.code).toBe(code);
      expect(await db.roomTransfer.count({ where: { stayId: BigInt(id) } })).toBe(0);
      await assertConsistent();
    });
    it('allows operational cleaning while occupied but refuses deactivation, maintenance or type reassignment', async () => {
      await active();
      const rooms = new RoomService(new PrismaRoomRepository(db));
      await expect(
        rooms.updateRoom(scope.hotelId, roomIds[0]!, { housekeepingStatus: 'CLEANING' }),
      ).rejects.toMatchObject({ code: 'HOUSEKEEPING_WORKFLOW_REQUIRED' });
      for (const input of [
        { isActive: false },
        { physicalStatus: 'MAINTENANCE' as const },
        {
          roomTypeId: (
            await db.room.findUniqueOrThrow({ where: { id: suiteRoom } })
          ).roomTypeId.toString(),
        },
      ])
        await expect(rooms.updateRoom(scope.hotelId, roomIds[0]!, input)).rejects.toMatchObject({
          code:
            input.physicalStatus === 'MAINTENANCE'
              ? 'MAINTENANCE_WORKFLOW_REQUIRED'
              : 'ROOM_OCCUPIED',
        });
    });
    it('honors temporal boundaries: no time reversal or overdue transfer; late checkout allowed', async () => {
      const id = await active();
      const original = await db.stay.findUniqueOrThrow({ where: { id: BigInt(id) } });
      const reversed = new StayService(
        new PrismaStayRepository(db),
        undefined,
        () => new Date(original.actualCheckinAt.getTime() - 1),
      );
      await expect(reversed.checkout(scope, BigInt(id), {})).rejects.toMatchObject({
        code: 'INVALID_CHECKOUT_OPERATION',
      });
      const late = new StayService(
        new PrismaStayRepository(db),
        undefined,
        () => new Date(asDate(departure).getTime() + 86400000),
      );
      await expect(
        late.transfer(scope, BigInt(id), { toRoomId: roomIds[2]!.toString(), reason: 'Overdue' }),
      ).rejects.toMatchObject({ code: 'INVALID_ROOM_TRANSFER' });
      expect((await late.checkout(scope, BigInt(id), {})).status).toBe('CHECKED_OUT');
    });

    it.each([1, 2, 3])('race %i: two check-ins to the same room succeed once', async () => {
      const results = await Promise.all([
        arrive(0, roomIds[0]!, app),
        arrive(1, roomIds[0]!, otherApp),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.code).toBe('ROOM_ALREADY_OCCUPIED');
      await assertConsistent();
    });
    it('serializes same-room arrivals from different reservations across independent API instances', async () => {
      const other = await createBooking();
      const results = await Promise.all([
        arrive(),
        post(
          checkinPath(0, other.id, other.rooms[0]!.id),
          { roomId: roomIds[0]!.toString() },
          otherApp,
        ),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      await assertConsistent();
    });
    it.each([1, 2, 3])('race %i: same reservation room can create only one stay', async () => {
      const results = await Promise.all([
        arrive(0, roomIds[0]!, app),
        arrive(0, roomIds[1]!, otherApp),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      await assertConsistent();
    });
    it.each([1, 2, 3])('race %i: two transfers to one destination succeed once', async () => {
      const a = await active();
      const b = await active(1);
      const body = { toRoomId: roomIds[2]!.toString(), reason: 'Concurrent transfer' };
      const results = await Promise.all([
        post(`/api/v1/stays/${a}/transfers`, body),
        post(`/api/v1/stays/${b}/transfers`, body, otherApp),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await db.roomTransfer.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      await assertConsistent();
    });
    it.each([1, 2, 3])(
      'race %i: checkout versus transfer leaves no orphan occupancy or incorrect history',
      async () => {
        const id = await active();
        const [checkout, transfer] = await Promise.all([
          post(`/api/v1/stays/${id}/check-out`, {}),
          post(
            `/api/v1/stays/${id}/transfers`,
            { toRoomId: roomIds[2]!.toString(), reason: 'Race' },
            otherApp,
          ),
        ]);
        expect(checkout.status).toBe(200);
        expect([201, 409]).toContain(transfer.status);
        expect(await db.roomTransfer.count({ where: { hotelId: scope.hotelId } })).toBe(
          transfer.status === 201 ? 1 : 0,
        );
        await assertConsistent();
      },
    );
    it.each([1, 2, 3])('race %i: simultaneous checkout succeeds once', async () => {
      const id = await active();
      const results = await Promise.all([
        post(`/api/v1/stays/${id}/check-out`, { notes: 'A' }),
        post(`/api/v1/stays/${id}/check-out`, { notes: 'B' }, otherApp),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      await assertConsistent();
    });
    it('serializes cancellation against the first check-in', async () => {
      const [arrival, cancel] = await Promise.all([
        arrive(),
        post(
          `/api/v1/reservations/${booking.id}/cancel`,
          { reason: 'Race cancellation' },
          otherApp,
        ),
      ]);
      expect([
        [201, 409],
        [409, 200],
      ]).toContainEqual([arrival.status, cancel.status]);
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(
        arrival.status === 201 ? 1 : 0,
      );
      await assertConsistent();
    });
    it.each(['checkin', 'checkout', 'transfer'] as const)(
      'rolls back every mutation when %s fails after writes',
      async (action) => {
        const id = action === 'checkin' ? undefined : await active();
        const before = await snapshots();
        const reservationBefore = await bookings.detail(scope, BigInt(booking.id));
        const originalStay = id ? await db.stay.findUnique({ where: { id: BigInt(id) } }) : null;
        if (action === 'checkin')
          vi.spyOn(PrismaStayRepository.prototype, 'syncReservation').mockRejectedValueOnce(
            new Error('Injected after stay, occupancy and assignment created'),
          );
        else
          vi.spyOn(PrismaStayRepository.prototype, 'dirty').mockRejectedValueOnce(
            new Error('Injected after occupancy moved/released'),
          );
        const run =
          action === 'checkin'
            ? service.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
                roomId: roomIds[0]!.toString(),
              })
            : action === 'checkout'
              ? service.checkout(scope, BigInt(id!), {})
              : service.transfer(scope, BigInt(id!), {
                  toRoomId: roomIds[2]!.toString(),
                  reason: 'Rollback',
                });
        await expect(run).rejects.toThrow('Injected');
        expect(await snapshots()).toEqual(before);
        expect(await bookings.detail(scope, BigInt(booking.id))).toEqual(reservationBefore);
        if (id)
          expect(await db.stay.findUnique({ where: { id: BigInt(id) } })).toEqual(originalStay);
        else expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(await db.roomTransfer.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(
          (await db.room.findUniqueOrThrow({ where: { id: roomIds[0]! } })).housekeepingStatus,
        ).toBe('READY');
        await assertConsistent();
      },
    );
    it('database uniqueness and composite foreign keys independently reject corruption', async () => {
      const id = await active();
      const another = await active(1);
      await expect(
        db.roomOccupancy.update({
          where: { stayId: BigInt(another) },
          data: { roomId: roomIds[0]! },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        db.roomOccupancy.update({ where: { stayId: BigInt(id) }, data: { roomId: foreignRoom } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      const { id: _id, ...data } = await db.stay.findUniqueOrThrow({ where: { id: BigInt(id) } });
      void _id;
      await expect(db.stay.create({ data })).rejects.toMatchObject({ code: 'P2002' });
      await expect(
        db.reservationRoom.delete({ where: { id: BigInt(booking.rooms[0]!.id) } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await assertConsistent();
    });
    it('requires valid authentication', async () => {
      expect((await request(app).get('/api/v1/stays')).status).toBe(401);
      expect((await get('/api/v1/stays', 'invalid-token')).status).toBe(401);
      expect(
        (
          await request(app)
            .post(checkinPath())
            .set('X-CSRF-Protection', '1')
            .send({ roomId: roomIds[0]!.toString() })
        ).status,
      ).toBe(401);
    });
    it.each(['ADMIN', 'MANAGER', 'RECEPTIONIST'] as const)('%s can operate stays', async (role) => {
      await changeRole(role);
      const id = await active();
      expect(
        (
          await post(`/api/v1/stays/${id}/transfers`, {
            toRoomId: roomIds[2]!.toString(),
            reason: 'Allowed',
          })
        ).status,
      ).toBe(201);
      expect((await post(`/api/v1/stays/${id}/check-out`, {})).status).toBe(200);
    });
    it.each(['HOUSEKEEPING', 'ACCOUNTANT', 'TECHNICIAN'] as const)(
      '%s cannot perform any stay writes',
      async (role) => {
        const id = await active();
        await changeRole(role);
        expect((await arrive(1)).status).toBe(403);
        expect((await post(`/api/v1/stays/${id}/check-out`, {})).status).toBe(403);
        expect(
          (
            await post(`/api/v1/stays/${id}/transfers`, {
              toRoomId: roomIds[2]!.toString(),
              reason: 'Forbidden',
            })
          ).status,
        ).toBe(403);
        if (role !== 'ACCOUNTANT') expect((await get('/api/v1/stays')).status).toBe(403);
      },
    );
    it('accountant sees minimal booking/room/date data and never guest, staff, notes or transfers', async () => {
      const id = await active();
      await changeRole('ACCOUNTANT');
      const detail = await get(`/api/v1/stays/${id}`);
      const list = await get('/api/v1/stays');
      expect(detail.status).toBe(200);
      expect(list.status).toBe(200);
      for (const data of [detail.body.data, list.body.data.items[0]]) {
        for (const key of [
          'bookerGuest',
          'checkinStaff',
          'checkoutStaff',
          'checkinNotes',
          'checkoutNotes',
          'transfers',
        ])
          expect(data).not.toHaveProperty(key);
      }
    });
    it('isolates foreign hotels on reads and writes, including arbitrary booking IDs', async () => {
      const id = await active();
      const foreignScope = { ...scope, hotelId: hotels[1]! };
      await expect(service.detail(foreignScope, BigInt(id))).rejects.toMatchObject({
        code: 'STAY_NOT_FOUND',
      });
      await expect(service.checkout(foreignScope, BigInt(id), {})).rejects.toMatchObject({
        code: 'STAY_NOT_FOUND',
      });
      await expect(
        service.transfer(foreignScope, BigInt(id), {
          toRoomId: foreignRoom.toString(),
          reason: 'Foreign',
        }),
      ).rejects.toMatchObject({ code: 'STAY_NOT_FOUND' });
      await expect(
        service.checkin(foreignScope, BigInt(booking.id), BigInt(booking.rooms[1]!.id), {
          roomId: foreignRoom.toString(),
        }),
      ).rejects.toMatchObject({ code: 'RESERVATION_NOT_FOUND' });
      const foreignStaff = await db.staffUser.create({
        data: {
          hotelId: hotels[1]!,
          roleId: (await db.staffUser.findUniqueOrThrow({ where: { id: scope.actorId } })).roleId,
          username: `${username}_foreign`,
          fullName: 'Foreign staff',
          passwordHash,
        },
      });
      const foreignToken = (
        await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username: foreignStaff.username,
          password: testPassword,
        })
      ).data.accessToken;
      expect((await get(`/api/v1/stays/${id}`, foreignToken)).status).toBe(404);
      expect((await get('/api/v1/stays', foreignToken)).body.data.pagination.total).toBe(0);
    });
    it('filters, searches, paginates, sorts, exposes occupancy and avoids sensitive guest fields', async () => {
      const id = await active();
      await active(1);
      const list = await get(
        `/api/v1/stays?status=CHECKED_IN&checkInDate=${today}&search=${booking.confirmationCode}&sortBy=id&sortOrder=asc&limit=1&page=2`,
      );
      expect(list.status).toBe(200);
      expect(list.body.data.pagination).toMatchObject({ total: 2, totalPages: 2, page: 2 });
      expect(list.body.data.items).toHaveLength(1);
      expect(
        (await get(`/api/v1/stays?roomId=${roomIds[0]}&roomNumber=301`)).body.data.items[0].stayId,
      ).toBe(id);
      expect((await get(`/api/v1/stays?checkInDate=${tomorrow}`)).body.data.items).toEqual([]);
      await post(`/api/v1/stays/${id}/check-out`, {});
      expect(
        (await get(`/api/v1/stays?checkOutDate=${today}&status=CHECKED_OUT`)).body.data.pagination
          .total,
      ).toBe(1);
      expect((await get(`/api/v1/rooms/${roomIds[1]}`)).body.data.occupancyStatus).toBe('OCCUPIED');
      expect(JSON.stringify((await get(`/api/v1/stays/${id}`)).body)).not.toMatch(
        /private|passwordHash|documentNumber|phone|email/,
      );
    });
    it('rejects forged timestamps, state and hotel; enforces CSRF and strict query validation', async () => {
      for (const field of ['hotelId', 'status', 'actualCheckinAt', 'checkinStaffId', 'role']) {
        expect(
          (await post(checkinPath(), { roomId: roomIds[0]!.toString(), [field]: 'forged' })).status,
        ).toBe(422);
      }
      expect(
        (
          await request(app)
            .post(checkinPath())
            .auth(token, { type: 'bearer' })
            .send({ roomId: roomIds[0]!.toString() })
        ).status,
      ).toBe(403);
      expect((await get('/api/v1/stays?sortBy=passwordHash')).status).toBe(422);
      expect((await get('/api/v1/stays/-1')).status).toBe(422);
      const id = await active();
      expect(
        (await post(`/api/v1/stays/${id}/check-out`, { actualCheckoutAt: '2020-01-01' })).status,
      ).toBe(422);
      expect(
        (
          await post(`/api/v1/stays/${id}/transfers`, {
            toRoomId: roomIds[2]!.toString(),
            reason: ' ',
            transferredBy: '1',
          })
        ).status,
      ).toBe(422);
    });
    it('serves Swagger UI, valid references and all five documented stay operations alongside existing APIs', async () => {
      expect((await request(app).get('/api-docs/')).status).toBe(200);
      const response = await request(app).get('/api-docs/openapi.json');
      expect(response.status).toBe(200);
      const doc = response.body as {
        paths: Record<
          string,
          Record<string, { security: object[]; responses: object; parameters?: object[] }>
        >;
        components: { schemas: Record<string, unknown> };
      };
      for (const [path, verb] of [
        ['/stays', 'get'],
        ['/stays/{id}', 'get'],
        ['/stays/{id}/check-out', 'post'],
        ['/stays/{id}/transfers', 'post'],
        ['/reservations/{reservationId}/rooms/{reservationRoomId}/check-in', 'post'],
      ])
        expect(doc.paths[path!]![verb!]!.security).toEqual([{ bearerAuth: [] }]);
      for (const path of ['/auth/login', '/rooms', '/guests', '/reservations'])
        expect(doc.paths).toHaveProperty(path);
      for (const match of JSON.stringify(doc).matchAll(
        /"\$ref":"#\/components\/schemas\/([^"]+)"/g,
      ))
        expect(doc.components.schemas).toHaveProperty(match[1]!);
    });
  },
);
