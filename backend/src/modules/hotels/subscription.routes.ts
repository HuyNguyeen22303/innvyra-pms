import { Router } from 'express';
import type { Env } from '../../config/env.js';
import {
  authenticatePlatform,
  requirePlatformPrincipal,
} from '../../middlewares/platform-authenticate.middleware.js';
import { csrfProtection } from '../../middlewares/csrf.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { getHotelSchema, ownHotelSchema } from './hotel.schema.js';
import {
  createPlanSchema,
  updatePlanSchema,
  recordPeriodSchema,
  statusSchema,
  type PlanInput,
  type MonthlyPeriodInput,
} from './subscription.schema.js';
import type { PlatformAuthService } from '../platform-auth/platform-auth.service.js';
import type { SubscriptionService } from './subscription.service.js';
export function platformSubscriptionRoutes(
  service: SubscriptionService,
  auth: PlatformAuthService,
  env: Env,
) {
  const router = Router();
  router.use(authenticatePlatform(auth));
  const actor = (req: Parameters<typeof requirePlatformPrincipal>[0]) =>
    BigInt(requirePlatformPrincipal(req).user.id);
  const csrf = csrfProtection(env);
  router.get('/plans', validate(ownHotelSchema), async (_req, res) => {
    res.json({ success: true, data: await service.plans() });
  });
  router.post('/plans', csrf, validate(createPlanSchema), async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.createPlan(actor(req), res.locals.validated.body as PlanInput),
    });
  });
  router.patch('/plans/:id', csrf, validate(updatePlanSchema), async (req, res) => {
    res.json({
      success: true,
      data: await service.updatePlan(
        actor(req),
        BigInt(req.params.id as string),
        res.locals.validated.body as Partial<Omit<PlanInput, 'code'>>,
      ),
    });
  });
  router.get('/hotels/:id/subscription', validate(getHotelSchema), async (req, res) => {
    res.json({ success: true, data: await service.summary(BigInt(req.params.id as string)) });
  });
  router.post(
    '/hotels/:id/subscription-periods',
    csrf,
    validate(recordPeriodSchema),
    async (req, res) => {
      res.status(201).json({
        success: true,
        data: await service.record(
          actor(req),
          BigInt(req.params.id as string),
          res.locals.validated.body as MonthlyPeriodInput,
        ),
      });
    },
  );
  router.patch('/hotels/:id/status', csrf, validate(statusSchema), async (req, res) => {
    const body = res.locals.validated.body as { status: 'ACTIVE' | 'SUSPENDED'; reason: string };
    res.json({
      success: true,
      data: await service.setStatus(
        actor(req),
        BigInt(req.params.id as string),
        body.status,
        body.reason,
      ),
    });
  });
  return router;
}
