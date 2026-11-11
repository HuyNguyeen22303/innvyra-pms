import type { Request, RequestHandler } from 'express';
import type { PlatformAuthService } from '../modules/platform-auth/platform-auth.service.js';
import { unauthorized } from '../shared/errors/app-error.js';

export function requirePlatformPrincipal(req: Request) {
  if (!req.platformPrincipal) throw unauthorized();
  return req.platformPrincipal;
}
export function authenticatePlatform(service: PlatformAuthService): RequestHandler {
  return async (req, _res, next) => {
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/i.exec(req.get('authorization') ?? '');
    if (!match?.[1] || match[1].length > 4096) throw unauthorized();
    req.platformPrincipal = await service.authenticate(match[1]);
    next();
  };
}
