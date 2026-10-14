import 'dotenv/config';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createPrisma } from './database/prisma.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { getDummyPasswordHash } from './shared/utils/password.js';
import { PrismaRoomTypeRepository } from './modules/room-types/room-type.repository.js';
import { PrismaRoomRepository } from './modules/rooms/room.repository.js';

async function main() {
  const env = parseEnv(process.env);
  const prisma = createPrisma(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await getDummyPasswordHash();
    const server = createApp(env, new PrismaAuthRepository(prisma), {
      roomTypes: new PrismaRoomTypeRepository(prisma),
      rooms: new PrismaRoomRepository(prisma),
    }).listen(env.PORT, () => {
      console.info(`Innvyra PMS API listening on port ${env.PORT}`);
    });
    server.on('error', () => {
      console.error('HTTP server could not start');
      void prisma.$disconnect();
      process.exitCode = 1;
    });
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => {
        process.exit(1);
      }, 10000).unref();
      server.close(() => {
        void prisma.$disconnect().finally(() => {
          clearTimeout(deadline);
        });
      });
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch {
    await prisma.$disconnect();
    throw new Error('Database startup failed; verify connectivity and apply backend migrations');
  }
}

main().catch((error: unknown) => {
  // Only our sanitized configuration/startup messages can reach this boundary.
  console.error(error instanceof Error ? error.message : 'Startup failed');
  process.exitCode = 1;
});
