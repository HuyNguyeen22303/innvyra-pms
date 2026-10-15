import type { z } from 'zod';
import type { RoleCode } from '../../shared/types/roles.js';
import type { PrismaBillingRepository } from './billing.repository.js';
import type {
  adjustmentBody,
  createOrderBody,
  createServiceBody,
  ledgerQuery,
  orderQuery,
  paymentBody,
  refundBody,
  serviceQuery,
  updateServiceBody,
} from './billing.schema.js';

export type BillingScope = { hotelId: bigint; actorId: bigint; role: RoleCode };
export type CreateServiceInput = z.infer<typeof createServiceBody>;
export type UpdateServiceInput = z.infer<typeof updateServiceBody>;
export type CreateOrderInput = z.infer<typeof createOrderBody>;
export type AdjustmentInput = z.infer<typeof adjustmentBody>;
export type PaymentInput = z.infer<typeof paymentBody>;
export type RefundInput = z.infer<typeof refundBody>;
export type ServiceQuery = z.infer<typeof serviceQuery>;
export type OrderQuery = z.infer<typeof orderQuery>;
export type LedgerQuery = z.infer<typeof ledgerQuery>;
export const billingPermissions = {
  read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  catalog: ['ADMIN', 'MANAGER'],
  orders: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
  pay: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  settle: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
} as const;
export type BillingPermission = keyof typeof billingPermissions;
export type BillingRepository = Pick<PrismaBillingRepository, keyof PrismaBillingRepository>;
export type BillingOperations = Omit<BillingRepository, 'write' | 'snapshot'>;
