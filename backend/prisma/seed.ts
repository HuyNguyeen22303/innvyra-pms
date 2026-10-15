import { z } from 'zod';
import { scriptPrisma } from '../scripts/database-tools.js';
import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { GuestCrypto } from '../src/modules/guests/guest.crypto.js';

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

const demoGuests = [
  {
    fullName: 'Nguyễn Văn An',
    phone: '0901234567',
    email: 'an.nguyen@gmail.com',
    dateOfBirth: '1990-05-15',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079090001234',
    address: '123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    notes: 'Khách VIP thân thiết, thích phòng tầng cao yên tĩnh',
  },
  {
    fullName: 'Trần Thị Bích',
    phone: '0912345678',
    email: 'bich.tran@yahoo.com',
    dateOfBirth: '1988-10-20',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001188002345',
    address: '45 Hai Bà Trưng, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội',
    notes: 'Yêu cầu phòng không hút thuốc và có bồn tắm',
  },
  {
    fullName: 'Lê Hoàng Long',
    phone: '0983456789',
    email: 'long.le@outlook.com',
    dateOfBirth: '1995-03-12',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '048095003456',
    address: '78 Bạch Đằng, Phường Hải Châu 1, Quận Hải Châu, TP. Đà Nẵng',
    notes: 'Khách lưu trú công tác dài ngày',
  },
  {
    fullName: 'Phạm Thu Hương',
    phone: '0974567890',
    email: 'huong.pham@gmail.com',
    dateOfBirth: '1992-07-25',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '031092004567',
    address: '12 Trần Phú, Phường Lương Khánh Thiện, Quận Ngô Quyền, Hải Phòng',
    notes: 'Thích phòng view vườn thoáng mát',
  },
  {
    fullName: 'Hoàng Minh Đức',
    phone: '0965678901',
    email: 'duc.hoang@company.vn',
    dateOfBirth: '1985-12-08',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001085005678',
    address: '56 Kim Mã, Phường Kim Mã, Quận Ba Đình, Hà Nội',
    notes: 'Yêu cầu xuất hóa đơn công ty khi thanh toán',
  },
  {
    fullName: 'Đặng Ngọc Mai',
    phone: '0936789012',
    email: 'mai.dang@gmail.com',
    dateOfBirth: '1998-09-18',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079198006789',
    address: '89 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh',
    notes: 'Du lịch nghỉ dưỡng cùng gia đình có trẻ nhỏ',
  },
  {
    fullName: 'Vũ Quốc Bảo',
    phone: '0947890123',
    email: 'bao.vu@tech.io',
    dateOfBirth: '1993-01-30',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '075093007890',
    address: '34 Đồng Khởi, Phường Tân Hiệp, TP. Biên Hòa, Đồng Nai',
    notes: 'Thường check-in muộn sau 21:00 do chuyến bay tối',
  },
  {
    fullName: 'Bùi Phương Thảo',
    phone: '0928901234',
    email: 'thao.bui@gmail.com',
    dateOfBirth: '1996-06-14',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '068096008901',
    address: '15 Quang Trung, Phường 9, TP. Đà Lạt, Lâm Đồng',
    notes: 'Dị ứng phấn hoa và hải sản tươi sống',
  },
  {
    fullName: 'Đỗ Tuấn Kiệt',
    phone: '0919012345',
    email: 'kiet.do@gmail.com',
    dateOfBirth: '1989-11-05',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079089009012',
    address: '102 Cách Mạng Tháng 8, Phường 7, Quận 3, TP. Hồ Chí Minh',
    notes: 'Thành viên Platinum chuỗi khách sạn boutique',
  },
  {
    fullName: 'Ngô Mỹ Linh',
    phone: '0909123456',
    email: 'linh.ngo@fashion.vn',
    dateOfBirth: '1997-04-22',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '001197010123',
    address: '67 Thợ Nhuộm, Phường Cửa Nam, Quận Hoàn Kiếm, Hà Nội',
    notes: 'Cần thêm gối phụ và bàn ủi trong phòng',
  },
  {
    fullName: 'John David Smith',
    phone: '+12025550143',
    email: 'john.smith@gmail.com',
    dateOfBirth: '1982-08-19',
    gender: 'MALE' as const,
    nationality: 'United States',
    documentType: 'PASSPORT' as const,
    documentNumber: 'A12345678',
    address: '742 Evergreen Terrace, Springfield, OR, USA',
    notes: 'English speaking, requests airport transfer service',
  },
  {
    fullName: 'Emma Charlotte Brown',
    phone: '+442079460912',
    email: 'emma.brown@yahoo.co.uk',
    dateOfBirth: '1991-02-11',
    gender: 'FEMALE' as const,
    nationality: 'United Kingdom',
    documentType: 'PASSPORT' as const,
    documentNumber: 'GB98765432',
    address: '10 Downing Mews, London, UK',
    notes: 'Prefers high floor with ocean balcony view',
  },
  {
    fullName: 'Michael Kenji Tanaka',
    phone: '+81355550198',
    email: 'm.tanaka@tokyo.jp',
    dateOfBirth: '1986-11-28',
    gender: 'MALE' as const,
    nationality: 'Japan',
    documentType: 'PASSPORT' as const,
    documentNumber: 'JP87654321',
    address: '2-11-3 Nagatacho, Chiyoda-ku, Tokyo, Japan',
    notes: 'Quiet room required for online business conferences',
  },
  {
    fullName: 'Park Min-Ji',
    phone: '+8223123456',
    email: 'minji.park@naver.com',
    dateOfBirth: '1994-05-03',
    gender: 'FEMALE' as const,
    nationality: 'South Korea',
    documentType: 'PASSPORT' as const,
    documentNumber: 'M12389045',
    address: 'Gangnam-daero 396, Gangnam-gu, Seoul, Korea',
    notes: 'Honeymoon couple, requests floral room decoration',
  },
  {
    fullName: 'Jean-Pierre Dubois',
    phone: '+33142685555',
    email: 'jp.dubois@orange.fr',
    dateOfBirth: '1979-12-15',
    gender: 'MALE' as const,
    nationality: 'France',
    documentType: 'PASSPORT' as const,
    documentNumber: 'FR54321098',
    address: '15 Rue de la Paix, 75002 Paris, France',
    notes: 'Vegetarian breakfast preference',
  },
  {
    fullName: 'Hans Mueller',
    phone: '+493012345678',
    email: 'hans.mueller@berlin.de',
    dateOfBirth: '1984-03-27',
    gender: 'MALE' as const,
    nationality: 'Germany',
    documentType: 'PASSPORT' as const,
    documentNumber: 'C01X00T47',
    address: 'Friedrichstraße 43, 10117 Berlin, Germany',
    notes: 'Requests early check-in around 10:00 AM if available',
  },
  {
    fullName: 'Lý Gia Hào',
    phone: '0908765432',
    email: 'hao.ly@finance.com',
    dateOfBirth: '1987-08-08',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '079087011234',
    address: '205 An Dương Vương, Phường 8, Quận 5, TP. Hồ Chí Minh',
    notes: 'Hội viên Diamond, ưu tiên nhận phòng sớm',
  },
  {
    fullName: 'Võ Thị Thanh Thủy',
    phone: '0918765432',
    email: 'thuy.vo@gmail.com',
    dateOfBirth: '1993-10-10',
    gender: 'FEMALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '072093012345',
    address: '18 Nguyễn Thị Minh Khai, Phường Lộc Thọ, TP. Nha Trang, Khánh Hòa',
    notes: 'Khách đặt phòng gia đình có người lớn tuổi',
  },
  {
    fullName: 'Trương Quốc Huy',
    phone: '0988765432',
    email: 'huy.truong@startup.vn',
    dateOfBirth: '1990-01-25',
    gender: 'MALE' as const,
    nationality: 'Việt Nam',
    documentType: 'NATIONAL_ID' as const,
    documentNumber: '083090013456',
    address: '42 Trần Hưng Đạo, Phường An Cư, Quận Ninh Kiều, TP. Cần Thơ',
    notes: 'Tham gia hội thảo doanh nghiệp tại khách sạn',
  },
  {
    fullName: 'Sophia Chen',
    phone: '+6567890123',
    email: 'sophia.chen@singapore.sg',
    dateOfBirth: '1995-07-07',
    gender: 'FEMALE' as const,
    nationality: 'Singapore',
    documentType: 'PASSPORT' as const,
    documentNumber: 'K7654321B',
    address: '1 Raffles Place, Singapore 048616',
    notes: 'Requires extra bed and infant baby cot',
  },
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
        const crypto =
          process.env.GUEST_ENCRYPTION_KEY && process.env.GUEST_HASH_KEY
            ? new GuestCrypto({
                GUEST_ENCRYPTION_KEY: process.env.GUEST_ENCRYPTION_KEY,
                GUEST_HASH_KEY: process.env.GUEST_HASH_KEY,
              })
            : null;

        const created = { hotel, staff: 0, roomTypes: 0, rooms: 0, guests: 0 };
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

        // Seed 20 Demo Guests
        for (const guest of demoGuests) {
          const existing = await tx.guest.findFirst({
            where: { hotelId: hotel.id, fullName: guest.fullName, phone: guest.phone },
          });
          if (existing) continue;

          await tx.guest.create({
            data: {
              hotelId: hotel.id,
              fullName: guest.fullName,
              phone: guest.phone,
              email: guest.email,
              dateOfBirth: guest.dateOfBirth
                ? new Date(`${guest.dateOfBirth}T00:00:00.000Z`)
                : null,
              gender: guest.gender,
              nationality: guest.nationality,
              documentType: guest.documentType,
              documentNumberCiphertext:
                guest.documentNumber && crypto
                  ? crypto.encrypt(hotel.id, guest.documentNumber)
                  : null,
              documentNumberHash:
                guest.documentNumber && crypto
                  ? crypto.fingerprint(hotel.id, guest.documentNumber)
                  : null,
              address: guest.address,
              notes: guest.notes,
            },
          });
          created.guests++;
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
        `Created ${result.staff} staff accounts, ${result.roomTypes} room types, ${result.rooms} rooms and ${result.guests} demo guests.`,
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
