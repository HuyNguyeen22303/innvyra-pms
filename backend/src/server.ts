import 'dotenv/config';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createPrisma } from './database/prisma.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { getDummyPasswordHash } from './shared/utils/password.js';
import { PrismaRoomTypeRepository } from './modules/room-types/room-type.repository.js';
import { PrismaRoomRepository } from './modules/rooms/room.repository.js';
import { PrismaGuestRepository } from './modules/guests/guest.repository.js';
import { PrismaReservationRepository } from './modules/reservations/reservation.repository.js';
import { PrismaStayRepository } from './modules/stays/stay.repository.js';
import { PrismaBillingRepository } from './modules/billing/billing.repository.js';
import { PrismaHousekeepingRepository } from './modules/housekeeping/housekeeping.repository.js';
import { PrismaMaintenanceRepository } from './modules/maintenance/maintenance.repository.js';
import { MaintenanceBlockService } from './modules/maintenance/maintenance-block.service.js';
import { startMaintenanceWorker } from './modules/maintenance/maintenance-worker.js';
import { PrismaReportRepository } from './modules/reports/report.repository.js';
import { PrismaEmployeeRepository } from './modules/employees/employee.repository.js';
import { PrismaInventoryRepository } from './modules/inventory/inventory.repository.js';

async function main() {
  const env = parseEnv(process.env);
  const prisma = createPrisma(env.DATABASE_URL, env.DATABASE_SSL, env.DATABASE_SSL_CA_FILE);
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    await getDummyPasswordHash();
    const maintenance = new PrismaMaintenanceRepository(prisma);
    const stopMaintenanceWorker = startMaintenanceWorker(new MaintenanceBlockService(maintenance));
    const server = createApp(
      env,
      new PrismaAuthRepository(prisma),
      {
        roomTypes: new PrismaRoomTypeRepository(prisma),
        rooms: new PrismaRoomRepository(prisma),
      },
      new PrismaGuestRepository(prisma),
      new PrismaReservationRepository(prisma),
      new PrismaStayRepository(prisma),
      new PrismaBillingRepository(prisma),
      { housekeeping: new PrismaHousekeepingRepository(prisma), maintenance },
      new PrismaReportRepository(prisma),
      new PrismaEmployeeRepository(prisma),
      new PrismaInventoryRepository(prisma),
    ).listen(env.PORT, () => {
      console.info(`Innvyra PMS API listening on port ${env.PORT}`);
    });
    server.on('error', () => {
      console.error('HTTP server could not start');
      void stopMaintenanceWorker().finally(() => prisma.$disconnect());
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
        void stopMaintenanceWorker()
          .finally(() => prisma.$disconnect())
          .finally(() => {
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
