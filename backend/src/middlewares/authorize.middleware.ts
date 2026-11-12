import type { RequestHandler } from 'express';
import type { RoleCode } from '../shared/types/roles.js';
import { AppError } from '../shared/errors/app-error.js';
import { requirePrincipal } from './authenticate.middleware.js';

export function authorizeHotelAccount(...roles: RoleCode[]): RequestHandler {
  return (req, _res, next) => {
    const principal = requirePrincipal(req);
    if (principal.user.mustChangePassword)
      throw new AppError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Change your temporary password before accessing hotel operations',
      );
    if (!roles.includes(principal.user.role)) throw new AppError(403, 'FORBIDDEN', 'Forbidden');
    next();
  };
}

export function authorizeRoles(...roles: RoleCode[]): RequestHandler {
  const account = authorizeHotelAccount(...roles);
  return (req, res, next) => {
    if (requirePrincipal(req).user.hotel?.status === 'SUSPENDED')
      throw new AppError(403, 'HOTEL_SUSPENDED', 'Hotel service is suspended; contact Innvyra');
    account(req, res, next);
  };
}
