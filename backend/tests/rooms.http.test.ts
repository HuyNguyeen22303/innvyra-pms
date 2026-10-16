import { memoryReservations } from './reservation-helpers.js';
import request from 'supertest';
import { memoryGuests } from './guest-helpers.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { roomTypeCreateBody } from '../src/modules/room-types/room-type.schema.js';
import { roomCreateBody } from '../src/modules/rooms/room.schema.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { ROLE_CODES } from '../src/shared/types/roles.js';
import { MemoryAuthRepository, testEnv, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';

describe('Room management HTTP: real JWT, authentication, RBAC, validation and services', () => {
  let passwordHash: string;
  let auth: MemoryAuthRepository;
  let store: ReturnType<typeof memoryRooms>;
  let app: ReturnType<typeof createApp>;
  let token: string;
  let hotelId: bigint;
  let typeId: string;
  let otherTypeId: string;
  let roomId: string;
  let otherRoomId: string;
  const typeBody = {
    code: 'SUP',
    name: 'Superior',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '700000.00',
  };
  beforeAll(async () => {
    passwordHash = await hashPassword(testPassword);
  });
  beforeEach(async () => {
    auth = new MemoryAuthRepository(passwordHash);
    hotelId = auth.users.get('admin')!.hotelId;
    store = memoryRooms();
    app = createApp(
      testEnv,
      auth,
      store.repositories,
      memoryGuests().repository,
      memoryReservations().repository,
    );
    token = (
      await new AuthService(auth, testEnv).login({ username: 'admin', password: testPassword })
    ).data.accessToken;
    const type = await store.repositories.roomTypes.create(
      hotelId,
      roomTypeCreateBody.parse({
        ...typeBody,
        code: 'DLX',
        name: 'Deluxe',
        basePrice: '900000.00',
      }),
    );
    const other = await store.repositories.roomTypes.create(
      1n,
      roomTypeCreateBody.parse({ ...typeBody, code: 'DLX' }),
    );
    typeId = type.id.toString();
    otherTypeId = other.id.toString();
    const room = await store.repositories.rooms.create(
      hotelId,
      roomCreateBody.parse({
        roomTypeId: typeId,
        roomNumber: '301',
        floorNumber: 3,
        housekeepingStatus: 'READY',
      }),
    );
    const otherRoom = await store.repositories.rooms.create(
      1n,
      roomCreateBody.parse({ roomTypeId: otherTypeId, roomNumber: '301', floorNumber: 3 }),
    );
    roomId = room.id.toString();
    otherRoomId = otherRoom.id.toString();
  });
  const get = (path: string) => request(app).get(`/api/v1${path}`).auth(token, { type: 'bearer' });
  const post = (path: string, data: object) =>
    request(app)
      .post(`/api/v1${path}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(data);
  const patch = (path: string, data: object) =>
    request(app)
      .patch(`/api/v1${path}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(data);
  const remove = (path: string) =>
    request(app)
      .delete(`/api/v1${path}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1');
  const roomBody = () => ({ roomTypeId: typeId, roomNumber: '302', floorNumber: 3 });

  it.each(['ADMIN', 'MANAGER'])(
    '%s can create, update and deactivate rooms and room types',
    async (role) => {
      auth.users.get('admin')!.role.code = role;
      const createdType = await post('/room-types', { ...typeBody, code: ' sup ' });
      expect(createdType.status).toBe(201);
      expect(createdType.body).toMatchObject({
        success: true,
        data: { code: 'SUP', basePrice: '700000.00', hotelId: hotelId.toString() },
      });
      expect((await post('/rooms', roomBody())).status).toBe(201);
      expect(
        (
          await patch(`/rooms/${roomId}`, {
            notes: 'Changed',
            housekeepingStatus: 'DIRTY',
            physicalStatus: 'OUT_OF_SERVICE',
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await patch(`/room-types/${typeId}`, {
            name: 'New Deluxe',
            basePrice: '999999999999.99',
            maxChildren: 0,
          })
        ).body,
      ).toMatchObject({ data: { basePrice: '999999999999.99' } });
      expect((await remove(`/rooms/${roomId}`)).status).toBe(200);
      // Created SUP has no active rooms; linked DLX remains protected separately.
      expect(
        (await remove(`/room-types/${(createdType.body as { data: { id: string } }).data.id}`))
          .status,
      ).toBe(200);
    },
  );
  it.each(ROLE_CODES)('%s can read within the current hotel', async (role) => {
    auth.users.get('admin')!.role.code = role;
    expect((await get('/room-types')).body).toMatchObject({ data: { pagination: { total: 1 } } });
    expect((await get('/rooms')).body).toMatchObject({ data: { pagination: { total: 1 } } });
    expect((await get(`/rooms/${roomId}`)).status).toBe(200);
    expect((await get(`/room-types/${typeId}`)).status).toBe(200);
  });
  it.each(['RECEPTIONIST', 'HOUSEKEEPING', 'ACCOUNTANT', 'TECHNICIAN'])(
    '%s cannot mutate either module',
    async (role) => {
      auth.users.get('admin')!.role.code = role;
      for (const response of await Promise.all([
        post('/rooms', roomBody()),
        patch(`/rooms/${roomId}`, { housekeepingStatus: 'READY' }),
        remove(`/rooms/${roomId}`),
        post('/room-types', typeBody),
        patch(`/room-types/${typeId}`, { name: 'Denied' }),
        remove(`/room-types/${typeId}`),
      ]))
        expect(response.status).toBe(403);
    },
  );
  it('requires a valid session on all ten operations', async () => {
    for (const path of ['/rooms', '/room-types']) {
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
      expect((await request(app).get(`/api/v1${path}/1`)).status).toBe(401);
      expect((await request(app).post(`/api/v1${path}`).send({})).status).toBe(401);
      expect((await request(app).patch(`/api/v1${path}/1`).send({})).status).toBe(401);
      expect((await request(app).delete(`/api/v1${path}/1`)).status).toBe(401);
      expect(
        (await request(app).get(`/api/v1${path}`).auth('not.a.jwt', { type: 'bearer' })).status,
      ).toBe(401);
    }
    auth.users.get('admin')!.isActive = false;
    expect((await get('/rooms')).status).toBe(401);
  });
  it('hides cross-hotel IDs on detail, patch and delete, including ADMIN', async () => {
    for (const [resource, other] of [
      ['room-types', otherTypeId],
      ['rooms', otherRoomId],
    ]) {
      expect((await get(`/${resource}/${other}`)).status).toBe(404);
      expect((await patch(`/${resource}/${other}`, { isActive: false })).status).toBe(404);
      expect((await remove(`/${resource}/${other}`)).status).toBe(404);
      expect((await get(`/${resource}/${other}`)).body).toEqual(
        (await get(`/${resource}/999999`)).body,
      );
    }
    expect(store.records.get(BigInt(otherRoomId))!.isActive).toBe(true);
    expect(store.types.get(BigInt(otherTypeId))!.isActive).toBe(true);
  });
  it('immediately follows server-side hotel and role changes', async () => {
    auth.users.get('admin')!.hotelId = 1n;
    expect((await get(`/rooms/${roomId}`)).status).toBe(404);
    expect((await get(`/rooms/${otherRoomId}`)).status).toBe(200);
    auth.users.get('admin')!.role.code = 'UNKNOWN';
    expect((await get('/rooms')).status).toBe(403);
  });
  it('rejects duplicate codes/numbers in the same hotel and retains uniqueness after deactivation', async () => {
    expect((await post('/room-types', { ...typeBody, code: 'dlx' })).body).toMatchObject({
      error: { code: 'ROOM_TYPE_CODE_EXISTS' },
    });
    expect((await post('/room-types', { ...typeBody, code: 'DLX' })).status).toBe(409);
    expect((await post('/rooms', { ...roomBody(), roomNumber: '301' })).status).toBe(409);
    await remove(`/rooms/${roomId}`);
    expect((await post('/rooms', { ...roomBody(), roomNumber: '301' })).status).toBe(409);
    await remove(`/room-types/${typeId}`);
    expect((await post('/room-types', { ...typeBody, code: 'DLX' })).status).toBe(409);
  });
  it('allows identical codes and room numbers across hotels', async () => {
    expect((await post('/room-types', typeBody)).status).toBe(201);
    expect((await post('/rooms', roomBody())).status).toBe(201);
    auth.users.get('admin')!.hotelId = 1n;
    expect((await post('/room-types', typeBody)).status).toBe(201);
    expect((await post('/rooms', { ...roomBody(), roomTypeId: otherTypeId })).status).toBe(201);
  });
  it('rejects nonexistent, foreign and inactive room types on create/reassignment/reactivation', async () => {
    for (const id of ['999999', otherTypeId]) {
      expect((await post('/rooms', { ...roomBody(), roomTypeId: id })).status).toBe(404);
      expect((await patch(`/rooms/${roomId}`, { roomTypeId: id })).status).toBe(404);
    }
    await remove(`/rooms/${roomId}`);
    await remove(`/room-types/${typeId}`);
    expect((await post('/rooms', roomBody())).status).toBe(409);
    expect((await patch(`/rooms/${roomId}`, { roomTypeId: typeId })).status).toBe(409);
    expect((await patch(`/rooms/${roomId}`, { isActive: true })).status).toBe(409);
    expect((await patch(`/room-types/${typeId}`, { isActive: true })).status).toBe(200);
    expect((await patch(`/rooms/${roomId}`, { isActive: true })).status).toBe(200);
  });
  it('supports partial updates, nullable fields, reassignment and uniqueness on update', async () => {
    const second = await post('/room-types', typeBody);
    const secondId = (second.body as { data: { id: string } }).data.id;
    expect((await patch(`/room-types/${secondId}`, { code: 'DLX' })).status).toBe(409);
    expect((await patch(`/room-types/${typeId}`, { description: null })).status).toBe(200);
    await post('/rooms', roomBody());
    expect((await patch(`/rooms/${roomId}`, { roomNumber: '302' })).status).toBe(409);
    expect(
      (await patch(`/rooms/${roomId}`, { roomTypeId: secondId, floorNumber: -1, notes: null }))
        .body,
    ).toMatchObject({
      data: {
        roomTypeId: secondId,
        roomType: { name: 'Superior' },
        floorNumber: -1,
        notes: null,
        roomNumber: '301',
      },
    });
  });
  it('soft deletes idempotently and protects active room references via DELETE and PATCH', async () => {
    expect((await remove(`/room-types/${typeId}`)).status).toBe(409);
    expect((await patch(`/room-types/${typeId}`, { isActive: false })).status).toBe(409);
    for (let i = 0; i < 2; i++)
      expect((await remove(`/rooms/${roomId}`)).body).toMatchObject({
        data: { isActive: false, housekeepingStatus: 'READY', physicalStatus: 'ACTIVE' },
      });
    for (let i = 0; i < 2; i++) expect((await remove(`/room-types/${typeId}`)).status).toBe(200);
    expect(store.records.size).toBe(2);
    expect(store.types.size).toBe(2);
    expect((await get(`/rooms/${roomId}`)).status).toBe(200);
    expect((await get(`/room-types/${typeId}`)).body).toMatchObject({ data: { isActive: false } });
  });
  it('paginates, searches, filters and sorts room types with exact money strings', async () => {
    await post('/room-types', typeBody);
    await post('/room-types', {
      ...typeBody,
      code: 'STD',
      name: 'Standard',
      basePrice: '0.01',
      isActive: false,
    });
    const page = await get('/room-types?page=2&limit=1&sortBy=basePrice&sortOrder=desc');
    expect(page.body).toMatchObject({
      data: {
        items: [{ code: 'SUP', basePrice: '700000.00' }],
        pagination: { total: 3, totalPages: 3, page: 2, limit: 1 },
      },
    });
    expect((await get('/room-types?search=del')).body).toMatchObject({
      data: { items: [{ code: 'DLX' }], pagination: { total: 1 } },
    });
    expect((await get('/room-types?search=STD&isActive=false')).body).toMatchObject({
      data: { items: [{ basePrice: '0.01' }], pagination: { total: 1 } },
    });
    expect((await get('/room-types?page=99')).body).toMatchObject({
      data: { items: [], pagination: { total: 3 } },
    });
  });
  it('filters rooms by floor, type, physical/housekeeping status, activity and number with pagination', async () => {
    const second = await post('/room-types', typeBody);
    const secondId = (second.body as { data: { id: string } }).data.id;
    await post('/rooms', {
      ...roomBody(),
      roomNumber: 'B01',
      floorNumber: -1,
      roomTypeId: secondId,
      physicalStatus: 'OUT_OF_SERVICE',
      housekeepingStatus: 'DIRTY',
      isActive: false,
    });
    for (const query of [
      'floorNumber=-1',
      `roomTypeId=${secondId}`,
      'physicalStatus=OUT_OF_SERVICE',
      'housekeepingStatus=DIRTY',
      'isActive=false',
      'search=B0',
    ]) {
      expect((await get(`/rooms?${query}`)).body).toMatchObject({
        data: {
          items: [{ roomNumber: 'B01', roomType: { name: 'Superior' } }],
          pagination: { total: 1 },
        },
      });
    }
    expect((await get(`/rooms?roomTypeId=${otherTypeId}`)).body).toMatchObject({
      data: { items: [], pagination: { total: 0 } },
    });
    expect(
      (await get('/rooms?page=2&limit=1&sortBy=floorNumber&sortOrder=desc')).body,
    ).toMatchObject({
      data: { items: [{ roomNumber: 'B01' }], pagination: { total: 2, totalPages: 2 } },
    });
    const roomList = await get('/rooms');
    expect(roomList.text).not.toMatch(/isAvailable|"occupancy":|password|tokenHash/);
    expect(roomList.body.data.items[0].occupancyStatus).toBe('VACANT');
  });
  it.each([
    { basePrice: '-0.01' },
    { basePrice: 0.1 },
    { basePrice: '1.001' },
    { basePrice: '1e5' },
    { basePrice: '1000000000000.00' },
    { maxAdults: -1 },
    { maxAdults: 0 },
    { maxAdults: 1.5 },
    { maxChildren: -1 },
    { maxChildren: 65536 },
    { code: ' ' },
    { code: 'invalid code' },
    { name: '' },
    { hotelId: '1' },
    { isActive: 'false' },
  ])('rejects invalid room type input %j', async (invalid) => {
    expect((await post('/room-types', { ...typeBody, ...invalid })).status).toBe(422);
    expect((await patch(`/room-types/${typeId}`, invalid)).status).toBe(422);
  });
  it.each([
    { roomNumber: ' ' },
    { roomNumber: 'a'.repeat(21) },
    { floorNumber: 32768 },
    { floorNumber: 1.5 },
    { floorNumber: '3' },
    { roomTypeId: '0' },
    { roomTypeId: '18446744073709551616' },
    { roomTypeId: 3 },
    { physicalStatus: 'VACANT' },
    { housekeepingStatus: 'AVAILABLE' },
    { isAvailable: true },
    { hotelId: '1' },
  ])('rejects invalid room input %j', async (invalid) => {
    expect((await post('/rooms', { ...roomBody(), ...invalid })).status).toBe(422);
    expect((await patch(`/rooms/${roomId}`, invalid)).status).toBe(422);
  });
  it('validates IDs, strict query parameters, pagination limits and nonempty updates', async () => {
    for (const path of ['/rooms', '/room-types']) {
      for (const query of [
        'limit=101',
        'limit=0',
        'page=0',
        'page=1.5',
        'page=1000001',
        'sortBy=hotelId',
        'sortOrder=bad',
        'isActive=0',
        'limit=1&limit=2',
        'hotelId=1',
        'search=',
      ])
        expect((await get(`${path}?${query}`)).status).toBe(422);
      for (const id of ['0', '-1', 'abc', '18446744073709551616'])
        expect((await get(`${path}/${id}`)).status).toBe(422);
      expect((await patch(`${path}/1`, {})).status).toBe(422);
    }
    for (const query of [
      'floorNumber=',
      'floorNumber=32768',
      'roomTypeId=bad',
      'physicalStatus=VACANT',
      'housekeepingStatus=bad',
    ])
      expect((await get(`/rooms?${query}`)).status).toBe(422);
  });
  it('requires CSRF on writes and supports browser PATCH/DELETE preflight', async () => {
    for (const resource of ['rooms', 'room-types']) {
      expect(
        (await request(app).post(`/api/v1/${resource}`).auth(token, { type: 'bearer' }).send({}))
          .status,
      ).toBe(403);
      expect(
        (await request(app).patch(`/api/v1/${resource}/1`).auth(token, { type: 'bearer' }).send({}))
          .status,
      ).toBe(403);
      expect(
        (await request(app).delete(`/api/v1/${resource}/1`).auth(token, { type: 'bearer' })).status,
      ).toBe(403);
    }
    const preflight = await request(app)
      .options('/api/v1/rooms/1')
      .set('Origin', testEnv.FRONTEND_URL)
      .set('Access-Control-Request-Method', 'PATCH');
    expect(preflight.status).toBe(204);
    expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');
    expect(preflight.headers['access-control-allow-methods']).toContain('DELETE');
  });
  it('publishes all 83 operations with resolvable schema references and matching response envelopes', async () => {
    const response = await request(app).get('/api-docs/openapi.json');
    expect(response.status).toBe(200);
    const spec = response.body as {
      paths: Record<string, Record<string, unknown>>;
      components: { schemas: Record<string, unknown> };
    };
    expect(Object.values(spec.paths).flatMap(Object.keys)).toHaveLength(83);
    const text = JSON.stringify(spec);
    for (const match of text.matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g))
      expect(spec.components.schemas).toHaveProperty(match[1]!);
    expect(spec.paths['/rooms/{id}']).toHaveProperty('delete');
    const room = await get(`/rooms/${roomId}`);
    expect(room.headers['cache-control']).toBe('no-store');
    expect(room.body).toMatchObject({
      success: true,
      message: 'Room retrieved',
      data: { id: roomId, hotelId: hotelId.toString(), roomTypeId: typeId },
    });
  });
});
