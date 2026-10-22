import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { ReservationService } from '../src/modules/reservations/reservation.service.js';
import { createReservationBody } from '../src/modules/reservations/reservation.schema.js';
import { asDate, asDateOnly, hotelToday } from '../src/modules/reservations/reservation.dates.js';
import { PrismaStayRepository } from '../src/modules/stays/stay.repository.js';
import { StayService } from '../src/modules/stays/stay.service.js';
import { PrismaBillingRepository } from '../src/modules/billing/billing.repository.js';
import { PrismaHousekeepingRepository } from '../src/modules/housekeeping/housekeeping.repository.js';
import { PrismaMaintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { MaintenanceBlockService } from '../src/modules/maintenance/maintenance-block.service.js';
import { OperationsRepository } from '../src/modules/operations/operations.repository.js';
import type { OperationsScope } from '../src/modules/operations/operations.shared.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { ROLE_CODES, type RoleCode } from '../src/shared/types/roles.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Operations MySQL: HTTP, constraints, rollback, and independent-client races',
  () => {
    let db: ReturnType<typeof createPrisma>, second: ReturnType<typeof createPrisma>;
    let app: ReturnType<typeof createApp>, otherApp: ReturnType<typeof createApp>;
    let scope: OperationsScope, bookings: ReservationService, stays: StayService;
    let rooms: bigint[], typeId: bigint, guestId: bigint, foreignRoom: bigint, foreignStaff: bigint;
    let hotels: bigint[] = [],
      hash: string,
      today: string,
      tomorrow: string,
      end: string;
    let tokens: Record<RoleCode, string>, staff: Record<RoleCode, bigint>, foreignToken: string;
    const missing = '18446744073709551615';
    const get = (path: string, role: RoleCode = 'ADMIN') =>
      request(app)
        .get('/api/v1' + path)
        .auth(tokens[role], { type: 'bearer' });
    const post = (path: string, body: object = {}, target = app, role: RoleCode = 'ADMIN') =>
      request(target)
        .post('/api/v1' + path)
        .auth(tokens[role], { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const patch = (path: string, body: object, role: RoleCode = 'ADMIN') =>
      request(app)
        .patch('/api/v1' + path)
        .auth(tokens[role], { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const taskPath = (id: string, action: string) => `/housekeeping/tasks/${id}/${action}`;
    const ticketPath = (id: string, action: string) => `/maintenance/tickets/${id}/${action}`;
    const blockInput = (index = 0, from = today, until = end) => ({
      roomId: rooms[index]!.toString(),
      startDate: from,
      endDate: until,
      reason: 'Repair and safety verification',
    });
    const bookingInput = (quantity = 1, from = today, until = end) =>
      createReservationBody.parse({
        guestId: guestId.toString(),
        checkInDate: from,
        checkOutDate: until,
        rooms: [{ roomTypeId: typeId.toString(), quantity, adults: 1 }],
      });
    const createBooking = (quantity = 1, from = today, until = end) =>
      bookings.create(scope, bookingInput(quantity, from, until));
    const task = async () => {
      const response = await post('/housekeeping/tasks', { roomId: rooms[0]!.toString() });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      return String(response.body.data.id);
    };
    const cleaning = async (complete = true) => {
      const id = await task();
      expect(
        (await patch(taskPath(id, 'assign'), { staffId: staff.HOUSEKEEPING.toString() })).status,
      ).toBe(200);
      expect((await post(taskPath(id, 'start'), {}, app, 'HOUSEKEEPING')).status).toBe(200);
      if (complete)
        expect((await post(taskPath(id, 'complete'), {}, app, 'HOUSEKEEPING')).status).toBe(200);
      return id;
    };
    const ticket = async () => {
      const response = await post('/maintenance/tickets', {
        roomId: rooms[0]!.toString(),
        title: 'AC failure',
        description: 'Cooling has stopped',
      });
      expect(response.status).toBe(201);
      return String(response.body.data.id);
    };
    const block = async (index = 0, from = today, until = end) => {
      const response = await post('/maintenance/blocks', blockInput(index, from, until));
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      return String(response.body.data.id);
    };
    const available = async (from = today, until = end) => {
      const response = await get(
        `/rooms/availability?checkInDate=${from}&checkOutDate=${until}&adults=1&roomTypeId=${typeId}`,
      );
      expect(response.status).toBe(200);
      return response.body.data[0].availableRooms as number;
    };
    const arrive = async (index = 1) => {
      const booking = await createBooking();
      const stay = await stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
        roomId: rooms[index]!.toString(),
      });
      return { booking, stay };
    };
    const state = (index = 0) => db.room.findUniqueOrThrow({ where: { id: rooms[index]! } });
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error(
          'Operations tests require a separate local _test database and NODE_ENV=test',
        );
      db = createPrisma(testUrl!);
      second = createPrisma(testUrl!);
      await db.$connect();
      await second.$connect();
      hash = await hashPassword(testPassword);
    });
    beforeEach(async () => {
      hotels = [];
      tokens = {} as Record<RoleCode, string>;
      staff = {} as Record<RoleCode, bigint>;
      const key = 'ops_' + randomUUID().replaceAll('-', '');
      for (const code of [key, key + '_b'])
        hotels.push(
          (await db.hotel.create({ data: { code, name: 'Synthetic operations hotel' } })).id,
        );
      const hotelId = hotels[0]!;
      for (const code of ROLE_CODES) {
        const role = await db.role.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        });
        const username = key + code;
        const person = await db.staffUser.create({
          data: {
            hotelId,
            roleId: role.id,
            username,
            passwordHash: hash,
            fullName: 'Synthetic ' + code,
          },
        });
        staff[code] = person.id;
        tokens[code] = (
          await new AuthService(new PrismaAuthRepository(db), testEnv).login({
            username,
            password: testPassword,
          })
        ).data.accessToken;
      }
      scope = { hotelId, actorId: staff.ADMIN, role: 'ADMIN' };
      const foreignRole = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
      const foreign = await db.staffUser.create({
        data: {
          hotelId: hotels[1]!,
          roleId: foreignRole.id,
          username: key + '_foreign',
          passwordHash: hash,
          fullName: 'Foreign admin',
        },
      });
      foreignStaff = foreign.id;
      foreignToken = (
        await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username: foreign.username,
          password: testPassword,
        })
      ).data.accessToken;
      typeId = (
        await db.roomType.create({
          data: { hotelId, code: 'DLX', name: 'Deluxe', maxAdults: 2, basePrice: '900000' },
        })
      ).id;
      guestId = (
        await db.guest.create({
          data: {
            hotelId,
            fullName: 'PRIVATE_GUEST_NAME',
            phone: 'PRIVATE_PHONE',
            documentNumberCiphertext: 'PRIVATE_DOCUMENT',
          },
        })
      ).id;
      rooms = [];
      for (let i = 0; i < 3; i++)
        rooms.push(
          (
            await db.room.create({
              data: {
                hotelId,
                roomTypeId: typeId,
                roomNumber: String(301 + i),
                floorNumber: 3,
                housekeepingStatus: i === 0 ? 'DIRTY' : 'READY',
              },
            })
          ).id,
        );
      const foreignType = await db.roomType.create({
        data: { hotelId: hotels[1]!, code: 'F', name: 'Foreign', maxAdults: 2, basePrice: '1' },
      });
      foreignRoom = (
        await db.room.create({
          data: {
            hotelId: hotels[1]!,
            roomTypeId: foreignType.id,
            roomNumber: '1',
            floorNumber: 1,
          },
        })
      ).id;
      today = hotelToday('Asia/Ho_Chi_Minh');
      tomorrow = asDateOnly(new Date(asDate(today).getTime() + 86400000));
      end = asDateOnly(new Date(asDate(today).getTime() + 2 * 86400000));
      bookings = new ReservationService(new PrismaReservationRepository(db), testEnv);
      stays = new StayService(new PrismaStayRepository(db));
      const build = (client: typeof db) =>
        createApp(
          testEnv,
          new PrismaAuthRepository(client),
          {
            rooms: new PrismaRoomRepository(client),
            roomTypes: new PrismaRoomTypeRepository(client),
          },
          new PrismaGuestRepository(client),
          new PrismaReservationRepository(client),
          new PrismaStayRepository(client),
          new PrismaBillingRepository(client),
          {
            housekeeping: new PrismaHousekeepingRepository(client),
            maintenance: new PrismaMaintenanceRepository(client),
          },
        );
      app = build(db);
      otherApp = build(second);
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      if (!db || !hotels.length) return;
      const where = { hotelId: { in: hotels } };
      await db.operationsAuditLog.deleteMany({ where });
      await db.housekeepingTask.deleteMany({ where });
      await db.maintenanceBlock.deleteMany({ where });
      await db.maintenanceTicket.deleteMany({ where });
      await db.roomOccupancy.deleteMany({ where });
      await db.roomTransfer.deleteMany({ where });
      await db.stay.deleteMany({ where });
      await db.reservationRoomNight.deleteMany({ where: { reservationRoom: where } });
      await db.reservationRoom.deleteMany({ where });
      await db.reservation.deleteMany({ where });
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

    it('runs full cleaning, failed inspection, rework and successful inspection with retained actors/timestamps', async () => {
      const id = await cleaning();
      expect((await state()).housekeepingStatus).toBe('INSPECTION');
      const failed = await post(taskPath(id, 'inspect'), {
        passed: false,
        notes: 'Bathroom requires rework',
      });
      expect(failed.body.data.status).toBe('PENDING');
      expect((await state()).housekeepingStatus).toBe('DIRTY');
      await post(taskPath(id, 'start'), {}, app, 'HOUSEKEEPING');
      await post(taskPath(id, 'complete'), {}, app, 'HOUSEKEEPING');
      const passed = await post(taskPath(id, 'inspect'), { passed: true, notes: 'Verified' });
      expect(passed.status).toBe(200);
      expect(passed.body.data).toMatchObject({
        status: 'COMPLETED',
        inspectedBy: staff.ADMIN.toString(),
        assignedTo: staff.HOUSEKEEPING.toString(),
      });
      expect(passed.body.data.startedAt).toBeTruthy();
      expect(passed.body.data.completedAt).toBeTruthy();
      expect(passed.body.data.history).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'INSPECTION_FAILED',
            notes: 'Bathroom requires rework',
          }),
          expect.objectContaining({ action: 'INSPECTION_PASSED' }),
        ]),
      );
      expect((await state()).housekeepingStatus).toBe('READY');
      expect((await post(taskPath(id, 'cancel'), { reason: 'No longer needed' })).status).toBe(409);
    });
    it('creates once; blocks duplicate active task and invalid initial room state', async () => {
      await task();
      expect(
        (await post('/housekeeping/tasks', { roomId: rooms[0]!.toString() })).body.error.code,
      ).toBe('HOUSEKEEPING_TASK_ALREADY_ACTIVE');
      expect(
        (await post('/housekeeping/tasks', { roomId: rooms[1]!.toString() })).body.error.code,
      ).toBe('ROOM_NOT_DIRTY');
    });
    it.each(['missing', 'foreign'] as const)(
      'hides %s rooms for tasks and tickets',
      async (kind) => {
        for (const [path, body] of [
          ['/housekeeping/tasks', {}],
          ['/maintenance/tickets', { title: 'Failure', description: 'Broken' }],
          ['/maintenance/blocks', blockInput()],
        ] as const) {
          const response = await post(path, {
            ...body,
            roomId: kind === 'missing' ? missing : foreignRoom.toString(),
          });
          expect(response.status).toBe(404);
        }
      },
    );
    it('rejects foreign, inactive and incompatible staff assignments', async () => {
      const id = await task(),
        tid = await ticket();
      for (const staffId of [foreignStaff, staff.ACCOUNTANT, BigInt(missing)]) {
        expect((await patch(taskPath(id, 'assign'), { staffId: String(staffId) })).status).toBe(
          422,
        );
        expect((await patch(ticketPath(tid, 'assign'), { staffId: String(staffId) })).status).toBe(
          422,
        );
      }
      await db.staffUser.update({ where: { id: staff.HOUSEKEEPING }, data: { isActive: false } });
      expect(
        (await patch(taskPath(id, 'assign'), { staffId: String(staff.HOUSEKEEPING) })).status,
      ).toBe(422);
    });
    it('does not skip cleaning or inspection; cancellation keeps room DIRTY and history', async () => {
      const id = await task();
      expect((await post(taskPath(id, 'complete'))).status).toBe(409);
      expect((await post(taskPath(id, 'inspect'), { passed: true })).status).toBe(409);
      expect((await post(taskPath(id, 'cancel'), { reason: 'Duplicate request' })).status).toBe(
        200,
      );
      expect((await state()).housekeepingStatus).toBe('DIRTY');
      expect((await post(taskPath(id, 'complete'))).status).toBe(409);
      expect((await get('/housekeeping/tasks/' + id)).body.data.history).toHaveLength(2);
      expect(await task()).not.toBe(id);
    });
    it('restricts cleaners to their assignment and strips guest data from dirty rooms and task detail', async () => {
      const id = await task();
      expect((await get('/housekeeping/tasks', 'HOUSEKEEPING')).body.data.items).toEqual([]);
      expect((await get('/housekeeping/tasks/' + id, 'HOUSEKEEPING')).status).toBe(404);
      await patch(taskPath(id, 'assign'), { staffId: staff.HOUSEKEEPING.toString() });
      expect((await get('/housekeeping/tasks', 'HOUSEKEEPING')).body.data.items).toHaveLength(1);
      expect((await post(taskPath(id, 'start'))).status).toBe(403);
      const dirty = await get('/housekeeping/dirty-rooms?floorNumber=3&limit=1&sortOrder=desc');
      expect(dirty.body.data.items[0].occupancyStatus).toBe('VACANT');
      expect(JSON.stringify(dirty.body)).not.toMatch(/PRIVATE_|passwordHash|bookerGuest/);
      expect(JSON.stringify((await get('/housekeeping/tasks/' + id)).body)).not.toMatch(
        /PRIVATE_|passwordHash|bookerGuest/,
      );
    });
    it.each(['HOUSEKEEPING', 'TECHNICIAN', 'RECEPTIONIST', 'ACCOUNTANT'] as const)(
      '%s cannot inspect or block/release rooms',
      async (role) => {
        expect(
          (await post('/housekeeping/tasks/1/inspect', { passed: true }, app, role)).status,
        ).toBe(403);
        expect((await post('/maintenance/blocks', blockInput(), app, role)).status).toBe(403);
        expect(
          (await post('/maintenance/blocks/1/release', { notes: 'Safe' }, app, role)).status,
        ).toBe(403);
      },
    );
    it('requires JWT and CSRF and rejects forged fields', async () => {
      for (const path of ['/housekeeping/tasks', '/maintenance/tickets', '/maintenance/blocks'])
        expect((await request(app).get('/api/v1' + path)).status).toBe(401);
      expect(
        (
          await request(app)
            .post('/api/v1/housekeeping/tasks')
            .auth(tokens.ADMIN, { type: 'bearer' })
            .send({ roomId: String(rooms[0]) })
        ).status,
      ).toBe(403);
      expect(
        (
          await post('/housekeeping/tasks', {
            roomId: String(rooms[0]),
            hotelId: String(hotels[1]),
          })
        ).status,
      ).toBe(422);
    });
    it('enforces hotel isolation for details, writes, assignment and history', async () => {
      const id = await task(),
        tid = await ticket(),
        bid = await block(1, tomorrow);
      for (const path of [
        '/housekeeping/tasks/' + id,
        '/maintenance/tickets/' + tid,
        '/maintenance/blocks/' + bid,
      ])
        expect(
          (
            await request(app)
              .get('/api/v1' + path)
              .auth(foreignToken, { type: 'bearer' })
          ).status,
        ).toBe(404);
      const response = await request(app)
        .post('/api/v1/housekeeping/tasks/' + id + '/cancel')
        .auth(foreignToken, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send({ reason: 'Forged' });
      expect(response.status).toBe(404);
      expect((await get('/housekeeping/tasks/' + id)).body.data.status).toBe('PENDING');
    });
    it('closes resolved technical work and never blocks a room just by reporting a ticket', async () => {
      const id = await ticket();
      expect((await state()).physicalStatus).toBe('ACTIVE');
      expect(await available()).toBe(3);
      expect((await post(ticketPath(id, 'start'), {}, app, 'TECHNICIAN')).status).toBe(404);
      expect(
        (await patch(ticketPath(id, 'assign'), { staffId: String(staff.TECHNICIAN) })).status,
      ).toBe(200);
      expect((await post(ticketPath(id, 'start'), {}, app, 'TECHNICIAN')).body.data.status).toBe(
        'IN_PROGRESS',
      );
      const resolved = await post(
        ticketPath(id, 'resolve'),
        { resolutionNotes: 'Replaced component' },
        app,
        'TECHNICIAN',
      );
      expect(resolved.body.data).toMatchObject({
        status: 'RESOLVED',
        resolvedBy: String(staff.TECHNICIAN),
      });
      expect((await post(ticketPath(id, 'close'), {}, app, 'RECEPTIONIST')).status).toBe(403);
      expect((await post(ticketPath(id, 'close'))).body.data.status).toBe('CLOSED');
      expect((await post(ticketPath(id, 'cancel'), { reason: 'No' })).status).toBe(409);
      expect((await get('/maintenance/tickets/' + id)).body.data.history).toHaveLength(5);
    });
    it('keeps block on resolve, requires resolution to release, then requires cleaning to reopen', async () => {
      const tid = await ticket();
      const created = await post('/maintenance/blocks', {
        ...blockInput(),
        maintenanceTicketId: tid,
      });
      expect(created.status).toBe(201);
      const id = String(created.body.data.id);
      expect((await post('/maintenance/blocks/' + id + '/release', { notes: 'Safe' })).status).toBe(
        409,
      );
      await patch(ticketPath(tid, 'assign'), { staffId: String(staff.TECHNICIAN) });
      await post(ticketPath(tid, 'start'), {}, app, 'TECHNICIAN');
      await post(ticketPath(tid, 'resolve'), { resolutionNotes: 'Fixed' }, app, 'TECHNICIAN');
      expect((await state()).physicalStatus).toBe('MAINTENANCE');
      expect((await post(ticketPath(tid, 'close'))).status).toBe(409);
      expect(
        (await post('/maintenance/blocks/' + id + '/release', { notes: 'Tested safe' })).status,
      ).toBe(200);
      expect(await state()).toMatchObject({
        physicalStatus: 'ACTIVE',
        housekeepingStatus: 'DIRTY',
        maintenanceManaged: false,
      });
      expect(
        await db.housekeepingTask.count({
          where: { hotelId: scope.hotelId, activeRoomId: rooms[0]! },
        }),
      ).toBe(1);
      expect((await post(ticketPath(tid, 'close'))).status).toBe(200);
    });
    it('supports ticket search/filter/pagination and assigned technician visibility', async () => {
      const id = await ticket();
      await ticket();
      await patch(ticketPath(id, 'assign'), { staffId: String(staff.TECHNICIAN) });
      const result = await get(
        '/maintenance/tickets?status=ASSIGNED&search=AC&limit=1&fromDate=' +
          today +
          '&toDate=' +
          today,
        'TECHNICIAN',
      );
      expect(result.body.data.pagination.total).toBe(1);
      expect((await get('/maintenance/tickets', 'TECHNICIAN')).body.data.items).toHaveLength(1);
      // Room numbers are part of the free-text search, not just title/description.
      const byRoom = await get('/maintenance/tickets?search=301');
      expect(byRoom.body.data.pagination.total).toBe(2);
      const stats = await get('/maintenance/tickets/stats');
      expect(stats.body.data).toEqual(
        expect.arrayContaining([
          { status: 'OPEN', count: 1 },
          { status: 'ASSIGNED', count: 1 },
        ]),
      );
    });
    it('rejects invalid/overlapping blocks but allows adjacent half-open intervals', async () => {
      expect((await post('/maintenance/blocks', blockInput(0, end, today))).status).toBe(422);
      await block(0, today, tomorrow);
      expect((await post('/maintenance/blocks', blockInput())).body.error.code).toBe(
        'MAINTENANCE_BLOCK_CONFLICT',
      );
      expect((await post('/maintenance/blocks', blockInput(0, tomorrow, end))).status).toBe(201);
      expect(await available()).toBe(2);
    });
    it('future blocks preserve current physical/readiness state and affect only their dates', async () => {
      const id = await block(1, tomorrow, end);
      expect(await state(1)).toMatchObject({
        physicalStatus: 'ACTIVE',
        housekeepingStatus: 'READY',
      });
      expect(await available(today, tomorrow)).toBe(3);
      expect(await available(tomorrow, end)).toBe(2);
      expect(
        (await post('/maintenance/blocks/' + id + '/cancel', { reason: 'Work postponed' })).status,
      ).toBe(200);
      expect(
        (await post('/maintenance/blocks/' + id + '/cancel', { reason: 'Retry' })).status,
      ).toBe(409);
      expect(await available()).toBe(3);
      expect((await get('/maintenance/blocks/' + id)).body.data.history).toHaveLength(2);
    });
    it('subtracts current maintenance once, blocks reservation creation, and release restores capacity once', async () => {
      const id = await block();
      expect(await available()).toBe(2);
      await createBooking(2);
      await expect(createBooking()).rejects.toMatchObject({ code: 'INSUFFICIENT_AVAILABILITY' });
      expect((await post('/maintenance/blocks/' + id + '/release', { notes: 'Safe' })).status).toBe(
        200,
      );
      expect(
        (await post('/maintenance/blocks/' + id + '/release', { notes: 'Retry' })).body.error.code,
      ).toBe('MAINTENANCE_ALREADY_RELEASED');
      expect(await available()).toBe(1);
      expect(
        await db.operationsAuditLog.count({
          where: { hotelId: scope.hotelId, blockId: BigInt(id), action: 'BLOCK_RELEASE' },
        }),
      ).toBe(1);
    });
    it('refuses any block on a currently occupied room without moving the guest', async () => {
      await arrive();
      expect((await post('/maintenance/blocks', blockInput(1))).body.error.code).toBe(
        'ROOM_CURRENTLY_OCCUPIED',
      );
      expect(
        (
          await post(
            '/maintenance/blocks',
            blockInput(1, end, asDateOnly(new Date(asDate(end).getTime() + 86400000))),
          )
        ).body.error.code,
      ).toBe('ROOM_CURRENTLY_OCCUPIED');
    });
    it('rejects block conflicting with a specific future reservation assignment', async () => {
      const booking = await createBooking(1, tomorrow, end);
      await db.reservationRoom.update({
        where: { id: BigInt(booking.rooms[0]!.id) },
        data: { roomId: rooms[0]! },
      });
      expect((await post('/maintenance/blocks', blockInput())).body.error.code).toBe(
        'MAINTENANCE_AFFECTS_RESERVATIONS',
      );
    });
    it('rejects block reducing total inventory below reservations on any night', async () => {
      await createBooking(3, tomorrow, end);
      expect((await post('/maintenance/blocks', blockInput())).body.error.code).toBe(
        'MAINTENANCE_AFFECTS_RESERVATIONS',
      );
      expect(await db.maintenanceBlock.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('blocks checkin and transfer for overlapping scheduled intervals even before the worker runs', async () => {
      await block(1, tomorrow);
      const booking = await createBooking();
      await expect(
        stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
          roomId: String(rooms[1]),
        }),
      ).rejects.toMatchObject({ code: 'ROOM_UNDER_MAINTENANCE' });
      const { stay } = await arrive(2);
      await expect(
        stays.transfer(scope, BigInt(stay.stayId), { toRoomId: String(rooms[1]), reason: 'Move' }),
      ).rejects.toMatchObject({ code: 'ROOM_UNDER_MAINTENANCE' });
    });
    it('auto-creates exactly one task at checkout and transfer inside their transaction', async () => {
      const { stay } = await arrive(1);
      await stays.transfer(scope, BigInt(stay.stayId), {
        toRoomId: String(rooms[2]),
        reason: 'Guest request',
      });
      expect((await state(1)).housekeepingStatus).toBe('DIRTY');
      expect(
        await db.housekeepingTask.count({
          where: { hotelId: scope.hotelId, activeRoomId: rooms[1]! },
        }),
      ).toBe(1);
      await stays.checkout(scope, BigInt(stay.stayId), {});
      expect((await state(2)).housekeepingStatus).toBe('DIRTY');
      await expect(stays.checkout(scope, BigInt(stay.stayId), {})).rejects.toMatchObject({
        code: 'STAY_ALREADY_CHECKED_OUT',
      });
      expect(await db.housekeepingTask.count({ where: { hotelId: scope.hotelId } })).toBe(2);
    });
    it('rejects Room PATCH/create workflow bypass and protects block/type changes', async () => {
      for (const housekeepingStatus of ['READY', 'CLEANING', 'INSPECTION']) {
        expect((await patch('/rooms/' + rooms[0], { housekeepingStatus })).body.error.code).toBe(
          'HOUSEKEEPING_WORKFLOW_REQUIRED',
        );
        expect(
          (
            await post('/rooms', {
              roomTypeId: String(typeId),
              roomNumber: 'NEW',
              floorNumber: 3,
              housekeepingStatus,
            })
          ).status,
        ).toBe(409);
      }
      expect((await patch('/rooms/' + rooms[0], { physicalStatus: 'MAINTENANCE' })).status).toBe(
        409,
      );
      await block();
      expect(
        (await patch('/rooms/' + rooms[0], { physicalStatus: 'ACTIVE' })).body.error.code,
      ).toBe('ROOM_OPERATIONS_CONFLICT');
      expect((await patch('/rooms/' + rooms[0], { isActive: false })).status).toBe(409);
    });
    it('blocks inspection while maintenance resets cleaning, without overwriting technical state', async () => {
      const id = await cleaning();
      await block();
      expect((await post(taskPath(id, 'inspect'), { passed: true })).status).toBe(409);
      expect(await state()).toMatchObject({
        physicalStatus: 'MAINTENANCE',
        housekeepingStatus: 'DIRTY',
      });
      expect((await get('/housekeeping/tasks/' + id)).body.data.history).toEqual(
        expect.arrayContaining([expect.objectContaining({ action: 'MAINTENANCE_REWORK' })]),
      );
    });
    it('activates scheduled work once with the hotel clock and preserves history', async () => {
      const id = await block(0, tomorrow);
      const service = new MaintenanceBlockService(new PrismaMaintenanceRepository(db));
      const future = new Date(asDate(tomorrow).getTime() + 3600000);
      await Promise.all([
        service.activateDue(future),
        new MaintenanceBlockService(new PrismaMaintenanceRepository(second)).activateDue(future),
      ]);
      expect((await get('/maintenance/blocks/' + id)).body.data.status).toBe('ACTIVE');
      expect(await state()).toMatchObject({
        physicalStatus: 'MAINTENANCE',
        housekeepingStatus: 'DIRTY',
      });
      expect(
        await db.operationsAuditLog.count({
          where: { hotelId: scope.hotelId, action: 'BLOCK_AUTO_ACTIVATED' },
        }),
      ).toBe(1);
    });
    it('does not activate scheduled work over an overdue occupant', async () => {
      const id = await block(1, tomorrow);
      const booking = await createBooking(1, today, tomorrow);
      await stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
        roomId: String(rooms[1]),
      });
      await new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).activateDue(
        new Date(asDate(tomorrow).getTime() + 3600000),
      );
      expect((await get('/maintenance/blocks/' + id)).body.data.status).toBe('SCHEDULED');
      expect((await state(1)).physicalStatus).toBe('ACTIVE');
    });
    it.each(['start', 'complete', 'inspect'] as const)(
      'serializes competing task %s transitions',
      async (action) => {
        const id = action === 'start' ? await task() : await cleaning(action === 'inspect');
        if (action === 'start')
          await patch(taskPath(id, 'assign'), { staffId: String(staff.HOUSEKEEPING) });
        const role = action === 'inspect' ? 'ADMIN' : 'HOUSEKEEPING';
        const body = action === 'inspect' ? { passed: true } : {};
        const responses = await Promise.all([
          post(taskPath(id, action), body, app, role),
          post(taskPath(id, action), body, otherApp, role),
        ]);
        expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
        expect((await state()).housekeepingStatus).toBe(
          action === 'start' ? 'CLEANING' : action === 'complete' ? 'INSPECTION' : 'READY',
        );
      },
    );
    it('serializes two simultaneous manual turnover creations with a database unique slot', async () => {
      const responses = await Promise.all([
        post('/housekeeping/tasks', { roomId: String(rooms[0]) }),
        post('/housekeeping/tasks', { roomId: String(rooms[0]) }, otherApp),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await db.housekeepingTask.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      await expect(
        db.housekeepingTask.create({
          data: {
            hotelId: scope.hotelId,
            roomId: rooms[0]!,
            activeRoomId: rooms[0]!,
            createdBy: staff.ADMIN,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
    it('serializes inspection against block creation; final technical and cleaning states agree', async () => {
      const id = await cleaning();
      const [inspection, blocking] = await Promise.all([
        post(taskPath(id, 'inspect'), { passed: true }),
        post('/maintenance/blocks', blockInput(), otherApp),
      ]);
      expect([200, 409]).toContain(inspection.status);
      expect(blocking.status).toBe(201);
      expect(await state()).toMatchObject({
        physicalStatus: 'MAINTENANCE',
        housekeepingStatus: 'DIRTY',
      });
    });
    it('serializes simultaneous overlapping maintenance blocks', async () => {
      const responses = await Promise.all([
        post('/maintenance/blocks', blockInput()),
        post('/maintenance/blocks', blockInput(), otherApp),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await available()).toBe(2);
    });
    it('serializes booking versus maintenance on the last available capacity', async () => {
      const results = await Promise.allSettled([
        new ReservationService(new PrismaReservationRepository(second), testEnv).create(
          scope,
          bookingInput(3),
        ),
        new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).create(
          scope,
          blockInput(),
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const nights = await new PrismaReservationRepository(db).occupied(
        scope.hotelId,
        typeId,
        asDate(today),
        asDate(end),
      );
      expect(nights.every((n) => n._count._all <= 3)).toBe(true);
    });
    it('serializes check-in versus current block activation', async () => {
      const booking = await createBooking();
      const results = await Promise.allSettled([
        new StayService(new PrismaStayRepository(second)).checkin(
          scope,
          BigInt(booking.id),
          BigInt(booking.rooms[0]!.id),
          { roomId: String(rooms[1]) },
        ),
        new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).create(
          scope,
          blockInput(1),
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const occupancy = await db.roomOccupancy.findUnique({ where: { roomId: rooms[1]! } });
      expect((await state(1)).physicalStatus).toBe(occupancy ? 'ACTIVE' : 'MAINTENANCE');
    });
    it('serializes release versus reservation creation without increasing inventory twice', async () => {
      const id = await block();
      await createBooking(2);
      const [release, booking] = await Promise.allSettled([
        new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).finish(
          scope,
          BigInt(id),
          'release',
          'Verified',
        ),
        new ReservationService(new PrismaReservationRepository(second), testEnv).create(
          scope,
          bookingInput(),
        ),
      ]);
      expect(release.status).toBe('fulfilled');
      expect(await available()).toBe(booking.status === 'fulfilled' ? 0 : 1);
      expect(
        (await post('/maintenance/blocks/' + id + '/release', { notes: 'Retry' })).status,
      ).toBe(409);
    });
    it('serializes checkout auto task versus manual creation', async () => {
      const { stay } = await arrive(1);
      const results = await Promise.allSettled([
        stays.checkout(scope, BigInt(stay.stayId), {}),
        post('/housekeeping/tasks', { roomId: String(rooms[1]) }, otherApp).then(
          (response) => response.status,
        ),
      ]);
      expect(results[0]!.status).toBe('fulfilled');
      expect(
        await db.housekeepingTask.count({ where: { hotelId: scope.hotelId, roomId: rooms[1]! } }),
      ).toBe(1);
      expect((await state(1)).housekeepingStatus).toBe('DIRTY');
    });
    it.each(['task', 'block', 'checkout'] as const)(
      'rolls back %s and room changes when audit persistence fails',
      async (kind) => {
        const activeStay = kind === 'checkout' ? (await arrive(1)).stay : null;
        vi.spyOn(OperationsRepository.prototype, 'audit').mockRejectedValueOnce(
          new Error('synthetic audit failure'),
        );
        if (kind === 'checkout') {
          vi.restoreAllMocks();
          const original = PrismaStayRepository.prototype.dirty;
          vi.spyOn(PrismaStayRepository.prototype, 'dirty').mockImplementationOnce(async function (
            this: PrismaStayRepository,
            ...args
          ) {
            await original.apply(this, args);
            throw new Error('synthetic task failure');
          });
          await expect(stays.checkout(scope, BigInt(activeStay!.stayId), {})).rejects.toThrow(
            'synthetic',
          );
          expect(await db.roomOccupancy.count({ where: { hotelId: scope.hotelId } })).toBe(1);
          expect((await state(1)).housekeepingStatus).toBe('READY');
        } else {
          const response =
            kind === 'task'
              ? await post('/housekeeping/tasks', { roomId: String(rooms[0]) })
              : await post('/maintenance/blocks', blockInput());
          expect(response.status).toBe(500);
          expect((await state()).physicalStatus).toBe('ACTIVE');
        }
        expect(await db.housekeepingTask.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(await db.maintenanceBlock.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(await db.operationsAuditLog.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      },
    );
    it('enforces database hotel references and nonterminal active-slot checks outside API', async () => {
      await expect(
        db.housekeepingTask.create({
          data: {
            hotelId: scope.hotelId,
            roomId: foreignRoom,
            activeRoomId: foreignRoom,
            createdBy: staff.ADMIN,
          },
        }),
      ).rejects.toBeTruthy();
      await expect(
        db.housekeepingTask.create({
          data: { hotelId: scope.hotelId, roomId: rooms[0]!, createdBy: staff.ADMIN },
        }),
      ).rejects.toBeTruthy();
      await expect(
        db.maintenanceBlock.create({
          data: {
            hotelId: scope.hotelId,
            roomId: rooms[0]!,
            createdBy: staff.ADMIN,
            startDate: asDate(end),
            endDate: asDate(today),
            reason: 'Invalid',
          },
        }),
      ).rejects.toBeTruthy();
    });

    it('keeps independent technical restrictions when releasing a block and never overwrites OUT_OF_SERVICE', async () => {
      const id = await block();
      // Simulate an independent technical restriction recorded by a trusted integration.
      await db.room.update({
        where: { id: rooms[0]! },
        data: { physicalStatus: 'OUT_OF_SERVICE' },
      });
      expect(
        (
          await post('/maintenance/blocks/' + id + '/release', {
            notes: 'Original repair complete; separate restriction remains',
          })
        ).status,
      ).toBe(200);
      expect((await state()).physicalStatus).toBe('OUT_OF_SERVICE');
      expect(await available()).toBe(2);
      expect((await post('/maintenance/blocks', blockInput())).status).toBe(409);
    });
    it('preserves another active block when releasing one of adjacent intervals', async () => {
      const first = await block(0, today, tomorrow);
      const next = await block(0, tomorrow, end);
      await new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).activateDue(
        new Date(asDate(tomorrow).getTime() + 3600000),
      );
      expect(
        (
          await post('/maintenance/blocks/' + first + '/release', {
            notes: 'First repair verified',
          })
        ).status,
      ).toBe(200);
      expect((await state()).physicalStatus).toBe('MAINTENANCE');
      expect((await get('/maintenance/blocks/' + next)).body.data.status).toBe('ACTIVE');
    });
    it('refuses inventory removal of another room when a future block and reservation consume remaining capacity', async () => {
      await block(0, tomorrow, end);
      await createBooking(2, tomorrow, end);
      expect((await patch('/rooms/' + rooms[1], { isActive: false })).body.error.code).toBe(
        'ROOM_INVENTORY_CONFLICT',
      );
    });
    it('calculates nightly peaks instead of summing reservations and blocks on different nights', async () => {
      await createBooking(2, today, tomorrow);
      await block(0, tomorrow, end);
      expect(await available()).toBe(1);
      expect(await available(tomorrow, end)).toBe(2);
      await createBooking();
      expect(await available()).toBe(0);
    });
    it('denies accountant all Operations reads and technical staff housekeeping access', async () => {
      for (const path of [
        '/housekeeping/tasks',
        '/housekeeping/dirty-rooms',
        '/maintenance/tickets',
        '/maintenance/blocks',
      ])
        expect((await get(path, 'ACCOUNTANT')).status).toBe(403);
      expect((await get('/housekeeping/tasks', 'TECHNICIAN')).status).toBe(403);
    });
    it('requires current active/ready room rules even when an inspection task exists', async () => {
      const id = await cleaning();
      await db.room.update({
        where: { id: rooms[0]! },
        data: { physicalStatus: 'OUT_OF_SERVICE' },
      });
      expect((await post(taskPath(id, 'inspect'), { passed: true })).body.error.code).toBe(
        'ROOM_UNDER_MAINTENANCE',
      );
      expect((await state()).housekeepingStatus).toBe('INSPECTION');
    });
    it('does not auto-release expired planned work after worker downtime', async () => {
      const id = await block(0, tomorrow, end);
      await new MaintenanceBlockService(new PrismaMaintenanceRepository(db)).activateDue(
        new Date(asDate(end).getTime() + 86400000),
      );
      expect((await get('/maintenance/blocks/' + id)).body.data.status).toBe('ACTIVE');
      expect((await state()).housekeepingStatus).toBe('DIRTY');
    });
    it('serves Swagger UI and all 22 documented operations with response schemas, auth and errors', async () => {
      expect((await request(app).get('/api-docs/')).status).toBe(200);
      const spec = (await request(app).get('/api-docs/openapi.json')).body;
      const paths = Object.entries(spec.paths).filter(
        ([path]) => path.startsWith('/housekeeping') || path.startsWith('/maintenance'),
      );
      const operations = paths.flatMap(([, path]) =>
        Object.values(
          path as Record<string, { security: object[]; responses: object; description: string }>,
        ),
      );
      expect(operations).toHaveLength(22);
      for (const operation of operations) {
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
        expect(operation.responses).toHaveProperty('409');
        expect(operation.description).toContain('Required roles');
      }
    });
  },
);
