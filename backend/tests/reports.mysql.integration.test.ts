import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrisma } from '../src/database/prisma.js';
import { PrismaAuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaRoomRepository } from '../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../src/modules/reservations/reservation.repository.js';
import { PrismaStayRepository } from '../src/modules/stays/stay.repository.js';
import { PrismaBillingRepository } from '../src/modules/billing/billing.repository.js';
import { PrismaHousekeepingRepository } from '../src/modules/housekeeping/housekeeping.repository.js';
import { PrismaMaintenanceRepository } from '../src/modules/maintenance/maintenance.repository.js';
import { PrismaReportRepository } from '../src/modules/reports/report.repository.js';
import { asDate, hotelToday } from '../src/modules/reservations/reservation.dates.js';
import { nextDate } from '../src/modules/reports/report.dates.js';
import { ROLE_CODES, type RoleCode } from '../src/shared/types/roles.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { testEnv, testPassword } from './helpers.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)(
  'Reports MySQL + HTTP: actual aggregates, scoped access, read-only history',
  () => {
    let db: ReturnType<typeof createPrisma>, app: ReturnType<typeof createApp>;
    const hotels: bigint[] = [],
      tokens = {} as Record<RoleCode, string>,
      staff = {} as Record<RoleCode, bigint>;
    let foreignToken: string,
      typeId: bigint,
      foreignTypeId: bigint,
      rooms: bigint[],
      mainFolio: bigint;
    let today: string, edgeToken: string;
    const range = { startDate: '2020-10-01', endDate: '2020-10-06' };
    const get = (path: string, query: object = range, role: RoleCode = 'ADMIN') =>
      request(app)
        .get('/api/v1/reports/' + path)
        .query(query)
        .auth(tokens[role], { type: 'bearer' });
    const d = (date: string) => new Date(date);
    const createdAt = d('2020-01-01T00:00:00Z');

    beforeAll(async () => {
      const url = new URL(testUrl!);
      if (
        process.env.NODE_ENV !== 'test' ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/[A-Za-z0-9_]+_test$/.test(url.pathname) ||
        (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === url.pathname)
      )
        throw new Error('Reports integration tests require a separate local _test database');
      db = createPrisma(testUrl!);
      await db.$connect();
      const key = 'reports_' + randomUUID().replaceAll('-', '');
      const hash = await hashPassword(testPassword);
      for (const suffix of ['', '_b', '_edge'])
        hotels.push(
          (
            await db.hotel.create({
              data: {
                code: key + suffix,
                name: 'Synthetic reports hotel',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            })
          ).id,
        );
      const hotelId = hotels[0]!;
      for (const code of ROLE_CODES) {
        const role = await db.role.upsert({
          where: { code },
          create: { code, name: code },
          update: {},
        });
        const user = await db.staffUser.create({
          data: {
            hotelId,
            roleId: role.id,
            username: key + code,
            fullName: 'Synthetic ' + code,
            passwordHash: hash,
          },
        });
        staff[code] = user.id;
        tokens[code] = (
          await new AuthService(new PrismaAuthRepository(db), testEnv).login({
            username: user.username,
            password: testPassword,
          })
        ).data.accessToken;
      }
      const role = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
      const foreignStaff = await db.staffUser.create({
        data: {
          hotelId: hotels[1]!,
          roleId: role.id,
          username: key + '_foreign',
          fullName: 'Foreign admin',
          passwordHash: hash,
        },
      });
      foreignToken = (
        await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username: foreignStaff.username,
          password: testPassword,
        })
      ).data.accessToken;
      typeId = (
        await db.roomType.create({
          data: {
            hotelId,
            code: 'MAIN',
            name: 'Main',
            basePrice: '900000',
            maxAdults: 2,
            createdAt,
          },
        })
      ).id;
      foreignTypeId = (
        await db.roomType.create({
          data: {
            hotelId: hotels[1]!,
            code: 'FOREIGN',
            name: 'Foreign type',
            basePrice: '900000',
            maxAdults: 2,
            createdAt,
          },
        })
      ).id;
      const secondType = await db.roomType.create({
        data: { hotelId, code: 'NEW', name: 'New type', basePrice: '950000', maxAdults: 2 },
      });
      rooms = [];
      for (let i = 0; i < 12; i++)
        rooms.push(
          (
            await db.room.create({
              data: {
                hotelId,
                roomTypeId: i < 10 ? typeId : secondType.id,
                roomNumber: String(i + 101),
                floorNumber: 1,
                housekeepingStatus:
                  i === 0 ? 'DIRTY' : i === 1 ? 'CLEANING' : i === 2 ? 'INSPECTION' : 'READY',
                physicalStatus: i === 9 ? 'MAINTENANCE' : i === 3 ? 'OUT_OF_SERVICE' : 'ACTIVE',
                isActive: i !== 4,
                createdAt: i < 10 ? createdAt : new Date(),
              },
            })
          ).id,
        );
      const guest = await db.guest.create({
        data: {
          hotelId,
          fullName: 'PRIVATE_GUEST_NAME',
          phone: 'PRIVATE_PHONE',
          documentNumberCiphertext: 'PRIVATE_DOCUMENT',
        },
      });
      const makeBooking = async (input: {
        quantity: number;
        status?: 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW' | 'CONFIRMED';
        arrival?: string;
        departure?: string;
        created?: Date;
        source?: string;
      }) => {
        const status = input.status ?? 'CONFIRMED';
        const arrival = input.arrival ?? range.startDate,
          departure = input.departure ?? range.endDate;
        const nights: { stayDate: Date; nightlyRate: string }[] = [];
        for (let date = arrival; date < departure; date = nextDate(date))
          nights.push({ stayDate: asDate(date), nightlyRate: '900000' });
        return db.reservation.create({
          data: {
            hotelId,
            confirmationCode: randomUUID().replaceAll('-', ''),
            bookerGuestId: guest.id,
            checkInDate: asDate(arrival),
            checkOutDate: asDate(departure),
            status,
            totalAmount: '900000',
            createdBy: staff.ADMIN,
            bookingSource: input.source ?? 'DIRECT',
            createdAt: input.created ?? d('2020-10-01T03:00:00Z'),
            ...(status === 'CANCELLED'
              ? {
                  cancelledAt: d('2020-10-02T03:00:00Z'),
                  cancelledBy: staff.ADMIN,
                  cancellationReason: 'Synthetic cancellation',
                }
              : {}),
            rooms: {
              create: Array.from({ length: input.quantity }, () => ({
                roomTypeId: typeId,
                adults: 2,
                createdAt: input.created ?? d('2020-10-01T03:00:00Z'),
                nights: { create: nights },
              })),
            },
          },
          include: { rooms: { include: { nights: { orderBy: { stayDate: 'asc' } } } } },
        });
      };
      const booking = await makeBooking({ quantity: 8, status: 'CHECKED_OUT' });
      const stayIds: bigint[] = [];
      for (let i = 0; i < 8; i++)
        stayIds.push(
          (
            await db.stay.create({
              data: {
                hotelId,
                roomTypeId: typeId,
                reservationRoomId: booking.rooms[i]!.id,
                currentRoomId: rooms[i]!,
                status: 'CHECKED_OUT',
                actualCheckinAt: d('2020-10-01T07:00:00Z'),
                actualCheckoutAt: d(i === 7 ? '2020-10-02T04:00:00Z' : '2020-10-06T04:00:00Z'),
                checkinStaffId: staff.ADMIN,
                checkoutStaffId: staff.ADMIN,
              },
            })
          ).id,
        );
      for (const [from, to, at] of [
        [0, 8, '2020-10-01T14:00:00Z'],
        [8, 0, '2020-10-01T15:00:00Z'],
        [0, 8, '2020-10-03T12:00:00Z'],
        [8, 0, '2020-10-04T05:00:00Z'],
      ] as const)
        await db.roomTransfer.create({
          data: {
            hotelId,
            roomTypeId: typeId,
            stayId: stayIds[0]!,
            fromRoomId: rooms[from]!,
            toRoomId: rooms[to]!,
            transferredAt: d(at),
            transferredBy: staff.ADMIN,
            reason: 'Synthetic transfer',
          },
        });
      for (let i = 0; i < 2; i++)
        await db.maintenanceBlock.create({
          data: {
            hotelId,
            roomId: rooms[9]!,
            startDate: asDate(range.startDate),
            endDate: asDate('2020-10-03'),
            status: 'RELEASED',
            reason: 'Retained overlapping legacy block',
            createdBy: staff.ADMIN,
            releasedBy: staff.ADMIN,
            releasedAt: d('2020-10-06T01:00:00Z'),
            createdAt,
          },
        });
      await db.maintenanceBlock.create({
        data: {
          hotelId,
          roomId: rooms[8]!,
          startDate: asDate(range.startDate),
          endDate: asDate(range.endDate),
          status: 'CANCELLED',
          reason: 'Cancelled future block',
          createdBy: staff.ADMIN,
          createdAt,
        },
      });
      await makeBooking({ quantity: 2, status: 'CANCELLED' });
      await makeBooking({ quantity: 1, status: 'NO_SHOW' });
      const expected = await makeBooking({
        quantity: 2,
        arrival: '2020-10-03',
        departure: '2020-10-05',
        created: d('2020-10-01T18:00:00Z'),
        source: '=HYPERLINK("example")',
      });
      const folio = await db.folio.create({
        data: { hotelId, reservationId: booking.id, openedAt: createdAt, createdAt },
      });
      mainFolio = folio.id;
      await db.folioItem.create({
        data: {
          hotelId,
          folioId: folio.id,
          entryType: 'DEBIT',
          sourceType: 'ROOM_NIGHT',
          sourceId: booking.rooms[0]!.nights[0]!.id,
          roomNightId: booking.rooms[0]!.nights[0]!.id,
          amount: '4500000',
          description: 'Multi-night billed activity',
          createdBy: staff.ADMIN,
          createdAt: d('2020-09-30T17:00:00Z'),
        },
      });
      const service = await db.service.create({
        data: {
          hotelId,
          code: 'SERVICE',
          name: 'Synthetic service',
          unit: 'item',
          price: '500000',
        },
      });
      const order = await db.serviceOrder.create({
        data: {
          hotelId,
          reservationId: booking.id,
          status: 'COMPLETED',
          createdBy: staff.ADMIN,
          completedBy: staff.ADMIN,
          completedAt: d('2020-10-01T02:00:00Z'),
          items: {
            create: {
              serviceId: service.id,
              nameSnapshot: 'Synthetic service',
              unitSnapshot: 'item',
              quantity: 1,
              unitPriceSnapshot: '500000',
              lineTotal: '500000',
            },
          },
        },
        include: { items: true },
      });
      await db.folioItem.create({
        data: {
          hotelId,
          folioId: folio.id,
          entryType: 'DEBIT',
          sourceType: 'SERVICE_ORDER_ITEM',
          sourceId: order.items[0]!.id,
          serviceOrderItemId: order.items[0]!.id,
          amount: '500000',
          description: 'Service posted once',
          createdBy: staff.ADMIN,
          createdAt: d('2020-10-01T02:00:00Z'),
        },
      });
      for (const [entryType, amount, at] of [
        ['DEBIT', '1000', '2020-09-30T00:00:00Z'],
        ['DEBIT', '200000', '2020-10-02T01:00:00Z'],
        ['CREDIT', '100000', '2020-10-03T01:00:00Z'],
        ['CREDIT', '500', '2020-10-07T01:00:00Z'],
      ] as const)
        await db.folioItem.create({
          data: {
            hotelId,
            folioId: folio.id,
            entryType,
            sourceType: 'MANUAL_ADJUSTMENT',
            amount,
            description: 'Synthetic adjustment',
            createdBy: staff.ADMIN,
            createdAt: d(at),
          },
        });
      const receipt = await db.payment.create({
        data: {
          hotelId,
          folioId: folio.id,
          paymentType: 'PAYMENT',
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'bank-ref',
          amount: '3000000',
          status: 'CONFIRMED',
          processedBy: staff.ADMIN,
          processedAt: d('2020-10-02T01:00:00Z'),
        },
      });
      await db.payment.create({
        data: {
          hotelId,
          folioId: folio.id,
          paymentType: 'REFUND',
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: 'refund-ref',
          originalPaymentId: receipt.id,
          reason: 'Partial refund',
          amount: '200000',
          status: 'CONFIRMED',
          processedBy: staff.ADMIN,
          processedAt: d('2020-10-03T01:00:00Z'),
        },
      });
      for (const [paymentType, amount, status, at] of [
        ['PAYMENT', '500', 'CONFIRMED', '2020-09-30T00:00:00Z'],
        ['DEPOSIT', '1000000', 'CONFIRMED', '2020-10-01T01:00:00Z'],
        ['PAYMENT', '999999', 'FAILED', '2020-10-01T01:00:00Z'],
        ['PAYMENT', '88888', 'PENDING', '2020-10-01T01:00:00Z'],
        ['PAYMENT', '123', 'CONFIRMED', '2020-10-05T17:00:00Z'],
      ] as const)
        await db.payment.create({
          data: {
            hotelId,
            folioId: folio.id,
            paymentType,
            paymentMethod: 'CASH',
            amount,
            status,
            processedBy: staff.ADMIN,
            processedAt: d(at),
          },
        });
      const creditFolio = await db.folio.create({ data: { hotelId, reservationId: expected.id } });
      await db.payment.create({
        data: {
          hotelId,
          folioId: creditFolio.id,
          paymentType: 'DEPOSIT',
          paymentMethod: 'CASH',
          amount: '200',
          status: 'CONFIRMED',
          processedBy: staff.ADMIN,
          processedAt: d('2020-10-01T01:00:00Z'),
        },
      });
      today = hotelToday('Asia/Ho_Chi_Minh');
      const currentBooking = await makeBooking({
        quantity: 1,
        arrival: today,
        departure: nextDate(today),
        created: new Date(),
      });
      const currentStay = await db.stay.create({
        data: {
          hotelId,
          roomTypeId: typeId,
          reservationRoomId: currentBooking.rooms[0]!.id,
          currentRoomId: rooms[0]!,
          actualCheckinAt: new Date(),
          checkinStaffId: staff.ADMIN,
        },
      });
      await db.roomOccupancy.create({
        data: {
          hotelId,
          roomId: rooms[0]!,
          roomTypeId: typeId,
          stayId: currentStay.id,
          occupiedAt: new Date(),
        },
      });
      for (const [i, status] of [
        [0, 'PENDING'],
        [1, 'IN_PROGRESS'],
        [2, 'AWAITING_INSPECTION'],
        [5, 'COMPLETED'],
      ] as const) {
        const task = await db.housekeepingTask.create({
          data: {
            hotelId,
            roomId: rooms[i]!,
            activeRoomId: status === 'COMPLETED' ? null : rooms[i]!,
            status,
            createdBy: staff.ADMIN,
            completedAt: status === 'COMPLETED' ? new Date() : null,
          },
        });
        if (status === 'COMPLETED')
          for (const [action, at] of [
            ['TASK_COMPLETE', '2020-10-02T01:00:00Z'],
            ['TASK_COMPLETE', '2020-10-03T01:00:00Z'],
            ['INSPECTION_PASSED', '2020-10-03T02:00:00Z'],
          ] as const)
            await db.operationsAuditLog.create({
              data: {
                hotelId,
                actorId: staff.ADMIN,
                taskId: task.id,
                action,
                toStatus: 'COMPLETED',
                createdAt: d(at),
              },
            });
      }
      for (const status of ['OPEN', 'IN_PROGRESS'] as const)
        await db.maintenanceTicket.create({
          data: {
            hotelId,
            roomId: rooms[9]!,
            title: 'Synthetic repair',
            description: 'Fixture',
            status,
            reportedBy: staff.ADMIN,
          },
        });
      await db.maintenanceBlock.create({
        data: {
          hotelId,
          roomId: rooms[9]!,
          startDate: asDate(today),
          endDate: asDate(nextDate(today)),
          status: 'ACTIVE',
          reason: 'Current repair',
          createdBy: staff.ADMIN,
        },
      });
      const foreignGuest = await db.guest.create({
        data: { hotelId: hotels[1]!, fullName: 'FOREIGN_PRIVATE_NAME' },
      });
      const foreignBooking = await db.reservation.create({
        data: {
          hotelId: hotels[1]!,
          bookerGuestId: foreignGuest.id,
          confirmationCode: randomUUID().replaceAll('-', ''),
          checkInDate: asDate(range.startDate),
          checkOutDate: asDate(range.endDate),
          totalAmount: '0',
          createdBy: foreignStaff.id,
          createdAt,
        },
      });
      const foreignFolio = await db.folio.create({
        data: { hotelId: hotels[1]!, reservationId: foreignBooking.id },
      });
      for (const amount of ['9999999999999999', '1'])
        await db.folioItem.create({
          data: {
            hotelId: hotels[1]!,
            folioId: foreignFolio.id,
            entryType: 'DEBIT',
            sourceType: 'MANUAL_ADJUSTMENT',
            amount,
            description: 'Foreign exact precision fixture',
            createdBy: foreignStaff.id,
            createdAt: d('2020-10-01T01:00:00Z'),
          },
        });
      // Separate single-room hotel exercises midnight, day-use, missing prices and corrupt overlap.
      const edgeHotel = hotels[2]!;
      const edgeStaff = await db.staffUser.create({
        data: {
          hotelId: edgeHotel,
          roleId: role.id,
          username: key + '_edge',
          fullName: 'Synthetic edge admin',
          passwordHash: hash,
        },
      });
      edgeToken = (
        await new AuthService(new PrismaAuthRepository(db), testEnv).login({
          username: edgeStaff.username,
          password: testPassword,
        })
      ).data.accessToken;
      const edgeType = await db.roomType.create({
        data: {
          hotelId: edgeHotel,
          code: 'EDGE',
          name: 'Edge',
          basePrice: '900000',
          maxAdults: 2,
          createdAt,
        },
      });
      const edgeRoom = await db.room.create({
        data: {
          hotelId: edgeHotel,
          roomTypeId: edgeType.id,
          roomNumber: '1',
          floorNumber: 1,
          createdAt,
        },
      });
      const edgeGuest = await db.guest.create({
        data: { hotelId: edgeHotel, fullName: 'Edge synthetic guest' },
      });
      for (const [day, arrival, departure, price, currency] of [
        ['2020-10-01', '2020-10-01T07:00:00Z', '2020-10-01T17:00:00Z', true, 'VND'],
        ['2020-10-02', '2020-10-02T07:00:00Z', '2020-10-02T10:00:00Z', true, 'VND'],
        ['2020-10-03', '2020-10-03T07:00:00Z', '2020-10-04T04:00:00Z', false, 'VND'],
        ['2020-10-04', '2020-10-04T07:00:00Z', '2020-10-05T04:00:00Z', true, 'VND'],
        ['2020-10-04', '2020-10-04T08:00:00Z', '2020-10-05T04:00:00Z', true, 'VND'],
        ['2020-10-07', '2020-10-07T07:00:00Z', '2020-10-08T04:00:00Z', true, 'USD'],
      ] as const) {
        const reservation = await db.reservation.create({
          data: {
            hotelId: edgeHotel,
            bookerGuestId: edgeGuest.id,
            confirmationCode: randomUUID().replaceAll('-', ''),
            checkInDate: asDate(day),
            checkOutDate: asDate(nextDate(day)),
            status: 'CHECKED_OUT',
            currency,
            totalAmount: '900000',
            createdBy: edgeStaff.id,
            createdAt,
          },
        });
        const rr = await db.reservationRoom.create({
          data: {
            hotelId: edgeHotel,
            reservationId: reservation.id,
            roomTypeId: edgeType.id,
            adults: 1,
          },
        });
        if (price)
          await db.reservationRoomNight.create({
            data: { reservationRoomId: rr.id, stayDate: asDate(day), nightlyRate: '900000' },
          });
        await db.stay.create({
          data: {
            hotelId: edgeHotel,
            roomTypeId: edgeType.id,
            reservationRoomId: rr.id,
            currentRoomId: edgeRoom.id,
            status: 'CHECKED_OUT',
            actualCheckinAt: d(arrival),
            actualCheckoutAt: d(departure),
            checkinStaffId: edgeStaff.id,
            checkoutStaffId: edgeStaff.id,
          },
        });
      }
      await db.maintenanceBlock.create({
        data: {
          hotelId: edgeHotel,
          roomId: edgeRoom.id,
          startDate: asDate('2020-10-05'),
          endDate: asDate('2020-10-10'),
          status: 'RELEASED',
          reason: 'Early safety release',
          createdBy: edgeStaff.id,
          releasedBy: edgeStaff.id,
          releasedAt: d('2020-10-06T16:00:00Z'),
          createdAt,
        },
      });
      app = createApp(
        testEnv,
        new PrismaAuthRepository(db),
        { rooms: new PrismaRoomRepository(db), roomTypes: new PrismaRoomTypeRepository(db) },
        new PrismaGuestRepository(db),
        new PrismaReservationRepository(db),
        new PrismaStayRepository(db),
        new PrismaBillingRepository(db),
        {
          housekeeping: new PrismaHousekeepingRepository(db),
          maintenance: new PrismaMaintenanceRepository(db),
        },
        new PrismaReportRepository(db),
      );
    }, 60000);

    afterAll(async () => {
      if (!db) return;
      const where = { hotelId: { in: hotels } };
      try {
        await db.operationsAuditLog.deleteMany({ where });
        await db.housekeepingTask.deleteMany({ where });
        await db.maintenanceBlock.deleteMany({ where });
        await db.maintenanceTicket.deleteMany({ where });
        await db.payment.deleteMany({ where: { ...where, paymentType: 'REFUND' } });
        await db.payment.deleteMany({ where });
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
        await db.guest.deleteMany({ where });
        await db.room.deleteMany({ where });
        await db.roomType.deleteMany({ where });
        await db.authSession.deleteMany({ where: { staffUser: where } });
        await db.staffUser.deleteMany({ where });
        await db.hotel.deleteMany({ where: { id: { in: hotels } } });
      } finally {
        await db.$disconnect();
      }
    });

    it('returns the live dashboard with distinct occupied rooms, multiple types and overlapping state dimensions', async () => {
      const response = await get('dashboard', {});
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.rooms).toMatchObject({
        total: 12,
        active: 11,
        occupied: 1,
        vacant: 11,
        dirty: 1,
        cleaning: 1,
        awaitingInspection: 1,
        ready: 6,
        underMaintenance: 1,
        outOfService: 1,
      });
      expect(response.body.data.reportDate).toBe(today);
      expect(response.body.data.currentGuestsCount).toBeNull();
    });
    it('does not present current room conditions as a historical dashboard', async () => {
      const response = await get('dashboard', { date: '2020-10-01' });
      expect(response.body.data.rooms).toBeNull();
      expect(response.body.data.roomSnapshotAt).toBeNull();
      expect(response.body.data.dataQuality.status).toBe('incomplete');
    });
    it('handles a hotel with no rooms, reservation rooms, or stays', async () => {
      const response = await request(app)
        .get('/api/v1/reports/dashboard')
        .auth(foreignToken, { type: 'bearer' });
      expect(response.body.data.rooms).toMatchObject({ total: 0, occupied: 0, vacant: 0 });
      expect(response.body.data.reservations).toEqual({
        expectedArrivals: 0,
        expectedDepartures: 0,
      });
    });
    it('separates posted room/services/adjustments from confirmed cash and computes cumulative balances', async () => {
      const response = await get('revenue');
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.summary).toMatchObject({
        roomCharges: '4500000.00',
        serviceCharges: '500000.00',
        adjustmentDebits: '200000.00',
        adjustmentCredits: '100000.00',
        netBilledCharges: '5100000.00',
        successfulPayments: '3000000.00',
        successfulDeposits: '1000200.00',
        successfulRefunds: '200000.00',
        netCashCollected: '3800200.00',
        balanceMovement: '1299800.00',
        paymentCount: 1,
        depositCount: 2,
        refundCount: 1,
      });
      expect(response.body.data.balance).toMatchObject({
        outstandingBalance: '1300300.00',
        accountsReceivable: '1300500.00',
        customerCredits: '200.00',
        folioCount: 2,
        cutoffExclusive: '2020-10-05T17:00:00.000Z',
      });
      expect(response.body.data.series[0].roomCharges).toBe('4500000.00');
      expect(response.body.data.series[4].netCashCollected).toBe('0.00');
      expect(response.body.data.basis.recognition).toBe('NOT_ACCOUNTING_RECOGNIZED_REVENUE');
    });
    it('uses UTC confirmation/posting instants against hotel dates, with an exclusive end', async () => {
      const response = await get('revenue', { startDate: '2020-10-01', endDate: '2020-10-02' });
      expect(response.body.data.summary.roomCharges).toBe('4500000.00');
      expect(response.body.data.summary.successfulPayments).toBe('0.00');
      const after = await get('payments', { startDate: '2020-10-06', endDate: '2020-10-07' });
      expect(after.body.data.summary.successfulPayments).toBe('123.00');
    });
    it('groups by month and zero fills days/months without inflating repeated SQL aggregates', async () => {
      const daily = await get('revenue');
      const monthly = await get('revenue', { ...range, groupBy: 'month' });
      expect(monthly.body.data.summary).toEqual(daily.body.data.summary);
      expect(monthly.body.data.series).toHaveLength(1);
      const empty = await get('revenue', {
        startDate: '2019-12-15',
        endDate: '2020-02-02',
        groupBy: 'month',
      });
      expect(empty.body.data.series).toHaveLength(3);
      expect(empty.body.data.summary.netBilledCharges).toBe('0.00');
    });
    it('uses 36 actual nights / 45 estimated sellable nights = 80%, with exact operational ADR and RevPAR', async () => {
      const response = await get('occupancy');
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.summary).toMatchObject({
        totalRoomNights: 50,
        sellableRoomNights: 45,
        maintenanceBlockedRoomNights: 5,
        occupiedRoomNights: 36,
        roomSalesValue: '32400000.00',
        occupancyRate: 80,
        operationalAdr: '900000.00',
        operationalRevpar: '720000.00',
        outOfServiceRoomNights: null,
      });
      expect(response.body.data.dataQuality.status).toBe('estimated');
      expect(response.body.data.series[0].occupiedRoomNights).toBe(8);
      expect(response.body.data.series[1].occupiedRoomNights).toBe(7);
      const month = await get('occupancy', {
        ...range,
        groupBy: 'month',
        roomTypeId: typeId.toString(),
      });
      expect(month.body.data.summary).toEqual(response.body.data.summary);
    });
    it('does not project current inactive/OUT_OF_SERVICE flags into history, or count duplicate blocks/transfers/cancellations/no-shows', async () => {
      const response = await get('occupancy');
      expect(response.body.data.summary.totalRoomNights).toBe(50);
      expect(response.body.data.summary.maintenanceBlockedRoomNights).toBe(5);
      expect(response.body.data.summary.conflictingRoomNights).toBe(0);
      expect(response.body.data.summary.occupiedRoomNights).toBe(36);
      expect(response.body.data.series[2].occupiedRoomNights).toBe(7);
    });
    it('uses null for unclosed nights; no rooms gives null rates, while empty available nights give zero occupancy', async () => {
      const current = await get('occupancy', { startDate: today, endDate: nextDate(today) });
      expect(current.body.data.summary.occupiedRoomNights).toBeNull();
      expect(current.body.data.summary.operationalAdr).toBeNull();
      const empty = await get('occupancy', { startDate: '2020-08-01', endDate: '2020-08-02' });
      expect(empty.body.data.summary).toMatchObject({
        occupiedRoomNights: 0,
        occupancyRate: 0,
        operationalAdr: null,
      });
      const foreign = await request(app)
        .get('/api/v1/reports/occupancy')
        .query(range)
        .auth(foreignToken, { type: 'bearer' });
      expect(foreign.body.data.summary).toMatchObject({
        sellableRoomNights: 0,
        occupancyRate: null,
        operationalAdr: null,
        operationalRevpar: null,
      });
    });
    it('counts 100% occupancy at an exact midnight checkout and excludes same-day use', async () => {
      const edge = (day: string) =>
        request(app)
          .get('/api/v1/reports/occupancy')
          .query({ startDate: day, endDate: nextDate(day) })
          .auth(edgeToken, { type: 'bearer' });
      expect((await edge('2020-10-01')).body.data.summary).toMatchObject({
        occupiedRoomNights: 1,
        occupancyRate: 100,
        operationalAdr: '900000.00',
        operationalRevpar: '900000.00',
      });
      expect((await edge('2020-10-02')).body.data.summary).toMatchObject({
        occupiedRoomNights: 0,
        occupancyRate: 0,
        operationalAdr: null,
      });
    });
    it('nulls incomplete prices/unsupported currencies and conflicting physical occupancy rather than inventing totals', async () => {
      const edge = (day: string) =>
        request(app)
          .get('/api/v1/reports/occupancy')
          .query({ startDate: day, endDate: nextDate(day) })
          .auth(edgeToken, { type: 'bearer' });
      for (const day of ['2020-10-03', '2020-10-07']) {
        const response = await edge(day);
        expect(response.body.data.summary).toMatchObject({
          occupiedRoomNights: 1,
          missingPriceNights: 1,
          roomSalesValue: null,
          operationalAdr: null,
          operationalRevpar: null,
        });
        expect(response.body.data.dataQuality.status).toBe('incomplete');
      }
      expect((await edge('2020-10-04')).body.data.summary).toMatchObject({
        conflictingRoomNights: 1,
        occupiedRoomNights: null,
        occupancyRate: null,
        roomSalesValue: null,
      });
    });
    it('stops a maintenance block at early explicit release and handles zero sellable inventory', async () => {
      const response = await request(app)
        .get('/api/v1/reports/occupancy')
        .query({ startDate: '2020-10-05', endDate: '2020-10-07' })
        .auth(edgeToken, { type: 'bearer' });
      expect(response.body.data.series[0]).toMatchObject({
        sellableRoomNights: 0,
        maintenanceBlockedRoomNights: 1,
        occupancyRate: null,
        operationalRevpar: null,
      });
      expect(response.body.data.series[1]).toMatchObject({
        sellableRoomNights: 1,
        maintenanceBlockedRoomNights: 0,
        occupancyRate: 0,
      });
    });
    it('counts orders, reservation rooms, cancellations, expected dates and actual movements separately', async () => {
      const response = await get('reservations');
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.summary).toEqual({
        reservationsCreated: 4,
        confirmedReservationsInCreatedCohort: 1,
        noShowReservationsInCreatedCohort: 1,
        cancelledReservations: 1,
        reservationRoomsCreated: 13,
        expectedArrivals: 2,
        expectedDepartures: 2,
        actualCheckins: 8,
        actualCheckouts: 1,
      });
      expect(response.body.data.series[0].reservationsCreated).toBe(3);
      expect(response.body.data.series[1].reservationsCreated).toBe(1);
      expect(response.body.data.series[2].expectedArrivals).toBe(2);
      expect(response.body.data.series[4].expectedDepartures).toBe(2);
      expect(response.body.data.bookingSources).toHaveLength(2);
      expect(response.body.data.bookingSources).toContainEqual({
        source: 'OTHER',
        reservations: 1,
      });
    });
    it('filters payment method without applying it to cumulative balances', async () => {
      const cash = await get('payments', { ...range, paymentMethod: 'CASH' });
      expect(cash.body.data.summary).toMatchObject({
        successfulPayments: '0.00',
        successfulDeposits: '1000200.00',
        successfulRefunds: '0.00',
        netCashCollected: '1000200.00',
        cashPayments: '1000200.00',
        bankTransferPayments: '0.00',
      });
      const bank = await get('payments', { ...range, paymentMethod: 'BANK_TRANSFER' });
      expect(bank.body.data.summary).toMatchObject({
        successfulPayments: '3000000.00',
        successfulRefunds: '200000.00',
        netCashCollected: '2800000.00',
        bankTransferPayments: '3000000.00',
        paymentCount: 1,
        refundCount: 1,
      });
      expect(bank.body.data.balance).toEqual(cash.body.data.balance);
    });
    it('lists historical nonzero folios with bounded pagination, signed credits, and no guest identity', async () => {
      const response = await get('outstanding', { ...range, limit: '1', sortOrder: 'desc' });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.items).toEqual([
        { folioId: mainFolio.toString(), outstandingBalance: '1300500.00' },
      ]);
      expect(response.body.data.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      const second = await get('outstanding', {
        ...range,
        limit: '1',
        page: '2',
        sortOrder: 'desc',
      });
      expect(second.body.data.items[0].outstandingBalance).toBe('-200.00');
    });
    it('separates current operations from retained period completion/inspection events', async () => {
      const response = await get('operations');
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.housekeeping).toEqual({
        snapshot: {
          dirtyRooms: 1,
          readyRooms: 6,
          cleaningRooms: 1,
          roomsAwaitingInspection: 1,
          activeHousekeepingTasks: 3,
          cleaningTasks: 1,
        },
        period: { completedHousekeepingTasks: 1, inspectedHousekeepingTasks: 1 },
      });
      expect(response.body.data.maintenance).toEqual({
        snapshot: {
          roomsUnderMaintenance: 1,
          roomsOutOfService: 1,
          openMaintenanceTickets: 1,
          inProgressMaintenanceTickets: 1,
          activeMaintenanceBlocks: 1,
        },
        period: { maintenanceBlockedRoomNights: 5 },
      });
    });
    it.each([
      'dashboard',
      'revenue',
      'occupancy',
      'reservations',
      'payments',
      'operations',
      'outstanding',
      'export',
    ])('requires JWT for %s', async (path) => {
      expect((await request(app).get('/api/v1/reports/' + path)).status).toBe(401);
    });
    it.each(['HOUSEKEEPING', 'TECHNICIAN', 'RECEPTIONIST'] as const)(
      'denies financial reports and CSV to %s',
      async (role) => {
        for (const path of ['revenue', 'payments', 'outstanding'])
          expect((await get(path, range, role)).status).toBe(403);
        expect((await get('export', { ...range, type: 'revenue' }, role)).status).toBe(403);
      },
    );
    it('allows accountant financial reports/export, denies other report exports, and redacts receptionist financial KPIs', async () => {
      for (const path of ['revenue', 'payments', 'outstanding'])
        expect((await get(path, range, 'ACCOUNTANT')).status).toBe(200);
      expect((await get('export', { ...range, type: 'payments' }, 'ACCOUNTANT')).status).toBe(200);
      expect((await get('export', { ...range, type: 'occupancy' }, 'ACCOUNTANT')).status).toBe(403);
      expect((await get('dashboard', {}, 'RECEPTIONIST')).body.data).not.toHaveProperty('finance');
      const occupancy = await get('occupancy', range, 'RECEPTIONIST');
      expect(occupancy.body.data.summary).not.toHaveProperty('roomSalesValue');
      expect(occupancy.body.data.series[0]).not.toHaveProperty('operationalAdr');
      expect((await get('reservations', range, 'RECEPTIONIST')).status).toBe(200);
      expect((await get('revenue', range, 'MANAGER')).status).toBe(200);
    });
    it('limits housekeeping and technician to relevant departmental operations aggregates', async () => {
      const hk = await get('operations', range, 'HOUSEKEEPING');
      expect(hk.body.data).toHaveProperty('housekeeping');
      expect(hk.body.data).not.toHaveProperty('maintenance');
      const tech = await get('operations', range, 'TECHNICIAN');
      expect(tech.body.data).toHaveProperty('maintenance');
      expect(tech.body.data).not.toHaveProperty('housekeeping');
    });
    it('isolates hotels even for ADMIN, rejects caller scope, and returns precise sums beyond JS integer precision', async () => {
      const response = await request(app)
        .get('/api/v1/reports/revenue')
        .query(range)
        .auth(foreignToken, { type: 'bearer' });
      expect(response.body.data.summary.netBilledCharges).toBe('10000000000000000.00');
      expect((await get('revenue')).body.data.summary.netBilledCharges).toBe('5100000.00');
      expect(
        (await get('occupancy', { ...range, roomTypeId: foreignTypeId.toString() })).status,
      ).toBe(404);
      expect((await get('revenue', { ...range, hotelId: hotels[1]!.toString() })).status).toBe(422);
    });
    it.each(['revenue', 'occupancy', 'reservations', 'payments'])(
      'exports %s with correct CSV headers, exact values and scope',
      async (type) => {
        const response = await get('export', { ...range, type });
        expect(response.status, response.text).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
        expect(response.headers['content-disposition']).toContain(
          `innvyra-${type}-2020-10-01-2020-10-06.csv`,
        );
        expect(response.text.charCodeAt(0)).toBe(0xfeff);
        expect(response.text).toContain('"date"');
        expect(response.text).toContain('"dataQuality"');
        expect(response.text.split('\r\n')).toHaveLength(7);
        expect(response.text).not.toContain('10000000000000000.00');
        if (type === 'revenue') expect(response.text).toContain('"4500000.00"');
        if (type === 'occupancy') expect(response.text).toContain('"900000.00"');
      },
    );
    it.each([
      { startDate: '2020-02-30' },
      { endDate: '2020-10-01' },
      { endDate: '2023-01-01' },
      { groupBy: 'week' },
      { sortBy: 'DROP TABLE rooms' },
    ])('rejects invalid/unbounded report query %j', async (q) => {
      expect((await get('revenue', { ...range, ...q })).status).toBe(422);
    });
    it('never returns guest PII and does not modify financial/operational/reservation records during reporting', async () => {
      const before = await db.$queryRaw`SELECT (SELECT COUNT(*) FROM folio_items) AS items,
      (SELECT SUM(amount) FROM folio_items) AS charges, (SELECT COUNT(*) FROM payments) AS receipts,
      (SELECT SUM(amount) FROM payments) AS cash, (SELECT MAX(updated_at) FROM reservations) AS reservations,
      (SELECT MAX(updated_at) FROM rooms) AS rooms, (SELECT COUNT(*) FROM operations_audit_logs) AS audits`;
      for (const path of [
        'revenue',
        'occupancy',
        'reservations',
        'payments',
        'operations',
        'outstanding',
      ]) {
        const response = await get(path);
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).not.toMatch(
          /PRIVATE_|passwordHash|documentNumber|bookerGuest|accessToken/,
        );
        expect(response.headers['cache-control']).toBe('private, no-store');
      }
      const after = await db.$queryRaw`SELECT (SELECT COUNT(*) FROM folio_items) AS items,
      (SELECT SUM(amount) FROM folio_items) AS charges, (SELECT COUNT(*) FROM payments) AS receipts,
      (SELECT SUM(amount) FROM payments) AS cash, (SELECT MAX(updated_at) FROM reservations) AS reservations,
      (SELECT MAX(updated_at) FROM rooms) AS rooms, (SELECT COUNT(*) FROM operations_audit_logs) AS audits`;
      expect(after).toEqual(before);
    });
    it('records representative query plans and small-fixture response timings without claiming a scale benchmark', async () => {
      const plans = await db.$queryRaw<
        { key: string | null; possible_keys: string | null }[]
      >`EXPLAIN SELECT SUM(amount) FROM payments WHERE hotel_id = ${hotels[0]!} AND status = 'CONFIRMED' AND processed_at >= ${d('2020-09-30T17:00:00Z')} AND processed_at < ${d('2020-10-05T17:00:00Z')}`;
      expect(plans[0]!.possible_keys).toContain('payments_hotel_id');
      const durations: Record<string, number> = {};
      for (const path of ['dashboard', 'revenue', 'occupancy']) {
        const start = performance.now();
        const response = await get(path, path === 'dashboard' ? {} : range);
        expect(response.status).toBe(200);
        durations[path] = Math.round(performance.now() - start);
      }
      console.info(
        'Reports synthetic fixture milliseconds (12 rooms, 36 occupied nights; not a scale benchmark):',
        durations,
      );
    });
    it('verifies current session revocation before serving reports', async () => {
      await db.authSession.updateMany({
        where: { staffUserId: staff.ACCOUNTANT },
        data: { revokedAt: new Date(), revokedReason: 'TEST' },
      });
      expect((await get('payments', range, 'ACCOUNTANT')).status).toBe(401);
    });
  },
);
