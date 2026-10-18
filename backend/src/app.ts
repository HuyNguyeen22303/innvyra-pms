import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import type { Env } from './config/env.js';
import { corsOptions } from './config/cors.js';
import { openApiDocument } from './config/swagger.js';
import { errorHandler, notFound } from './middlewares/error.middleware.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { apiRoutes } from './routes/index.js';
import type { RoomTypeRepository } from './modules/room-types/room-type.types.js';
import type { RoomRepository } from './modules/rooms/room.types.js';
import type { GuestRepository } from './modules/guests/guest.types.js';
import type { ReservationRepository } from './modules/reservations/reservation.types.js';
import type { StayRepository } from './modules/stays/stay.types.js';
import type { BillingRepository } from './modules/billing/billing.types.js';
import type { HousekeepingRepository } from './modules/housekeeping/housekeeping.types.js';
import type { MaintenanceRepository } from './modules/maintenance/maintenance.types.js';
import type { ReportRepository } from './modules/reports/report.types.js';
import type { EmployeeRepository } from './modules/employees/employee.types.js';
import type { InventoryRepository } from './modules/inventory/inventory.types.js';
export type OperationsRepositories = {
  housekeeping: HousekeepingRepository;
  maintenance: MaintenanceRepository;
};

export type RoomRepositories = { roomTypes: RoomTypeRepository; rooms: RoomRepository };

export function createApp(
  env: Env,
  repository: AuthRepository,
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
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
  app.use(
    helmet({
      ...(env.NODE_ENV !== 'production' ? { strictTransportSecurity: false } : {}),
      contentSecurityPolicy: {
        directives: { upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null },
      },
    }),
  );
  app.use(cors(corsOptions(env)));
  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      swaggerOptions: { persistAuthorization: false, withCredentials: true },
    }),
  );
  app.use(
    '/api/v1',
    apiRoutes(
      new AuthService(repository, env),
      env,
      rooms,
      guests,
      reservations,
      stays,
      billing,
      operations,
      reports,
      employees,
      inventory,
    ),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
