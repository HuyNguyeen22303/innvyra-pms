import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Env } from '../../src/config/env.js';
import { bootstrapPlatformAdmin } from '../../src/modules/platform-auth/platform-bootstrap.service.js';
import { ROLE_CODES, type RoleCode } from '../../src/shared/types/roles.js';
import {
  asDate,
  dateOnly,
  localDay,
  periodEnd,
} from '../../src/modules/hotels/subscription-calendar.js';
import { phase6App } from './app.js';
import {
  ScenarioHttp,
  PHASE6_PASSWORD,
  PHASE6_INITIAL_PASSWORD,
  type ScenarioSession,
} from './client.js';

type Identified = { id: string };
type Booking = Identified & { confirmationCode: string; rooms: Identified[]; totalAmount: string };
export type ScenarioStaff = Identified & { username: string; session: ScenarioSession };
export interface ScenarioHotel {
  id: string;
  code: string;
  timezone: string;
  today: string;
  staff: Record<RoleCode, ScenarioStaff>;
  inactive: Identified & { username: string };
  temporary: Identified & { username: string };
  types: Record<'STANDARD' | 'SUITE', string>;
  rooms: Record<string, string>;
  guests: string[];
  serviceId: string;
  closed: { booking: Booking; stayId: string; folioId: string; paymentId: string; orderId: string };
  active: { booking: Booking; stayId: string; folioId: string; orderId: string };
  future: Booking;
  cancelled: Booking;
  housekeeping: { pending: string; inProgress: string; awaitingInspection: string };
  maintenance: { ticketId: string; blockId: string };
  inventory: {
    categoryId: string;
    supplierId: string;
    itemId: string;
    receiptId: string;
    issueId: string;
  };
  expected: {
    rate: string;
    servicePrice: string;
    roomCharges: string;
    serviceCharges: string;
    collected: string;
    outstanding: string;
    stock: string;
    closedBill: string;
  };
}
export const dayOffset = (day: string, offset: number) =>
  dateOnly(new Date(asDate(day).getTime() + offset * 86400000));

