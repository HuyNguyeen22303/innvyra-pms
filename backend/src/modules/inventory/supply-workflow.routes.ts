import { Router, type Request } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { authenticate, requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { idSchema, paginationFields } from '../../shared/validation/room-input.js';
import { periodQuery } from '../reports/report.schema.js';
import {
  materialPresetBody,
  reconciliationBody,
  reconcileReceiptBody,
  supplierPaymentBody,
  type SupplierPaymentInput,
} from './supply-workflow.schema.js';
import type { SupplyWorkflow } from './supply-workflow.service.js';
const scope = (req: Request) => {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
};
const params = z.object({ id: idSchema }).strict();
const empty = z.object({}).strict();
const financial = ['ADMIN', 'MANAGER', 'ACCOUNTANT'] as const;
export function supplyWorkflowRoutes(service: SupplyWorkflow, auth: AuthService, env: Env) {
  const router = Router();
  const protect = authenticate(auth);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const csrf = csrfProtection(env);
  router.get(
    '/room-types/:id/housekeeping-materials',
    protect,
    authorizeRoles('ADMIN', 'MANAGER', 'HOUSEKEEPING'),
    validate(z.object({ params, query: empty })),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.presets(scope(req), BigInt(req.params.id as string)),
      });
    },
  );
  router.put(
    '/room-types/:id/housekeeping-materials',
    protect,
    authorizeRoles('ADMIN', 'MANAGER'),
    csrf,
    validate(z.object({ params, query: empty, body: materialPresetBody })),
    async (req, res) => {
      const { body } = res.locals.validated as { body: z.infer<typeof materialPresetBody> };
      res.json({
        success: true,
        data: await service.setPresets(scope(req), BigInt(req.params.id as string), body.materials),
      });
    },
  );
  router.get(
    '/inventory/receipts/:id/settlement',
    protect,
    authorizeRoles(...financial),
    validate(z.object({ params, query: empty })),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.settlement(scope(req), BigInt(req.params.id as string)),
      });
    },
  );
  router.post(
    '/inventory/receipts/:id/payments',
    protect,
    authorizeRoles(...financial),
    csrf,
    validate(z.object({ params, query: empty, body: supplierPaymentBody })),
    async (req, res) => {
      const { body } = res.locals.validated as { body: SupplierPaymentInput };
      res
        .status(201)
        .json({
          success: true,
          data: await service.pay(scope(req), BigInt(req.params.id as string), body),
        });
    },
  );
  router.post(
    '/inventory/supplier-payments/:id/reverse',
    protect,
    authorizeRoles(...financial),
    csrf,
    validate(z.object({ params, query: empty, body: reconciliationBody })),
    async (req, res) => {
      const { body } = res.locals.validated as { body: { reason: string } };
      res.json({
        success: true,
        data: await service.reverse(scope(req), BigInt(req.params.id as string), body.reason),
      });
    },
  );
  router.post(
    '/inventory/receipts/:id/reconcile',
    protect,
    authorizeRoles(...financial),
    csrf,
    validate(z.object({ params, query: empty, body: reconcileReceiptBody })),
    async (req, res) => {
      const { body } = res.locals.validated as { body: z.infer<typeof reconcileReceiptBody> };
      res.json({
        success: true,
        data: await service.reconcile(
          scope(req),
          BigInt(req.params.id as string),
          body.reason,
          body.payment,
        ),
      });
    },
  );
  const financeQuery = periodQuery
    .extend({ page: paginationFields.page, limit: paginationFields.limit })
    .strict();
  router.get(
    '/reports/supplier-finance',
    protect,
    authorizeRoles(...financial),
    validate(z.object({ query: financeQuery })),
    async (req, res) => {
      const { query } = res.locals.validated as { query: z.infer<typeof financeQuery> };
      res.json({ success: true, data: await service.supplierFinance(scope(req), query) });
    },
  );
  return router;
}
