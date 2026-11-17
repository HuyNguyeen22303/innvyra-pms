import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env.js';
import type { AuthService } from '../auth/auth.service.js';
import { authenticate } from '../../middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../middlewares/authorize.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { emptyQuery, idParams, idSchema } from '../../shared/validation/room-input.js';
import { AppError } from '../../shared/errors/app-error.js';
import { billingScope } from '../billing/billing.controller.js';
import { billingPermissions } from '../billing/billing.types.js';
import { idempotencyKey, ledgerQuery } from '../billing/billing.schema.js';
import { PaymentQrService } from './payment-qr.service.js';
import type { PrismaPaymentQrRepository } from './payment-qr.repository.js';
import {
  bankAccountBody,
  qrRequestBody,
  confirmQrBody,
  cancelQrBody,
  type BankAccountInput,
  type QrRequestInput,
  type ConfirmQrInput,
} from './payment-qr.schema.js';

export function paymentQrRoutes(
  repository: PrismaPaymentQrRepository,
  auth: AuthService,
  env: Env,
) {
  const router = Router(),
    service = new PaymentQrService(repository);
  const add = (
    method: 'get' | 'post' | 'put',
    path: string,
    schema: z.ZodType,
    handler: RequestHandler,
    admin = false,
    key = false,
  ) => {
    router[method](
      path,
      authenticate(auth),
      authorizeRoles(...(admin ? (['ADMIN'] as const) : billingPermissions.pay)),
      (_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      },
      ...(method === 'get' ? [] : [csrfProtection(env)]),
      (req, _res, next) => {
        if (key && !idempotencyKey.safeParse(req.get('Idempotency-Key')).success)
          throw new AppError(422, 'INVALID_IDEMPOTENCY_KEY', 'Cần Idempotency-Key hợp lệ');
        next();
      },
      validate(schema),
      handler,
    );
  };
  add('get', '/hotel/banks', z.object({ query: emptyQuery }), async (req, res) => {
    res.json({ success: true, data: await service.banks(billingScope(req)) });
  });
  add('get', '/hotel/bank-account', z.object({ query: emptyQuery }), async (req, res) => {
    res.json({ success: true, data: await service.account(billingScope(req)) });
  });
  add(
    'put',
    '/hotel/bank-account',
    z.object({ query: emptyQuery, body: bankAccountBody }),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.saveAccount(
          billingScope(req),
          res.locals.validated.body as BankAccountInput,
        ),
      });
    },
    true,
  );
  const reservationParams = z.object({ id: idSchema }).strict();
  add(
    'get',
    '/reservations/:id/payment-requests',
    z.object({ params: reservationParams, query: ledgerQuery }),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.list(
          billingScope(req),
          BigInt(req.params.id as string),
          res.locals.validated.query,
        ),
      });
    },
  );
  add(
    'post',
    '/reservations/:id/payment-requests',
    z.object({ params: reservationParams, query: emptyQuery, body: qrRequestBody }),
    async (req, res) => {
      res.status(201).json({
        success: true,
        data: await service.create(
          billingScope(req),
          BigInt(req.params.id as string),
          res.locals.validated.body as QrRequestInput,
          req.get('Idempotency-Key')!,
        ),
      });
    },
    false,
    true,
  );
  add(
    'get',
    '/payment-requests/:id',
    z.object({ params: idParams, query: emptyQuery }),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.detail(billingScope(req), BigInt(req.params.id as string)),
      });
    },
  );
  add(
    'post',
    '/payment-requests/:id/confirm',
    z.object({ params: idParams, query: emptyQuery, body: confirmQrBody }),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.confirm(
          billingScope(req),
          BigInt(req.params.id as string),
          res.locals.validated.body as ConfirmQrInput,
          req.get('Idempotency-Key')!,
        ),
      });
    },
    false,
    true,
  );
  add(
    'post',
    '/payment-requests/:id/cancel',
    z.object({ params: idParams, query: emptyQuery, body: cancelQrBody }),
    async (req, res) => {
      res.json({
        success: true,
        data: await service.cancel(
          billingScope(req),
          BigInt(req.params.id as string),
          res.locals.validated.body.reason,
          req.get('Idempotency-Key')!,
        ),
      });
    },
    false,
    true,
  );
  return router;
}
