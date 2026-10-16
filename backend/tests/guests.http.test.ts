import { memoryReservations } from './reservation-helpers.js';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { GuestService } from '../src/modules/guests/guest.service.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { guestCreateBody } from '../src/modules/guests/guest.schema.js';
import type { GuestScope } from '../src/modules/guests/guest.types.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { MemoryAuthRepository, testPassword } from './helpers.js';
import { memoryRooms } from './room-helpers.js';
import { guestEnv, guestInput, memoryGuests } from './guest-helpers.js';

describe('Guests HTTP: real JWT, RBAC, validation, service and privacy policies', () => {
  let passwordHash: string;
  let auth: MemoryAuthRepository;
  let store: ReturnType<typeof memoryGuests>;
  let app: ReturnType<typeof createApp>;
  let token: string;
  let ownId: string;
  let otherId: string;
  let scope: GuestScope;
  beforeAll(async () => {
    passwordHash = await hashPassword(testPassword);
  });
  beforeEach(async () => {
    auth = new MemoryAuthRepository(passwordHash);
    store = memoryGuests();
    app = createApp(
      guestEnv,
      auth,
      memoryRooms().repositories,
      store.repository,
      memoryReservations().repository,
    );
    const login = await new AuthService(auth, guestEnv).login({
      username: 'admin',
      password: testPassword,
    });
    token = login.data.accessToken;
    scope = {
      hotelId: BigInt(login.data.user.hotelId),
      actorId: BigInt(login.data.user.id),
      role: 'ADMIN',
    };
    const service = new GuestService(store.repository, new GuestCrypto(guestEnv));
    ownId = (await service.createGuest(scope, guestCreateBody.parse(guestInput))).guest.id;
    otherId = (
      await service.createGuest(
        { ...scope, hotelId: 1n },
        guestCreateBody.parse({ ...guestInput, fullName: 'Foreign Guest' }),
      )
    ).guest.id;
  });
  const get = (path = '') =>
    request(app).get(`/api/v1/guests${path}`).auth(token, { type: 'bearer' });
  const post = (body: object) =>
    request(app)
      .post('/api/v1/guests')
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body);
  const patch = (body: object, id = ownId) =>
    request(app)
      .patch(`/api/v1/guests/${id}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1')
      .send(body);
  const remove = (id = ownId) =>
    request(app)
      .delete(`/api/v1/guests/${id}`)
      .auth(token, { type: 'bearer' })
      .set('X-CSRF-Protection', '1');

  it.each(['ADMIN', 'MANAGER', 'RECEPTIONIST'])(
    '%s can create, read and update operational details',
    async (role) => {
      auth.users.get('admin')!.role.code = role;
      const res = await post({
        fullName: '  New  Synthetic \n Guest ',
        phone: '+44 (20) 7946-0958',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        success: true,
        data: {
          fullName: 'New Synthetic Guest',
          phone: '+442079460958',
          dateOfBirth: null,
          documentNumber: null,
        },
        warnings: [],
      });
      expect((await get(`/${ownId}`)).body.data.documentNumber).toBe(guestInput.documentNumber);
      expect((await patch({ notes: 'Revised' })).status).toBe(200);
    },
  );
  it.each(['HOUSEKEEPING', 'TECHNICIAN'])('%s cannot access any Guest operation', async (role) => {
    auth.users.get('admin')!.role.code = role;
    for (const res of [
      await get(),
      await get(`/${ownId}`),
      await post({ fullName: 'No' }),
      await patch({ notes: 'No' }),
      await remove(),
    ]) {
      expect(res.status).toBe(403);
      expect(res.text).not.toContain(guestInput.documentNumber);
    }
  });
  it('ACCOUNTANT reads only id/fullName, cannot infer nationality or write', async () => {
    auth.users.get('admin')!.role.code = 'ACCOUNTANT';
    const minimal = { id: ownId, fullName: guestInput.fullName };
    expect((await get(`/${ownId}`)).body.data).toEqual(minimal);
    expect((await get()).body.data.items).toEqual([minimal]);
    expect((await get('?nationality=VN')).status).toBe(403);
    expect((await post({ fullName: 'No' })).status).toBe(403);
    expect((await patch({ notes: 'No' })).status).toBe(403);
    expect((await remove()).status).toBe(403);
  });
  it('rejects missing/revoked authentication and requires CSRF', async () => {
    expect((await request(app).get('/api/v1/guests')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/v1/guests')
          .auth(token, { type: 'bearer' })
          .send({ fullName: 'No' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/guests')
          .auth(token, { type: 'bearer' })
          .set('X-CSRF-Protection', '1')
          .set('Origin', 'https://attacker.example')
          .send({ fullName: 'No' })
      ).status,
    ).toBe(403);
    for (const session of auth.sessions.values()) session.revokedAt = new Date();
    expect((await get()).status).toBe(401);
  });
  it.each([
    {},
    { fullName: '' },
    { fullName: ' '.repeat(10) },
    { fullName: 'x'.repeat(151) },
    { fullName: 'Test', email: 'not-email' },
    { fullName: 'Test', dateOfBirth: '2999-01-01' },
    { fullName: 'Test', dateOfBirth: '2025-02-29' },
    { fullName: 'Test', dateOfBirth: '2024-02-30' },
    { fullName: 'Test', gender: 'INVALID' },
    { fullName: 'Test', documentType: 'INVALID' },
    { fullName: 'Test', documentNumber: 'TEST123' },
    { fullName: 'Test', phone: '++123abc' },
    { fullName: 'Test', phone: '123456789012345678901' },
    { fullName: 'Test', nationality: 'x'.repeat(101) },
    { fullName: 'Test', notes: 'x'.repeat(5001) },
  ])('rejects invalid create body %#', async (body) => {
    expect((await post(body)).status).toBe(422);
  });
  it.each([
    'id',
    'hotelId',
    'hotel_id',
    'role',
    'deletedAt',
    'createdAt',
    'documentNumberHash',
    'documentNumberCiphertext',
  ])('rejects mass assignment of %s', async (field) => {
    expect((await post({ fullName: 'Synthetic', [field]: '1' })).status).toBe(422);
    expect((await patch({ [field]: '1' })).status).toBe(422);
  });
  it('warns on duplicates without merging or changing the original guest', async () => {
    const original = structuredClone(store.records.get(BigInt(ownId)));
    const res = await post({
      ...guestInput,
      fullName: 'Different synthetic name',
      email: ' GUEST@EXAMPLE.TEST ',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(ownId);
    expect(res.body.warnings).toEqual([
      { code: 'POSSIBLE_DUPLICATE', message: expect.any(String), candidateIds: [ownId] },
    ]);
    expect(store.records.get(BigInt(ownId))).toEqual(original);
    expect(store.records.size).toBe(3);
    expect(res.text).not.toContain(otherId);
  });
  it('does not reveal a match found only in another hotel', async () => {
    const res = await post({ fullName: 'Foreign Guest' });
    expect(res.status).toBe(201);
    expect(res.body.warnings).toEqual([]);
  });
  it('lists a bounded page, filters by name/nationality and sorts with ID ties', async () => {
    const a = await post({ fullName: 'Alpha Example', nationality: 'VN' });
    const z = await post({ fullName: 'Zeta Example', nationality: 'US' });
    const all = await get('?limit=1&page=2&sortBy=fullName&sortOrder=asc');
    expect(all.status).toBe(200);
    expect(all.body.data.pagination).toEqual({ total: 3, page: 2, limit: 1, totalPages: 3 });
    expect(all.body.data.items[0].id).toBe(ownId);
    expect(
      (await get('?search=Example&sortBy=fullName&sortOrder=desc')).body.data.items.map(
        (row: { id: string }) => row.id,
      ),
    ).toEqual([z.body.data.id, a.body.data.id]);
    expect(
      (await get('?nationality=US')).body.data.items.map((row: { id: string }) => row.id),
    ).toEqual([z.body.data.id]);
    store.records.get(BigInt(ownId))!.createdAt = new Date('2000-01-01');
    expect((await get('?sortBy=createdAt&sortOrder=asc')).body.data.items[0].id).toBe(ownId);
    const list = await get();
    expect(list.headers['cache-control']).toBe('no-store');
    for (const row of list.body.data.items)
      expect(Object.keys(row).sort()).toEqual(
        ['id', 'fullName', 'phone', 'email', 'nationality', 'createdAt', 'updatedAt'].sort(),
      );
    expect(list.text).not.toMatch(/document|dateOfBirth|address|notes|Foreign Guest/);
  });
  it.each([
    'limit=101',
    'limit=0',
    'page=0',
    'page=1.5',
    'page=1000001',
    'page=1&page=2',
    'sortBy=documentNumber',
    'sortOrder=sideways',
    'hotelId=1',
    'status=DELETED',
    'unknown=x',
  ])('rejects unsupported query %s', async (query) => {
    expect((await get(`?${query}`)).status).toBe(422);
  });
  it('uses the same 404 for missing and foreign IDs on all operations', async () => {
    for (const id of ['18446744073709551615', otherId]) {
      for (const res of [await get(`/${id}`), await patch({ notes: 'No' }, id), await remove(id)])
        expect(res.body).toEqual({
          success: false,
          message: 'Guest not found',
          error: { code: 'GUEST_NOT_FOUND' },
        });
      expect((await get(`/${id}`)).status).toBe(404);
    }
    expect(store.records.get(BigInt(otherId))!.deletedAt).toBeNull();
  });
  it.each(['0', '-1', 'abc', '1.5', '01', '18446744073709551616'])(
    'validates ID %s on read/update/delete',
    async (id) => {
      for (const res of [await get(`/${id}`), await patch({ notes: 'No' }, id), await remove(id)])
        expect(res.status).toBe(422);
    },
  );
  it('preserves omitted fields, clears nullable fields and never leaks audit values', async () => {
    const res = await patch({ notes: 'Changed only notes' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      fullName: guestInput.fullName,
      phone: '+12025550100',
      email: guestInput.email,
      documentNumber: guestInput.documentNumber,
      notes: 'Changed only notes',
    });
    expect((await patch({ dateOfBirth: null, email: null, phone: null })).body.data).toMatchObject({
      dateOfBirth: null,
      email: null,
      phone: null,
    });
    expect(
      (await patch({ documentNumber: 'TEST-REPLACEMENT-2', dateOfBirth: '2000-02-29' })).status,
    ).toBe(200);
    expect(store.audits.at(-1)).toMatchObject({
      hotelId: scope.hotelId,
      actorId: scope.actorId,
      action: 'UPDATED',
      changedFields: ['dateOfBirth', 'documentNumber'],
    });
    const auditText = JSON.stringify(store.audits, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    expect(auditText).not.toMatch(
      /TEST-PASSPORT|TEST-REPLACEMENT|1998-05-20|2000-02-29|example.test/,
    );
    const stored = store.records.get(BigInt(ownId))!;
    expect(stored.documentNumberCiphertext).not.toContain('TEST-REPLACEMENT');
    expect((await get(`/${ownId}`)).text).not.toMatch(/Ciphertext|Hash/);
  });
  it('rejects empty PATCH and clearing document type while retaining its number', async () => {
    expect((await patch({})).status).toBe(422);
    expect((await patch({ documentType: null })).status).toBe(409);
    expect((await patch({ documentType: null, documentNumber: null })).status).toBe(200);
    expect((await patch({ documentNumber: 'TEST2' })).status).toBe(409);
  });
  it.each(['ADMIN', 'MANAGER'])(
    '%s soft deletes, retains references and hides deleted profiles',
    async (role) => {
      auth.users.get('admin')!.role.code = role;
      const reference = { guestId: BigInt(ownId) };
      const res = await remove();
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id: ownId, deletedAt: expect.any(String) });
      expect(store.records.get(reference.guestId)!.deletedAt).toBeInstanceOf(Date);
      expect(store.records.get(reference.guestId)!.fullName).toBe(guestInput.fullName);
      expect((await get()).body.data.pagination.total).toBe(0);
      expect((await get(`/${ownId}`)).status).toBe(404);
      expect((await patch({ notes: 'No' })).status).toBe(404);
      expect((await remove()).status).toBe(404);
      expect((await post({ fullName: guestInput.fullName })).body.warnings).toEqual([]);
    },
  );
  it('RECEPTIONIST cannot delete', async () => {
    auth.users.get('admin')!.role.code = 'RECEPTIONIST';
    expect((await remove()).status).toBe(403);
  });
  it('fails closed without keys while allowing a minimal profile', async () => {
    const env = { ...guestEnv, GUEST_ENCRYPTION_KEY: undefined, GUEST_HASH_KEY: undefined };
    app = createApp(
      env,
      auth,
      memoryRooms().repositories,
      store.repository,
      memoryReservations().repository,
    );
    expect((await post({ fullName: 'Minimal no documents' })).status).toBe(201);
    const size = store.records.size;
    expect((await post(guestInput)).status).toBe(503);
    expect(store.records.size).toBe(size);
    expect((await get(`/${ownId}`)).status).toBe(503);
    auth.users.get('admin')!.role.code = 'ACCOUNTANT';
    expect((await get(`/${ownId}`)).status).toBe(200);
  });
  it('rolls back changes on audit failure and sanitizes logs and errors', async () => {
    const before = structuredClone(store.records.get(BigInt(ownId)));
    const spy = vi
      .spyOn(store.repository, 'audit')
      .mockRejectedValue(new Error(guestInput.documentNumber));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await patch({ documentNumber: 'TEST-NEW-2' });
      expect(res.status).toBe(500);
      expect(res.text).not.toMatch(/TEST-|Prisma/);
      expect(store.records.get(BigInt(ownId))).toEqual(before);
      expect(JSON.stringify(log.mock.calls)).not.toContain(guestInput.documentNumber);
    } finally {
      spy.mockRestore();
      log.mockRestore();
    }
  });
  it('documents all 83 operations, role projections, warnings and soft delete', async () => {
    expect((await request(app).get('/api-docs/')).status).toBe(200);
    const spec = (await request(app).get('/api-docs/openapi.json')).body;
    expect(Object.values(spec.paths).flatMap((value) => Object.keys(value as object))).toHaveLength(
      83,
    );
    expect(spec.tags).toContainEqual({ name: 'Guests' });
    for (const path of ['/guests', '/guests/{id}'])
      for (const operation of Object.values(spec.paths[path]) as {
        security: object[];
        responses: object;
        description: string;
      }[]) {
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
        expect(operation.responses).toHaveProperty('401');
        expect(operation.responses).toHaveProperty('403');
        expect(operation.description).toMatch(/Roles:/);
      }
    expect(spec.components.schemas.CreateGuest.additionalProperties).toBe(false);
    expect(spec.components.schemas.GuestMinimal.required).toEqual(['id', 'fullName']);
    expect(spec.paths['/guests/{id}'].delete.description).toMatch(/No cascade or hard delete/);
  });
});
