import { createApp } from '../../src/app.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Env } from '../../src/config/env.js';
import { PrismaAuthRepository } from '../../src/modules/auth/auth.repository.js';
import { PrismaPlatformAuthRepository } from '../../src/modules/platform-auth/platform-auth.repository.js';
import { PrismaRoomRepository } from '../../src/modules/rooms/room.repository.js';
import { PrismaRoomTypeRepository } from '../../src/modules/room-types/room-type.repository.js';
import { PrismaGuestRepository } from '../../src/modules/guests/guest.repository.js';
import { PrismaReservationRepository } from '../../src/modules/reservations/reservation.repository.js';
import { PrismaStayRepository } from '../../src/modules/stays/stay.repository.js';
import { PrismaBillingRepository } from '../../src/modules/billing/billing.repository.js';
import { PrismaHousekeepingRepository } from '../../src/modules/housekeeping/housekeeping.repository.js';
import { PrismaMaintenanceRepository } from '../../src/modules/maintenance/maintenance.repository.js';
import { PrismaReportRepository } from '../../src/modules/reports/report.repository.js';
import { PrismaEmployeeRepository } from '../../src/modules/employees/employee.repository.js';
import { PrismaInventoryRepository } from '../../src/modules/inventory/inventory.repository.js';
import { HotelManagementService } from '../../src/modules/hotels/hotel.service.js';

// Same real repositories and middleware as server.ts, with no mock service.
export function phase6App(prisma: PrismaClient, env: Env) {
  return createApp(
    env,
    new PrismaAuthRepository(prisma),
    {
      rooms: new PrismaRoomRepository(prisma),
      roomTypes: new PrismaRoomTypeRepository(prisma),
    },
    new PrismaGuestRepository(prisma),
    new PrismaReservationRepository(prisma),
    new PrismaStayRepository(prisma),
    new PrismaBillingRepository(prisma),
    {
      housekeeping: new PrismaHousekeepingRepository(prisma),
      maintenance: new PrismaMaintenanceRepository(prisma),
    },
    new PrismaReportRepository(prisma),
    new PrismaEmployeeRepository(prisma),
    new PrismaInventoryRepository(prisma),
    new PrismaPlatformAuthRepository(prisma),
    new HotelManagementService(prisma),
  );
}
