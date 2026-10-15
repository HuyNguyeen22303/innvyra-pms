import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { requirePrincipal } from '../../middlewares/authenticate.middleware.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { RoleCode } from '../../shared/types/roles.js';
import { paginationFields } from '../../shared/validation/room-input.js';

export type OperationsScope = { hotelId: bigint; actorId: bigint; role: RoleCode };
export const managers = ['ADMIN', 'MANAGER'] as const;
export const operationsReaders = [
  'ADMIN',
  'MANAGER',
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'TECHNICIAN',
] as const;
export const housekeepingReaders = ['ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'] as const;
export const requesters = ['ADMIN', 'MANAGER', 'RECEPTIONIST'] as const;
export const cleaners = ['ADMIN', 'MANAGER', 'HOUSEKEEPING'] as const;
export const technicians = ['ADMIN', 'MANAGER', 'TECHNICIAN'] as const;
export const notes = z.string().trim().min(1).max(2000);
export const emptyBody = z.object({}).strict().default({});
export const pageFields = {
  page: paginationFields.page,
  limit: paginationFields.limit,
  sortOrder: paginationFields.sortOrder,
};
export function allowed(scope: OperationsScope, roles: readonly RoleCode[]) {
  if (!roles.includes(scope.role)) throw new AppError(403, 'FORBIDDEN', 'Forbidden');
}
export function assignedActor(scope: OperationsScope, assignedTo: bigint | null) {
  // Managers may supervise, but cannot impersonate the assigned worker.
  if (assignedTo !== scope.actorId)
    throw new AppError(403, 'FORBIDDEN', 'Only the assigned staff member may perform this action');
}
export function conflict(code: string, message: string): never {
  throw new AppError(409, code, message);
}
export function operationHandler<B = object, Q = object>(
  message: string,
  action: (
    scope: OperationsScope,
    input: { body: B; query: Q; params: Record<string, string> },
  ) => Promise<unknown>,
  status = 200,
): RequestHandler {
  return async (req: Request, res) => {
    const { user } = requirePrincipal(req);
    const data = await action(
      { hotelId: BigInt(user.hotelId), actorId: BigInt(user.id), role: user.role },
      res.locals.validated,
    );
    res.status(status).json({ success: true, message, data });
  };
}
