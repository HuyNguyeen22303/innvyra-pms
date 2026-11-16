import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { PrismaHousekeepingRepository } from '../src/modules/housekeeping/housekeeping.repository.js';
import { PrismaMaintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { PrismaInventoryRepository } from '../src/modules/inventory/inventory.repository.js';
import { PrismaReportRepository } from '../src/modules/reports/report.repository.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { ROLE_CODES, type RoleCode } from '../src/shared/types/roles.js';
import { isolatedMySql } from './isolated-mysql.js';
import { testEnv, testPassword } from './helpers.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'Housekeeping, inventory and supplier cash integration',
  () => {
    let database: Awaited<ReturnType<typeof isolatedMySql>>, app: ReturnType<typeof createApp>;
    let hotelId: bigint, typeId: bigint, foreignItem: bigint, category: string;
    let tokens: Record<RoleCode, string>, staff: Record<RoleCode, bigint>;
    const key = () => randomUUID();
    const call = (
      method: 'get' | 'post' | 'put' | 'patch',
      path: string,
      body?: object,
      role: RoleCode = 'ADMIN',
    ) => {
      const target = request(app)[method]('/api/v1' + path);
      const req = target.auth(tokens[role], { type: 'bearer' }).set('X-CSRF-Protection', '1');
      return body ? req.send(body) : req;
    };
    const payment = (amount: string, extra: object = {}) => ({
      requestKey: key(),
      amount,
      paymentMethod: 'CASH',
      paidAt: '2025-01-02T10:00:00+07:00',
      ...extra,
    });
    async function item(extra: object = {}) {
      const res = await call('post', '/inventory/items', {
        code: key().slice(0, 20),
        name: 'Dầu gội',
        unit: 'chai',
        categoryId: category,
        materialType: 'CONSUMABLE',
        ...extra,
      });
      expect(res.status, res.text).toBe(201);
      return res.body.data;
    }
    async function receipt(itemId: string, quantity = '10', initialPayment?: object) {
      const res = await call('post', '/inventory/receipts', {
        receiptNumber: key(),
        receiptDate: '2025-01-01T10:00:00+07:00',
        items: [{ itemId, quantity, unitPrice: '100000' }],
        ...(initialPayment ? { initialPayment } : {}),
      });
      expect(res.status, res.text).toBe(201);
      return res.body.data;
    }
    async function task() {
      const room = await database.prisma.room.create({
        data: { hotelId, roomTypeId: typeId, roomNumber: key().slice(0, 12), floorNumber: 1 },
      });
      const created = await call('post', '/housekeeping/tasks', { roomId: String(room.id) });
      expect(created.status, created.text).toBe(201);
      const id = created.body.data.id as string;
      expect(
        (
          await call('patch', `/housekeeping/tasks/${id}/assign`, {
            staffId: String(staff.HOUSEKEEPING),
          })
        ).status,
      ).toBe(200);
      const start = await call('post', `/housekeeping/tasks/${id}/start`, {}, 'HOUSEKEEPING');
      expect(start.status, start.text).toBe(200);
      return { id, workToken: start.body.data.workToken as string };
    }
    beforeAll(async () => {
      database = await isolatedMySql('supply_workflows');
      const db = database.prisma;
      const hash = await hashPassword(testPassword);
      await db.role.createMany({ data: ROLE_CODES.map((code) => ({ code, name: code })) });
      hotelId = (await db.hotel.create({ data: { code: 'SUPPLY_A', name: 'Lotus' } })).id;
      typeId = (
        await db.roomType.create({
          data: { hotelId, code: 'STD', name: 'Tiêu chuẩn', basePrice: '700000', maxAdults: 2 },
        })
      ).id;
      staff = {} as typeof staff;
      tokens = {} as typeof tokens;
      for (const role of ROLE_CODES) {
        const roleRow = await db.role.findUniqueOrThrow({ where: { code: role } });
        staff[role] = (
          await db.staffUser.create({
            data: {
              hotelId,
              roleId: roleRow.id,
              username: role.toLowerCase(),
              fullName: role,
              passwordHash: hash,
            },
          })
        ).id;
      }
      app = createApp(
        { ...testEnv, DATABASE_URL: database.url },
        new PrismaAuthRepository(db),
        { roomTypes: new PrismaRoomTypeRepository(db), rooms: new PrismaRoomRepository(db) },
        new PrismaGuestRepository(db),
        new PrismaReservationRepository(db),
        undefined,
        undefined,
        {
          housekeeping: new PrismaHousekeepingRepository(db),
          maintenance: new PrismaMaintenanceRepository(db),
        },
        new PrismaReportRepository(db),
        undefined,
        new PrismaInventoryRepository(db),
      );
      for (const role of ROLE_CODES) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('X-CSRF-Protection', '1')
          .send({ username: role.toLowerCase(), password: testPassword });
        expect(res.status, res.text).toBe(200);
        tokens[role] = res.body.data.accessToken;
      }
      const cat = await call('post', '/inventory/categories', {
        code: 'AMENITY',
        name: 'Đồ dùng phòng',
      });
      category = cat.body.data.id;
      const foreign = await db.hotel.create({ data: { code: 'SUPPLY_B', name: 'Ocean' } });
      const foreignCat = await db.inventoryCategory.create({
        data: { hotelId: foreign.id, code: 'A', name: 'Amenities' },
      });
      foreignItem = (
        await db.inventoryItem.create({
          data: {
            hotelId: foreign.id,
            categoryId: foreignCat.id,
            code: 'FOREIGN',
            name: 'Foreign',
            unit: 'cái',
            materialType: 'CONSUMABLE',
          },
        })
      ).id;
    }, 120000);
    afterAll(async () => {
      await database?.dispose();
    });
    it('suggests per-room-type consumables, atomically issues actual usage, retries and rework without double deductions', async () => {
      const supply = await item();
      await receipt(supply.id);
      expect(
        (
          await call('put', `/room-types/${typeId}/housekeeping-materials`, {
            materials: [{ itemId: supply.id, quantity: '2' }],
          })
        ).status,
      ).toBe(200);
      const work = await task(),
        path = `/housekeeping/tasks/${work.id}`;
      const suggested = await call('get', path + '/materials', undefined, 'HOUSEKEEPING');
      expect(suggested.body.data.materials[0]).toMatchObject({
        itemId: supply.id,
        quantity: '2.00',
      });
      const body = {
        workToken: work.workToken,
        materials: [{ itemId: supply.id, quantity: '1.50' }],
      };
      const done = await call('post', path + '/complete', body, 'HOUSEKEEPING');
      expect(done.status, done.text).toBe(200);
      expect((await call('post', path + '/complete', body, 'HOUSEKEEPING')).status).toBe(200);
      expect(
        (
          await database.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: BigInt(supply.id) },
          })
        ).currentStock.toString(),
      ).toBe('8.5');
      expect(
        await database.prisma.stockIssue.count({
          where: { housekeepingCompletion: { taskId: BigInt(work.id) } },
        }),
      ).toBe(1);
      expect(
        (
          await call(
            'post',
            path + '/complete',
            { ...body, materials: [{ itemId: supply.id, quantity: '2' }] },
            'HOUSEKEEPING',
          )
        ).status,
      ).toBe(409);
      await call('post', path + '/inspect', { passed: false, notes: 'Cần vệ sinh bổ sung' });
      const started = await call('post', path + '/start', {}, 'HOUSEKEEPING');
      const second = {
        workToken: started.body.data.workToken,
        materials: [{ itemId: supply.id, quantity: '0.50' }],
      };
      expect((await call('post', path + '/complete', second, 'HOUSEKEEPING')).status).toBe(200);
      expect(
        (
          await database.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: BigInt(supply.id) },
          })
        ).currentStock.toString(),
      ).toBe('8');
      expect(
        (await call('get', path + '/materials', undefined, 'HOUSEKEEPING')).body.data.history,
      ).toHaveLength(2);
    });
    it('rolls back completion and all stock changes on shortage; requires explicit no-materials confirmation', async () => {
      const supply = await item();
      await receipt(supply.id, '1');
      const work = await task();
      const path = `/housekeeping/tasks/${work.id}`;
      const before = await database.prisma.inventoryMovement.count();
      const failed = await call(
        'post',
        path + '/complete',
        { workToken: work.workToken, materials: [{ itemId: supply.id, quantity: '2' }] },
        'HOUSEKEEPING',
      );
      expect(failed.status, failed.text).toBe(409);
      expect(
        (
          await database.prisma.housekeepingTask.findUniqueOrThrow({
            where: { id: BigInt(work.id) },
          })
        ).status,
      ).toBe('IN_PROGRESS');
      expect(await database.prisma.inventoryMovement.count()).toBe(before);
      expect(
        await database.prisma.housekeepingMaterialCompletion.count({
          where: { taskId: BigInt(work.id) },
        }),
      ).toBe(0);
      expect(
        (
          await call(
            'post',
            path + '/complete',
            { workToken: work.workToken, materials: [] },
            'HOUSEKEEPING',
          )
        ).status,
      ).toBe(422);
      expect(
        (
          await call(
            'post',
            path + '/complete',
            {
              workToken: work.workToken,
              materials: [],
              noMaterialsReason: 'Chỉ thu dọn và thay đồ vải',
            },
            'HOUSEKEEPING',
          )
        ).status,
      ).toBe(200);
    });
    it('protects classification and tenant boundaries and serializes competing stock consumption', async () => {
      const reusable = await item({ materialType: 'REUSABLE' });
      expect(
        (
          await call('put', `/room-types/${typeId}/housekeeping-materials`, {
            materials: [{ itemId: reusable.id, quantity: '1' }],
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await call('put', `/room-types/${typeId}/housekeeping-materials`, {
            materials: [{ itemId: String(foreignItem), quantity: '1' }],
          })
        ).status,
      ).toBe(404);
      const supply = await item();
      await receipt(supply.id, '1');
      const a = await task(),
        b = await task();
      const results = await Promise.all(
        [a, b].map((work) =>
          call(
            'post',
            `/housekeeping/tasks/${work.id}/complete`,
            { workToken: work.workToken, materials: [{ itemId: supply.id, quantity: '1' }] },
            'HOUSEKEEPING',
          ),
        ),
      );
      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(
        (
          await database.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: BigInt(supply.id) },
          })
        ).currentStock.toString(),
      ).toBe('0');
    });
    it('records initial or partial supplier payments, prevents retries and overpayment, and reverses with an audit trail', async () => {
      const supply = await item();
      const bill = await receipt(supply.id, '10', payment('400000'));
      const path = `/inventory/receipts/${bill.id}`;
      expect((await call('get', path + '/settlement')).body.data).toMatchObject({
        paidAmount: '400000.00',
        outstandingAmount: '600000.00',
        status: 'PARTIAL',
      });
      const body = payment('600000', { paidAt: '2025-01-03T10:00:00+07:00' });
      expect((await call('post', path + '/payments', body, 'ACCOUNTANT')).status).toBe(201);
      expect((await call('post', path + '/payments', body, 'ACCOUNTANT')).status).toBe(201);
      expect((await call('post', path + '/payments', payment('1'))).status).toBe(409);
      expect(
        (await call('post', path + '/payments', { ...body, amount: '1' }, 'ACCOUNTANT')).status,
      ).toBe(409);
      const settled = (await call('get', path + '/settlement')).body.data;
      expect(settled.status).toBe('PAID');
      expect(settled.payments).toHaveLength(2);
      const reversed = await call(
        'post',
        `/inventory/supplier-payments/${settled.payments[1].id}/reverse`,
        { reason: 'Ghi nhầm giao dịch' },
        'ACCOUNTANT',
      );
      expect(reversed.status, reversed.text).toBe(200);
      expect(reversed.body.data.outstandingAmount).toBe('600000.00');
      expect(reversed.body.data.payments[1].reversal.reason).toBe('Ghi nhầm giao dịch');
    });
    it('keeps historical payments unknown until explicit reconciliation and rejects unauthorized financial access', async () => {
      const old = await database.prisma.stockReceipt.create({
        data: {
          hotelId,
          createdBy: staff.ADMIN,
          receiptNumber: key(),
          receiptDate: new Date('2020-01-01'),
          totalAmount: '100000',
        },
      });
      const path = `/inventory/receipts/${old.id}`;
      expect((await call('get', path + '/settlement')).body.data).toMatchObject({
        status: 'UNRECONCILED',
        outstandingAmount: null,
      });
      expect((await call('post', path + '/payments', payment('100'))).status).toBe(409);
      expect(
        (
          await call(
            'post',
            path + '/reconcile',
            { reason: 'Đã đối chiếu, phiếu chưa trả tiền' },
            'ACCOUNTANT',
          )
        ).status,
      ).toBe(200);
      expect((await call('get', path + '/settlement')).body.data.outstandingAmount).toBe(
        '100000.00',
      );
      for (const role of ['HOUSEKEEPING', 'TECHNICIAN', 'RECEPTIONIST'] as const) {
        expect((await call('get', path + '/settlement', undefined, role)).status).toBe(403);
        expect((await call('post', path + '/payments', payment('1'), role)).status).toBe(403);
      }
      expect(
        (await call('get', `/inventory/receipts/18446744073709551615/settlement`)).status,
      ).toBe(404);
    });
    it('reports purchases and real cash on their separate dates, supports fractional quantities and consistent category filters', async () => {
      const otherCategory = await call('post', '/inventory/categories', {
        code: key().slice(0, 20),
        name: 'Hóa chất',
      });
      const a = await item(),
        b = await item({ categoryId: otherCategory.body.data.id, unit: 'ml' });
      const bought = await call('post', '/inventory/receipts', {
        receiptNumber: key(),
        receiptDate: '2024-02-01T10:00:00+07:00',
        items: [
          { itemId: a.id, quantity: '1.50', unitPrice: '100' },
          { itemId: b.id, quantity: '0.25', unitPrice: '200' },
        ],
        initialPayment: payment('50', { paidAt: '2024-02-02T10:00:00+07:00' }),
      });
      expect(bought.status, bought.text).toBe(201);
      const purchase = await call(
        'get',
        `/reports/procurement?startDate=2024-02-01&endDate=2024-02-02&categoryId=${otherCategory.body.data.id}`,
      );
      expect(purchase.status, purchase.text).toBe(200);
      expect(purchase.body.data.summary).toMatchObject({
        totalExpense: '50.00',
        distinctItemCount: 1,
      });
      expect(purchase.body.data.topItems[0].totalQuantity).toBe('0.25');
      expect(purchase.body.data.bySupplier[0].totalAmount).toBe('50.00');
      const cash = await call('get', '/reports/payments?startDate=2024-02-02&endDate=2024-02-03');
      expect(cash.status, cash.text).toBe(200);
      expect(cash.body.data.summary).toMatchObject({
        netCashCollected: '0.00',
        supplierPayments: '50.00',
        netCashAfterSupplies: '-50.00',
      });
      const finance = await call(
        'get',
        '/reports/supplier-finance?startDate=2024-02-02&endDate=2024-02-03',
      );
      expect(finance.status, finance.text).toBe(200);
      expect(finance.body.data.netPaidOut).toBe('50.00');
    });
    it('rolls back goods and receipt when initial payment exceeds the invoice; serializes competing supplier payments', async () => {
      const supply = await item();
      const count = await database.prisma.stockReceipt.count();
      const rejected = await call('post', '/inventory/receipts', {
        items: [{ itemId: supply.id, quantity: '1', unitPrice: '100' }],
        initialPayment: payment('101'),
      });
      expect(rejected.status, rejected.text).toBe(409);
      expect(await database.prisma.stockReceipt.count()).toBe(count);
      expect(
        (
          await database.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: BigInt(supply.id) },
          })
        ).currentStock.toString(),
      ).toBe('0');
      const bill = await receipt(supply.id, '1');
      const path = `/inventory/receipts/${bill.id}/payments`;
      const results = await Promise.all([
        call('post', path, payment('60000')),
        call('post', path, payment('60000'), 'ACCOUNTANT'),
      ]);
      expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
      expect(
        (await call('get', `/inventory/receipts/${bill.id}/settlement`)).body.data
          .outstandingAmount,
      ).toBe('40000.00');
    });
    it('reconciles known historical paid amounts atomically and protects cross-hotel foreign keys', async () => {
      const legacy = await database.prisma.stockReceipt.create({
        data: {
          hotelId,
          createdBy: staff.ADMIN,
          receiptNumber: key(),
          receiptDate: new Date('2020-01-01'),
          totalAmount: '1000',
        },
      });
      const path = `/inventory/receipts/${legacy.id}`;
      expect(
        (
          await call('post', path + '/reconcile', {
            reason: 'Đối chiếu chứng từ cũ',
            payment: payment('1001'),
          })
        ).status,
      ).toBe(409);
      expect((await call('get', path + '/settlement')).body.data.status).toBe('UNRECONCILED');
      const verified = await call(
        'post',
        path + '/reconcile',
        { reason: 'Đã đối chiếu khoản trả trước', payment: payment('400') },
        'ACCOUNTANT',
      );
      expect(verified.status, verified.text).toBe(200);
      expect(verified.body.data).toMatchObject({
        paidAmount: '400.00',
        outstandingAmount: '600.00',
        status: 'PARTIAL',
      });
      const foreign = await database.prisma.inventoryItem.findUniqueOrThrow({
        where: { id: foreignItem },
      });
      await expect(
        database.prisma.housekeepingMaterialPreset.create({
          data: { hotelId, roomTypeId: typeId, itemId: foreign.id, quantity: '1' },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
    it('scales guest-based suggestions, validates preparation capacity and preserves the recorded counts across retries', async () => {
      await database.prisma.roomType.update({ where: { id: typeId }, data: { maxChildren: 1 } });
      const supply = await item();
      await receipt(supply.id, '10');
      expect(
        (
          await call('put', `/room-types/${typeId}/housekeeping-materials`, {
            materials: [{ itemId: supply.id, quantity: '1.00', usageBasis: 'PER_GUEST' }],
          })
        ).status,
      ).toBe(200);
      const work = await task(),
        path = `/housekeeping/tasks/${work.id}`;
      const suggested = (await call('get', path + '/materials', undefined, 'HOUSEKEEPING')).body
        .data;
      expect(suggested.roomType).toMatchObject({ maxAdults: 2, maxChildren: 1 });
      expect(suggested.materials[0]).toMatchObject({
        quantity: '2.00',
        presetQuantity: '1.00',
        usageBasis: 'PER_GUEST',
      });
      const body = {
        workToken: work.workToken,
        materials: [{ itemId: supply.id, quantity: '3' }],
        preparedAdults: 2,
        preparedChildren: 1,
      };
      expect((await call('post', path + '/complete', body, 'HOUSEKEEPING')).status).toBe(200);
      expect((await call('post', path + '/complete', body, 'HOUSEKEEPING')).status).toBe(200);
      expect(
        (await call('post', path + '/complete', { ...body, preparedChildren: 0 }, 'HOUSEKEEPING'))
          .status,
      ).toBe(409);
      expect(
        (await call('get', path + '/materials', undefined, 'HOUSEKEEPING')).body.data.history[0],
      ).toMatchObject({ preparedAdults: 2, preparedChildren: 1 });
      const second = await task();
      expect(
        (
          await call(
            'post',
            `/housekeeping/tasks/${second.id}/complete`,
            { ...body, workToken: second.workToken, preparedAdults: 3 },
            'HOUSEKEEPING',
          )
        ).status,
      ).toBe(422);
      expect(
        (
          await database.prisma.inventoryItem.findUniqueOrThrow({
            where: { id: BigInt(supply.id) },
          })
        ).currentStock.toString(),
      ).toBe('7');
      expect(
        await database.prisma.housekeepingMaterialCompletion.count({
          where: { taskId: BigInt(second.id) },
        }),
      ).toBe(0);
    });
    it('requires the active cleaning token, protects role boundaries and keeps reusable units distinct', async () => {
      const work = await task();
      const path = `/housekeeping/tasks/${work.id}`;
      expect(
        (
          await call(
            'post',
            path + '/complete',
            { workToken: key(), materials: [], noMaterialsReason: 'Không cấp vật tư' },
            'HOUSEKEEPING',
          )
        ).status,
      ).toBe(409);
      expect((await call('post', path + '/complete', {}, 'HOUSEKEEPING')).status).toBe(422);
      for (const role of ['HOUSEKEEPING', 'RECEPTIONIST', 'TECHNICIAN', 'ACCOUNTANT'] as const)
        expect(
          (
            await call(
              'put',
              `/room-types/${typeId}/housekeeping-materials`,
              { materials: [] },
              role,
            )
          ).status,
        ).toBe(403);
      const consumable = await item();
      await receipt(consumable.id, '1');
      expect(
        (await call('patch', `/inventory/items/${consumable.id}`, { unit: 'ml' })).status,
      ).toBe(409);
    });
  },
);
