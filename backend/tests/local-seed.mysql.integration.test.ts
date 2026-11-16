import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.js';
import { isolatedMySql } from './isolated-mysql.js';
import { seedLocalDataset } from '../scripts/local-seed/dataset.js';
import { verifyLocalDataset } from '../scripts/local-seed/verify.js';
import { LOCAL_PASSWORD, LOCAL_INITIAL_PASSWORD } from '../scripts/local-seed/catalog.js';
import { backfillLocalSupplies } from '../scripts/local-seed/supply-backfill.js';
import {
  planReservationCodeChanges,
  applyReservationCodeChanges,
} from '../scripts/local-seed/reservation-codes.js';

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
      expect(report.counts.inventory_items).toBe(120);
      expect(report.counts.housekeeping_material_presets).toBe(216);
      const openingReceipts = await database.prisma.stockReceipt.findMany({
        where: { receiptNumber: { startsWith: 'NHAP-BP-' } },
        include: { supplierPayments: true, items: true },
      });
      expect(openingReceipts).toHaveLength(3);
      expect(
        openingReceipts.every(
          (receipt) =>
            receipt.paymentTracking === 'TRACKED' &&
            receipt.supplierPayments.length === 0 &&
            receipt.items.length === 34,
        ),
      ).toBe(true);
      const codes = (await database.prisma.reservation.findMany()).map(
        (row) => row.confirmationCode,
      );
      expect(codes.every((code) => /^INN-[0-9A-F]{12}$/.test(code))).toBe(true);
      expect(new Set(codes).size).toBe(codes.length);
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
    it('converts legacy codes without changing IDs or financial details, avoiding existing codes and supporting reruns', async () => {
      const booking = await database.prisma.reservation.findFirstOrThrow();
      await database.prisma.reservation.update({
        where: { id: booking.id },
        data: { confirmationCode: `INN-${'A'.repeat(28)}` },
      });
      const before = await database.prisma.reservation.findUniqueOrThrow({
        where: { id: booking.id },
      });
      const existing = await database.prisma.reservation.findFirstOrThrow({
        where: { id: { not: booking.id } },
      });
      let calls = 0;
      const plan = await planReservationCodeChanges(database.prisma, env, () =>
        ++calls === 1 ? existing.confirmationCode : 'INN-123456789ABC',
      );
      expect(calls).toBe(2);
      expect(plan).toHaveLength(1);
      await applyReservationCodeChanges(database.prisma, env, plan);
      const after = await database.prisma.reservation.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(after).toEqual({ ...before, confirmationCode: 'INN-123456789ABC' });
      expect(await planReservationCodeChanges(database.prisma, env)).toEqual([]);
      expect((await verifyLocalDataset(database.prisma, env)).ok).toBe(true);
    });
    it('rolls back the entire code update when a reservation changes after planning', async () => {
      const bookings = await database.prisma.reservation.findMany({
        take: 2,
        orderBy: { id: 'asc' },
      });
      const originals = bookings.map((booking) => booking.confirmationCode);
      try {
        for (const [index, booking] of bookings.entries())
          await database.prisma.reservation.update({
            where: { id: booking.id },
            data: { confirmationCode: `LEGACY-ROLLBACK-${index}` },
          });
        const plan = await planReservationCodeChanges(database.prisma, env);
        await database.prisma.reservation.update({
          where: { id: bookings[1]!.id },
          data: { confirmationCode: 'LEGACY-CHANGED' },
        });
        await expect(applyReservationCodeChanges(database.prisma, env, plan)).rejects.toThrow(
          'rolled back',
        );
        expect(
          (await database.prisma.reservation.findUniqueOrThrow({ where: { id: bookings[0]!.id } }))
            .confirmationCode,
        ).toBe('LEGACY-ROLLBACK-0');
      } finally {
        for (const [index, booking] of bookings.entries())
          await database.prisma.reservation.update({
            where: { id: booking.id },
            data: { confirmationCode: originals[index]! },
          });
      }
    });
    it('fills only missing local supply configuration, preserves custom presets and all stock/financial history, and supports reruns', async () => {
      const db = database.prisma;
      await db.housekeepingMaterialPreset.deleteMany();
      const legacyCodes = ['ITEM_1', 'ITEM_2', 'ITEM_3', 'ITEM_4', 'ITEM_5', 'ITEM_6'];
      await db.inventoryItem.updateMany({
        where: { code: { in: legacyCodes } },
        data: { materialType: 'UNCLASSIFIED' },
      });
      await db.inventoryItem.updateMany({
        where: { code: { in: ['ITEM_4', 'ITEM_5', 'ITEM_6'] } },
        data: { unit: 'chai' },
      });
      const roomType = await db.roomType.findFirstOrThrow();
      const brush = await db.inventoryItem.findFirstOrThrow({
        where: { hotelId: roomType.hotelId, code: 'ITEM_3' },
      });
      await db.housekeepingMaterialPreset.create({
        data: {
          hotelId: roomType.hotelId,
          roomTypeId: roomType.id,
          itemId: brush.id,
          quantity: '7.25',
        },
      });
      const originalItems = await db.inventoryItem.findMany({ orderBy: { id: 'asc' } });
      const snapshot = async () =>
        createHash('sha256')
          .update(
            JSON.stringify(
              await Promise.all([
                db.reservation.findMany({ orderBy: { id: 'asc' } }),
                db.stay.findMany({ orderBy: { id: 'asc' } }),
                db.inventoryMovement.findMany({ orderBy: { id: 'asc' } }),
                db.stockReceipt.findMany({ orderBy: { id: 'asc' } }),
                db.supplierPayment.findMany({ orderBy: { id: 'asc' } }),
                db.payment.findMany({ orderBy: { id: 'asc' } }),
              ]),
              (_key, value) => (typeof value === 'bigint' ? String(value) : value),
            ),
          )
          .digest('hex');
      const before = await snapshot();
      const planned = await backfillLocalSupplies(db, env);
      expect(planned).toMatchObject({
        applied: false,
        itemsClassified: 18,
        roomTypesConfigured: 12,
        presetLinesAdded: 215,
      });
      expect(await db.housekeepingMaterialPreset.count()).toBe(1);
      expect(
        (await db.inventoryItem.findMany({ where: { code: { in: legacyCodes } } })).every(
          (item) => item.materialType === 'UNCLASSIFIED',
        ),
      ).toBe(true);
      const applied = await backfillLocalSupplies(db, env, true);
      expect(applied).toMatchObject({
        applied: true,
        itemsClassified: 18,
        roomTypesConfigured: 12,
        presetLinesAdded: 215,
      });
      expect(await snapshot()).toBe(before);
      const updatedItems = await db.inventoryItem.findMany({ orderBy: { id: 'asc' } });
      for (const [index, item] of updatedItems.entries()) {
        const original = originalItems[index]!;
        expect(item.currentStock).toEqual(original.currentStock);
        expect(item.unit).toBe(original.unit);
        expect(item.updatedAt).toEqual(original.updatedAt);
        expect(item.materialType).toBe(
          legacyCodes.includes(item.code)
            ? item.code === 'ITEM_1'
              ? 'REUSABLE'
              : 'CONSUMABLE'
            : original.materialType,
        );
      }
      expect(
        (
          await db.housekeepingMaterialPreset.findFirstOrThrow({
            where: { roomTypeId: roomType.id, itemId: brush.id },
          })
        ).quantity.toString(),
      ).toBe('7.25');
      expect(await backfillLocalSupplies(db, env, true)).toMatchObject({
        itemsClassified: 0,
        roomTypesConfigured: 0,
        presetLinesAdded: 0,
      });
      expect((await verifyLocalDataset(db, env)).ok).toBe(true);
      await expect(
        backfillLocalSupplies(db, { ...env, NODE_ENV: 'production' }, true),
      ).rejects.toThrow('local Innvyra');
    });
  },
);
