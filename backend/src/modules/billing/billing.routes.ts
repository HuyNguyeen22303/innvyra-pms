import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { emptyQuery, idParams, idSchema } from '../../shared/validation/room-input.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthService } from '../auth/auth.service.js';
import type { BillingService } from './billing.service.js';
import { billingController } from './billing.controller.js';
import { billingPermissions, type BillingPermission } from './billing.types.js';
import {
  adjustmentBody,
  cancelOrderBody,
  createOrderBody,
  createServiceBody,
  emptyBody,
  idempotencyKey,
  ledgerQuery,
  orderQuery,
  paymentBody,
  refundBody,
  serviceQuery,
  updateServiceBody,
} from './billing.schema.js';

export function billingRoutes(service: BillingService, auth: AuthService, env: Env) {
  const router = Router();
  const c = billingController(service);
  const noStore: RequestHandler = (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
  const requireKey: RequestHandler = (req, _res, next) => {
    if (!idempotencyKey.safeParse(req.get('Idempotency-Key')).success)
      throw new AppError(
        422,
        'INVALID_IDEMPOTENCY_KEY',
        'A valid Idempotency-Key header is required',
      );
    next();
  };
  const add = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    permission: BillingPermission,
    controller: RequestHandler,
    options: { body?: z.ZodType; params?: z.ZodType; query?: z.ZodType; key?: boolean } = {},
  ) => {
    router[method](
      path,
      noStore,
      authenticate(auth),
      authorizeRoles(...billingPermissions[permission]),
      ...(method === 'get' ? [] : [csrfProtection(env)]),
      ...(options.key ? [requireKey] : []),
      validate(
        z.object({
          params: options.params ?? emptyQuery,
          query: options.query ?? emptyQuery,
          ...(method === 'get' ? {} : { body: options.body ?? emptyBody }),
        }),
      ),
      controller,
    );
  };
  add('get', '/services', 'read', c.services, { query: serviceQuery });
  add('post', '/services', 'catalog', c.createService, { body: createServiceBody });
  add('get', '/services/:id', 'read', c.service, { params: idParams });
  add('patch', '/services/:id', 'catalog', c.updateService, {
    params: idParams,
    body: updateServiceBody,
  });
  add('delete', '/services/:id', 'catalog', c.deactivate, { params: idParams });
  add('get', '/service-orders', 'read', c.orders, { query: orderQuery });
  add('post', '/service-orders', 'orders', c.createOrder, { body: createOrderBody });
  add('get', '/service-orders/:id', 'read', c.order, { params: idParams });
  add('post', '/service-orders/:id/complete', 'orders', c.complete, { params: idParams });
  add('post', '/service-orders/:id/cancel', 'orders', c.cancel, {
    params: idParams,
    body: cancelOrderBody,
  });
  const reservationParams = z.object({ reservationId: idSchema }).strict();
  add('post', '/reservations/:reservationId/folio/open', 'pay', c.open, {
    params: reservationParams,
  });
  add('get', '/reservations/:reservationId/folio', 'read', c.reservationFolio, {
    params: reservationParams,
  });
  add('get', '/folios/:id', 'read', c.folio, { params: idParams });
  add('get', '/folios/:id/items', 'read', c.items, { params: idParams, query: ledgerQuery });
  add('post', '/folios/:id/adjustments', 'settle', c.adjust, {
    params: idParams,
    body: adjustmentBody,
    key: true,
  });
  add('post', '/folios/:id/close', 'settle', c.close, { params: idParams });
  const folioParams = z.object({ folioId: idSchema }).strict();
  add('post', '/folios/:folioId/payments', 'pay', c.pay, {
    params: folioParams,
    body: paymentBody,
    key: true,
  });
  add('get', '/folios/:folioId/payments', 'read', c.payments, {
    params: folioParams,
    query: ledgerQuery,
  });
  add('post', '/payments/:id/refunds', 'settle', c.refund, {
    params: idParams,
    body: refundBody,
    key: true,
  });
  return router;
}
