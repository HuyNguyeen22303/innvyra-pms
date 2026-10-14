import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { GuestService } from '../src/modules/guests/guest.service.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';
import { guestCreateBody, guestListQuery } from '../src/modules/guests/guest.schema.js';
import type { GuestScope } from '../src/modules/guests/guest.types.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { guestEnv, guestInput } from './guest-helpers.js';
import { testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Guests MySQL: encrypted persistence, isolation, audit, references and races',
  () => {
    let prisma: ReturnType<typeof createPrisma>;
    let service: GuestService;
    let scope: GuestScope;
    let otherHotelId: bigint;
    let app: ReturnType<typeof createApp>;
    let token: string;
    let passwordHash: string;
    let hotels: bigint[];
    beforeAll(async () => {
      passwordHash = await hashPassword(testPassword);
    });
    beforeEach(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname)
      )
        throw new Error(
          'Guest MySQL tests require NODE_ENV=test and a local database ending in _test',
        );
      if (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
        throw new Error('TEST_DATABASE_URL must use a separate database name');
      hotels = [];
      prisma = createPrisma(testUrl!);
      const code = `guest_${randomUUID().replaceAll('-', '')}`;
      const first = await prisma.hotel.create({
        data: { code, name: 'Synthetic guest test hotel' },
      });
      hotels.push(first.id);
      const second = await prisma.hotel.create({
        data: { code: `${code}_2`, name: 'Synthetic foreign test hotel' },
      });
      hotels.push(second.id);
      otherHotelId = second.id;
      const role = await prisma.role.upsert({
        where: { code: 'ADMIN' },
        create: { code: 'ADMIN', name: 'Administrator' },
        update: {},
      });
      const user = await prisma.staffUser.create({
        data: {
          hotelId: first.id,
          roleId: role.id,
          username: code,
          fullName: 'Synthetic Admin',
          passwordHash,
        },
      });
      scope = { hotelId: first.id, actorId: user.id, role: 'ADMIN' };
      const auth = new PrismaAuthRepository(prisma);
      const repository = new PrismaGuestRepository(prisma);
      service = new GuestService(repository, new GuestCrypto(guestEnv));
      app = createApp(
        guestEnv,
        auth,
        {
          rooms: new PrismaRoomRepository(prisma),
          roomTypes: new PrismaRoomTypeRepository(prisma),
        },
        repository,
        new PrismaReservationRepository(prisma),
      );
      token = (
        await new AuthService(auth, guestEnv).login({ username: code, password: testPassword })
      ).data.accessToken;
    });
    afterEach(async () => {
      if (!prisma) return;
      try {
        if (hotels.length) {
          const where = { hotelId: { in: hotels } };
          // Only this test's random tagged fixtures are removed. Never reset/drop/truncate.
          await prisma.guestAuditLog.deleteMany({ where });
          await prisma.guest.deleteMany({ where });
          await prisma.authSession.deleteMany({ where: { staffUser: where } });
          await prisma.staffUser.deleteMany({ where });
          await prisma.hotel.deleteMany({ where: { id: { in: hotels } } });
        }
      } finally {
        await prisma.$disconnect();
      }
    });
    const create = () => service.createGuest(scope, guestCreateBody.parse(guestInput));
    const get = (id: string) =>
      request(app).get(`/api/v1/guests/${id}`).auth(token, { type: 'bearer' });
    const patch = (id: string, data: object) =>
      request(app)
        .patch(`/api/v1/guests/${id}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(data);
    const remove = (id: string) =>
      request(app)
        .delete(`/api/v1/guests/${id}`)
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1');

    it('stores ciphertext and tenant-keyed hash, round-trips DATE and exposes no internal fields', async () => {
      const created = await request(app)
        .post('/api/v1/guests')
        .auth(token, { type: 'bearer' })
        .set('X-CSRF-Protection', '1')
        .send(guestInput);
      expect(created.status).toBe(201);
      const record = await prisma.guest.findUniqueOrThrow({
        where: { id: BigInt(created.body.data.id) },
      });
      expect(record.documentNumberCiphertext).toMatch(/^v1\./);
      expect(record.documentNumberCiphertext).not.toContain(guestInput.documentNumber);
      expect(record.documentNumberHash).toMatch(/^[a-f0-9]{64}$/);
      expect(record.dateOfBirth!.toISOString()).toBe('1998-05-20T00:00:00.000Z');
      const detail = await get(created.body.data.id);
      expect(detail.status).toBe(200);
      expect(detail.body.data).toMatchObject({
        id: record.id.toString(),
        documentNumber: guestInput.documentNumber,
        dateOfBirth: '1998-05-20',
      });
      expect(detail.text).not.toMatch(/Ciphertext|Hash|hotelId/);
    });
    it('allows shared phone/email/documents, warns only inside hotel and never merges', async () => {
      const first = await create();
      const duplicate = await create();
      expect(duplicate.guest.id).not.toBe(first.guest.id);
      expect(duplicate.warnings[0]!.candidateIds).toEqual([first.guest.id]);
      const foreign = await service.createGuest(
        { ...scope, hotelId: otherHotelId },
        guestCreateBody.parse(guestInput),
      );
      expect(foreign.warnings).toEqual([]);
      const [one, two] = await Promise.all([
        prisma.guest.findUniqueOrThrow({ where: { id: BigInt(first.guest.id) } }),
        prisma.guest.findUniqueOrThrow({ where: { id: BigInt(foreign.guest.id) } }),
      ]);
      expect(one.documentNumberHash).not.toBe(two.documentNumberHash);
      expect(await prisma.guest.count({ where: { hotelId: scope.hotelId } })).toBe(2);
    });
    it('finds equivalent document numbers despite randomized ciphertext and different contact details', async () => {
      const first = await create();
      const second = await service.createGuest(scope, {
        fullName: 'Different Guest',
        documentType: 'PASSPORT',
        documentNumber: 'test passport 0001',
      });
      expect(second.warnings[0]!.candidateIds).toEqual([first.guest.id]);
    });
    it('applies SQL search, nationality, pagination and stable ordering to active guests only', async () => {
      await create();
      await service.createGuest(scope, { fullName: 'A Test', nationality: 'VN' });
      const last = await service.createGuest(scope, { fullName: 'Z Test', nationality: 'VN' });
      await service.createGuest(
        { ...scope, hotelId: otherHotelId },
        { fullName: 'A Test', nationality: 'VN' },
      );
      const page = await service.getGuests(
        scope,
        guestListQuery.parse({
          search: 'Test',
          nationality: 'VN',
          page: '2',
          limit: '1',
          sortOrder: 'asc',
        }),
      );
      expect(page.pagination).toEqual({ total: 2, page: 2, limit: 1, totalPages: 2 });
      expect(page.items[0]!.id).toBe(last.guest.id);
      expect(JSON.stringify(page)).not.toMatch(/document|dateOfBirth|address|notes/);
      await service.deleteGuest(scope, BigInt(last.guest.id));
      expect(
        (await service.getGuests(scope, guestListQuery.parse({ search: 'Test' }))).pagination.total,
      ).toBe(1);
    });
    it('hides foreign guests from GET/PATCH/DELETE and forbids ownership injection', async () => {
      const foreign = await service.createGuest(
        { ...scope, hotelId: otherHotelId },
        { fullName: 'Foreign' },
      );
      for (const res of [
        await get(foreign.guest.id),
        await patch(foreign.guest.id, { notes: 'No' }),
        await remove(foreign.guest.id),
      ])
        expect(res.status).toBe(404);
      const own = await create();
      expect((await patch(own.guest.id, { hotelId: otherHotelId.toString() })).status).toBe(422);
      expect(
        (await prisma.guest.findUniqueOrThrow({ where: { id: BigInt(own.guest.id) } })).hotelId,
      ).toBe(scope.hotelId);
    });
    it('persists partial updates and audits only field names in the same transaction', async () => {
      const guest = await create();
      const id = BigInt(guest.guest.id);
      expect(
        (await patch(guest.guest.id, { dateOfBirth: '2000-02-29', documentNumber: 'TEST-UPDATED' }))
          .status,
      ).toBe(200);
      const record = await prisma.guest.findUniqueOrThrow({ where: { id } });
      expect(record.email).toBe(guestInput.email);
      expect(record.phone).toBe('+12025550100');
      const audit = await prisma.guestAuditLog.findMany({
        where: { hotelId: scope.hotelId, guestId: id },
        orderBy: { id: 'asc' },
      });
      expect(audit).toHaveLength(2);
      expect(audit[1]).toMatchObject({
        actorId: scope.actorId,
        action: 'UPDATED',
        changedFields: ['dateOfBirth', 'documentNumber'],
      });
      expect(
        JSON.stringify(audit, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      ).not.toMatch(/TEST-PASSPORT|TEST-UPDATED|1998-05-20|2000-02-29/);
    });
    it('rolls back an actual SQL mutation if the audit write fails', async () => {
      const guest = await create();
      const id = BigInt(guest.guest.id);
      const original = await prisma.guest.findUniqueOrThrow({ where: { id } });
      const spy = vi
        .spyOn(PrismaGuestRepository.prototype, 'audit')
        .mockRejectedValue(new Error('synthetic audit failure'));
      try {
        await expect(service.updateGuest(scope, id, { notes: 'Must roll back' })).rejects.toThrow(
          'synthetic audit failure',
        );
      } finally {
        spy.mockRestore();
      }
      expect(await prisma.guest.findUniqueOrThrow({ where: { id } })).toEqual(original);
      expect(
        await prisma.guestAuditLog.count({ where: { hotelId: scope.hotelId, guestId: id } }),
      ).toBe(1);
    });
    it('retains rows and restrictive references on soft delete; deleted IDs stay unavailable', async () => {
      const guest = await create();
      const id = BigInt(guest.guest.id);
      const reference = await prisma.guestAuditLog.findFirstOrThrow({
        where: { hotelId: scope.hotelId, guestId: id },
      });
      expect((await remove(guest.guest.id)).status).toBe(200);
      expect((await prisma.guest.findUniqueOrThrow({ where: { id } })).deletedAt).toBeInstanceOf(
        Date,
      );
      expect(await prisma.guestAuditLog.findUnique({ where: { id: reference.id } })).not.toBeNull();
      await expect(prisma.guest.delete({ where: { id } })).rejects.toMatchObject({ code: 'P2003' });
      expect((await get(guest.guest.id)).status).toBe(404);
      expect((await remove(guest.guest.id)).status).toBe(404);
    });
    it('enforces the composite audit FK across hotel boundaries even outside the API', async () => {
      const guest = await create();
      await expect(
        prisma.guestAuditLog.create({
          data: {
            hotelId: otherHotelId,
            guestId: BigInt(guest.guest.id),
            actorId: scope.actorId,
            action: 'UPDATED',
            changedFields: ['notes'],
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
    it('serializes concurrent duplicate checks using independent database clients', async () => {
      const second = createPrisma(testUrl!);
      try {
        const otherService = new GuestService(
          new PrismaGuestRepository(second),
          new GuestCrypto(guestEnv),
        );
        const results = await Promise.all([
          create(),
          otherService.createGuest(scope, guestCreateBody.parse(guestInput)),
        ]);
        expect(results.map((result) => result.warnings.length).sort()).toEqual([0, 1]);
        expect(new Set(results.map((result) => result.guest.id)).size).toBe(2);
        expect(await prisma.guestAuditLog.count({ where: { hotelId: scope.hotelId } })).toBe(2);
      } finally {
        await second.$disconnect();
      }
    });
    it('reads current role from MySQL and restricts a downgraded user immediately', async () => {
      const guest = await create();
      const accountant = await prisma.role.upsert({
        where: { code: 'ACCOUNTANT' },
        create: { code: 'ACCOUNTANT', name: 'Accountant' },
        update: {},
      });
      await prisma.staffUser.update({
        where: { id: scope.actorId },
        data: { roleId: accountant.id },
      });
      expect((await get(guest.guest.id)).body.data).toEqual({
        id: guest.guest.id,
        fullName: guestInput.fullName,
      });
      expect((await patch(guest.guest.id, { notes: 'No' })).status).toBe(403);
    });
  },
);
