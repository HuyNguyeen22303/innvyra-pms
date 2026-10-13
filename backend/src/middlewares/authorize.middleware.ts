import type { RequestHandler } from 'express';
import type { RoleCode } from '../shared/types/roles.js';
import { AppError } from '../shared/errors/app-error.js';
import { requirePrincipal } from './authenticate.middleware.js';

export function authorizeRoles(...roles: RoleCode[]): RequestHandler {
  return (req, _res, next) => {
    const principal = requirePrincipal(req);
    if (!roles.includes(principal.user.role)) throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    next();
  };
}
