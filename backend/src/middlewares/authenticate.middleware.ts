import type { Request, RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/auth.service.js';
import { unauthorized } from '../shared/errors/app-error.js';

export function requirePrincipal(req: Request) {
  if (!req.principal) throw unauthorized();
  return req.principal;
}
export function authenticate(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(req.get('authorization') ?? '');
    if (!match?.[1] || match[1].length > 4096) throw unauthorized();
    req.principal = await service.authenticate(match[1]);
    next();
  };
}
