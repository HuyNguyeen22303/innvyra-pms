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
import { PrismaPaymentQrRepository } from '../src/modules/payment-qr/payment-qr.repository.js';
import { PrismaReportRepository } from '../src/modules/reports/report.repository.js';
import { nextDate } from '../src/modules/reports/report.dates.js';
import type { BillingScope } from '../src/modules/billing/billing.types.js';
import { hashPassword } from '../src/shared/utils/password.js';
import type { RoleCode } from '../src/shared/types/roles.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Billing MySQL: HTTP, financial integrity, isolation and real lock races',
  () => {
    let db: ReturnType<typeof createPrisma>, second: ReturnType<typeof createPrisma>;
    let app: ReturnType<typeof createApp>, otherApp: ReturnType<typeof createApp>;
    let booking: Awaited<ReturnType<ReservationService['create']>>;
    let scope: BillingScope;
    let token: string, foreignToken: string, passwordHash: string;
    let hotels: bigint[] = [],
      roomIds: bigint[],
      guestId: bigint,
      typeId: bigint;
    let bookings: ReservationService, stays: StayService;
    const missing = '18446744073709551615';
    const post = (
      path: string,
      body: object = {},
      key: string = randomUUID(),
      target = app,
      accessToken = token,
    ) =>
      request(target)
        .post(`/api/v1${path}`)
        .auth(accessToken, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .set('Idempotency-Key', key)
        .send(body);
    const get = (path: string, accessToken = token) =>
      request(app).get(`/api/v1${path}`).auth(accessToken, { type: 'bearer' });
    const patch = (path: string, body: object) =>
      request(app)
        .patch(`/api/v1${path}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(body);
    const createBooking = (quantity = 1) => {
      const today = hotelToday('Asia/Ho_Chi_Minh');
      return bookings.create(
        scope,
        createReservationBody.parse({
          guestId: guestId.toString(),
          checkInDate: today,
          checkOutDate: asDateOnly(new Date(asDate(today).getTime() + 2 * 86400000)),
          rooms: [{ roomTypeId: typeId.toString(), quantity, adults: 2 }],
        }),
      );
    };
    const active = async () => {
      const stay = await stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
        roomId: roomIds[0]!.toString(),
      });
      return stay.stayId;
    };
    const open = async () => {
      const response = await post(`/reservations/${booking.id}/folio/open`);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      return String(response.body.data.id);
    };
    const catalog = async (code = 'LAUNDRY', price = '50000.00') => {
      const response = await post('/services', { code, name: code, unit: 'item', price });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      return String(response.body.data.id);
    };
    const order = async (serviceId: string, quantity = 2, stayId?: string) => {
      const response = await post('/service-orders', {
        reservationId: booking.id,
        ...(stayId ? { stayId } : {}),
        items: [{ serviceId, quantity }],
      });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      return String(response.body.data.id);
    };
    const pay = (
      folioId: string,
      amount: string,
      key: string = randomUUID(),
      target = app,
      extra: object = {},
    ) =>
      post(
        `/folios/${folioId}/payments`,
        {
          paymentType: 'PAYMENT',
          paymentMethod: 'CASH',
          amount,
          confirmedReceived: true,
          ...extra,
        },
        key,
        target,
      );
    const refund = (
      paymentId: string,
      amount: string,
      key: string = randomUUID(),
      target = app,
      extra: object = {},
    ) =>
      post(
        `/payments/${paymentId}/refunds`,
        { amount, reason: 'Approved manual return of receipt', confirmedRefunded: true, ...extra },
        key,
        target,
      );
    const adjust = (
      folioId: string,
      amount: string,
      entryType = 'CREDIT',
      key: string = randomUUID(),
      target = app,
    ) =>
      post(
        `/folios/${folioId}/adjustments`,
        { amount, entryType, reason: 'Approved service compensation' },
        key,
        target,
      );
    const terminal = async (status: 'CANCELLED' | 'NO_SHOW' = 'CANCELLED') => {
      const response = await post(
        `/reservations/${booking.id}/${status === 'CANCELLED' ? 'cancel' : 'no-show'}`,
        { reason: 'Guest did not stay' },
      );
      expect(response.status, JSON.stringify(response.body)).toBe(200);
    };
    const settlementBody = async (folioId: string, amount = '0') => {
      const preview = await get(`/folios/${folioId}/terminal-settlement`);
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      return {
        finalChargeAmount: amount,
        reason: 'Approved cancellation policy',
        expectedRevision: String(preview.body.data.revision),
        confirmedReviewed: true,
      };
    };
    const settle = async (folioId: string, amount = '0') =>
      post(`/folios/${folioId}/terminal-settlement`, await settlementBody(folioId, amount));
    const changeRole = async (code: RoleCode) => {
      const role = await db.role.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      });
      await db.staffUser.update({ where: { id: scope.actorId }, data: { roleId: role.id } });
    };
    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error('Billing tests require a separate local _test database');
      db = createPrisma(testUrl!);
      second = createPrisma(testUrl!);
      await db.$connect();
      await second.$connect();
      passwordHash = await hashPassword(testPassword);
    });
    beforeEach(async () => {
      hotels = [];
      const prefix = `bill_${randomUUID().replaceAll('-', '')}`;
      const role = await db.role.upsert({
        where: { code: 'ADMIN' },
        create: { code: 'ADMIN', name: 'Admin' },
        update: {},
      });
      for (const code of [prefix, `${prefix}_b`]) {
        const hotel = await db.hotel.create({
          data: { code, name: 'Synthetic billing test hotel' },
        });
        hotels.push(hotel.id);
        const staff = await db.staffUser.create({
          data: {
            hotelId: hotel.id,
            roleId: role.id,
            username: code,
            fullName: 'Synthetic billing staff',
            passwordHash,
          },
        });
        const login = await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username: code,
          password: testPassword,
        });
        if (code === prefix) {
          scope = { hotelId: hotel.id, actorId: staff.id, role: 'ADMIN' };
          token = login.data.accessToken;
        } else foreignToken = login.data.accessToken;
      }
      guestId = (
        await db.guest.create({ data: { hotelId: scope.hotelId, fullName: 'Synthetic guest' } })
      ).id;
      typeId = (
        await db.roomType.create({
          data: {
            hotelId: scope.hotelId,
            code: 'DLX',
            name: 'Deluxe',
            maxAdults: 2,
            basePrice: '900000.00',
          },
        })
      ).id;
      roomIds = [];
      for (const roomNumber of ['101', '102', '103', '104'])
        roomIds.push(
          (
            await db.room.create({
              data: {
                hotelId: scope.hotelId,
                roomTypeId: typeId,
                roomNumber,
                floorNumber: 1,
                housekeepingStatus: 'READY',
              },
            })
          ).id,
        );
      bookings = new ReservationService(new PrismaReservationRepository(db), testEnv);
      stays = new StayService(new PrismaStayRepository(db));
      booking = await createBooking();
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
          new PrismaBillingRepository(prisma),
          undefined,
          new PrismaReportRepository(prisma),
          undefined,
          undefined,
          undefined,
          undefined,
          new PrismaPaymentQrRepository(prisma),
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
      // Only fixtures owned by this test are removed, in reference order. No reset/truncate.
      await db.billingAuditLog.deleteMany({ where });
      await db.billingIdempotency.deleteMany({ where });
      await db.paymentRequest.deleteMany({ where });
      await db.hotelBankAccount.deleteMany({ where });
      await db.payment.deleteMany({ where: { ...where, originalPaymentId: { not: null } } });
      await db.payment.deleteMany({ where });
      await db.folioItem.deleteMany({ where: { ...where, relatedItemId: { not: null } } });
      await db.folioItem.deleteMany({ where });
      await db.folio.deleteMany({ where });
      await db.serviceOrderItem.deleteMany({ where });
      await db.serviceOrder.deleteMany({ where });
      await db.service.deleteMany({ where });
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

    it('ADMIN creates, searches, filters, paginates, updates and deactivates services without deleting history', async () => {
      const id = await catalog();
      await catalog('MINIBAR', '30000');
      expect(
        (await get('/services?search=LAUN&isActive=true&sortBy=price&sortOrder=desc&limit=1')).body
          .data,
      ).toMatchObject({ items: [{ id, price: '50000.00' }], pagination: { total: 1 } });
      expect(
        (await post('/services', { code: 'laundry', name: 'Duplicate', unit: 'item', price: '1' }))
          .status,
      ).toBe(409);
      expect((await patch(`/services/${id}`, { price: '60000' })).body.data.price).toBe('60000.00');
      expect(
        (
          await request(app)
            .delete(`/api/v1/services/${id}`)
            .auth(token, { type: 'bearer' })
            .set('X-CSRF-Protection', '1')
            .send({})
        ).status,
      ).toBe(200);
      expect((await get(`/services/${id}`)).body.data.isActive).toBe(false);
      expect(await db.service.count({ where: { hotelId: scope.hotelId } })).toBe(2);
    });
    it('uses requested catalog snapshots after price/name changes and deactivation', async () => {
      const stayId = await active();
      const folioId = await open();
      const serviceId = await catalog();
      const orderId = await order(serviceId, 2, stayId);
      await patch(`/services/${serviceId}`, { price: '100000', name: 'Changed', isActive: false });
      const completed = await post(`/service-orders/${orderId}/complete`);
      expect(completed.status).toBe(200);
      expect(completed.body.data.items[0]).toMatchObject({
        unitPriceSnapshot: '50000.00',
        lineTotal: '100000.00',
        nameSnapshot: 'LAUNDRY',
      });
      expect((await get(`/folios/${folioId}`)).body.data.totalCharges).toBe('1900000.00');
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            items: [{ serviceId, quantity: 1 }],
          })
        ).body.error.code,
      ).toBe('SERVICE_INACTIVE');
    });
    it('requires active stays and rejects checked-out stays without affecting checkout billing', async () => {
      const serviceId = await catalog();
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            items: [{ serviceId, quantity: 1 }],
          })
        ).status,
      ).toBe(409);
      const stayId = await active();
      const folioId = await open();
      const before = await db.reservationRoomNight.findMany({
        where: { reservationRoom: { reservationId: BigInt(booking.id) } },
      });
      expect((await post(`/stays/${stayId}/check-out`)).status).toBe(200);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        status: 'OPEN',
        outstandingBalance: '1800000.00',
        totalPayments: '0.00',
      });
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            stayId,
            items: [{ serviceId, quantity: 1 }],
          })
        ).status,
      ).toBe(409);
      expect(
        await db.reservationRoomNight.findMany({
          where: { reservationRoom: { reservationId: BigInt(booking.id) } },
        }),
      ).toEqual(before);
    });
    it('rejects missing service, invalid stay and a stay belonging to another reservation', async () => {
      const stayId = await active();
      const serviceId = await catalog();
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            items: [{ serviceId: missing, quantity: 1 }],
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            stayId: missing,
            items: [{ serviceId, quantity: 1 }],
          })
        ).status,
      ).toBe(404);
      const another = await createBooking();
      await stays.checkin(scope, BigInt(another.id), BigInt(another.rooms[0]!.id), {
        roomId: roomIds[1]!.toString(),
      });
      expect(
        (
          await post('/service-orders', {
            reservationId: another.id,
            stayId,
            items: [{ serviceId, quantity: 1 }],
          })
        ).body.error.code,
      ).toBe('STAY_NOT_FOUND');
    });
    it('lists orders and cancels only REQUESTED orders, preserving completed charges', async () => {
      await active();
      await open();
      const serviceId = await catalog();
      const first = await order(serviceId);
      const other = await order(serviceId);
      expect(
        (await post(`/service-orders/${first}/cancel`, { reason: 'Guest request' })).body.data
          .status,
      ).toBe('CANCELLED');
      expect((await post(`/service-orders/${first}/complete`)).status).toBe(409);
      expect((await post(`/service-orders/${other}/complete`)).status).toBe(200);
      expect(
        (await post(`/service-orders/${other}/cancel`, { reason: 'Remove charge' })).status,
      ).toBe(409);
      const list = await get(`/service-orders?reservationId=${booking.id}&status=COMPLETED`);
      expect(list.body.data.items).toHaveLength(1);
      expect((await get(`/service-orders/${other}`)).body.data.status).toBe('COMPLETED');
    });
    it('searches orders by guest, room and confirmation code while keeping accountant name search restricted', async () => {
      const stayId = await active();
      const orderId = await order(await catalog(), 1, stayId);
      const base = `/service-orders?reservationId=${booking.id}`;

      const byGuest = await get(`${base}&search=Synthetic`);
      expect(byGuest.body.data.pagination.total).toBe(1);
      expect(byGuest.body.data.items[0]).toMatchObject({
        id: orderId,
        guestName: 'Synthetic guest',
        confirmationCode: booking.confirmationCode,
        roomNumber: '101',
        roomTypeName: 'Deluxe',
      });
      expect((await get(`${base}&search=10`)).body.data.pagination.total).toBe(1);
      expect((await get(`${base}&search=101`)).body.data.pagination.total).toBe(1);
      expect(
        (await get(`${base}&search=${encodeURIComponent(booking.confirmationCode)}`)).body.data
          .pagination.total,
      ).toBe(1);
      expect((await get(`${base}&search=does-not-exist`)).body.data.pagination.total).toBe(0);

      await changeRole('ACCOUNTANT');
      expect((await get(`${base}&search=Synthetic`)).body.data.pagination.total).toBe(0);
      expect((await get(`${base}&search=101`)).body.data.pagination.total).toBe(1);
    });
    it('GET never opens a folio; successful check-in opens it before service completion', async () => {
      expect((await get(`/reservations/${booking.id}/folio`)).status).toBe(404);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      await active();
      const orderId = await order(await catalog());
      expect((await post(`/service-orders/${orderId}/complete`)).status).toBe(200);
      expect((await get(`/service-orders/${orderId}`)).body.data.status).toBe('COMPLETED');
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(1);
    });
    const bookingBody = (deposit?: object) => ({
      guestId: guestId.toString(),
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      rooms: [{ roomTypeId: typeId.toString(), quantity: 1, adults: 2 }],
      ...(deposit ? { initialDeposit: deposit } : {}),
    });
    const depositBody = (amount = '500000', extra: object = {}) => ({
      amount,
      paymentMethod: 'CASH',
      confirmedReceived: true,
      ...extra,
    });
    it('creates an idempotent reservation without a folio when no deposit is received', async () => {
      const key = randomUUID(),
        body = bookingBody();
      const result = await post('/reservations', body, key);
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      expect(result.body.data).toMatchObject({ folioId: null, initialPaymentId: null });
      expect((await post('/reservations', body, key)).body).toEqual(result.body);
      expect(await db.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(2);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it.each(['CASH', 'BANK_TRANSFER'])(
      'creates booking, folio and %s deposit once under concurrent confirmation',
      async (method) => {
        const body = bookingBody(
          depositBody('500000', {
            paymentMethod: method,
            ...(method === 'BANK_TRANSFER' ? { referenceNumber: 'BANK-BOOK-500K' } : {}),
          }),
        );
        const key = randomUUID();
        const [a, b] = await Promise.all([
          post('/reservations', body, key),
          post('/reservations', body, key, otherApp),
        ]);
        expect(a.status, JSON.stringify(a.body)).toBe(201);
        expect(b.body).toEqual(a.body);
        expect(a.body.data.folioId).toBeTruthy();
        expect(a.body.data.initialPaymentId).toBeTruthy();
        expect((await get(`/folios/${a.body.data.folioId}`)).body.data).toMatchObject({
          totalDeposits: '500000.00',
          outstandingBalance: '1300000.00',
        });
        expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
        expect(
          (await post('/reservations', bookingBody(depositBody('400000')), key)).body.error.code,
        ).toBe('IDEMPOTENCY_CONFLICT');
      },
    );
    it('supports full deposits using the same per-night rounding as folio opening', async () => {
      await db.roomType.update({ where: { id: typeId }, data: { basePrice: '900000.50' } });
      const result = await post('/reservations', bookingBody(depositBody('1800002')));
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      expect(result.body.data.totalAmount).toBe('1800001.00');
      expect((await get(`/folios/${result.body.data.folioId}`)).body.data).toMatchObject({
        totalCharges: '1800002.00',
        totalDeposits: '1800002.00',
        outstandingBalance: '0.00',
        status: 'OPEN',
      });
    });
    it.each([
      depositBody('0'),
      depositBody('1.5'),
      depositBody('1', { confirmedReceived: false }),
      depositBody('1', { paymentMethod: 'BANK_TRANSFER' }),
      depositBody('1', { hotelId: '2' }),
    ])('rejects invalid initial deposit without creating a booking', async (deposit) => {
      expect((await post('/reservations', bookingBody(deposit))).status).toBe(422);
      expect(await db.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(1);
    });
    it('requires a key for deposits and rolls back a booking whose deposit exceeds confirmed charges', async () => {
      const body = bookingBody(depositBody());
      expect(
        (
          await request(app)
            .post('/api/v1/reservations')
            .auth(token, { type: 'bearer' })
            .set('X-CSRF-Protection', '1')
            .send(body)
        ).body.error.code,
      ).toBe('INVALID_IDEMPOTENCY_KEY');
      expect(
        (await post('/reservations', bookingBody(depositBody('1800001')))).body.error.code,
      ).toBe('INSUFFICIENT_OUTSTANDING_BALANCE');
      expect(await db.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it.each(['createItems', 'createPayment', 'audit', 'saveKey'] as const)(
      'rolls back the entire booking/deposit when %s fails and safely retries',
      async (method) => {
        const key = randomUUID(),
          body = bookingBody(depositBody());
        vi.spyOn(PrismaBillingRepository.prototype, method).mockRejectedValueOnce(
          new Error('Synthetic workflow failure'),
        );
        expect((await post('/reservations', body, key)).status).toBe(500);
        expect(await db.reservation.count({ where: { hotelId: scope.hotelId } })).toBe(1);
        for (const count of [
          await db.folio.count({ where: { hotelId: scope.hotelId } }),
          await db.payment.count({ where: { hotelId: scope.hotelId } }),
          await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } }),
        ])
          expect(count).toBe(0);
        const retry = await post('/reservations', body, key);
        expect(retry.status, JSON.stringify(retry.body)).toBe(201);
        expect((await post('/reservations', body, key)).body).toEqual(retry.body);
      },
    );
    it('reuses the prepaid folio at check-in without reposting charges or deposits', async () => {
      const result = await post('/reservations', bookingBody(depositBody()));
      booking = result.body.data;
      const before = await get(`/folios/${result.body.data.folioId}`);
      await active();
      expect((await get(`/reservations/${booking.id}/folio`)).body.data).toEqual(before.body.data);
      expect(
        await db.folioItem.count({ where: { folioId: BigInt(result.body.data.folioId) } }),
      ).toBe(2);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
    });
    it('concurrent room arrivals share one reservation folio and post all booked nights once', async () => {
      booking = await createBooking(2);
      const path = (index: number) =>
        `/reservations/${booking.id}/rooms/${booking.rooms[index]!.id}/check-in`;
      const [a, b] = await Promise.all([
        post(path(0), { roomId: roomIds[0]!.toString() }),
        post(path(1), { roomId: roomIds[1]!.toString() }, randomUUID(), otherApp),
      ]);
      expect(a.status, JSON.stringify(a.body)).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.data.folioId).toBe(b.body.data.folioId);
      expect(await db.folioItem.count({ where: { hotelId: scope.hotelId } })).toBe(4);
      expect((await get(`/folios/${a.body.data.folioId}`)).body.data.totalCharges).toBe(
        '3600000.00',
      );
    });
    it('failed automatic folio creation rolls back physical check-in and room assignment', async () => {
      vi.spyOn(PrismaBillingRepository.prototype, 'createItems').mockRejectedValueOnce(
        new Error('Synthetic folio failure'),
      );
      const path = `/reservations/${booking.id}/rooms/${booking.rooms[0]!.id}/check-in`;
      expect((await post(path, { roomId: roomIds[0]!.toString() })).status).toBe(500);
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.roomOccupancy.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(
        (
          await db.reservationRoom.findUniqueOrThrow({
            where: { id: BigInt(booking.rooms[0]!.id) },
          })
        ).roomId,
      ).toBeNull();
      expect((await post(path, { roomId: roomIds[0]!.toString() })).status).toBe(201);
    });
    it('refuses a closed legacy folio at arrival without reopening or occupying a room', async () => {
      const folioId = await open();
      await db.folio.update({
        where: { id: BigInt(folioId) },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      expect(
        (
          await post(`/reservations/${booking.id}/rooms/${booking.rooms[0]!.id}/check-in`, {
            roomId: roomIds[0]!.toString(),
          })
        ).body.error.code,
      ).toBe('FOLIO_NOT_OPEN');
      expect(await db.stay.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('opens exactly once under concurrent requests and uses original nightly snapshots', async () => {
      await db.roomType.update({ where: { id: typeId }, data: { basePrice: '9900000' } });
      const path = `/reservations/${booking.id}/folio/open`;
      const [a, b] = await Promise.all([post(path), post(path, {}, randomUUID(), otherApp)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.data.id).toBe(b.body.data.id);
      expect(a.body.data.totalCharges).toBe('1800000.00');
      expect(await db.folioItem.count({ where: { hotelId: scope.hotelId } })).toBe(2);
      expect((await get(`/reservations/${booking.id}/folio`)).body.data.id).toBe(a.body.data.id);
    });
    it('posts all rooms and nights and rounds legacy fractional snapshots without rewriting them', async () => {
      booking = await createBooking(2);
      await db.reservationRoomNight.updateMany({
        where: { reservationRoom: { reservationId: BigInt(booking.id) } },
        data: { nightlyRate: '900000.50' },
      });
      const folioId = await open();
      expect((await get(`/folios/${folioId}`)).body.data.totalCharges).toBe('3600004.00');
      expect((await get(`/folios/${folioId}/items?limit=2`)).body.data.pagination.total).toBe(4);
      const snapshots = await db.reservationRoomNight.findMany({
        where: { reservationRoom: { reservationId: BigInt(booking.id) } },
      });
      expect(snapshots.every((night) => night.nightlyRate.toFixed(2) === '900000.50')).toBe(true);
    });
    it.each(['CANCELLED', 'NO_SHOW'] as const)(
      'opens a terminal %s folio empty for explicit fees',
      async (status) => {
        await terminal(status);
        const folioId = await open();
        expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
          totalCharges: '0.00',
          outstandingBalance: '0.00',
        });
        expect(await db.folioItem.count({ where: { folioId: BigInt(folioId) } })).toBe(0);
        const result = await settle(folioId, '300000');
        expect(result.status).toBe(200);
        expect(result.body.data).toMatchObject({ status: 'OPEN', outstandingBalance: '300000.00' });
      },
    );
    it.each(['CANCELLED', 'NO_SHOW'] as const)(
      'waives an existing %s folio and closes atomically without fictitious cash',
      async (status) => {
        const folioId = await open();
        const originalItems = await db.folioItem.findMany({ where: { folioId: BigInt(folioId) } });
        await terminal(status);
        const body = await settlementBody(folioId);
        body.reason = 'Approved waiver with recorded policy. '.repeat(60).slice(0, 2000);
        const key = randomUUID();
        const result = await post(`/folios/${folioId}/terminal-settlement`, body, key);
        expect(result.status, JSON.stringify(result.body)).toBe(200);
        expect(result.body.data).toMatchObject({
          status: 'CLOSED',
          netCharges: '0.00',
          netPaid: '0.00',
          totalCredits: '1800000.00',
          outstandingBalance: '0.00',
        });
        expect(await db.payment.count({ where: { folioId: BigInt(folioId) } })).toBe(0);
        expect(
          await db.folioItem.findMany({
            where: { id: { in: originalItems.map((item) => item.id) } },
          }),
        ).toEqual(originalItems);
        expect((await post(`/folios/${folioId}/terminal-settlement`, body, key)).body).toEqual(
          result.body,
        );
        expect(
          (
            await post(
              `/folios/${folioId}/terminal-settlement`,
              { ...body, finalChargeAmount: '1' },
              key,
            )
          ).body.error.code,
        ).toBe('IDEMPOTENCY_CONFLICT');
        expect(await db.folioItem.count({ where: { folioId: BigInt(folioId) } })).toBe(3);
        expect(
          await db.billingAuditLog.count({
            where: {
              hotelId: scope.hotelId,
              action: 'TERMINAL_FOLIO_SETTLED',
              reason: body.reason,
            },
          }),
        ).toBe(1);
      },
    );
    it('retains the agreed deposit as fees and closes without a second charge or receipt', async () => {
      const folioId = await open();
      await pay(folioId, '300000', randomUUID(), app, { paymentType: 'DEPOSIT' });
      await terminal('NO_SHOW');
      const result = await settle(folioId, '300000');
      expect(result.body.data).toMatchObject({
        status: 'CLOSED',
        netCharges: '300000.00',
        netPaid: '300000.00',
        totalRefunds: '0.00',
      });
      expect(await db.payment.count({ where: { folioId: BigInt(folioId) } })).toBe(1);
    });
    it('settles prepaid cancellation, refunds multiple original receipts, and reconciles reporting', async () => {
      const folioId = await open();
      const cash = await pay(folioId, '300000', randomUUID(), app, { paymentType: 'DEPOSIT' });
      const bank = await pay(folioId, '200000', randomUUID(), app, {
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'BANK-IN-200K',
      });
      await terminal();
      expect((await settle(folioId, '100000')).body.data).toMatchObject({
        status: 'OPEN',
        netCharges: '100000.00',
        netPaid: '500000.00',
        outstandingBalance: '-400000.00',
        totalRefunds: '0.00',
      });
      expect((await post(`/folios/${folioId}/close`)).body.error.code).toBe('FOLIO_UNSETTLED');
      expect((await refund(String(cash.body.data.id), '200000')).status).toBe(201);
      const receipts = (await get(`/folios/${folioId}/payments`)).body.data.items;
      expect(
        receipts.find((row: { id: string }) => row.id === String(cash.body.data.id))
          .refundableAmount,
      ).toBe('100000.00');
      expect((await refund(String(bank.body.data.id), '200000')).body.error.code).toBe(
        'REFUND_REFERENCE_REQUIRED',
      );
      expect(
        (
          await refund(String(bank.body.data.id), '200000', randomUUID(), app, {
            referenceNumber: 'BANK-OUT-200K',
          })
        ).status,
      ).toBe(201);
      expect((await refund(String(cash.body.data.id), '1')).body.error.code).toBe(
        'REFUND_EXCEEDS_SETTLEMENT',
      );
      expect((await post(`/folios/${folioId}/close`)).body.data.status).toBe('CLOSED');
      const today = hotelToday('Asia/Ho_Chi_Minh');
      const report = await get(`/reports/revenue?startDate=${today}&endDate=${nextDate(today)}`);
      expect(report.status, JSON.stringify(report.body)).toBe(200);
      expect(report.body.data.summary).toMatchObject({
        netBilledCharges: '100000.00',
        successfulDeposits: '300000.00',
        successfulPayments: '200000.00',
        successfulRefunds: '400000.00',
        netCashCollected: '100000.00',
        balanceMovement: '0.00',
      });
    });
    it('keeps the folio open for a fee above prepaid money until actual collection', async () => {
      const folioId = await open();
      await pay(folioId, '300000');
      await terminal('NO_SHOW');
      expect((await settle(folioId, '500000')).body.data.outstandingBalance).toBe('200000.00');
      expect(
        (await pay(folioId, '1', randomUUID(), app, { paymentType: 'DEPOSIT' })).body.error.code,
      ).toBe('DEPOSIT_NOT_ALLOWED');
      expect((await pay(folioId, '200001')).body.error.code).toBe(
        'INSUFFICIENT_OUTSTANDING_BALANCE',
      );
      expect((await pay(folioId, '200000')).status).toBe(201);
      expect((await post(`/folios/${folioId}/close`)).body.data.status).toBe('CLOSED');
    });
    it('rejects stale settlement after money changed and handles concurrent duplicate submissions once', async () => {
      const folioId = await open();
      await terminal();
      const body = await settlementBody(folioId, '500000');
      await pay(folioId, '100000');
      expect((await post(`/folios/${folioId}/terminal-settlement`, body)).body.error.code).toBe(
        'SETTLEMENT_STALE',
      );
      const refreshed = await settlementBody(folioId, '300000');
      const key = randomUUID();
      const [a, b] = await Promise.all([
        post(`/folios/${folioId}/terminal-settlement`, refreshed, key),
        post(`/folios/${folioId}/terminal-settlement`, refreshed, key, otherApp),
      ]);
      expect(a.status).toBe(200);
      expect(b.body).toEqual(a.body);
      expect(await db.folioItem.count({ where: { folioId: BigInt(folioId) } })).toBe(3);
      expect(
        (await post(`/folios/${folioId}/terminal-settlement`, refreshed)).body.error.code,
      ).toBe('SETTLEMENT_STALE');
    });
    it('rolls back adjustment and closure if the audit cannot be saved', async () => {
      const folioId = await open();
      await terminal();
      const body = await settlementBody(folioId);
      vi.spyOn(PrismaBillingRepository.prototype, 'audit').mockRejectedValueOnce(
        new Error('Synthetic audit failure'),
      );
      expect((await post(`/folios/${folioId}/terminal-settlement`, body)).status).toBe(500);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        status: 'OPEN',
        totalCredits: '0.00',
      });
      expect(await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('blocks settlement for live reservations, pending activity and corrupted active terminal stays', async () => {
      const folioId = await open();
      expect((await get(`/folios/${folioId}/terminal-settlement`)).body.error.code).toBe(
        'RESERVATION_NOT_TERMINAL',
      );
      const stayId = await active();
      const serviceId = await catalog();
      const orderId = await order(serviceId, 1, stayId);
      // Emulate imported inconsistent terminal data; settlement must never hide a live stay.
      await db.reservation.update({
        where: { id: BigInt(booking.id) },
        data: {
          status: 'NO_SHOW',
          cancellationReason: 'Imported no-show',
          cancelledAt: new Date(),
          cancelledBy: scope.actorId,
        },
      });
      expect((await settle(folioId)).body.error.code).toBe('STAYS_NOT_FINISHED');
      await db.stay.update({
        where: { id: BigInt(stayId) },
        data: {
          status: 'CHECKED_OUT',
          actualCheckoutAt: new Date(),
          checkoutStaffId: scope.actorId,
        },
      });
      expect((await settle(folioId)).body.error.code).toBe('FOLIO_PENDING_ACTIVITY');
      await post(`/service-orders/${orderId}/cancel`, { reason: 'Service not used' });
      await db.payment.create({
        data: {
          hotelId: scope.hotelId,
          folioId: BigInt(folioId),
          paymentType: 'PAYMENT',
          paymentMethod: 'CASH',
          amount: '1',
          status: 'PENDING',
          processedBy: scope.actorId,
        },
      });
      expect((await settle(folioId)).body.error.code).toBe('FOLIO_PENDING_ACTIVITY');
      expect((await get(`/folios/${folioId}`)).body.data.totalCredits).toBe('0.00');
    });
    it('preserves exact settlement and collection for amounts above JS safe integer', async () => {
      await terminal();
      const folioId = await open();
      expect((await settle(folioId, '9999999999999999')).body.data.netCharges).toBe(
        '9999999999999999.00',
      );
      expect((await pay(folioId, '9999999999999999')).status).toBe(201);
      expect((await post(`/folios/${folioId}/close`)).body.data.outstandingBalance).toBe('0.00');
    });
    it.each(['RECEPTIONIST', 'HOUSEKEEPING', 'TECHNICIAN'] as const)(
      'denies %s settlement while enforcing tenant isolation',
      async (role) => {
        const folioId = await open();
        await terminal();
        const body = await settlementBody(folioId);
        expect((await get(`/folios/${folioId}/terminal-settlement`, foreignToken)).status).toBe(
          404,
        );
        expect(
          (
            await post(
              `/folios/${folioId}/terminal-settlement`,
              body,
              randomUUID(),
              app,
              foreignToken,
            )
          ).status,
        ).toBe(404);
        await changeRole(role);
        expect((await post(`/folios/${folioId}/terminal-settlement`, body)).status).toBe(403);
      },
    );
    it.each(['MANAGER', 'ACCOUNTANT'] as const)(
      'allows %s to approve terminal fees under existing settlement permissions',
      async (role) => {
        const folioId = await open();
        await terminal();
        const body = await settlementBody(folioId);
        await changeRole(role);
        expect((await post(`/folios/${folioId}/terminal-settlement`, body)).body.data.status).toBe(
          'CLOSED',
        );
      },
    );
    it('requires CSRF, an idempotency key and reviewed fields on the terminal endpoint', async () => {
      const folioId = await open();
      await terminal();
      const body = await settlementBody(folioId);
      expect(
        (
          await request(app)
            .post(`/api/v1/folios/${folioId}/terminal-settlement`)
            .auth(token, { type: 'bearer' })
            .set('Idempotency-Key', randomUUID())
            .send(body)
        ).status,
      ).toBe(403);
      expect((await post(`/folios/${folioId}/terminal-settlement`, body, 'invalid')).status).toBe(
        422,
      );
      expect(
        (
          await post(`/folios/${folioId}/terminal-settlement`, {
            ...body,
            confirmedReviewed: false,
          })
        ).status,
      ).toBe(422);
      expect(
        (await post(`/folios/${folioId}/terminal-settlement`, { ...body, hotelId: '2' })).status,
      ).toBe(422);
      expect((await get(`/folios/${folioId}`)).body.data.totalCredits).toBe('0.00');
    });
    it('cancellation retains charges and receipts without automatic refund or closure', async () => {
      const folioId = await open();
      await pay(folioId, '500000', randomUUID(), app, { paymentType: 'DEPOSIT' });
      expect(
        (await post(`/reservations/${booking.id}/cancel`, { reason: 'Cancelled' })).status,
      ).toBe(200);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        totalCharges: '1800000.00',
        totalDeposits: '500000.00',
        totalRefunds: '0.00',
        outstandingBalance: '1300000.00',
        status: 'OPEN',
      });
    });
    it('verifies complete financial example through HTTP and closes only after checkout', async () => {
      const stayId = await active();
      const folioId = await open();
      const laundry = await catalog();
      const minibar = await catalog('MINIBAR');
      const response = await post('/service-orders', {
        reservationId: booking.id,
        items: [
          { serviceId: laundry, quantity: 2 },
          { serviceId: minibar, quantity: 1 },
        ],
      });
      expect((await post(`/service-orders/${response.body.data.id}/complete`)).status).toBe(200);
      expect(
        (await pay(folioId, '500000', randomUUID(), app, { paymentType: 'DEPOSIT' })).status,
      ).toBe(201);
      expect((await pay(folioId, '1000000')).status).toBe(201);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        totalCharges: '1950000.00',
        totalDeposits: '500000.00',
        totalPayments: '1000000.00',
        outstandingBalance: '450000.00',
      });
      expect((await post(`/folios/${folioId}/close`)).body.error.code).toBe('FOLIO_UNSETTLED');
      const key = randomUUID();
      const finalPayment = await pay(folioId, '450000', key);
      expect(finalPayment.status).toBe(201);
      expect((await post(`/folios/${folioId}/close`)).body.error.code).toBe('STAYS_NOT_FINISHED');
      expect((await post(`/stays/${stayId}/check-out`)).status).toBe(200);
      expect((await post(`/folios/${folioId}/close`)).body.data.status).toBe('CLOSED');
      expect((await post(`/folios/${folioId}/close`)).body.data.outstandingBalance).toBe('0.00');
      expect((await pay(folioId, '450000', key)).body).toEqual(finalPayment.body);
      expect((await pay(folioId, '1')).body.error.code).toBe('FOLIO_NOT_OPEN');
      expect((await refund(String(finalPayment.body.data.id), '1')).body.error.code).toBe(
        'FOLIO_NOT_OPEN',
      );
      expect((await adjust(folioId, '1', 'DEBIT')).body.error.code).toBe('FOLIO_NOT_OPEN');
      expect((await post(`/reservations/${booking.id}/folio/open`)).body.data.status).toBe(
        'CLOSED',
      );
    });
    it('summarizes scoped folios in one batch with the detail balance and omits missing reservations', async () => {
      const folioId = await open();
      expect((await pay(folioId, '100000')).status).toBe(201);
      const detail = (await get(`/folios/${folioId}`)).body.data;
      const path = `/folios/summaries?reservationIds=${booking.id},${booking.id},18446744073709551615`;
      const result = await get(path);
      expect(result.status).toBe(200);
      expect(result.headers['cache-control']).toBe('no-store');
      expect(result.body.data.items).toEqual([{
        reservationId: booking.id, folioId, status: detail.status, closedAt: detail.closedAt,
        outstandingBalance: detail.outstandingBalance,
      }]);
      expect((await get(path, foreignToken)).body.data.items).toEqual([]);
      expect((await get('/folios/summaries?reservationIds=1,0')).status).toBe(422);
      expect((await get('/folios/summaries?reservationIds=' + Array.from({ length: 51 }, () => '1').join(','))).status)
        .toBe(422);
    });
    it('records cash and confirmed bank transfers and rejects missing attestations/references', async () => {
      const folioId = await open();
      expect(
        (
          await pay(folioId, '100000', randomUUID(), app, {
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: 'BANK-TEST-001',
          })
        ).body.data,
      ).toMatchObject({
        status: 'CONFIRMED',
        paymentMethod: 'BANK_TRANSFER',
        processedBy: scope.actorId.toString(),
      });
      expect(
        (await pay(folioId, '1', randomUUID(), app, { paymentMethod: 'BANK_TRANSFER' })).status,
      ).toBe(422);
      expect(
        (await pay(folioId, '1', randomUUID(), app, { confirmedReceived: false })).status,
      ).toBe(422);
      expect((await pay(folioId, '1800000')).body.error.code).toBe(
        'INSUFFICIENT_OUTSTANDING_BALANCE',
      );
      expect((await get(`/folios/${folioId}/payments`)).body.data.pagination.total).toBe(1);
    });
    it.each(['-1', '0', '1.01', '10000000000000000'])(
      'rejects payment amount %s through HTTP',
      async (amount) => {
        expect((await pay(await open(), amount)).status).toBe(422);
      },
    );
    it('replays normalized same payload, rejects changed payload and cross-operation key reuse', async () => {
      const folioId = await open();
      const key = randomUUID();
      const first = await pay(folioId, '100000', key);
      expect((await pay(folioId, '100000.00', key)).body).toEqual(first.body);
      expect((await pay(folioId, '100001', key)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
      expect((await refund(String(first.body.data.id), '1', key)).body.error.code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
      expect((await adjust(folioId, '1', 'CREDIT', key)).body.error.code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
    });
    it('requires valid Idempotency-Key and rejects financial field injection', async () => {
      const folioId = await open();
      const payload = {
        paymentType: 'PAYMENT',
        paymentMethod: 'CASH',
        amount: '1',
        confirmedReceived: true,
      };
      expect(
        (
          await request(app)
            .post(`/api/v1/folios/${folioId}/payments`)
            .auth(token, { type: 'bearer' })
            .set('X-CSRF-Protection', '1')
            .send(payload)
        ).status,
      ).toBe(422);
      expect((await pay(folioId, '1', 'bad')).status).toBe(422);
      expect(
        (
          await pay(folioId, '1', randomUUID(), app, {
            processedBy: '2',
            status: 'CONFIRMED',
            hotelId: '2',
          })
        ).status,
      ).toBe(422);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('partially refunds, preserves originals and computes net paid correctly', async () => {
      const folioId = await open();
      const payment = await pay(folioId, '1000000');
      const id = String(payment.body.data.id);
      const key = randomUUID();
      const a = await refund(id, '200000', key);
      expect(a.status).toBe(201);
      expect((await refund(id, '200000', key)).body).toEqual(a.body);
      expect((await refund(id, '300000')).status).toBe(201);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        totalPayments: '1000000.00',
        totalRefunds: '500000.00',
        netPaid: '500000.00',
        outstandingBalance: '1300000.00',
      });
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: BigInt(id) } })).amount.toFixed(2),
      ).toBe('1000000.00');
      expect((await refund(id, '500001')).body.error.code).toBe('REFUND_AMOUNT_EXCEEDED');
      expect((await refund(String(a.body.data.id), '1')).body.error.code).toBe(
        'REFUND_NOT_ALLOWED',
      );
      expect((await refund(id, '500000')).status).toBe(201);
      expect((await refund(id, '1')).body.error.code).toBe('PAYMENT_ALREADY_REFUNDED');
    });
    it('requires actual outgoing bank refund reference and approval reason', async () => {
      const payment = await pay(await open(), '500000', randomUUID(), app, {
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'IN-123',
      });
      const id = String(payment.body.data.id);
      expect((await refund(id, '1')).body.error.code).toBe('REFUND_REFERENCE_REQUIRED');
      expect(
        (await refund(id, '1', randomUUID(), app, { referenceNumber: 'OUT-123', reason: '' }))
          .status,
      ).toBe(422);
      expect(
        (
          await refund(id, '1', randomUUID(), app, {
            referenceNumber: 'OUT-123',
            confirmedRefunded: false,
          })
        ).status,
      ).toBe(422);
      expect(
        (await refund(id, '100000', randomUUID(), app, { referenceNumber: 'OUT-123' })).body.data
          .referenceNumber,
      ).toBe('OUT-123');
    });
    it('adjustments append history, reference original items and cannot create negative balance', async () => {
      const folioId = await open();
      const oldItems = await db.folioItem.findMany({ where: { hotelId: scope.hotelId } });
      const key = randomUUID();
      const path = `/folios/${folioId}/adjustments`;
      const body = {
        entryType: 'CREDIT',
        amount: '100000',
        reason: 'Approved concession',
        relatedItemId: oldItems[0]!.id.toString(),
      };
      const first = await post(path, body, key);
      expect(first.status).toBe(201);
      expect((await post(path, body, key)).body).toEqual(first.body);
      expect((await get(`/folios/${folioId}`)).body.data.outstandingBalance).toBe('1700000.00');
      expect((await adjust(folioId, '1700001')).status).toBe(409);
      expect(
        await db.folioItem.findMany({ where: { id: { in: oldItems.map((item) => item.id) } } }),
      ).toEqual(oldItems);
      expect(
        (
          await request(app)
            .patch(`/api/v1/folios/${folioId}/items/${oldItems[0]!.id}`)
            .auth(token, { type: 'bearer' })
            .send({ amount: '0' })
        ).status,
      ).toBe(404);
    });
    it('supports manual cancellation settlement by refund then credit, with no automatic policy', async () => {
      const folioId = await open();
      const receipt = await pay(folioId, '500000', randomUUID(), app, { paymentType: 'DEPOSIT' });
      await post(`/reservations/${booking.id}/cancel`, { reason: 'Manager approved cancellation' });
      expect((await adjust(folioId, '1800000')).status).toBe(409);
      expect((await refund(String(receipt.body.data.id), '500000')).status).toBe(201);
      expect((await adjust(folioId, '1800000')).status).toBe(201);
      expect((await post(`/folios/${folioId}/close`)).body.data.status).toBe('CLOSED');
    });
    it('blocks closure for unfinished services and pending money even at zero balance', async () => {
      const stayId = await active();
      const folioId = await open();
      const orderId = await order(await catalog());
      await pay(folioId, '1800000');
      await post(`/stays/${stayId}/check-out`);
      expect((await post(`/folios/${folioId}/close`)).body.error.code).toBe(
        'FOLIO_PENDING_ACTIVITY',
      );
      await post(`/service-orders/${orderId}/cancel`, { reason: 'Not delivered' });
      const pending = await db.payment.create({
        data: {
          hotelId: scope.hotelId,
          folioId: BigInt(folioId),
          paymentType: 'PAYMENT',
          paymentMethod: 'CASH',
          amount: '1',
          status: 'PENDING',
          processedBy: scope.actorId,
        },
      });
      expect((await get(`/folios/${folioId}`)).body.data.outstandingBalance).toBe('0.00');
      expect((await post(`/folios/${folioId}/close`)).body.error.code).toBe(
        'FOLIO_PENDING_ACTIVITY',
      );
      expect((await refund(String(pending.id), '1')).body.error.code).toBe('REFUND_NOT_ALLOWED');
    });
    it('serializes same-key payments across independent clients to one receipt and one audit', async () => {
      const folioId = await open();
      const key = randomUUID();
      const [a, b] = await Promise.all([
        pay(folioId, '1000000', key),
        pay(folioId, '1000000', key, otherApp),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body).toEqual(b.body);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      expect(
        await db.billingAuditLog.count({
          where: { hotelId: scope.hotelId, action: 'PAYMENT_RECORDED' },
        }),
      ).toBe(1);
    });
    it('prevents two concurrent distinct payments exceeding current debt', async () => {
      const folioId = await open();
      const results = await Promise.all([
        pay(folioId, '1000000'),
        pay(folioId, '1000000', randomUUID(), otherApp),
      ]);
      expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
      expect((await get(`/folios/${folioId}`)).body.data.outstandingBalance).toBe('800000.00');
    });
    it('prevents two concurrent refunds exceeding the original receipt', async () => {
      const receipt = await pay(await open(), '1000000');
      const id = String(receipt.body.data.id);
      const results = await Promise.all([
        refund(id, '600000'),
        refund(id, '600000', randomUUID(), otherApp),
      ]);
      expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(
        (
          await db.payment.aggregate({
            where: { originalPaymentId: BigInt(id) },
            _sum: { amount: true },
          })
        )._sum.amount?.toFixed(2),
      ).toBe('600000.00');
    });
    it('serializes duplicate service completion to exactly one posted source', async () => {
      await active();
      const folioId = await open();
      const orderId = await order(await catalog());
      const [a, b] = await Promise.all([
        post(`/service-orders/${orderId}/complete`),
        post(`/service-orders/${orderId}/complete`, {}, randomUUID(), otherApp),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body).toEqual(b.body);
      expect((await get(`/folios/${folioId}`)).body.data.totalCharges).toBe('1900000.00');
      expect(
        await db.folioItem.count({
          where: { hotelId: scope.hotelId, sourceType: 'SERVICE_ORDER_ITEM' },
        }),
      ).toBe(1);
    });
    it('serializes credit adjustment against payment without a negative balance', async () => {
      const folioId = await open();
      const results = await Promise.all([
        pay(folioId, '1500000'),
        adjust(folioId, '500000', 'CREDIT', randomUUID(), otherApp),
      ]);
      expect(results.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(['300000.00', '1300000.00']).toContain(
        (await get(`/folios/${folioId}`)).body.data.outstandingBalance,
      );
    });
    it('close-versus-complete cannot close with pending fees or post into a closed folio', async () => {
      const stayId = await active();
      const folioId = await open();
      const orderId = await order(await catalog());
      await pay(folioId, '1800000');
      await post(`/stays/${stayId}/check-out`);
      const [close, complete] = await Promise.all([
        post(`/folios/${folioId}/close`),
        post(`/service-orders/${orderId}/complete`, {}, randomUUID(), otherApp),
      ]);
      expect(close.status).toBe(409);
      expect(complete.status).toBe(200);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        status: 'OPEN',
        outstandingBalance: '100000.00',
      });
    });
    it('close-versus-debit has only a closed unchanged folio or an open indebted folio', async () => {
      const stayId = await active();
      const folioId = await open();
      await pay(folioId, '1800000');
      await post(`/stays/${stayId}/check-out`);
      const [close, debit] = await Promise.all([
        post(`/folios/${folioId}/close`),
        adjust(folioId, '100000', 'DEBIT', randomUUID(), otherApp),
      ]);
      expect([close.status, debit.status]).toEqual(close.status === 200 ? [200, 409] : [409, 201]);
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject(
        close.status === 200
          ? { status: 'CLOSED', outstandingBalance: '0.00' }
          : { status: 'OPEN', outstandingBalance: '100000.00' },
      );
    });
    it('rolls back service posting and status when audit fails', async () => {
      await active();
      const folioId = await open();
      const orderId = await order(await catalog());
      vi.spyOn(PrismaBillingRepository.prototype, 'audit').mockRejectedValueOnce(
        new Error('private SQL credential secret'),
      );
      const response = await post(`/service-orders/${orderId}/complete`);
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toMatch(/SQL|credential|secret|stack|prisma/i);
      expect((await get(`/service-orders/${orderId}`)).body.data.status).toBe('REQUESTED');
      expect((await get(`/folios/${folioId}`)).body.data.totalCharges).toBe('1800000.00');
      expect((await post(`/service-orders/${orderId}/complete`)).status).toBe(200);
    });
    it('rolls back payment, audit and idempotency atomically when key persistence fails; same-key retry succeeds', async () => {
      const folioId = await open();
      const key = randomUUID();
      vi.spyOn(PrismaBillingRepository.prototype, 'saveKey').mockRejectedValueOnce(
        new Error('synthetic failure'),
      );
      expect((await pay(folioId, '100000', key)).status).toBe(500);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(
        await db.billingAuditLog.count({
          where: { hotelId: scope.hotelId, action: 'PAYMENT_RECORDED' },
        }),
      ).toBe(0);
      expect(await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect((await pay(folioId, '100000', key)).status).toBe(201);
    });
    it('rolls back folio initialization when posting fails', async () => {
      vi.spyOn(PrismaBillingRepository.prototype, 'createItems').mockRejectedValueOnce(
        new Error('synthetic failure'),
      );
      expect((await post(`/reservations/${booking.id}/folio/open`)).status).toBe(500);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.folioItem.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      await open();
    });
    it('database uniqueness and composite foreign keys reject duplicate sources and foreign financial writes', async () => {
      const folioId = await open();
      const item = (await db.folioItem.findMany({ where: { hotelId: scope.hotelId } }))[0]!;
      await expect(
        db.folioItem.create({
          data: {
            hotelId: scope.hotelId,
            folioId: BigInt(folioId),
            sourceType: 'ROOM_NIGHT',
            sourceId: item.sourceId,
            roomNightId: item.roomNightId,
            entryType: 'DEBIT',
            amount: item.amount,
            description: 'duplicate',
            createdBy: scope.actorId,
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.payment.create({
          data: {
            hotelId: hotels[1]!,
            folioId: BigInt(folioId),
            paymentType: 'PAYMENT',
            paymentMethod: 'CASH',
            amount: '1',
            status: 'CONFIRMED',
            processedBy: scope.actorId,
          },
        }),
      ).rejects.toThrow();
      await expect(
        db.payment.create({
          data: {
            hotelId: scope.hotelId,
            folioId: BigInt(folioId),
            paymentType: 'PAYMENT',
            paymentMethod: 'CASH',
            amount: '-1',
            status: 'CONFIRMED',
            processedBy: scope.actorId,
          },
        }),
      ).rejects.toThrow();
    });
    it('isolates every financial resource from another hotel, including ADMIN', async () => {
      await active();
      const folioId = await open();
      const serviceId = await catalog();
      const orderId = await order(serviceId);
      const receipt = await pay(folioId, '100000');
      for (const path of [
        `/folios/${folioId}`,
        `/folios/${folioId}/items`,
        `/folios/${folioId}/payments`,
        `/reservations/${booking.id}/folio`,
        `/services/${serviceId}`,
        `/service-orders/${orderId}`,
      ])
        expect((await get(path, foreignToken)).status).toBe(404);
      for (const [path, body] of [
        [`/folios/${folioId}/close`, {}],
        [`/reservations/${booking.id}/folio/open`, {}],
        [`/service-orders/${orderId}/complete`, {}],
        [
          `/payments/${receipt.body.data.id}/refunds`,
          { amount: '1', reason: 'Foreign attempt', confirmedRefunded: true },
        ],
        [
          `/folios/${folioId}/payments`,
          { amount: '1', paymentType: 'PAYMENT', paymentMethod: 'CASH', confirmedReceived: true },
        ],
      ] as const)
        expect((await post(path, body, randomUUID(), app, foreignToken)).status).toBe(404);
      expect((await get('/services', foreignToken)).body.data.items).toEqual([]);
      expect((await get('/service-orders', foreignToken)).body.data.items).toEqual([]);
    });
    it('requires JWT and CSRF and uses current server roles, including on idempotent replay', async () => {
      const folioId = await open();
      const key = randomUUID();
      const receipt = await pay(folioId, '100000', key);
      expect((await request(app).get(`/api/v1/folios/${folioId}`)).status).toBe(401);
      expect(
        (
          await request(app)
            .post(`/api/v1/folios/${folioId}/close`)
            .auth(token, { type: 'bearer' })
            .send({})
        ).status,
      ).toBe(403);
      await changeRole('RECEPTIONIST');
      expect((await pay(folioId, '1')).status).toBe(201);
      expect((await refund(String(receipt.body.data.id), '1')).status).toBe(403);
      expect((await adjust(folioId, '1')).status).toBe(403);
      expect(
        (await post('/services', { code: 'DENIED', name: 'Denied', unit: 'item', price: '0' }))
          .status,
      ).toBe(403);
      await changeRole('HOUSEKEEPING');
      expect((await pay(folioId, '100000', key)).status).toBe(403);
      expect((await get(`/folios/${folioId}`)).status).toBe(403);
    });
    it.each(['HOUSEKEEPING', 'TECHNICIAN'] as const)(
      '%s cannot read or mutate Billing',
      async (role) => {
        const folioId = await open();
        await changeRole(role);
        expect((await get('/services')).status).toBe(403);
        expect((await pay(folioId, '1')).status).toBe(403);
        expect((await adjust(folioId, '1')).status).toBe(403);
        expect(
          (
            await post(`/payments/${missing}/refunds`, {
              amount: '1',
              reason: 'Denied',
              confirmedRefunded: true,
            })
          ).status,
        ).toBe(403);
      },
    );
    it.each(['MANAGER', 'ACCOUNTANT'] as const)(
      '%s can settle payments/refunds/adjustments under policy',
      async (role) => {
        const folioId = await open();
        await changeRole(role);
        const receipt = await pay(folioId, '100000');
        expect(receipt.status).toBe(201);
        expect((await refund(String(receipt.body.data.id), '50000')).status).toBe(201);
        expect((await adjust(folioId, '100000')).status).toBe(201);
        if (role === 'ACCOUNTANT')
          expect(
            (await post('/services', { code: 'DENIED', name: 'Denied', unit: 'item', price: '0' }))
              .status,
          ).toBe(403);
      },
    );
    it('refuses incomplete nightly snapshots without creating a partially charged folio', async () => {
      const night = await db.reservationRoomNight.findFirstOrThrow({
        where: { reservationRoom: { reservationId: BigInt(booking.id) } },
      });
      // Corrupt only this synthetic fixture to simulate incomplete legacy/imported data.
      await db.reservationRoomNight.delete({ where: { id: night.id } });
      const response = await post(`/reservations/${booking.id}/folio/open`);
      expect(response.body.error.code).toBe('ROOM_SNAPSHOTS_MISSING');
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('rejects foreign services and stays on an otherwise valid own-hotel order', async () => {
      await active();
      const ownService = await catalog();
      const foreignHotel = hotels[1]!;
      const foreignStaff = await db.staffUser.findFirstOrThrow({
        where: { hotelId: foreignHotel },
      });
      const foreignService = await db.service.create({
        data: { hotelId: foreignHotel, code: 'FOREIGN', name: 'Foreign', unit: 'item', price: '1' },
      });
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            items: [{ serviceId: foreignService.id.toString(), quantity: 1 }],
          })
        ).body.error.code,
      ).toBe('SERVICE_NOT_FOUND');
      const guest = await db.guest.create({
        data: { hotelId: foreignHotel, fullName: 'Foreign synthetic guest' },
      });
      const type = await db.roomType.create({
        data: {
          hotelId: foreignHotel,
          code: 'FOREIGN',
          name: 'Foreign',
          maxAdults: 2,
          basePrice: '1',
        },
      });
      const room = await db.room.create({
        data: {
          hotelId: foreignHotel,
          roomTypeId: type.id,
          roomNumber: '1',
          floorNumber: 1,
          housekeepingStatus: 'READY',
        },
      });
      const foreignScope: BillingScope = {
        hotelId: foreignHotel,
        actorId: foreignStaff.id,
        role: 'ADMIN',
      };
      const foreignBooking = await bookings.create(
        foreignScope,
        createReservationBody.parse({
          guestId: guest.id.toString(),
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          rooms: [{ roomTypeId: type.id.toString(), quantity: 1, adults: 1 }],
        }),
      );
      const foreignStay = await stays.checkin(
        foreignScope,
        BigInt(foreignBooking.id),
        BigInt(foreignBooking.rooms[0]!.id),
        { roomId: room.id.toString() },
      );
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            stayId: foreignStay.stayId,
            items: [{ serviceId: ownService, quantity: 1 }],
          })
        ).body.error.code,
      ).toBe('STAY_NOT_FOUND');
    });
    it('rejects a checked-out stay even when another room remains checked in', async () => {
      booking = await createBooking(2);
      const ended = await active();
      await stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[1]!.id), {
        roomId: roomIds[1]!.toString(),
      });
      await post(`/stays/${ended}/check-out`);
      const serviceId = await catalog();
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            stayId: ended,
            items: [{ serviceId, quantity: 1 }],
          })
        ).body.error.code,
      ).toBe('SERVICE_NOT_ALLOWED');
      expect(
        (
          await post('/service-orders', {
            reservationId: booking.id,
            items: [{ serviceId, quantity: 1 }],
          })
        ).status,
      ).toBe(201);
    });
    it('replays simultaneous same-key refunds once and isolates a reused key from another folio', async () => {
      const folioId = await open();
      const receipt = await pay(folioId, '1000000');
      const key = randomUUID();
      const [a, b] = await Promise.all([
        refund(String(receipt.body.data.id), '200000', key),
        refund(String(receipt.body.data.id), '200000', key, otherApp),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body).toEqual(b.body);
      expect(
        await db.payment.count({ where: { hotelId: scope.hotelId, paymentType: 'REFUND' } }),
      ).toBe(1);
      booking = await createBooking();
      const otherFolio = await open();
      expect((await pay(otherFolio, '200000', key)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });
    it.each(['refund', 'adjustment'] as const)(
      'rolls back %s and its audit/key when persistence fails',
      async (kind) => {
        const folioId = await open();
        const receipt = await pay(folioId, '500000');
        const before = (await get(`/folios/${folioId}`)).body.data;
        const count = await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } });
        vi.spyOn(PrismaBillingRepository.prototype, 'saveKey').mockRejectedValueOnce(
          new Error('synthetic failure'),
        );
        const response =
          kind === 'refund'
            ? await refund(String(receipt.body.data.id), '100000')
            : await adjust(folioId, '100000');
        expect(response.status).toBe(500);
        expect((await get(`/folios/${folioId}`)).body.data).toEqual(before);
        expect(await db.billingIdempotency.count({ where: { hotelId: scope.hotelId } })).toBe(
          count,
        );
        expect(
          await db.billingAuditLog.count({
            where: {
              hotelId: scope.hotelId,
              action: kind === 'refund' ? 'REFUND_RECORDED' : 'FOLIO_ADJUSTED',
            },
          }),
        ).toBe(0);
      },
    );
    const configureQr = (expectedVersion = 0, extra: object = {}, accessToken = token) =>
      request(app)
        .put('/api/v1/hotel/bank-account')
        .auth(accessToken, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send({
          bankBin: '970415',
          accountNumber: '000111222333',
          accountName: 'Nguyễn Văn An',
          enabled: true,
          expectedVersion,
          ...extra,
        });
    const qrCreate = (
      amount = '300000',
      kind = 'DEPOSIT',
      key: string = randomUUID(),
      target = app,
    ) =>
      post(
        `/reservations/${booking.id}/payment-requests`,
        { amount, paymentType: kind },
        key,
        target,
      );
    const qrConfirm = (
      id: string,
      key: string = randomUUID(),
      target = app,
      referenceNumber = 'FT-TEST-100',
    ) =>
      post(
        `/payment-requests/${id}/confirm`,
        { referenceNumber, confirmedReceived: true },
        key,
        target,
      );
    it('QR account is scoped, versioned, audited and editable only by hotel ADMIN', async () => {
      expect((await get('/hotel/bank-account')).body.data).toBeNull();
      const saved = await configureQr();
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      expect(saved.body.data).toMatchObject({
        version: 1,
        accountNumber: '000111222333',
        accountName: 'NGUYEN VAN AN',
      });
      expect((await configureQr()).body.error.code).toBe('BANK_ACCOUNT_STALE');
      expect((await get('/hotel/bank-account', foreignToken)).body.data).toBeNull();
      for (const role of ['MANAGER', 'RECEPTIONIST', 'ACCOUNTANT', 'HOUSEKEEPING'] as const) {
        await changeRole(role);
        expect((await configureQr(1)).status).toBe(403);
      }
      expect(
        await db.billingAuditLog.count({
          where: { hotelId: scope.hotelId, action: 'BANK_ACCOUNT_UPDATED' },
        }),
      ).toBe(1);
    });
    it('QR creation and rendering do not open a folio, post money or change booking snapshots', async () => {
      expect((await configureQr()).status).toBe(200);
      const result = await qrCreate();
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      const id = result.body.data.id;
      expect(result.body.data).toMatchObject({
        amount: '300000.00',
        status: 'PENDING',
        folioId: null,
        paymentId: null,
      });
      expect(result.body.data.memo).toMatch(/^INN[A-F0-9]{16}$/);
      const detail = await get(`/payment-requests/${id}`);
      expect(detail.body.data).toMatchObject({
        canConfirm: true,
        bankBin: '970415',
        accountNumber: '000111222333',
      });
      expect(detail.body.data.qrDataURL).toMatch(/^data:image\/png;base64,/);
      expect((await get(`/payment-requests/${id}`, foreignToken)).status).toBe(404);
      expect((await get(`/reservations/${booking.id}/payment-requests`, foreignToken)).status).toBe(
        404,
      );
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('QR rejects absent account, invalid money, excess amount, missing key and unconfirmed receipt', async () => {
      expect((await qrCreate()).body.error.code).toBe('BANK_ACCOUNT_UNCONFIGURED');
      await configureQr();
      for (const amount of ['0', '1.50', '10000000000000', '-1'])
        expect((await qrCreate(amount)).status).toBe(422);
      expect((await qrCreate('1800001')).status).toBe(409);
      expect((await qrCreate('10', 'REFUND')).status).toBe(422);
      expect((await qrCreate('10', 'DEPOSIT', '')).status).toBe(422);
      const id = (await qrCreate()).body.data.id;
      expect(
        (
          await post(`/payment-requests/${id}/confirm`, {
            referenceNumber: 'FT-TEST',
            confirmedReceived: false,
          })
        ).status,
      ).toBe(422);
      expect((await qrConfirm(id, randomUUID(), app, ' ')).status).toBe(422);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it('QR concurrent creation and confirmation with different keys produce one request, one folio and one receipt', async () => {
      await configureQr();
      const created = await Promise.all([
        qrCreate(),
        qrCreate('300000', 'DEPOSIT', randomUUID(), otherApp),
      ]);
      expect(created.map((x) => x.status)).toEqual([201, 201]);
      const id = created[0]!.body.data.id;
      expect(created[1]!.body.data.id).toBe(id);
      const confirmations = await Promise.all([
        qrConfirm(id),
        qrConfirm(id, randomUUID(), otherApp),
      ]);
      expect(confirmations.map((x) => x.status)).toEqual([200, 200]);
      expect(confirmations[1]!.body.data.paymentId).toBe(confirmations[0]!.body.data.paymentId);
      expect(await db.paymentRequest.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      const folioId = confirmations[0]!.body.data.folioId;
      expect((await get(`/folios/${folioId}`)).body.data).toMatchObject({
        totalDeposits: '300000.00',
        outstandingBalance: '1500000.00',
      });
      expect((await qrConfirm(id, randomUUID(), app, 'OTHER-REF')).status).toBe(409);
    });
    it.each(['manual', 'qr'])(
      'QR refuses a bank reference already recorded through %s receipt',
      async (source) => {
        await configureQr();
        const id = (await qrCreate()).body.data.id;
        if (source === 'qr') {
          expect((await qrConfirm(id)).status).toBe(200);
        } else {
          const folioId = await open();
          expect(
            (
              await pay(folioId, '300000', randomUUID(), app, {
                paymentMethod: 'BANK_TRANSFER',
                referenceNumber: 'FT-TEST-100',
              })
            ).status,
          ).toBe(201);
        }
        const pendingId = source === 'qr' ? (await qrCreate()).body.data.id : id;
        expect((await qrConfirm(pendingId)).body.error.code).toBe(
          'BANK_REFERENCE_ALREADY_RECORDED',
        );
        expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(1);
      },
    );
    it('QR replays stable keys, rejects changed payload and resumes the pending request without duplicating', async () => {
      await configureQr();
      const key = randomUUID(),
        first = await qrCreate('300000', 'DEPOSIT', key);
      expect((await qrCreate('300000', 'DEPOSIT', key)).body.data).toEqual(first.body.data);
      expect((await qrCreate('400000', 'DEPOSIT', key)).body.error.code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
      expect((await qrCreate('400000')).body.error.code).toBe('QR_REQUEST_PENDING');
      const id = first.body.data.id;
      expect(
        (await get(`/reservations/${booking.id}/payment-requests`)).body.data.items[0].id,
      ).toBe(id);
      const confirmKey = randomUUID(),
        confirmed = await qrConfirm(id, confirmKey);
      expect((await qrConfirm(id, confirmKey)).body.data).toEqual(confirmed.body.data);
      expect((await qrConfirm(id, confirmKey, app, 'DIFFERENT')).body.error.code).toBe(
        'IDEMPOTENCY_CONFLICT',
      );
    });
    it.each(['createPayment', 'audit', 'saveKey'] as const)(
      'QR %s failure rolls back folio, receipt, request status and idempotency result',
      async (method) => {
        await configureQr();
        const id = (await qrCreate()).body.data.id,
          key = randomUUID();
        const injection = vi
          .spyOn(PrismaBillingRepository.prototype, method)
          .mockRejectedValueOnce(new Error('Synthetic QR failure'));
        expect((await qrConfirm(id, key)).status).toBe(500);
        injection.mockRestore();
        expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
        expect(
          (await db.paymentRequest.findUniqueOrThrow({ where: { id: BigInt(id) } })).status,
        ).toBe('PENDING');
        expect((await qrConfirm(id, key)).status).toBe(200);
      },
    );
    it('QR detects changed debt, keeps the request immutable and cancels pending QR after closing folio', async () => {
      await configureQr();
      const stayId = await active();
      const folioId = await open();
      const id = (await qrCreate('1800000', 'PAYMENT')).body.data.id;
      await pay(folioId, '1800000');
      expect((await qrConfirm(id)).body.error.code).toBe('INSUFFICIENT_OUTSTANDING_BALANCE');
      expect((await get(`/payment-requests/${id}`)).body.data).toMatchObject({
        canConfirm: false,
        qrDataURL: null,
        amount: '1800000.00',
      });
      expect((await post(`/stays/${stayId}/check-out`)).status).toBe(200);
      expect((await post(`/folios/${folioId}/close`)).status).toBe(200);
      expect((await get(`/payment-requests/${id}`)).body.data.status).toBe('CANCELLED');
    });
    it('QR bank change or disable cancels pending requests, never changes paid receipts or snapshots', async () => {
      await configureQr();
      const id = (await qrCreate()).body.data.id;
      expect((await configureQr(1, { accountNumber: '999000111222', enabled: false })).status).toBe(
        200,
      );
      expect((await get(`/payment-requests/${id}`)).body.data).toMatchObject({
        status: 'CANCELLED',
        accountNumber: '000111222333',
        qrDataURL: null,
      });
      expect((await qrConfirm(id)).status).toBe(409);
      expect((await qrCreate()).status).toBe(409);
      expect(await db.payment.count({ where: { hotelId: scope.hotelId } })).toBe(0);
    });
    it.each(['cancel', 'no-show'])(
      'QR %s cancels deposit requests and does not open a folio',
      async (action) => {
        await configureQr();
        const id = (await qrCreate()).body.data.id;
        expect(
          (await post(`/reservations/${booking.id}/${action}`, { reason: 'Guest did not arrive' }))
            .status,
        ).toBe(200);
        expect((await get(`/payment-requests/${id}`)).body.data.status).toBe('CANCELLED');
        expect((await qrConfirm(id)).status).toBe(409);
        expect(await db.folio.count({ where: { hotelId: scope.hotelId } })).toBe(0);
      },
    );
    it('QR cancellation is idempotent; a replacement has a new memo; confirmation of full deposit reuses folio at check-in', async () => {
      await configureQr();
      const original = (await qrCreate()).body.data,
        key = randomUUID();
      const cancel = () =>
        post(
          `/payment-requests/${original.id}/cancel`,
          { reason: 'Customer changed deposit' },
          key,
        );
      expect((await cancel()).status).toBe(200);
      expect((await cancel()).status).toBe(200);
      const next = await qrCreate('1800000');
      expect(next.body.data.memo).not.toBe(original.memo);
      const confirmed = await qrConfirm(next.body.data.id);
      expect(confirmed.status).toBe(200);
      const stay = await stays.checkin(scope, BigInt(booking.id), BigInt(booking.rooms[0]!.id), {
        roomId: roomIds[0]!.toString(),
      });
      expect(stay.folioId).toBe(confirmed.body.data.folioId);
      expect((await get(`/folios/${stay.folioId}`)).body.data.outstandingBalance).toBe('0.00');
    });
    it('serves Swagger and browser preflight for Idempotency-Key', async () => {
      expect((await request(app).get('/api-docs/')).status).toBe(200);
      const spec = (await request(app).get('/api-docs/openapi.json')).body;
      expect(spec.paths['/folios/{folioId}/payments'].post.security).toEqual([{ bearerAuth: [] }]);
      expect(spec.paths['/payments/{id}/refunds'].post.parameters).toContainEqual(
        expect.objectContaining({ name: 'Idempotency-Key', required: true }),
      );
      const preflight = await request(app)
        .options('/api/v1/folios/1/payments')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Idempotency-Key');
      expect(String(preflight.headers['access-control-allow-headers'])).toContain(
        'Idempotency-Key',
      );
    });
  },
);
