import { z } from 'zod';
import { scriptPrisma } from '../scripts/database-tools.js';
import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { hashPassword } from '../src/shared/utils/password.js';

const roles = [
  ['ADMIN', 'Quản trị hệ thống'],
  ['MANAGER', 'Quản lý khách sạn'],
  ['RECEPTIONIST', 'Nhân viên lễ tân'],
  ['HOUSEKEEPING', 'Nhân viên buồng phòng'],
  ['ACCOUNTANT', 'Nhân viên kế toán'],
  ['TECHNICIAN', 'Nhân viên kỹ thuật'],
] as const;

const staffAccounts = [
  ['MANAGER', 'manager', 'Nguyễn Minh Anh'],
  ['RECEPTIONIST', 'receptionist', 'Trần Ngọc Linh'],
  ['ACCOUNTANT', 'accountant', 'Lê Thu Hà'],
  ['HOUSEKEEPING', 'housekeeping', 'Phạm Thị Lan'],
  ['TECHNICIAN', 'technician', 'Hoàng Văn Nam'],
] as const;

// Prices are VND decimal strings, matching the room type API.
const roomTypes = [
  ['STD-SGL', 'Standard Single', 1, 0, '500000.00'],
  ['STD-DBL', 'Standard Double', 2, 1, '650000.00'],
  ['STD-TWN', 'Standard Twin', 2, 1, '700000.00'],
  ['STD-TRP', 'Standard Triple', 3, 1, '850000.00'],
  ['SUP-DBL', 'Superior Double', 2, 1, '900000.00'],
  ['SUP-TWN', 'Superior Twin', 2, 1, '950000.00'],
  ['SUP-GARDEN', 'Superior Garden View', 2, 1, '1000000.00'],
  ['SUP-CITY', 'Superior City View', 2, 1, '1050000.00'],
  ['DLX-DBL', 'Deluxe Double', 2, 1, '1200000.00'],
  ['DLX-TWN', 'Deluxe Twin', 2, 1, '1250000.00'],
  ['DLX-BALCONY', 'Deluxe Balcony', 2, 1, '1400000.00'],
  ['DLX-SEA', 'Deluxe Sea View', 2, 1, '1600000.00'],
  ['FAMILY', 'Family Room', 4, 2, '1800000.00'],
  ['FAMILY-CONNECT', 'Family Connecting', 4, 2, '2000000.00'],
  ['FAMILY-GARDEN', 'Family Garden View', 4, 2, '2100000.00'],
  ['FAMILY-SEA', 'Family Sea View', 4, 2, '2300000.00'],
  ['SUITE-JUNIOR', 'Junior Suite', 2, 1, '2500000.00'],
  ['SUITE-EXEC', 'Executive Suite', 2, 2, '3000000.00'],
  ['SUITE-PREMIUM', 'Premium Suite', 4, 2, '4000000.00'],
  ['SUITE-PRESIDENT', 'Presidential Suite', 4, 2, '6000000.00'],
] as const;

