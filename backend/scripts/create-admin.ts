import { adminInputSchema } from '../src/modules/auth/auth.schema.js';
import { hashPassword } from '../src/shared/utils/password.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { scriptPrisma } from './database-tools.js';

async function main() {
  const result = adminInputSchema.safeParse({
    username: process.env.ADMIN_USERNAME,
    fullName: process.env.ADMIN_FULL_NAME,
    hotelId: process.env.ADMIN_HOTEL_ID,
    password: process.env.ADMIN_PASSWORD,
    ...(process.env.ADMIN_EMAIL ? { email: process.env.ADMIN_EMAIL } : {}),
  });
  delete process.env.ADMIN_PASSWORD;
  if (!result.success) {
    console.error(
      `Invalid admin input: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
    process.exitCode = 1;
    return;
  }
  const input = result.data;
  const passwordHash = await hashPassword(input.password);
  input.password = '';
  const prisma = scriptPrisma();
  try {
    const admin = await prisma.$transaction(
      async (tx) => {
        // Serializes simultaneous first-admin bootstraps without adding a new table.
        await tx.$queryRaw`SELECT id FROM roles WHERE code = 'ADMIN' FOR UPDATE`;
        const role = await tx.role.findUnique({ where: { code: 'ADMIN' } });
        if (!role) throw new AppError(409, 'ROLE_MISSING', 'Run db:seed before creating an admin');
        if (await tx.staffUser.findFirst({ where: { roleId: role.id } }))
          throw new AppError(
            409,
            'ADMIN_EXISTS',
            'An ADMIN already exists; this script only bootstraps the first admin',
          );
        if (!(await tx.hotel.findUnique({ where: { id: input.hotelId } })))
          throw new AppError(422, 'HOTEL_MISSING', 'The specified hotel does not exist');
        if (
          await tx.staffUser.findFirst({
            where: {
              OR: [{ username: input.username }, ...(input.email ? [{ email: input.email }] : [])],
            },
          })
        )
          throw new AppError(409, 'ACCOUNT_EXISTS', 'The username or email already exists');
        return tx.staffUser.create({
          data: {
            username: input.username,
            fullName: input.fullName,
            email: input.email ?? null,
            hotelId: input.hotelId,
            roleId: role.id,
            passwordHash,
          },
          select: { id: true },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
    console.info(`First ADMIN created with ID ${admin.id.toString()}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : 'Admin creation failed. Verify the database and unique account fields.',
  );
  process.exitCode = 1;
});
