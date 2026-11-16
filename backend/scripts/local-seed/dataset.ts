import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { Prisma } from '../../src/generated/prisma/client.js';
import type { Env } from '../../src/config/env.js';
import { ROLE_CODES, type RoleCode } from '../../src/shared/types/roles.js';
import { bootstrapPlatformAdmin } from '../../src/modules/platform-auth/platform-bootstrap.service.js';
import { localDay } from '../../src/modules/hotels/subscription-calendar.js';
import { phase6App as createSeedApp } from '../phase6/app.js';
import { ScenarioHttp as SeedHttp, type ScenarioSession } from '../phase6/client.js';
import { dayOffset } from '../phase6/scenario.js';
import { seedLocalHistory } from './history.js';
import { localStaff } from './staff.js';
import { isLocalDatabaseName } from './config.js';
import { defaultCleaningMaterials } from './supply-defaults.js';
import { backfillLocalSupplies } from './supply-backfill.js';
import {
  LOCAL_PASSWORD,
  LOCAL_INITIAL_PASSWORD,
  LOCAL_PLATFORM_EMAIL,
  LOCAL_SEED_VERSION,
  localHotels,
  localPlans,
  localRoomTypes,
  localServices,
  guestNames,
} from './catalog.js';

type Entity = { id: string };
type Staff = Entity & { username: string; session: ScenarioSession };
type Booking = Entity & { rooms: Entity[]; totalAmount: string };
export const isLocalSeedName = isLocalDatabaseName;
export const sqlIdentifier = (value: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('Unexpected SQL identifier');
  return `\`${value}\``;
};
export async function assertLocalSeedTarget(prisma: PrismaClient, env: Env) {
  const target = new URL(env.DATABASE_URL);
  if (
    !['development', 'test'].includes(env.NODE_ENV) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !isLocalSeedName(target.pathname.slice(1))
  )
    throw new Error('Persistent sample seed requires a separate local multi-hotel database');
  const actual = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
  if (actual[0]?.name !== target.pathname.slice(1))
    throw new Error('Seed database connection does not match its target');
  const tables = await prisma.$queryRaw<{ name: string }[]>`
    SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' AND TABLE_NAME <> '_prisma_migrations'`;
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*) AS n FROM ${sqlIdentifier(table.name)}`,
    );
    if (Number(rows[0]!.n))
      throw new Error('Database is not empty; this seed never resets existing data');
  }
}

export async function seedLocalDataset(
  prisma: PrismaClient,
  env: Env,
  progress: (value: string) => void = () => {},
) {
  await assertLocalSeedTarget(prisma, env);
  if (!env.GUEST_ENCRYPTION_KEY || !env.GUEST_HASH_KEY)
    throw new Error('Configure persistent guest encryption/hash keys before seeding');
  const app = createSeedApp(prisma, env),
    http = new SeedHttp(app, LOCAL_PASSWORD);
  const today = localDay('Asia/Ho_Chi_Minh');
  const importedAt = new Date(`${dayOffset(today, -90)}T09:00:00+07:00`);
  await prisma.role.createMany({ data: ROLE_CODES.map((code) => ({ code, name: code })) });
  await bootstrapPlatformAdmin(prisma, {
    email: LOCAL_PLATFORM_EMAIL,
    fullName: 'Quản trị nền tảng Innvyra',
    password: LOCAL_PASSWORD,
  });
  const owner = await http.ok<{ accessToken: string }>('post', '/platform/auth/login', undefined, {
    email: LOCAL_PLATFORM_EMAIL,
    password: LOCAL_PASSWORD,
  });
  const plans: Record<string, string> = {};
  for (const plan of localPlans)
    plans[plan.code] = (
      await http.ok<Entity>(
        'post',
        '/platform/plans',
        owner.accessToken,
        {
          ...plan,
          description: 'Quản lý đặt phòng, lưu trú và vận hành khách sạn; thanh toán theo tháng.',
        },
        201,
      )
    ).id;
  const hotels = [];
  for (const [hotelIndex, config] of localHotels.entries()) {
    progress(`Seeding ${config.code}: staff, rooms, guests and linked operations...`);
    const roster = localStaff(config);
    const adminProfile = roster.find((person) => person.role === 'ADMIN')!;
    const result = await http.ok<{ hotel: Entity; admin: Entity; temporaryPassword: string }>(
      'post',
      '/platform/hotels',
      owner.accessToken,
      {
        code: config.code,
        name: config.name,
        timezone: 'Asia/Ho_Chi_Minh',
        contactEmail: `contact.${config.code.toLowerCase()}@example.test`,
        contactPhone: `0280000000${hotelIndex + 1}`,
        address: config.address,
        agreementReference: LOCAL_SEED_VERSION,
        admin: {
          fullName: adminProfile.fullName,
          username: adminProfile.username,
          email: adminProfile.email,
        },
        subscription: {
          planId: plans[config.plan]!,
          startsOn: today,
          monthCount: 6,
          reason: 'Đăng ký sử dụng Innvyra, thanh toán theo tháng.',
          agreementReference: LOCAL_SEED_VERSION,
          paymentReference: `LOCAL-SUB-${config.code}`,
        },
      },
      201,
    );
    const hotelId = BigInt(result.hotel.id);
    const admin = await http.activatePassword(adminProfile.username, result.temporaryPassword);
    const staff = {
      ADMIN: { id: result.admin.id, username: adminProfile.username, session: admin },
    } as Record<RoleCode, Staff>;
    for (const person of roster.filter((person) => person.role !== 'ADMIN')) {
      const { fullName, username, email, role } = person;
      const account = await http.ok<Entity>(
        'post',
        '/employees',
        admin.accessToken,
        {
          fullName,
          username,
          email,
          role,
          password: LOCAL_INITIAL_PASSWORD,
        },
        201,
      );
      if (!person.isActive) {
        await http.ok('patch', `/employees/${account.id}/deactivate`, admin.accessToken, {});
      } else if (!person.mustChangePassword) {
        const session = await http.activatePassword(username, LOCAL_INITIAL_PASSWORD);
        if (person.primary) staff[role] = { id: account.id, username, session };
      }
    }
    await prisma.staffUser.updateMany({ where: { hotelId }, data: { createdAt: importedAt } });
    const types: { id: string; rate: string; code: string; maxAdults: number }[] = [];
    for (const type of localRoomTypes) {
      const rate = String(Math.round(type.basePrice * config.rateFactor));
      const created = await http.ok<Entity>(
        'post',
        '/room-types',
        admin.accessToken,
        { ...type, basePrice: rate, description: `Hạng phòng tại ${config.name}` },
        201,
      );
      types.push({ id: created.id, rate, code: type.code, maxAdults: type.maxAdults });
    }
    const rooms: { id: string; number: string; typeId: string; rate: string }[] = [];
    async function finishCleaning(taskId: string) {
      await http.ok(
        'patch',
        `/housekeeping/tasks/${taskId}/assign`,
        staff.MANAGER.session.accessToken,
        { staffId: staff.HOUSEKEEPING.id },
      );
      await http.ok(
        'post',
        `/housekeeping/tasks/${taskId}/start`,
        staff.HOUSEKEEPING.session.accessToken,
        {},
      );
      await http.ok(
        'post',
        `/housekeeping/tasks/${taskId}/complete`,
        staff.HOUSEKEEPING.session.accessToken,
        {},
      );
      await http.ok(
        'post',
        `/housekeeping/tasks/${taskId}/inspect`,
        staff.MANAGER.session.accessToken,
        { passed: true },
      );
    }
    for (let index = 0; index < config.rooms; index++) {
      const floor = Math.floor(index / config.perFloor) + 1,
        number = String(floor * 100 + (index % config.perFloor) + 1),
        type = types[index % types.length]!;
      const room = await http.ok<Entity>(
        'post',
        '/rooms',
        admin.accessToken,
        {
          roomNumber: number,
          floorNumber: floor,
          roomTypeId: type.id,
          physicalStatus: index === config.rooms - 1 ? 'OUT_OF_SERVICE' : 'ACTIVE',
        },
        201,
      );
      rooms.push({ id: room.id, number, typeId: type.id, rate: type.rate });
      if (index !== config.rooms - 1) {
        const task = await http.ok<Entity>(
          'post',
          '/housekeeping/tasks',
          staff.RECEPTIONIST.session.accessToken,
          { roomId: room.id },
          201,
        );
        await finishCleaning(task.id);
      }
    }
    await http.ok(
      'post',
      '/rooms',
      admin.accessToken,
      {
        roomNumber: config.retiredRoom.number,
        floorNumber: config.retiredRoom.floor,
        roomTypeId: types[0]!.id,
        isActive: false,
        notes: config.retiredRoom.notes,
      },
      201,
    );
    await prisma.roomType.updateMany({ where: { hotelId }, data: { createdAt: importedAt } });
    await prisma.room.updateMany({ where: { hotelId }, data: { createdAt: importedAt } });
    const guests: string[] = [];
    for (let index = 0; index < config.guests; index++) {
      const profile = await http.ok<Entity>(
        'post',
        '/guests',
        staff.RECEPTIONIST.session.accessToken,
        {
          fullName: guestNames[index]!,
          phone: `090${hotelIndex}${String(index + 1).padStart(6, '0')}`,
          email: `guest.${config.code.toLowerCase()}.${index + 1}@example.test`,
          dateOfBirth: `${1980 + (index % 20)}-${String(1 + (index % 12)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
          gender: index % 2 ? 'FEMALE' : 'MALE',
          nationality: 'Việt Nam',
          documentType: 'PASSPORT',
          documentNumber: `LOCAL-${config.code.replaceAll('_', '-')}-${String(index + 1).padStart(4, '0')}`,
          address: `${12 + index * 3} ${['Lê Lợi', 'Nguyễn Trãi', 'Trần Phú'][index % 3]}, ${config.city}`,
          notes: [
            'Ưu tiên phòng yên tĩnh, không hút thuốc.',
            'Khách đi công tác, cần hóa đơn.',
            'Ưu tiên phòng tầng cao.',
            'Liên hệ xác nhận giờ đến trước một ngày.',
          ][index % 4],
        },
        201,
      );
      guests.push(profile.id);
    }
    await prisma.guest.updateMany({ where: { hotelId }, data: { createdAt: importedAt } });
    const services: Record<string, string> = {};
    for (const service of localServices)
      services[service.code] = (
        await http.ok<Entity>('post', '/services', admin.accessToken, service, 201)
      ).id;
    const historical = await seedLocalHistory(prisma, {
      hotelId,
      code: config.code,
      today,
      guestIds: guests.map(BigInt),
      rooms: rooms
        .slice(0, 4)
        .map((room) => ({ id: BigInt(room.id), typeId: BigInt(room.typeId), rate: room.rate })),
      receptionistId: BigInt(staff.RECEPTIONIST.id),
      accountantId: BigInt(staff.ACCOUNTANT.id),
      managerId: BigInt(staff.MANAGER.id),
      cleanerId: BigInt(staff.HOUSEKEEPING.id),
      service: { id: BigInt(services.LAUNDRY!), name: 'Giặt ủi', unit: 'kg', price: '45000' },
    });
    const book = (guest: number, typeId: string, from: number, nights = 2) =>
      http.ok<Booking>(
        'post',
        '/reservations',
        staff.RECEPTIONIST.session.accessToken,
        {
          guestId: guests[guest % guests.length]!,
          checkInDate: dayOffset(today, from),
          checkOutDate: dayOffset(today, from + nights),
          rooms: [{ roomTypeId: typeId, quantity: 1, adults: 2 }],
          bookingSource: ['DIRECT', 'PHONE', 'EMAIL', 'AGENT'][guest % 4],
        },
        201,
      );
    const pay = (
      folioId: string,
      amount: string,
      kind: 'CASH' | 'BANK_TRANSFER',
      paymentType = 'PAYMENT',
    ) =>
      http.ok<Entity>(
        'post',
        `/folios/${folioId}/payments`,
        staff.ACCOUNTANT.session.accessToken,
        {
          paymentType,
          paymentMethod: kind,
          amount,
          confirmedReceived: true,
          ...(kind === 'BANK_TRANSFER'
            ? { referenceNumber: `LOCAL-${config.code}-${folioId}-${paymentType}` }
            : {}),
        },
        201,
        `local-${config.code}-${folioId}-${kind}-${paymentType}`,
      );
    // A complete current-day departure, service charge and receipt.
    const closedBooking = await book(8, rooms[0]!.typeId, 0, 1);
    const closedStay = await http.ok<{ stayId: string }>(
      'post',
      `/reservations/${closedBooking.id}/rooms/${closedBooking.rooms[0]!.id}/check-in`,
      staff.RECEPTIONIST.session.accessToken,
      { roomId: rooms[0]!.id },
      201,
    );
    const closedFolio = await http.ok<Entity>(
      'post',
      `/reservations/${closedBooking.id}/folio/open`,
      staff.ACCOUNTANT.session.accessToken,
      {},
    );
    const water = await http.ok<Entity>(
      'post',
      '/service-orders',
      staff.RECEPTIONIST.session.accessToken,
      {
        reservationId: closedBooking.id,
        stayId: closedStay.stayId,
        items: [{ serviceId: services.WATER!, quantity: 2 }],
      },
      201,
    );
    await http.ok(
      'post',
      `/service-orders/${water.id}/complete`,
      staff.RECEPTIONIST.session.accessToken,
      {},
    );
    const closedTotal = new Prisma.Decimal(rooms[0]!.rate).add(40000);
    await pay(closedFolio.id, '200000', 'CASH');
    await pay(closedFolio.id, closedTotal.sub(200000).toFixed(0), 'BANK_TRANSFER');
    await http.ok(
      'post',
      `/stays/${closedStay.stayId}/check-out`,
      staff.RECEPTIONIST.session.accessToken,
      {},
    );
    await http.ok('post', `/folios/${closedFolio.id}/close`, admin.accessToken, {});
    const turnover = await prisma.housekeepingTask.findFirstOrThrow({
      where: { hotelId, activeRoomId: BigInt(rooms[0]!.id) },
    });
    await finishCleaning(String(turnover.id));
    // Active stays, deposits, completed and requested service orders.
    const occupiedRooms = ['102', '201', '202', '301']
      .slice(0, config.occupied)
      .map((number) => rooms.find((room) => room.number === number)!);
    const activeStays: string[] = [];
    for (const [index, room] of occupiedRooms.entries()) {
      const booking = await book(10 + index, room.typeId, 0, 2 + (index % 2));
      const stay = await http.ok<{ stayId: string }>(
        'post',
        `/reservations/${booking.id}/rooms/${booking.rooms[0]!.id}/check-in`,
        staff.RECEPTIONIST.session.accessToken,
        { roomId: room.id },
        201,
      );
      activeStays.push(stay.stayId);
      const folio = await http.ok<Entity>(
        'post',
        `/reservations/${booking.id}/folio/open`,
        staff.ACCOUNTANT.session.accessToken,
        {},
      );
      await pay(folio.id, '150000', index % 2 ? 'CASH' : 'BANK_TRANSFER', 'DEPOSIT');
      const breakfast = await http.ok<Entity>(
        'post',
        '/service-orders',
        staff.RECEPTIONIST.session.accessToken,
        {
          reservationId: booking.id,
          stayId: stay.stayId,
          items: [{ serviceId: services.BREAKFAST!, quantity: 2 }],
        },
        201,
      );
      await http.ok(
        'post',
        `/service-orders/${breakfast.id}/complete`,
        staff.RECEPTIONIST.session.accessToken,
        {},
      );
      if (index === 0)
        await http.ok(
          'post',
          '/service-orders',
          staff.RECEPTIONIST.session.accessToken,
          {
            reservationId: booking.id,
            stayId: stay.stayId,
            items: [{ serviceId: services.LAUNDRY!, quantity: 1 }],
          },
          201,
        );
    }
    for (let index = 0; index < 8; index++) {
      const booking = await book(15 + index, types[index % types.length]!.id, 5 + index * 2, 2);
      const folio = await http.ok<Entity>(
        'post',
        `/reservations/${booking.id}/folio/open`,
        staff.ACCOUNTANT.session.accessToken,
        {},
      );
      await pay(folio.id, '100000', 'BANK_TRANSFER', 'DEPOSIT');
    }
    for (const index of [0, 2]) await book(24 + index, types[index]!.id, 0, 1);
    const cancelled = await book(26, types[0]!.id, 23, 2);
    await http.ok(
      'post',
      `/reservations/${cancelled.id}/cancel`,
      staff.RECEPTIONIST.session.accessToken,
      { reason: 'Khách thay đổi lịch trình.' },
    );
    const noShow = await book(27, types[2]!.id, 0, 1);
    await http.ok(
      'post',
      `/reservations/${noShow.id}/no-show`,
      staff.RECEPTIONIST.session.accessToken,
      { reason: 'Khách không đến và không xác nhận lại giờ nhận phòng.' },
    );
    // Operational work queues, using actual transitions and hotel-scoped staff.
    for (const [number, stage] of [
      ['103', 'PENDING'],
      ['105', 'IN_PROGRESS'],
      ['106', 'AWAITING_INSPECTION'],
    ] as const) {
      const room = rooms.find((item) => item.number === number)!;
      await http.ok('patch', `/rooms/${room.id}`, admin.accessToken, {
        housekeepingStatus: 'DIRTY',
      });
      const task = await http.ok<Entity>(
        'post',
        '/housekeeping/tasks',
        staff.RECEPTIONIST.session.accessToken,
        { roomId: room.id },
        201,
      );
      await http.ok(
        'patch',
        `/housekeeping/tasks/${task.id}/assign`,
        staff.MANAGER.session.accessToken,
        { staffId: staff.HOUSEKEEPING.id },
      );
      if (stage !== 'PENDING')
        await http.ok(
          'post',
          `/housekeeping/tasks/${task.id}/start`,
          staff.HOUSEKEEPING.session.accessToken,
          {},
        );
      if (stage === 'AWAITING_INSPECTION')
        await http.ok(
          'post',
          `/housekeeping/tasks/${task.id}/complete`,
          staff.HOUSEKEEPING.session.accessToken,
          {},
        );
    }
    const blockedRoom = rooms.find((room) => room.number === '104')!;
    const ticket = await http.ok<Entity>(
      'post',
      '/maintenance/tickets',
      staff.RECEPTIONIST.session.accessToken,
      {
        roomId: blockedRoom.id,
        title: 'Kiểm tra điều hòa phòng 104',
        description: 'Điều hòa làm lạnh yếu, cần kiểm tra hệ thống và vệ sinh dàn lạnh.',
      },
      201,
    );
    await http.ok(
      'patch',
      `/maintenance/tickets/${ticket.id}/assign`,
      staff.MANAGER.session.accessToken,
      { staffId: staff.TECHNICIAN.id },
    );
    await http.ok(
      'post',
      `/maintenance/tickets/${ticket.id}/start`,
      staff.TECHNICIAN.session.accessToken,
      {},
    );
    await http.ok(
      'post',
      '/maintenance/blocks',
      staff.MANAGER.session.accessToken,
      {
        roomId: blockedRoom.id,
        maintenanceTicketId: ticket.id,
        startDate: today,
        endDate: dayOffset(today, 3),
        reason: 'Tạm khóa phòng để kiểm tra và sửa chữa điều hòa.',
      },
      201,
    );
    // Supply chain: two suppliers, six items, two receipts, three issues, count.
    const categories: string[] = [];
    for (const [code, name] of [
      ['LINEN', 'Đồ vải'],
      ['AMENITY', 'Đồ dùng phòng'],
      ['CLEANING', 'Vật tư vệ sinh'],
    ])
      categories.push(
        (
          await http.ok<Entity>(
            'post',
            '/inventory/categories',
            admin.accessToken,
            { code, name },
            201,
          )
        ).id,
      );
    const suppliers: string[] = [];
    for (let index = 0; index < 2; index++)
      suppliers.push(
        (
          await http.ok<Entity>(
            'post',
            '/inventory/suppliers',
            admin.accessToken,
            {
              code: `SUPPLIER_${index + 1}`,
              name: `${['Công ty TNHH Vật tư An Phúc', 'Công ty TNHH Đồ dùng Minh Khang'][index]} · ${config.city}`,
              contactPerson: guestNames[4 + hotelIndex * 2 + index]!,
              email: `supplier.${hotelIndex}.${index}@example.test`,
              phone: `09090000${hotelIndex}${index}`,
            },
            201,
          )
        ).id,
      );
    const itemNames = [
      'Khăn tắm',
      'Dầu gội mini',
      'Bàn chải',
      'Nước lau sàn',
      'Dung dịch chuyên dụng',
      'Tinh dầu phòng',
    ];
    const items: string[] = [];
    for (const [index, name] of itemNames.entries())
      items.push(
        (
          await http.ok<Entity>(
            'post',
            '/inventory/items',
            admin.accessToken,
            {
              code: `ITEM_${index + 1}`,
              name,
              categoryId: categories[index === 0 ? 0 : index < 3 ? 1 : 2]!,
              materialType: index === 0 ? 'REUSABLE' : 'CONSUMABLE',
              unit: index === 1 ? 'chai' : index < 3 ? 'cái' : 'ml',
              minStockLevel: index >= 3 ? (index === 4 ? '20000' : '10000') : '10',
            },
            201,
          )
        ).id,
      );
    for (let receipt = 0; receipt < 2; receipt++) {
      const rawQuantities = receipt ? [100, 100, 50, 30, 10] : [200, 300, 150, 90, 20];
      const receiptTotal = rawQuantities.reduce(
        (sum, qty, index) =>
          sum.add(new Prisma.Decimal(qty).mul([75000, 5000, 15000, 45000, 120000][index]!)),
        new Prisma.Decimal(0),
      );
      const paidRatio = [
        [1, 0.4],
        [0, 1],
        [0.5, 0],
      ][hotelIndex]![receipt]!;
      const seededReceipt = await http.ok<Entity>(
        'post',
        '/inventory/receipts',
        admin.accessToken,
        {
          receiptNumber: `NHAP-${receipt + 1}`,
          ...(paidRatio > 0
            ? {
                initialPayment: {
                  requestKey: randomUUID(),
                  amount: receiptTotal.mul(paidRatio).toFixed(2),
                  paymentMethod: receipt === 0 ? 'BANK_TRANSFER' : 'CASH',
                  referenceNumber: receipt === 0 ? `NCC-${config.code}-${receipt + 1}` : undefined,
                  paidAt: `${dayOffset(today, receipt ? -4 : -19)}T09:00:00+07:00`,
                },
              }
            : {}),
          supplierId: suppliers[receipt]!,
          receiptDate: `${dayOffset(today, receipt ? -5 : -20)}T09:00:00+07:00`,
          items: items.slice(0, 5).map((itemId, index) => ({
            itemId,
            quantity: String(rawQuantities[index]! * (index >= 3 ? 1000 : 1)),
            unitPrice: String([75000, 5000, 15000, 45, 120][index]),
          })),
        },
        201,
      );
      // Two genuine installments on different dates; some invoices remain partly unpaid.
      const secondRatio =
        hotelIndex === 0 && receipt === 1 ? 0.2 : hotelIndex === 2 && receipt === 0 ? 0.5 : 0;
      if (secondRatio > 0)
        await http.ok(
          'post',
          `/inventory/receipts/${seededReceipt.id}/payments`,
          staff.ACCOUNTANT.session.accessToken,
          {
            requestKey: randomUUID(),
            amount: receiptTotal.mul(secondRatio).toFixed(2),
            paymentMethod: 'BANK_TRANSFER',
            referenceNumber: `NCC-${config.code}-${receipt + 1}-LAN2`,
            paidAt: `${dayOffset(today, -2)}T10:30:00+07:00`,
          },
          201,
        );
    }
    for (let issue = 0; issue < 3; issue++)
      await http.ok(
        'post',
        '/inventory/issues',
        staff.MANAGER.session.accessToken,
        {
          issueNumber: `XUAT-${issue + 1}`,
          department: ['HOUSEKEEPING', 'FRONT_OFFICE', 'MAINTENANCE'][issue],
          issueDate: `${dayOffset(today, issue - 3)}T10:00:00+07:00`,
          items: items.slice(0, 5).map((itemId, index) => ({
            itemId,
            quantity: String(
              [
                [40, 60, 30, 10, 5],
                [10, 20, 10, 5, 5],
                [5, 10, 5, 5, 5],
              ][issue]![index]! * (index >= 3 ? 1000 : 1),
            ),
          })),
        },
        201,
      );
    await http.ok(
      'post',
      '/inventory/adjustments',
      admin.accessToken,
      {
        adjustmentNumber: 'KIEMKE-1',
        itemId: items[0]!,
        actualQuantity: '244',
        reason: 'Đối chiếu kiểm kê, thiếu 1 khăn tắm.',
      },
      201,
    );

    // Imported legacy receipt: goods and stock are known, settlement is not assumed.
    const legacyReceipt = await http.ok<Entity>(
      'post',
      '/inventory/receipts',
      admin.accessToken,
      {
        receiptNumber: 'NHAP-CHUYENTIEP',
        supplierId: suppliers[0],
        receiptDate: `${dayOffset(today, -60)}T09:00:00+07:00`,
        items: [{ itemId: items[1], quantity: '10', unitPrice: '5000' }],
        notes: 'Chứng từ chuyển tiếp đang chờ đối chiếu lịch sử thanh toán.',
      },
      201,
    );
    await prisma.stockReceipt.update({
      where: { id: BigInt(legacyReceipt.id) },
      data: { paymentTracking: 'UNRECONCILED' },
    });
    const supplyItems = await prisma.inventoryItem.findMany({ where: { hotelId } });
    for (const type of types)
      await http.ok('put', `/room-types/${type.id}/housekeeping-materials`, admin.accessToken, {
        materials: defaultCleaningMaterials(type, supplyItems),
      });
    const awaiting = await http.ok<{ items: Entity[] }>(
      'get',
      '/housekeeping/tasks?status=AWAITING_INSPECTION',
      staff.HOUSEKEEPING.session.accessToken,
    );
    if (awaiting.items[0]) {
      const taskId = awaiting.items[0].id;
      await http.ok(
        'post',
        `/housekeeping/tasks/${taskId}/inspect`,
        staff.MANAGER.session.accessToken,
        { passed: false, notes: 'Bổ sung vật tư phòng và vệ sinh lại khu vực sàn.' },
      );
      const active = await http.ok<Entity & { workToken: string }>(
        'post',
        `/housekeeping/tasks/${taskId}/start`,
        staff.HOUSEKEEPING.session.accessToken,
        {},
      );
      await http.ok(
        'post',
        `/housekeeping/tasks/${taskId}/complete`,
        staff.HOUSEKEEPING.session.accessToken,
        {
          workToken: active.workToken,
          materials: [
            { itemId: items[1], quantity: '2' },
            { itemId: items[2], quantity: '1' },
            { itemId: items[3], quantity: '75.50' },
          ],
          notes: 'Đã bổ sung đồ dùng phòng theo thực tế và vệ sinh lại sàn.',
        },
      );
    }
    hotels.push({
      id: String(hotelId),
      code: config.code,
      name: config.name,
      today,
      adminUsername: adminProfile.username,
      roleUsernames: Object.fromEntries(
        Object.entries(staff).map(([role, user]) => [role, user.username]),
      ),
      inactiveUsername: roster.find((person) => !person.isActive)!.username,
      temporaryUsername: roster.find((person) => person.isActive && person.mustChangePassword)!
        .username,
      staffAccounts: roster,
      retiredRoomNumber: config.retiredRoom.number,
      activeRoomCount: config.rooms,
      historyCount: historical.length,
      primaryStaffIds: Object.fromEntries(
        Object.entries(staff).map(([role, user]) => [role, user.id]),
      ),
      activeStayIds: activeStays,
      guestCount: guests.length,
      expectedFirstItemStock: '244.00',
    });
  }
  await prisma.platformAdmin.updateMany({ data: { createdAt: importedAt } });
  await backfillLocalSupplies(prisma, env, true);
  return {
    app,
    http,
    platformToken: owner.accessToken,
    manifest: {
      version: LOCAL_SEED_VERSION,
      staffNamingVersion: 2,
      database: new URL(env.DATABASE_URL).pathname.slice(1),
      createdAt: new Date().toISOString(),
      platformEmail: LOCAL_PLATFORM_EMAIL,
      samplePassword: LOCAL_PASSWORD,
      initialPassword: LOCAL_INITIAL_PASSWORD,
      hotels,
    },
  };
}
export type LocalDataset = Awaited<ReturnType<typeof seedLocalDataset>>;
