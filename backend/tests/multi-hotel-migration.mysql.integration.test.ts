import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { createConnection, type Connection } from 'mariadb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrisma, databaseOptions } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { ROLE_CODES } from '../src/shared/types/roles.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { AccessTokens, newRefreshToken } from '../src/shared/utils/tokens.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
const migrationName = '20261111000000_multi_hotel_foundation';
const backendRoot = resolve(import.meta.dirname, '..');
const temporaryRoot = join(backendRoot, '.tmp');
const migrationsRoot = join(backendRoot, 'prisma', 'migrations');
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const legacyStaffId = 9007199254740993n;
const legacySessionId = randomUUID();
const legacyRefresh = newRefreshToken();
const legacyUsername = 'legacy_migration_admin';

function identifier(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('Invalid test SQL identifier');
  return `\`${value}\``;
}

function migrate(config: string, url: string) {
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', config], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    encoding: 'utf8',
    timeout: 60000,
  });
  // Driver/CLI output can contain connection details; report only a sanitized failure.
  if (result.error || result.status !== 0)
    throw new Error(`Isolated migration failed (exit ${result.status ?? 'unavailable'})`);
}

async function legacyLayout(connection: Connection) {
  const columns = await connection.query<{ tableName: string; columnName: string }[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME <> '_prisma_migrations' ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  );
  const layout = new Map<string, string[]>();
  for (const column of columns) {
    const list = layout.get(column.tableName) ?? [];
    list.push(column.columnName);
    layout.set(column.tableName, list);
  }
  return layout;
}

