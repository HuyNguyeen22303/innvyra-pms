import 'dotenv/config';
import { platformBootstrapInput } from '../src/modules/platform-auth/platform-auth.schema.js';
import { bootstrapPlatformAdmin } from '../src/modules/platform-auth/platform-bootstrap.service.js';
import { AppError } from '../src/shared/errors/app-error.js';
import { scriptPrisma } from './database-tools.js';

async function main() {
  const result = platformBootstrapInput.safeParse({
    email: process.env.PLATFORM_ADMIN_EMAIL,
    fullName: process.env.PLATFORM_ADMIN_FULL_NAME,
    password: process.env.PLATFORM_ADMIN_PASSWORD,
  });
  delete process.env.PLATFORM_ADMIN_PASSWORD;
  if (!result.success) {
    console.error(
      `Invalid platform admin input: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
    process.exitCode = 1;
    return;
  }
  const prisma = scriptPrisma();
  try {
    const admin = await bootstrapPlatformAdmin(prisma, result.data);
    console.info(`First PLATFORM_ADMIN created with ID ${admin.id.toString()}.`);
  } finally {
    result.data.password = '';
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof AppError
      ? error.message
      : 'Platform admin creation failed. Verify connectivity and apply the multi-hotel foundation migration.',
  );
  process.exitCode = 1;
});
