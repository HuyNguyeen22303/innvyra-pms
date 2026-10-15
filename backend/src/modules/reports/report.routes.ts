import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  dashboardQuery,
  exportQuery,
  occupancyQuery,
  outstandingQuery,
  paymentQuery,
  periodQuery,
} from './report.schema.js';
import { reportController } from './report.controller.js';
import { ExportService } from './export.service.js';
import { reportRoles, type ReportService } from './report.service.js';

export function reportRoutes(service: ReportService, auth: AuthService, env: Env) {
  const router = Router(),
    c = reportController(service, new ExportService(service, env));
  router.use(authenticate(auth));
  const schemas = {
    dashboard: dashboardQuery,
    revenue: periodQuery,
    occupancy: occupancyQuery,
    reservations: periodQuery,
    payments: paymentQuery,
    operations: periodQuery,
    outstanding: outstandingQuery,
  };
  for (const type of Object.keys(schemas) as (keyof typeof schemas)[]) {
    router.get(
      '/' + type,
      authorizeRoles(...reportRoles[type]),
      validate(z.object({ query: schemas[type] })),
      c[type],
    );
  }
  router.get(
    '/export',
    authorizeRoles('ADMIN', 'MANAGER', 'ACCOUNTANT'),
    validate(z.object({ query: exportQuery })),
    c.export,
  );
  return router;
}