async function snapshot(connection: Connection, layout: Map<string, string[]>) {
  const result: Record<string, string[]> = {};
  for (const [table, columns] of layout) {
    const rows = await connection.query<Record<string, unknown>[]>(
      `SELECT ${columns.map(identifier).join(', ')} FROM ${identifier(table)}`,
    );
    result[table] = rows
      .map((row) =>
        JSON.stringify(row, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      )
      .sort();
  }
  return result;
}

async function seedLegacyData(connection: Connection, passwordHash: string) {
  // SQL intentionally uses only pre-foundation columns. The generated client
  // represents the new schema and cannot insert against the legacy schema.
  for (const [index, code] of ROLE_CODES.entries())
    await connection.query('INSERT INTO roles (id, code, name) VALUES (?, ?, ?)', [
      index + 1,
      code,
      code,
    ]);
  await connection.query(
    `INSERT INTO hotels (id, code, name, timezone) VALUES
     (101, 'LEGACY_A', 'Khách sạn cũ A', 'Asia/Ho_Chi_Minh'),
     (102, 'LEGACY_B', 'Khách sạn cũ B', 'Asia/Ho_Chi_Minh')`,
  );
  await connection.query(
    `INSERT INTO staff_users
     (id, hotel_id, role_id, full_name, username, email, password_hash, is_active)
     VALUES (?, 101, 1, 'Legacy admin', ?, 'legacy@example.test', ?, true),
            (?, 102, 1, 'Legacy inactive admin', 'legacy_disabled', NULL, ?, false)`,
    [legacyStaffId, legacyUsername, passwordHash, legacyStaffId + 1n, passwordHash],
  );
  const expiresAt = new Date(Date.now() + 86400000);
  await connection.query(
    'INSERT INTO auth_sessions (id, staff_user_id, expires_at) VALUES (?, ?, ?)',
    [legacySessionId, legacyStaffId, expiresAt],
  );
  await connection.query(
    'INSERT INTO refresh_tokens (session_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [legacySessionId, legacyRefresh.hash, expiresAt],
  );
  await connection.query(
    `INSERT INTO room_types (id, hotel_id, code, name, max_adults, base_price, updated_at)
     VALUES (201, 101, 'DLX', 'Deluxe', 2, 700000.01, '2026-11-01 10:00:00')`,
  );
  await connection.query(
    `INSERT INTO rooms (id, hotel_id, room_type_id, room_number, floor_number, updated_at)
     VALUES (301, 101, 201, '101', 1, '2026-11-01 10:00:00')`,
  );
  await connection.query(
    `INSERT INTO guests (id, hotel_id, full_name, phone, updated_at)
     VALUES (401, 101, 'Khách trước migration', '0900000001', '2026-11-01 10:00:00')`,
  );
  await connection.query(
    `INSERT INTO reservations
     (id, hotel_id, confirmation_code, booker_guest_id, check_in_date, check_out_date,
      total_amount, created_by, updated_at)
     VALUES (501, 101, 'LEGACY-RESERVATION', 401, '2026-11-12', '2026-11-13',
             700000.01, ?, '2026-11-01 10:00:00')`,
    [legacyStaffId],
  );
  await connection.query(
    `INSERT INTO reservation_rooms
     (id, hotel_id, reservation_id, room_type_id, room_id, adults, updated_at)
     VALUES (601, 101, 501, 201, 301, 2, '2026-11-01 10:00:00')`,
  );
  await connection.query(
    `INSERT INTO reservation_room_nights (id, reservation_room_id, stay_date, nightly_rate)
     VALUES (701, 601, '2026-11-12', 700000.01)`,
  );
  await connection.query(
    `INSERT INTO folios (id, hotel_id, reservation_id, updated_at)
     VALUES (801, 101, 501, '2026-11-01 10:00:00')`,
  );
  await connection.query(
    `INSERT INTO folio_items
     (id, hotel_id, folio_id, entry_type, source_type, source_id, room_night_id,
      amount, description, created_by)
     VALUES (901, 101, 801, 'DEBIT', 'ROOM_NIGHT', 701, 701, 700000, 'Legacy room charge', ?)`,
    [legacyStaffId],
  );
  await connection.query(
    `INSERT INTO payments
     (id, hotel_id, folio_id, payment_type, payment_method, amount, status, processed_by)
     VALUES (1001, 101, 801, 'PAYMENT', 'CASH', 100000, 'CONFIRMED', ?)`,
    [legacyStaffId],
  );
}

describe.skipIf(!testUrl)(
  'Multi-hotel foundation: real upgrade from populated legacy MySQL',
  () => {
    const databaseName = `innvyra_mh_upgrade_${randomUUID().replaceAll('-', '')}_test`;
    let createdDatabase = false;
    let workspace: string | undefined;
    let server: Connection | undefined;
    let raw: Connection | undefined;
    let prisma: ReturnType<typeof createPrisma>;
    let passwordHash: string;
    let before: Record<string, string[]>;
    let after: Record<string, string[]>;

    beforeAll(async () => {
      const source = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(source.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(source.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === source.pathname)
      )
        throw new Error('Migration tests require a separate local TEST_DATABASE_URL ending _test');
      const target = new URL(source);
      target.pathname = `/${databaseName}`;
      const { database: _database, ...serverOptions } = databaseOptions(source.toString());
      void _database;
      server = await createConnection({ ...serverOptions, allowPublicKeyRetrieval: true });
      // No IF NOT EXISTS: ownership is established only when our unique CREATE succeeds.
      await server.query(
        `CREATE DATABASE ${identifier(databaseName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      createdDatabase = true;
      await mkdir(temporaryRoot, { recursive: true });
      workspace = await mkdtemp(join(temporaryRoot, 'multi-hotel-upgrade-'));
      const legacyMigrations = join(workspace, 'migrations');
      await mkdir(legacyMigrations);
      for (const entry of await readdir(migrationsRoot, { withFileTypes: true })) {
        if (
          entry.name === 'migration_lock.toml' ||
          (entry.isDirectory() && entry.name < migrationName)
        )
          await cp(join(migrationsRoot, entry.name), join(legacyMigrations, entry.name), {
            recursive: true,
          });
      }
      const legacyConfig = join(workspace, 'prisma.config.ts');
      await writeFile(
        legacyConfig,
        `import { defineConfig } from 'prisma/config';\nexport default defineConfig({
        schema: ${JSON.stringify(join(backendRoot, 'prisma', 'schema.prisma'))},
        migrations: { path: ${JSON.stringify(legacyMigrations)} },
        datasource: { url: process.env.DATABASE_URL! }
      });\n`,
        'utf8',
      );
      migrate(legacyConfig, target.toString());
      raw = await createConnection({
        ...databaseOptions(target.toString()),
        allowPublicKeyRetrieval: true,
      });
      passwordHash = await hashPassword(testPassword);
      await seedLegacyData(raw, passwordHash);
      const layout = await legacyLayout(raw);
      before = await snapshot(raw, layout);
      migrate(join(backendRoot, 'prisma.config.ts'), target.toString());
      // The second deploy must do nothing, including no subscription/account backfill.
      migrate(join(backendRoot, 'prisma.config.ts'), target.toString());
      after = await snapshot(raw, layout);
      prisma = createPrisma(target.toString());
      await prisma.$connect();
    }, 120000);

    afterAll(async () => {
      try {
        await prisma?.$disconnect();
        await raw?.end();
        if (
          createdDatabase &&
          server &&
          /^innvyra_mh_upgrade_[a-f0-9]{32}_test$/.test(databaseName)
        )
          await server.query(`DROP DATABASE ${identifier(databaseName)}`);
      } finally {
        await server?.end();
        // Only remove the exact directory created by this suite under backend/.tmp.
        if (
          workspace &&
          dirname(workspace) === temporaryRoot &&
          basename(workspace).startsWith('multi-hotel-upgrade-')
        )
          await rm(workspace, { recursive: true });
      }
    });

    const admin = () =>
      prisma.platformAdmin.create({
        data: {
          fullName: 'Synthetic platform admin',
          email: `${randomUUID()}@example.test`,
          passwordHash,
        },
      });
    const periodData = (recordedById: bigint, hotelId = 101n) => ({
      hotelId,
      recordedById,
      planName: 'PMS đầy đủ',
      startsOn: new Date('2026-11-11T00:00:00Z'),
      endsOn: new Date('2026-12-10T00:00:00Z'),
      feeAmount: '1500000.01',
      paymentReference: 'MANUAL-CONFIRMATION',
    });

    it('preserves every original column and row, including IDs, hashes, sessions and finance', async () => {
      expect(after).toEqual(before);
      expect(
        (await prisma.reservation.findUniqueOrThrow({ where: { id: 501n } })).totalAmount.toFixed(
          2,
        ),
      ).toBe('700000.01');
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: 1001n } })).amount.toFixed(2),
      ).toBe('100000.00');
      expect(
        (await prisma.staffUser.findUniqueOrThrow({ where: { id: legacyStaffId } })).passwordHash,
      ).toBe(passwordHash);
    });

    it('keeps legacy hotels active and staff flags unchanged, without seeding subscriptions or platform roles', async () => {
      const hotels = await prisma.hotel.findMany({ orderBy: { id: 'asc' } });
      expect(hotels.map((hotel) => hotel.status)).toEqual(['ACTIVE', 'ACTIVE']);
      expect(
        hotels.every((hotel) => hotel.suspendedAt === null && hotel.suspensionReason === null),
      ).toBe(true);
      const staff = await prisma.staffUser.findMany({ orderBy: { id: 'asc' } });
      expect(staff.map((user) => user.isActive)).toEqual([true, false]);
      expect(staff.every((user) => !user.mustChangePassword)).toBe(true);
      expect(await prisma.hotelSubscriptionPeriod.count()).toBe(0);
      expect(await prisma.platformAdmin.count()).toBe(0);
      expect((await prisma.role.findMany()).map((role) => role.code).sort()).toEqual(
        [...ROLE_CODES].sort(),
      );
    });

    it('keeps existing sessions, password login and refresh working and foreign rooms hidden', async () => {
      const auth = new AuthService(new PrismaAuthRepository(prisma), testEnv);
      const existingToken = await new AccessTokens(testEnv).sign(
        legacyStaffId.toString(),
        legacySessionId,
      );
      expect((await auth.authenticate(existingToken)).user.hotelId).toBe('101');
      expect((await auth.refresh(legacyRefresh.token)).data.user.id).toBe(legacyStaffId.toString());
      expect(
        (await auth.login({ username: legacyUsername, password: testPassword })).data.user.role,
      ).toBe('ADMIN');
      const rooms = new PrismaRoomRepository(prisma);
      expect(await rooms.findById(101n, 301n)).not.toBeNull();
      expect(await rooms.findById(102n, 301n)).toBeNull();
    });

    it('requires a platform identity for platform sessions and stores its refresh tokens separately', async () => {
      await expect(
        prisma.platformAuthSession.create({
          data: {
            id: randomUUID(),
            platformAdminId: legacyStaffId,
            expiresAt: new Date(Date.now() + 86400000),
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      const owner = await admin();
      const session = await prisma.platformAuthSession.create({
        data: {
          id: randomUUID(),
          platformAdminId: owner.id,
          expiresAt: new Date(Date.now() + 86400000),
          refreshTokens: {
            create: {
              tokenHash: newRefreshToken().hash,
              expiresAt: new Date(Date.now() + 86400000),
            },
          },
        },
        include: { refreshTokens: true },
      });
      expect(session.refreshTokens).toHaveLength(1);
      expect(await prisma.authSession.findUnique({ where: { id: session.id } })).toBeNull();
      await prisma.platformAuthSession.delete({ where: { id: session.id } });
      expect(await prisma.platformRefreshToken.count({ where: { sessionId: session.id } })).toBe(0);
      expect(
        await prisma.authSession.findUnique({ where: { id: legacySessionId } }),
      ).not.toBeNull();
    });

    it('stores exact VND fees and inclusive dates, rejecting invalid periods and negative fees', async () => {
      const owner = await admin();
      const data = periodData(owner.id);
      const period = await prisma.hotelSubscriptionPeriod.create({ data });
      expect(period.feeAmount.toFixed(2)).toBe('1500000.01');
      expect(period.endsOn.toISOString()).toBe('2026-12-10T00:00:00.000Z');
      for (const invalid of [
        { startsOn: new Date('2026-12-11T00:00:00Z') },
        { feeAmount: '-0.01' },
        { currency: 'USD' },
      ])
        await expect(
          prisma.hotelSubscriptionPeriod.create({ data: { ...data, ...invalid } }),
        ).rejects.toThrow();
      await expect(
        prisma.hotelSubscriptionPeriod.create({
          data: {
            ...data,
            startsOn: data.endsOn,
            feeAmount: '0',
          },
        }),
      ).resolves.toHaveProperty('id');
    });

    it('rejects cross-hotel audit targets and preserves the identity of the platform actor', async () => {
      const periodOwner = await admin();
      const foreignPeriod = await prisma.hotelSubscriptionPeriod.create({
        data: periodData(periodOwner.id, 102n),
      });
      const owner = await admin();
      const base = { hotelId: 101n, actorId: owner.id, action: 'HOTEL_UPDATED' as const };
      await expect(
        prisma.platformAuditLog.create({
          data: {
            ...base,
            targetStaffUserId: legacyStaffId + 1n,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        prisma.platformAuditLog.create({
          data: {
            ...base,
            subscriptionPeriodId: foreignPeriod.id,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await prisma.platformAuditLog.create({
        data: {
          ...base,
          action: 'HOTEL_ADMIN_PASSWORD_RESET',
          targetStaffUserId: legacyStaffId,
          changes: { changedFields: ['mustChangePassword'] },
        },
      });
      await expect(prisma.platformAdmin.delete({ where: { id: owner.id } })).rejects.toMatchObject({
        code: 'P2003',
      });
    });

    it('requires suspension timestamps/reasons and audit reasons for suspension or reactivation', async () => {
      await expect(
        prisma.hotel.update({ where: { id: 101n }, data: { status: 'SUSPENDED' } }),
      ).rejects.toThrow();
      await prisma.hotel.update({
        where: { id: 101n },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspensionReason: 'Confirmed manual suspension',
        },
      });
      await expect(
        prisma.hotel.update({ where: { id: 101n }, data: { status: 'ACTIVE' } }),
      ).rejects.toThrow();
      await prisma.hotel.update({
        where: { id: 101n },
        data: {
          status: 'ACTIVE',
          suspendedAt: null,
          suspensionReason: null,
        },
      });
      const owner = await admin();
      for (const action of ['HOTEL_SUSPENDED', 'HOTEL_REACTIVATED'] as const)
        await expect(
          prisma.platformAuditLog.create({
            data: {
              hotelId: 101n,
              actorId: owner.id,
              action,
              reason: '   ',
            },
          }),
        ).rejects.toThrow();
    });
  },
);
