import type { z } from 'zod';
import type { RoleCode } from '../../shared/types/roles.js';
import type { checkinBody, checkoutBody, transferBody, stayListQuery } from './stay.schema.js';
import type { PrismaStayRepository } from './stay.repository.js';

export type StayScope = { hotelId: bigint; actorId: bigint; role: RoleCode };
export type CheckinInput = z.infer<typeof checkinBody>;
export type CheckoutInput = z.infer<typeof checkoutBody>;
export type TransferInput = z.infer<typeof transferBody>;
export type StayQuery = z.infer<typeof stayListQuery>;
export const stayPermissions = {
  read: ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT'],
  write: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
} as const;
export type StayRepository = Pick<PrismaStayRepository, keyof PrismaStayRepository>;
export type StayOperations = Omit<StayRepository, 'withHotelLock' | 'list'>;
