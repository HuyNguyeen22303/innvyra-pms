import { Router } from 'express';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { EmployeeService } from './employee.service.js';
import { employeeController } from './employee.controller.js';
import { employeePermissions } from './employee.types.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdSchema,
  listEmployeesSchema,
} from './employee.schema.js';

export function employeeRoutes(service: EmployeeService, auth: AuthService, env: Env) {
  const router = Router();
  const controller = employeeController(service);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(authenticate(auth));
  router.get(
    '/',
    authorizeRoles(...employeePermissions.read),
    validate(listEmployeesSchema),
    controller.getEmployees,
  );
  router.post(
    '/',
    authorizeRoles(...employeePermissions.write),
    csrfProtection(env),
    validate(createEmployeeSchema),
    controller.createEmployee,
  );
  router.patch(
    '/:id',
    authorizeRoles(...employeePermissions.write),
    csrfProtection(env),
    validate(updateEmployeeSchema),
    controller.updateEmployee,
  );
  router.patch(
    '/:id/deactivate',
    authorizeRoles(...employeePermissions.deactivate),
    csrfProtection(env),
    validate(employeeIdSchema),
    controller.deactivateEmployee,
  );
  return router;
}
