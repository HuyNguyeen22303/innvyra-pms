import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { ROLE_CODES } from '../src/shared/types/roles.js';
import { memoryGuests } from './guest-helpers.js';
import { memoryRooms } from './room-helpers.js';
import { MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { futureDay, memoryReservations, reservationInput } from './reservation-helpers.js';

describe('reservations HTTP: auth, roles, dates, availability and lifecycle', () => {
  let hash: string;
  let auth: MemoryAuthRepository;
  let store: ReturnType<typeof memoryReservations>;
  let app: ReturnType<typeof createApp>;
  let token: string;
  beforeAll(async () => {
    hash = await hashPassword(testPassword);
  });
  beforeEach(async () => {
    auth = new MemoryAuthRepository(hash);
    store = memoryReservations();
    app = createApp(
      testEnv,
      auth,
      memoryRooms().repositories,
      memoryGuests().repository,
      store.repository,
    );
    token = (
      await new AuthService(auth, testEnv).login({ username: 'admin', password: testPassword })
    ).data.accessToken;
  });
  const post = (body: object = reservationInput()) =>
    request(app)
      .post('/api/v1/reservations')
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body);
  const get = (path = '/reservations') =>
    request(app).get(`/api/v1${path}`).auth(token, { type: 'bearer' });
  const cancel = (id: string, reason = 'Travel plans changed') =>
    request(app)
      .post(`/api/v1/reservations/${id}/cancel`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send({ reason });
  const available = (extra: object = {}) =>
    get('/rooms/availability').query({
      checkInDate: futureDay(10),
      checkOutDate: futureDay(12),
      adults: '2',
      children: '0',
      ...extra,
    });
  it('requires JWT and a live server-side session', async () => {
    expect((await request(app).get('/api/v1/rooms/availability')).status).toBe(401);
    expect((await request(app).post('/api/v1/reservations').send(reservationInput())).status).toBe(
      401,
    );
    for (const session of auth.sessions.values()) session.revokedAt = new Date();
    expect((await get()).status).toBe(401);
  });
  it.each(ROLE_CODES)(
    'enforces %s permissions for read, create, availability and cancel',
    async (role) => {
      const created = await post();
      auth.users.get('admin')!.role.code = role;
      const write = ['ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(role);
      const read = write || role === 'ACCOUNTANT';
      expect((await get()).status).toBe(read ? 200 : 403);
      expect((await get(`/reservations/${created.body.data.id}`)).status).toBe(read ? 200 : 403);
      expect((await available()).status).toBe(write ? 200 : 403);
      expect((await post()).status).toBe(write ? 201 : 403);
      expect((await cancel(created.body.data.id)).status).toBe(write ? 200 : 403);
    },
  );
  it('requires CSRF and rejects arbitrary PATCH, assignment and status/price writes', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/reservations')
          .auth(token, { type: 'bearer' })
          .send(reservationInput())
      ).status,
    ).toBe(403);
    for (const field of ['hotelId', 'status', 'totalAmount', 'createdBy', 'roomId'])
      expect((await post({ ...reservationInput(), [field]: '1' })).status).toBe(422);
    expect(
      (
        await request(app)
          .patch('/api/v1/reservations/1')
          .auth(token, { type: 'bearer' })
          .send({ status: 'CONFIRMED' })
      ).status,
    ).toBe(404);
  });
  it('creates multiple rooms/types with safe BigInt, exact snapshots and private guest projection', async () => {
    const result = await post({
      ...reservationInput(),
      rooms: [
        { roomTypeId: '2', quantity: 2, adults: 2, children: 1 },
        { roomTypeId: '4', quantity: 1, adults: 1, children: 0 },
      ],
    });
    expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({
      status: 'CONFIRMED',
      totalRooms: 3,
      totalNights: 2,
      totalAmount: '5400000.06',
      currency: 'VND',
    });
    expect(typeof result.body.data.id).toBe('string');
    expect(result.body.data.rooms).toHaveLength(3);
    for (const room of result.body.data.rooms) {
      expect(room.roomId).toBeNull();
      expect(room.nights).toHaveLength(2);
    }
    expect(Object.keys(result.body.data.bookerGuest)).toEqual(['id', 'fullName']);
    expect(result.text).not.toMatch(/document|ciphertext|password|phone|email/);
    const listed = await get();
    expect(listed.body.data.pagination).toMatchObject({ total: 1, page: 1, totalPages: 1 });
    expect(listed.body.data.items[0]).not.toHaveProperty('rooms');
    expect((await get(`/reservations/${result.body.data.id}`)).headers['cache-control']).toBe(
      'no-store',
    );
  });
  it('availability uses the busiest night and half-open boundaries', async () => {
    expect((await available({ roomTypeId: '2' })).body.data[0].availableRooms).toBe(3);
    const booking = {
      ...reservationInput(),
      checkInDate: futureDay(11),
      checkOutDate: futureDay(13),
      rooms: [{ roomTypeId: '2', quantity: 3, adults: 2, children: 0 }],
    };
    expect((await post(booking)).status).toBe(201);
    expect((await available({ roomTypeId: '2' })).body.data[0].availableRooms).toBe(0);
    expect((await post()).status).toBe(409);
    expect(
      (
        await available({
          roomTypeId: '2',
          checkInDate: futureDay(13),
          checkOutDate: futureDay(14),
        })
      ).body.data[0].availableRooms,
    ).toBe(3);
    expect(
      (await available({ roomTypeId: '2', checkInDate: futureDay(9), checkOutDate: futureDay(11) }))
        .body.data[0].availableRooms,
    ).toBe(3);
  });
  it('rejects equal, reversed, past, excessive and malformed dates', async () => {
    for (const dates of [
      { checkOutDate: futureDay(10) },
      { checkOutDate: futureDay(9) },
      { checkInDate: futureDay(-1) },
      { checkOutDate: futureDay(50) },
      { checkInDate: '2026-02-30' },
    ]) {
      expect((await available(dates)).status).toBe(422);
      expect((await post({ ...reservationInput(), ...dates })).status).toBe(422);
    }
  });
  it('rejects missing/deleted/foreign guests and foreign room types without leaking data', async () => {
    store.guests.set(13n, 2n);
    for (const guestId of ['99', '13'])
      expect((await post({ ...reservationInput(), guestId })).body.error.code).toBe(
        'GUEST_NOT_FOUND',
      );
    store.guests.delete(12n);
    expect((await post()).status).toBe(404);
    store.guests.set(12n, 9007199254740995n);
    store.types.get(2n)!.hotelId = 2n;
    expect((await post()).body.error.code).toBe('ROOM_TYPE_NOT_FOUND');
    expect((await available({ roomTypeId: '2' })).status).toBe(404);
    expect((await available()).body.data.map((t: { roomTypeId: string }) => t.roomTypeId)).toEqual([
      '4',
    ]);
  });
  it('handles inactive/missing types, guest capacity and quantity validation', async () => {
    expect((await available({ roomTypeId: '999' })).status).toBe(404);
    store.types.get(2n)!.isActive = false;
    expect((await available({ roomTypeId: '2' })).status).toBe(409);
    expect((await post()).body.error.code).toBe('ROOM_TYPE_INACTIVE');
    store.types.get(2n)!.isActive = true;
    expect((await available({ adults: '3' })).body.data).toEqual([]);
    expect(
      (await post({ ...reservationInput(), rooms: [{ roomTypeId: '2', quantity: 1, adults: 3 }] }))
        .body.error.code,
    ).toBe('ROOM_CAPACITY_EXCEEDED');
    for (const quantity of [0, -1, 0.5])
      expect(
        (await post({ ...reservationInput(), rooms: [{ roomTypeId: '2', quantity, adults: 2 }] }))
          .status,
      ).toBe(422);
  });
  it('cancels idempotently, preserves audit/snapshots and releases capacity exactly once', async () => {
    const created = await post();
    const id = created.body.data.id;
    expect((await available({ roomTypeId: '2' })).body.data[0].availableRooms).toBe(2);
    expect((await cancel(id)).status).toBe(200);
    const first = (await get(`/reservations/${id}`)).body.data;
    expect((await cancel(id, 'Different second reason')).status).toBe(200);
    const second = (await get(`/reservations/${id}`)).body.data;
    expect(second.cancellation).toEqual(first.cancellation);
    expect(second.totalAmount).toEqual(created.body.data.totalAmount);
    expect(second.rooms).toEqual(created.body.data.rooms);
    expect((await available({ roomTypeId: '2' })).body.data[0].availableRooms).toBe(3);
  });
  it.each(['CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW'] as const)(
    'rejects cancelling %s',
    async (status) => {
      const created = await post();
      store.records.get(BigInt(created.body.data.id))!.status = status;
      expect((await cancel(created.body.data.id)).body.error.code).toBe(
        'RESERVATION_CANNOT_BE_CANCELLED',
      );
    },
  );
  it('hides foreign reservations, notes and restricted guest search', async () => {
    const created = await post({ ...reservationInput(), notes: 'Private preference' });
    auth.users.get('admin')!.role.code = 'ACCOUNTANT';
    const detail = await get(`/reservations/${created.body.data.id}`);
    expect(detail.body.data).not.toHaveProperty('notes');
    expect((await get().query({ guestSearch: 'Guest' })).status).toBe(403);
    auth.users.get('admin')!.role.code = 'ADMIN';
    store.records.get(BigInt(created.body.data.id))!.hotelId = 999n;
    expect((await get(`/reservations/${created.body.data.id}`)).status).toBe(404);
    expect((await cancel(created.body.data.id)).status).toBe(404);
    expect((await get()).body.data.items).toEqual([]);
  });
  it('serves Swagger UI/JSON with 79 operations, complete reservation contracts and valid refs', async () => {
    expect((await request(app).get('/api-docs/')).status).toBe(200);
    const spec = (await request(app).get('/api-docs/openapi.json')).body;
    expect(Object.values(spec.paths).flatMap((path) => Object.keys(path as object))).toHaveLength(
      79,
    );
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === '$ref')
          expect(spec.components.schemas[String(child).split('/').pop()!]).toBeDefined();
        else visit(child);
      }
    };
    visit(spec);
    for (const path of [
      '/rooms/availability',
      '/reservations',
      '/reservations/{id}',
      '/reservations/{id}/cancel',
    ])
      for (const op of Object.values(spec.paths[path]) as {
        security: unknown;
        description: string;
        responses: object;
      }[]) {
        expect(op.security).toEqual([{ bearerAuth: [] }]);
        expect(op.description).toContain('Roles:');
        expect(op.responses).toHaveProperty('409');
      }
  });
});