async function main() {
  const prisma = scriptPrisma();
  try {
    const hotelInput =
      process.env.SEED_HOTEL_CODE || process.env.SEED_HOTEL_NAME
        ? z
            .object({
              code: z.string().trim().min(1).max(50),
              name: z.string().trim().min(1).max(191),
            })
            .parse({ code: process.env.SEED_HOTEL_CODE, name: process.env.SEED_HOTEL_NAME })
        : undefined;
    const seedDemo =
      z
        .enum(['true', 'false'])
        .default(process.env.NODE_ENV === 'production' ? 'false' : 'true')
        .parse(process.env.SEED_DEMO_DATA) === 'true';
    if (seedDemo && process.env.NODE_ENV === 'production') {
      throw new AppError(400, 'DEMO_PRODUCTION', 'Demo seed is only available outside production.');
    }
    const password = seedDemo
      ? adminInputSchema.shape.password.parse(
          process.env.SEED_STAFF_PASSWORD ?? 'Innvyra@Demo2026!',
        )
      : undefined;
    // Hash outside the transaction; each account receives its own Argon2id salt.
    const accounts = await Promise.all(
      (password ? staffAccounts : []).map(async ([roleCode, username, fullName]) => ({
        roleCode,
        username,
        fullName,
        passwordHash: await hashPassword(password!),
      })),
    );
    const result = await prisma.$transaction(
      async (tx) => {
        for (const [code, name] of roles) {
          await tx.role.upsert({ where: { code }, create: { code, name }, update: {} });
        }
        let hotel = hotelInput
          ? await tx.hotel.upsert({
              where: { code: hotelInput.code },
              create: hotelInput,
              update: {},
            })
          : undefined;
        if (!seedDemo) return { hotel, staff: 0, roomTypes: 0, rooms: 0 };
        if (!hotel) {
          const hotels = await tx.hotel.findMany({ take: 2, orderBy: { id: 'asc' } });
          if (hotels.length > 1) {
            throw new AppError(
              400,
              'SEED_HOTEL_REQUIRED',
              'Multiple hotels found. Set SEED_HOTEL_CODE and SEED_HOTEL_NAME.',
            );
          }
          hotel =
            hotels[0] ?? (await tx.hotel.create({ data: { code: 'MAIN', name: 'Innvyra Hotel' } }));
        }
        const created = { hotel, staff: 0, roomTypes: 0, rooms: 0 };
        for (const { roleCode, ...account } of accounts) {
          const role = await tx.role.findUniqueOrThrow({ where: { code: roleCode } });
          const existing = await tx.staffUser.findUnique({ where: { username: account.username } });
          if (existing) {
            if (existing.hotelId !== hotel.id || existing.roleId !== role.id) {
              throw new AppError(
                409,
                'SEED_ACCOUNT_CONFLICT',
                `Seed username ${account.username} belongs to another hotel or role.`,
              );
            }
            continue;
          }
          await tx.staffUser.create({ data: { ...account, hotelId: hotel.id, roleId: role.id } });
          created.staff++;
        }
        for (const [
          index,
          [code, name, maxAdults, maxChildren, basePrice],
        ] of roomTypes.entries()) {
          let roomType = await tx.roomType.findUnique({
            where: { hotelId_code: { hotelId: hotel.id, code } },
          });
          if (!roomType) {
            roomType = await tx.roomType.create({
              data: {
                hotelId: hotel.id,
                code,
                name,
                description: `Phòng ${name} dành cho tối đa ${maxAdults} người lớn và ${maxChildren} trẻ em.`,
                maxAdults,
                maxChildren,
                basePrice,
              },
            });
            created.roomTypes++;
          }
          const floorNumber = Math.floor(index / 10) + 1;
          const roomNumber = String(floorNumber * 100 + (index % 10) + 1);
          if (
            await tx.room.findUnique({
              where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber } },
            })
          ) {
            continue;
          }
          if (!roomType.isActive) {
            throw new AppError(
              409,
              'SEED_ROOM_TYPE_INACTIVE',
              `Seed room type ${code} is inactive.`,
            );
          }
          await tx.room.create({
            data: {
              hotelId: hotel.id,
              roomTypeId: roomType.id,
              roomNumber,
              floorNumber,
              physicalStatus: 'ACTIVE',
              housekeepingStatus: 'READY',
            },
          });
          created.rooms++;
        }
        return created;
      },
      { timeout: 30000 },
    );
    console.info('Roles seeded idempotently. Existing data and passwords were preserved.');
    if (result.hotel)
      console.info(`Hotel: ${result.hotel.code} (ID: ${result.hotel.id.toString()})`);
    if (seedDemo) {
      console.info(
        `Created ${result.staff} staff accounts, ${result.roomTypes} room types and ${result.rooms} rooms.`,
      );
      console.info(`Demo usernames: ${staffAccounts.map(([, username]) => username).join(', ')}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof z.ZodError
        ? 'Invalid seed configuration. Verify SEED_HOTEL_CODE / SEED_HOTEL_NAME, SEED_DEMO_DATA and SEED_STAFF_PASSWORD (15–128 varied characters).'
        : 'Seed failed. Verify database connectivity and migrations. No seed data was committed.',
  );
  process.exitCode = 1;
});
