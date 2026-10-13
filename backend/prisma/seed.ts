import { z } from 'zod';
import { scriptPrisma } from '../scripts/database-tools.js';

const roles = [
  ['ADMIN', 'Quản trị hệ thống'],
  ['MANAGER', 'Quản lý khách sạn'],
  ['RECEPTIONIST', 'Nhân viên lễ tân'],
  ['HOUSEKEEPING', 'Nhân viên buồng phòng'],
  ['ACCOUNTANT', 'Nhân viên kế toán'],
  ['TECHNICIAN', 'Nhân viên kỹ thuật'],
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
    await prisma.$transaction(async (tx) => {
      for (const [code, name] of roles) {
        await tx.role.upsert({ where: { code }, create: { code, name }, update: {} });
      }
      if (hotelInput)
        await tx.hotel.upsert({ where: { code: hotelInput.code }, create: hotelInput, update: {} });
    });
    console.info('Roles seeded idempotently. No staff account or password was created.');
    if (hotelInput) {
      const hotel = await prisma.hotel.findUniqueOrThrow({ where: { code: hotelInput.code } });
      console.info(`Hotel ID: ${hotel.id.toString()}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Seed failed. Verify database and optional SEED_HOTEL_CODE / SEED_HOTEL_NAME.');
  process.exitCode = 1;
});
