import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { AppError } from '../../shared/errors/app-error.js';
import { hashPassword } from '../../shared/utils/password.js';
import { platformBootstrapInput, type PlatformBootstrapInput } from './platform-auth.schema.js';

const exists = () =>
  new AppError(
    409,
    'PLATFORM_ADMIN_EXISTS',
    'A platform admin already exists; bootstrap is only for the first account',
  );

export async function bootstrapPlatformAdmin(prisma: PrismaClient, raw: PlatformBootstrapInput) {
  const input = platformBootstrapInput.parse(raw);
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction(
      async (tx) => {
        if (await tx.platformAdmin.findFirst({ select: { id: true } })) throw exists();
        // Reserving the initial PK makes two empty-table bootstraps mutually exclusive
        // without a hotel/role row or a connection-scoped advisory lock.
        return tx.platformAdmin.create({
          data: {
            id: 1n,
            email: input.email,
            fullName: input.fullName,
            passwordHash,
          },
          select: { id: true, email: true, fullName: true },
        });
      },
      { isolationLevel: 'ReadCommitted' },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw exists();
    throw error;
  }
}
