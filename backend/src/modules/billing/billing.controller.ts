import type { Request, RequestHandler } from 'express';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import type { BillingService } from './billing.service.js';
import type {
  AdjustmentInput,
  BillingScope,
  CreateOrderInput,
  CreateServiceInput,
  LedgerQuery,
  OrderQuery,
  PaymentInput,
  RefundInput,
  ServiceQuery,
  UpdateServiceInput,
} from './billing.types.js';

export const billingScope = (req: Request): BillingScope => {
  const { user } = requirePrincipal(req);
  return { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role };
};
type Input<B = object, Q = object> = { body: B; query: Q; params: Record<string, string> };
function handler<B = object, Q = object>(
  message: string,
  action: (scope: BillingScope, input: Input<B, Q>, key: string) => Promise<unknown>,
  status = 200,
): RequestHandler {
  return async (req, res) => {
    const data = await action(
      billingScope(req),
      res.locals.validated as Input<B, Q>,
      req.get('Idempotency-Key') ?? '',
    );
    res.status(status).json({ success: true, message, data });
  };
}
export function billingController(service: BillingService) {
  return {
    services: handler<object, ServiceQuery>('Services retrieved', (scope, { query }) =>
      service.listServices(scope, query),
    ),
    service: handler('Service retrieved', (scope, { params }) =>
      service.getService(scope, BigInt(params.id!)),
    ),
    createService: handler<CreateServiceInput>(
      'Service created',
      (scope, { body }) => service.createService(scope, body),
      201,
    ),
    updateService: handler<UpdateServiceInput>('Service updated', (scope, { params, body }) =>
      service.updateService(scope, BigInt(params.id!), body),
    ),
    deactivate: handler('Service deactivated', (scope, { params }) =>
      service.updateService(scope, BigInt(params.id!), { isActive: false }),
    ),
    orders: handler<object, OrderQuery>('Service orders retrieved', (scope, { query }) =>
      service.listOrders(scope, query),
    ),
    order: handler('Service order retrieved', (scope, { params }) =>
      service.getOrder(scope, BigInt(params.id!)),
    ),
    createOrder: handler<CreateOrderInput>(
      'Service order created',
      (scope, { body }) => service.createOrder(scope, body),
      201,
    ),
    complete: handler('Service order completed', (scope, { params }) =>
      service.completeOrder(scope, BigInt(params.id!)),
    ),
    cancel: handler<{ reason: string }>('Service order cancelled', (scope, { params, body }) =>
      service.cancelOrder(scope, BigInt(params.id!), body.reason),
    ),
    open: handler('Folio opened or retrieved', (scope, { params }) =>
      service.openFolio(scope, BigInt(params.reservationId!)),
    ),
    reservationFolio: handler('Folio retrieved', (scope, { params }) =>
      service.getFolio(scope, BigInt(params.reservationId!), true),
    ),
    folio: handler('Folio retrieved', (scope, { params }) =>
      service.getFolio(scope, BigInt(params.id!)),
    ),
    items: handler<object, LedgerQuery>('Folio items retrieved', (scope, { params, query }) =>
      service.listItems(scope, BigInt(params.id!), query),
    ),
    adjust: handler<AdjustmentInput>(
      'Adjustment recorded',
      (scope, { params, body }, key) => service.adjust(scope, BigInt(params.id!), body, key),
      201,
    ),
    close: handler('Folio closed', (scope, { params }) =>
      service.closeFolio(scope, BigInt(params.id!)),
    ),
    payments: handler<object, LedgerQuery>('Payments retrieved', (scope, { params, query }) =>
      service.listPayments(scope, BigInt(params.folioId!), query),
    ),
    pay: handler<PaymentInput>(
      'Payment recorded',
      (scope, { params, body }, key) =>
        service.recordPayment(scope, BigInt(params.folioId!), body, key),
      201,
    ),
    refund: handler<RefundInput>(
      'Refund recorded',
      (scope, { params, body }, key) => service.refund(scope, BigInt(params.id!), body, key),
      201,
    ),
  };
}
