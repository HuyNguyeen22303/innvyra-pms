import { Router } from 'express';
import type { Env } from '../config/env.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { RoomRepositories } from '../app.js';
import { roomTypeRoutes } from '../modules/room-types/room-type.routes.js';
import { RoomTypeService } from '../modules/room-types/room-type.service.js';
import { roomRoutes } from '../modules/rooms/room.routes.js';
import { RoomService } from '../modules/rooms/room.service.js';
import type { GuestRepository } from '../modules/guests/guest.types.js';
import { GuestService } from '../modules/guests/guest.service.js';
import { GuestCrypto } from '../modules/guests/guest.crypto.js';
import { guestRoutes } from '../modules/guests/guest.routes.js';
import type { ReservationRepository } from '../modules/reservations/reservation.types.js';
import { ReservationService } from '../modules/reservations/reservation.service.js';
import { reservationRoutes } from '../modules/reservations/reservation.routes.js';
import { stayRoutes } from '../modules/stays/stay.routes.js';
import { StayService } from '../modules/stays/stay.service.js';
import type { StayRepository } from '../modules/stays/stay.types.js';
import type { BillingRepository } from '../modules/billing/billing.types.js';
import { BillingService } from '../modules/billing/billing.service.js';
import { billingRoutes } from '../modules/billing/billing.routes.js';
import type { OperationsRepositories } from '../app.js';
import { HousekeepingService } from '../modules/housekeeping/housekeeping.service.js';
import { housekeepingRoutes } from '../modules/housekeeping/housekeeping.routes.js';
import { MaintenanceService } from '../modules/maintenance/maintenance.service.js';
import { MaintenanceBlockService } from '../modules/maintenance/maintenance-block.service.js';
import { maintenanceRoutes } from '../modules/maintenance/maintenance.routes.js';
import type { ReportRepository } from '../modules/reports/report.types.js';
import { ReportService } from '../modules/reports/report.service.js';
import { reportRoutes } from '../modules/reports/report.routes.js';
import type { EmployeeRepository } from '../modules/employees/employee.types.js';
import { EmployeeService } from '../modules/employees/employee.service.js';
import { employeeRoutes } from '../modules/employees/employee.routes.js';
import type { InventoryRepository } from '../modules/inventory/inventory.types.js';
import { InventoryService } from '../modules/inventory/inventory.service.js';
import { inventoryRoutes } from '../modules/inventory/inventory.routes.js';

export function apiRoutes(
  service: AuthService,
  env: Env,
  rooms: RoomRepositories,
  guests: GuestRepository,
  reservations: ReservationRepository,
  stays?: StayRepository,
  billing?: BillingRepository,
  operations?: OperationsRepositories,
  reports?: ReportRepository,
  employees?: EmployeeRepository,
  inventory?: InventoryRepository,
) {
  const router = Router();
  router.use('/auth', authRoutes(service, env));
  if (employees) router.use('/employees', employeeRoutes(new EmployeeService(employees), service, env));
  if (inventory) router.use('/inventory', inventoryRoutes(new InventoryService(inventory), service, env));
  if (reports) router.use('/reports', reportRoutes(new ReportService(reports, env), service, env));
  if (operations) {
    router.use(
      '/housekeeping',
      housekeepingRoutes(new HousekeepingService(operations.housekeeping), service, env),
    );
    router.use(
      '/maintenance',
      maintenanceRoutes(
        new MaintenanceService(operations.maintenance),
        new MaintenanceBlockService(operations.maintenance),
        service,
        env,
      ),
    );
  }
  if (billing) router.use(billingRoutes(new BillingService(billing), service, env));
  if (stays) router.use(stayRoutes(new StayService(stays), service, env));
  // Register the literal availability route before rooms/:id.
  router.use(reservationRoutes(new ReservationService(reservations, env), service, env));
  router.use('/room-types', roomTypeRoutes(new RoomTypeService(rooms.roomTypes), service, env));
  router.use('/rooms', roomRoutes(new RoomService(rooms.rooms), service, env));
  router.use('/guests', guestRoutes(new GuestService(guests, new GuestCrypto(env)), service, env));
  return router;
}