export async function seedPhase6Scenario(prisma: PrismaClient, env: Env) {
  // This fixture may backdate synthetic subscription metadata. It must never be
  // callable against an application schema, even when the caller sets NODE_ENV=test.
  const target = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV !== 'test' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !/^\/innvyra_phase_six_[a-f0-9]{32}_test$/.test(target.pathname)
  )
    throw new Error('Phase 6 seed requires a newly owned phase_six test schema');
  const actual = await prisma.$queryRaw<{ name: string }[]>`SELECT DATABASE() AS name`;
  if (
    actual[0]?.name !== target.pathname.slice(1) ||
    (process.env.DATABASE_URL && new URL(process.env.DATABASE_URL).pathname === target.pathname)
  )
    throw new Error('Phase 6 seed database connection does not match the owned test target');
  if ((await prisma.hotel.count()) || (await prisma.platformAdmin.count()))
    throw new Error('Phase 6 seed requires an empty schema; existing records are never reset');
  const app = phase6App(prisma, env);
  const http = new ScenarioHttp(app);
  await prisma.role.createMany({ data: ROLE_CODES.map((code) => ({ code, name: code })) });
  const owner = await bootstrapPlatformAdmin(prisma, {
    email: 'phase6.owner@example.test',
    fullName: 'Quản trị Innvyra kiểm thử',
    password: PHASE6_PASSWORD,
  });
  const platform = await http.ok<{ accessToken: string }>(
    'post',
    '/platform/auth/login',
    undefined,
    { email: owner.email, password: PHASE6_PASSWORD },
  );
  const plan = await http.ok<Identified>(
    'post',
    '/platform/plans',
    platform.accessToken,
    {
      code: 'P6_STANDARD',
      name: 'Gói mẫu Phase 6',
      monthlyPrice: '299000.25',
      roomLimit: 8,
      staffLimit: 8,
      isActive: true,
    },
    201,
  );
  const largePlan = await http.ok<Identified>(
    'post',
    '/platform/plans',
    platform.accessToken,
    {
      code: 'P6_LARGE',
      name: 'Gói mẫu mở rộng',
      monthlyPrice: '599000.50',
      roomLimit: 20,
      staffLimit: 25,
      isActive: true,
    },
    201,
  );
  const smallPlan = await http.ok<Identified>(
    'post',
    '/platform/plans',
    platform.accessToken,
    {
      code: 'P6_SMALL',
      name: 'Gói mẫu hạn mức thấp',
      monthlyPrice: '99000',
      roomLimit: 2,
      staffLimit: 2,
      isActive: true,
    },
    201,
  );
  let sequence = 0;
  async function createHotel(
    code: string,
    timezone = 'Asia/Ho_Chi_Minh',
    selectedPlan = plan.id,
    startsOn = localDay(timezone),
  ) {
    const username = `${code.toLowerCase()}_admin`;
    const result = await http.ok<{
      hotel: Identified & { code: string };
      admin: Identified;
      temporaryPassword: string;
      subscription: Identified;
    }>(
      'post',
      '/platform/hotels',
      platform.accessToken,
      {
        code,
        name: `${code} · khách sạn kiểm thử`,
        timezone,
        admin: { username, fullName: `Quản trị ${code}`, email: `${username}@example.test` },
        subscription: {
          planId: selectedPlan,
          startsOn,
          monthCount: 1,
          reason: 'Phase 6 synthetic onboarding',
          paymentReference: `DEMO-${code}`,
        },
      },
      201,
    );
    const session = await http.activatePassword(username, result.temporaryPassword);
    return { ...result, session, username, timezone, today: localDay(timezone) };
  }
  async function cleanRoom(roomId: string, users: Record<RoleCode, ScenarioStaff>) {
    const task = await http.ok<Identified>(
      'post',
      '/housekeeping/tasks',
      users.RECEPTIONIST.session.accessToken,
      { roomId },
      201,
    );
    await finishCleaning(task.id, users);
    return task.id;
  }
  async function finishCleaning(taskId: string, users: Record<RoleCode, ScenarioStaff>) {
    await http.ok(
      'patch',
      `/housekeeping/tasks/${taskId}/assign`,
      users.MANAGER.session.accessToken,
      { staffId: users.HOUSEKEEPING.id },
    );
    await http.ok(
      'post',
      `/housekeeping/tasks/${taskId}/start`,
      users.HOUSEKEEPING.session.accessToken,
      {},
    );
    await http.ok(
      'post',
      `/housekeeping/tasks/${taskId}/complete`,
      users.HOUSEKEEPING.session.accessToken,
      {},
    );
    await http.ok(
      'post',
      `/housekeeping/tasks/${taskId}/inspect`,
      users.MANAGER.session.accessToken,
      { passed: true },
    );
  }
  async function seedHotel(suffix: 'A' | 'B'): Promise<ScenarioHotel> {
    const timezone = suffix === 'A' ? 'Asia/Ho_Chi_Minh' : 'America/Los_Angeles';
    const base = await createHotel(`P6_${suffix}`, timezone);
    const users = {
      ADMIN: { id: base.admin.id, username: base.username, session: base.session },
    } as Record<RoleCode, ScenarioStaff>;
    const admin = base.session.accessToken;
    for (const role of ROLE_CODES.filter((code) => code !== 'ADMIN')) {
      const username = `p6_${suffix.toLowerCase()}_${role.toLowerCase()}`;
      const staff = await http.ok<Identified>(
        'post',
        '/employees',
        admin,
        {
          fullName: `${suffix} · ${role}`,
          username,
          email: `${username}@example.test`,
          role,
          password: PHASE6_INITIAL_PASSWORD,
        },
        201,
      );
      users[role] = {
        ...staff,
        username,
        session: await http.activatePassword(username, PHASE6_INITIAL_PASSWORD),
      };
    }
    const inactiveName = `p6_${suffix.toLowerCase()}_inactive`;
    const inactive = await http.ok<Identified>(
      'post',
      '/employees',
      admin,
      {
        fullName: `${suffix} · nhân viên nghỉ`,
        username: inactiveName,
        role: 'RECEPTIONIST',
        password: PHASE6_INITIAL_PASSWORD,
      },
      201,
    );
    await http.ok('patch', `/employees/${inactive.id}/deactivate`, admin, {});
    const temporaryName = `p6_${suffix.toLowerCase()}_temporary`;
    const temporary = await http.ok<Identified>(
      'post',
      '/employees',
      admin,
      {
        fullName: `${suffix} · cần đổi mật khẩu`,
        username: temporaryName,
        role: 'RECEPTIONIST',
        password: PHASE6_INITIAL_PASSWORD,
      },
      201,
    );
    const rate = suffix === 'A' ? '500000.25' : '300000.50';
    const servicePrice = suffix === 'A' ? '25000.00' : '15000.00';
    const standard = await http.ok<Identified>(
      'post',
      '/room-types',
      admin,
      { code: 'STANDARD', name: `Hạng tiêu chuẩn ${suffix}`, maxAdults: 2, basePrice: rate },
      201,
    );
    const suite = await http.ok<Identified>(
      'post',
      '/room-types',
      admin,
      { code: 'SUITE', name: `Hạng suite ${suffix}`, maxAdults: 3, basePrice: '800000.50' },
      201,
    );
    const rooms: Record<string, string> = {};
    for (const number of ['101', '102', '103', '104', '201', '202']) {
      const room = await http.ok<Identified>(
        'post',
        '/rooms',
        admin,
        {
          roomNumber: number,
          floorNumber: Number(number[0]),
          roomTypeId: number.startsWith('1') ? standard.id : suite.id,
        },
        201,
      );
      rooms[number] = room.id;
    }
    for (const number of ['101', '102', '201', '202']) await cleanRoom(rooms[number]!, users);
    const guests: string[] = [];
    for (const number of [1, 2]) {
      const guest = await http.ok<Identified>(
        'post',
        '/guests',
        users.RECEPTIONIST.session.accessToken,
        {
          fullName: `Synthetic Guest ${suffix} ${number}`,
          email: `guest_${suffix.toLowerCase()}_${number}@example.test`,
          phone: `090000000${number}`,
          documentType: 'PASSPORT',
          documentNumber: `SYNTHETIC-DOC-${number}`,
          notes: `PRIVATE_${suffix}_ONLY`,
        },
        201,
      );
      guests.push(guest.id);
    }
    const service = await http.ok<Identified>(
      'post',
      '/services',
      admin,
      { code: 'LAUNDRY', name: `Giặt ủi ${suffix}`, unit: 'item', price: servicePrice },
      201,
    );
    const receptionist = users.RECEPTIONIST.session.accessToken;
    const accountant = users.ACCOUNTANT.session.accessToken;
    const book = (guestId: string, roomTypeId: string, start: number, end: number) =>
      http.ok<Booking>(
        'post',
        '/reservations',
        receptionist,
        {
          guestId,
          checkInDate: dayOffset(base.today, start),
          checkOutDate: dayOffset(base.today, end),
          rooms: [{ roomTypeId, quantity: 1, adults: 2 }],
        },
        201,
      );
    const closedBooking = await book(guests[0]!, standard.id, 0, 2);
    const closedStay = await http.ok<{ stayId: string }>(
      'post',
      `/reservations/${closedBooking.id}/rooms/${closedBooking.rooms[0]!.id}/check-in`,
      receptionist,
      { roomId: rooms['101']! },
      201,
    );
    const closedFolio = await http.ok<Identified>(
      'post',
      `/reservations/${closedBooking.id}/folio/open`,
      accountant,
      {},
    );
    const order = await http.ok<Identified>(
      'post',
      '/service-orders',
      receptionist,
      {
        reservationId: closedBooking.id,
        stayId: closedStay.stayId,
        items: [{ serviceId: service.id, quantity: 2 }],
      },
      201,
    );
    await http.ok('post', `/service-orders/${order.id}/complete`, receptionist, {});
    const firstPayment = await http.ok<Identified>(
      'post',
      `/folios/${closedFolio.id}/payments`,
      accountant,
      {
        paymentType: 'PAYMENT',
        paymentMethod: 'CASH',
        amount: suffix === 'A' ? '400000.00' : '100000.00',
        confirmedReceived: true,
      },
      201,
      `phase6-${suffix}-closed-cash`,
    );
    await http.ok(
      'post',
      `/folios/${closedFolio.id}/payments`,
      accountant,
      {
        paymentType: 'PAYMENT',
        paymentMethod: 'BANK_TRANSFER',
        amount: suffix === 'A' ? '650000.00' : '530002.00',
        confirmedReceived: true,
        referenceNumber: `DEMO-TRANSFER-${suffix}`,
      },
      201,
      `phase6-${suffix}-closed-bank`,
    );
    await http.ok('post', `/stays/${closedStay.stayId}/check-out`, receptionist, {});
    await http.ok('post', `/folios/${closedFolio.id}/close`, admin, {});
    const turnover = await prisma.housekeepingTask.findFirstOrThrow({
      where: { hotelId: BigInt(base.hotel.id), roomId: BigInt(rooms['101']!), status: 'PENDING' },
    });
    await finishCleaning(String(turnover.id), users);
    const activeBooking = await book(guests[1]!, standard.id, 0, 2);
    const activeStay = await http.ok<{ stayId: string }>(
      'post',
      `/reservations/${activeBooking.id}/rooms/${activeBooking.rooms[0]!.id}/check-in`,
      receptionist,
      { roomId: rooms['102']! },
      201,
    );
    const activeFolio = await http.ok<Identified>(
      'post',
      `/reservations/${activeBooking.id}/folio/open`,
      accountant,
      {},
    );
    await http.ok(
      'post',
      `/folios/${activeFolio.id}/payments`,
      accountant,
      {
        paymentType: 'DEPOSIT',
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: `DEMO-DEPOSIT-${suffix}`,
        amount: suffix === 'A' ? '100000.00' : '50000.00',
        confirmedReceived: true,
      },
      201,
      `phase6-${suffix}-active-deposit`,
    );
    const pendingOrder = await http.ok<Identified>(
      'post',
      '/service-orders',
      receptionist,
      {
        reservationId: activeBooking.id,
        stayId: activeStay.stayId,
        items: [{ serviceId: service.id, quantity: 1 }],
      },
      201,
    );
    const future = await book(guests[0]!, standard.id, 3, 5);
    const cancelled = await book(guests[1]!, suite.id, 5, 7);
    await http.ok('post', `/reservations/${cancelled.id}/cancel`, receptionist, {
      reason: 'Synthetic cancellation scenario',
    });
    const ticket = await http.ok<Identified>(
      'post',
      '/maintenance/tickets',
      receptionist,
      {
        roomId: rooms['104']!,
        title: `Điều hòa ${suffix}`,
        description: 'Synthetic repair scenario',
      },
      201,
    );
    await http.ok(
      'patch',
      `/maintenance/tickets/${ticket.id}/assign`,
      users.MANAGER.session.accessToken,
      { staffId: users.TECHNICIAN.id },
    );
    await http.ok(
      'post',
      `/maintenance/tickets/${ticket.id}/start`,
      users.TECHNICIAN.session.accessToken,
      {},
    );
    const block = await http.ok<Identified>(
      'post',
      '/maintenance/blocks',
      users.MANAGER.session.accessToken,
      {
        roomId: rooms['104']!,
        maintenanceTicketId: ticket.id,
        startDate: base.today,
        endDate: dayOffset(base.today, 2),
        reason: 'Synthetic safety block',
      },
      201,
    );
    const housekeeping = { pending: '', inProgress: '', awaitingInspection: '' };
    for (const [number, stage] of [
      ['103', 'pending'],
      ['201', 'awaitingInspection'],
      ['202', 'inProgress'],
    ] as const) {
      if (number !== '103')
        await http.ok('patch', '/rooms/' + rooms[number]!, admin, { housekeepingStatus: 'DIRTY' });
      const task = await http.ok<Identified>(
        'post',
        '/housekeeping/tasks',
        receptionist,
        { roomId: rooms[number]! },
        201,
      );
      housekeeping[stage] = task.id;
      await http.ok(
        'patch',
        '/housekeeping/tasks/' + task.id + '/assign',
        users.MANAGER.session.accessToken,
        { staffId: users.HOUSEKEEPING.id },
      );
      if (stage !== 'pending')
        await http.ok(
          'post',
          '/housekeeping/tasks/' + task.id + '/start',
          users.HOUSEKEEPING.session.accessToken,
          {},
        );
      if (stage === 'awaitingInspection')
        await http.ok(
          'post',
          '/housekeeping/tasks/' + task.id + '/complete',
          users.HOUSEKEEPING.session.accessToken,
          {},
        );
    }
    const category = await http.ok<Identified>(
      'post',
      '/inventory/categories',
      admin,
      { code: 'LINEN', name: `Đồ vải ${suffix}` },
      201,
    );
    const supplier = await http.ok<Identified>(
      'post',
      '/inventory/suppliers',
      admin,
      { code: 'DEMO_SUPPLIER', name: `Nhà cung cấp ${suffix}` },
      201,
    );
    const item = await http.ok<Identified>(
      'post',
      '/inventory/items',
      admin,
      {
        code: 'TOWEL',
        name: `Khăn ${suffix}`,
        categoryId: category.id,
        unit: 'piece',
        minStockLevel: '10',
      },
      201,
    );
    const receipt = await http.ok<Identified>(
      'post',
      '/inventory/receipts',
      users.MANAGER.session.accessToken,
      {
        receiptNumber: 'DEMO-RECEIPT-01',
        supplierId: supplier.id,
        items: [
          { itemId: item.id, quantity: suffix === 'A' ? '100' : '40', unitPrice: '50000.25' },
        ],
      },
      201,
    );
    const issue = await http.ok<Identified>(
      'post',
      '/inventory/issues',
      users.MANAGER.session.accessToken,
      {
        issueNumber: 'DEMO-ISSUE-01',
        department: 'HOUSEKEEPING',
        items: [{ itemId: item.id, quantity: suffix === 'A' ? '12' : '5' }],
      },
      201,
    );
    await http.ok(
      'post',
      '/inventory/adjustments',
      admin,
      {
        adjustmentNumber: 'DEMO-COUNT-01',
        itemId: item.id,
        actualQuantity: suffix === 'A' ? '85' : '34',
        reason: 'Synthetic physical stock count',
      },
      201,
    );
    return {
      id: base.hotel.id,
      code: base.hotel.code,
      timezone,
      today: base.today,
      staff: users,
      inactive: { id: inactive.id, username: inactiveName },
      temporary: { id: temporary.id, username: temporaryName },
      types: { STANDARD: standard.id, SUITE: suite.id },
      rooms,
      guests,
      serviceId: service.id,
      closed: {
        booking: closedBooking,
        stayId: closedStay.stayId,
        folioId: closedFolio.id,
        paymentId: firstPayment.id,
        orderId: order.id,
      },
      active: {
        booking: activeBooking,
        stayId: activeStay.stayId,
        folioId: activeFolio.id,
        orderId: pendingOrder.id,
      },
      future,
      cancelled,
      housekeeping,
      maintenance: { ticketId: ticket.id, blockId: block.id },
      inventory: {
        categoryId: category.id,
        supplierId: supplier.id,
        itemId: item.id,
        receiptId: receipt.id,
        issueId: issue.id,
      },
      expected:
        suffix === 'A'
          ? {
              rate,
              servicePrice,
              roomCharges: '2000000.00',
              serviceCharges: '50000.00',
              collected: '1150000.00',
              outstanding: '900000.00',
              stock: '85.00',
              closedBill: '1050000.00',
            }
          : {
              rate,
              servicePrice,
              roomCharges: '1200004.00',
              serviceCharges: '30000.00',
              collected: '680002.00',
              outstanding: '550002.00',
              stock: '34.00',
              closedBill: '630002.00',
            },
    };
  }
  const a = await seedHotel('A');
  const b = await seedHotel('B');
  const states: Record<string, { id: string; username: string }> = {};
  for (const remaining of [14, 7, 1, 0, -1, -8]) {
    const code = `P6_${remaining >= 0 ? 'DUE' : 'OVER'}_${Math.abs(remaining)}`;
    const record = await createHotel(code);
    const end = dayOffset(record.today, remaining);
    const exclusive = asDate(dayOffset(end, 1));
    let startsOn: string | undefined;
    let months = 12;
    for (let years = 1; years <= 4; years++) {
      const start = new Date(
        Date.UTC(
          exclusive.getUTCFullYear() - years,
          exclusive.getUTCMonth(),
          exclusive.getUTCDate(),
        ),
      );
      if (dateOnly(periodEnd(dateOnly(start), years * 12)) === end) {
        startsOn = dateOnly(start);
        months = years * 12;
        break;
      }
    }
    if (!startsOn) throw new Error('Cannot construct consistent historical fixture dates');
    // Historical fixture exception: public onboarding intentionally rejects backdating.
    const price = await prisma.subscriptionPlan.findUniqueOrThrow({
      where: { id: BigInt(plan.id) },
    });
    await prisma.hotelSubscriptionPeriod.update({
      where: { id: BigInt(record.subscription.id) },
      data: {
        startsOn: asDate(startsOn),
        endsOn: asDate(end),
        monthCount: months,
        feeAmount: price.monthlyPrice.mul(months),
        notes: 'Synthetic historical period for Phase 6 boundary tests',
      },
    });
    states[String(remaining)] = { id: record.hotel.id, username: record.username };
  }
  const upcoming = await createHotel(
    'P6_UPCOMING',
    'Asia/Ho_Chi_Minh',
    plan.id,
    dayOffset(localDay('Asia/Ho_Chi_Minh'), 2),
  );
  states.UPCOMING = { id: upcoming.hotel.id, username: upcoming.username };
  const suspended = await createHotel('P6_SUSPENDED');
  await http.ok('patch', `/platform/hotels/${suspended.hotel.id}/status`, platform.accessToken, {
    status: 'SUSPENDED',
    reason: 'Synthetic manual suspension',
  });
  states.SUSPENDED = { id: suspended.hotel.id, username: suspended.username };
  const legacy = await prisma.hotel.create({
    data: { code: 'P6_LEGACY', name: 'Khách sạn cũ chưa có thuê bao' },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const existing = await prisma.staffUser.findUniqueOrThrow({
    where: { id: BigInt(a.staff.ADMIN.id) },
  });
  await prisma.staffUser.create({
    data: {
      hotelId: legacy.id,
      roleId: role.id,
      username: 'p6_legacy_admin',
      fullName: 'Quản trị khách sạn cũ',
      passwordHash: existing.passwordHash,
    },
  });
  states.UNCONFIGURED = { id: String(legacy.id), username: 'p6_legacy_admin' };
  return {
    app,
    http,
    prisma,
    env,
    platform,
    plans: { standard: plan.id, large: largePlan.id, small: smallPlan.id },
    a,
    b,
    states,
    createHotel: () => createHotel(`P6_EXTRA_${++sequence}`),
    cleanRoom,
    finishCleaning,
  };
}
export type Phase6Scenario = Awaited<ReturnType<typeof seedPhase6Scenario>>;
