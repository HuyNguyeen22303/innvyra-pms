import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { isolatedMySql } from './isolated-mysql.js';
import { seedLocalDataset } from '../scripts/local-seed/dataset.js';
import { verifyLocalDataset } from '../scripts/local-seed/verify.js';
import { LOCAL_PASSWORD, LOCAL_INITIAL_PASSWORD } from '../scripts/local-seed/catalog.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Persistent multi-hotel local sample: full graph and financial integrity',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>;
    let seeded: Awaited<ReturnType<typeof seedLocalDataset>>;
    let env: ReturnType<typeof parseEnv>;
    beforeAll(async () => {
      database = await isolatedMySql('local_seed');
      env = parseEnv({
        NODE_ENV: 'test',
        DATABASE_URL: database.url,
        JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
        GUEST_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        GUEST_HASH_KEY: randomBytes(32).toString('hex'),
        LOGIN_RATE_LIMIT_MAX: '10000',
        REFRESH_RATE_LIMIT_MAX: '10000',
      });
      seeded = await seedLocalDataset(database.prisma, env);
    }, 240000);
    afterAll(async () => {
      await database?.dispose();
    });
    it('creates a different persistent-style dataset with complete hotel-scoped roles and history', async () => {
      const report = await verifyLocalDataset(database.prisma, env);
      expect(report.foreignKeyCount).toBeGreaterThan(50);
      expect(report.checks.filter((check) => check.failures)).toEqual([]);
      expect(report.ok).toBe(true);
      expect(report.counts.hotels).toBe(3);
      expect(report.counts.rooms).toBe(57);
      expect(report.counts.staff_users).toBe(36);
      expect(report.counts.guests).toBe(78);
      expect(report.counts.reservations).toBeGreaterThanOrEqual(60);
      expect(report.counts.room_occupancies).toBe(9);
      for (const hotel of seeded.manifest.hotels) {
        expect(hotel.historyCount).toBe(8);
        const session = await seeded.http.login(hotel.adminUsername, LOCAL_PASSWORD);
        expect(session.user.mustChangePassword).toBe(false);
        const rooms = await seeded.http.ok<{ items: { hotelId: string }[] }>(
          'get',
          '/rooms?limit=100',
          session.accessToken,
        );
        expect(rooms.items).toHaveLength(hotel.activeRoomCount + 1);
        expect(rooms.items.every((room) => room.hotelId === hotel.id)).toBe(true);
        const range = `startDate=${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}&endDate=${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}`;
        const report = await seeded.http.ok<{ summary: { netCashCollected: string } }>(
          'get',
          `/reports/revenue?${range}`,
          session.accessToken,
        );
        expect(Number(report.summary.netCashCollected)).toBeGreaterThan(0);
      }
    }, 60000);
    it('authenticates personal usernames while preserving onboarding and departed employee states', async () => {
      const people = await database.prisma.staffUser.findMany({ include: { role: true } });
      expect(new Set(people.map((person) => person.username)).size).toBe(36);
      for (const hotel of seeded.manifest.hotels) {
        const prefix = { LOTUS_HCM: 'lotus', OCEAN_DN: 'ocean', PINE_DL: 'pine' }[hotel.code]!;
        const employees = people.filter((person) => String(person.hotelId) === hotel.id);
        for (const person of employees) {
          expect(person.username).toMatch(
            new RegExp(`^${prefix}_(admin|quanly|letan|buongphong|ketoan|kythuat)_[a-z]+$`),
          );
          expect(person.username).not.toMatch(/inactive|temporary|staff_|_2\d/);
          expect(person.fullName).not.toContain('·');
        }
        for (const username of Object.values(hotel.roleUsernames)) {
          const session = await seeded.http.login(username);
          expect(session.user.username).toBe(username);
          expect(session.user.mustChangePassword).toBe(false);
        }
        expect(
          (
            await seeded.http.request('post', '/auth/login', {
              body: { username: hotel.inactiveUsername, password: LOCAL_INITIAL_PASSWORD },
            })
          ).status,
        ).toBe(401);
        const newHire = await seeded.http.login(hotel.temporaryUsername, LOCAL_INITIAL_PASSWORD);
        expect(newHire.user.mustChangePassword).toBe(true);
        const retired = await database.prisma.room.findFirstOrThrow({
          where: { hotelId: BigInt(hotel.id), isActive: false },
        });
        expect(retired.roomNumber).toBe(hotel.retiredRoomNumber);
        expect(retired.roomNumber).not.toBe('999');
        expect(retired.floorNumber).toBe(Number(retired.roomNumber[0]));
        expect(retired.notes).toContain('Chuyển đổi công năng');
      }
      const guests = await database.prisma.guest.findMany();
      expect(guests.some((guest) => guest.fullName.endsWith('Anh Anh'))).toBe(false);
    }, 60000);
    it('does not reset or modify a populated database when seed is run again', async () => {
      const before = await database.prisma.reservation.count();
      await expect(seedLocalDataset(database.prisma, env)).rejects.toThrow('not empty');
      expect(await database.prisma.reservation.count()).toBe(before);
    });
    it('detects a receipt/header mismatch instead of only checking FK presence', async () => {
      const receipt = await database.prisma.stockReceipt.findFirstOrThrow();
      try {
        await database.prisma.stockReceipt.update({
          where: { id: receipt.id },
          data: { totalAmount: receipt.totalAmount.add('0.01') },
        });
        const report = await verifyLocalDataset(database.prisma, env);
        expect(report.ok).toBe(false);
        expect(report.checks.find((check) => check.name === 'receipt_totals')?.failures).toBe(1);
      } finally {
        await database.prisma.stockReceipt.update({
          where: { id: receipt.id },
          data: { totalAmount: receipt.totalAmount },
        });
      }
    });
  },
);
