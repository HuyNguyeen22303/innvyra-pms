import type { RequestHandler } from 'express';
import type { Env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';

// A custom header forces preflight. Only exact trusted origins pass CORS.
// Non-browser clients (Postman/CLI) may omit Origin but still need the header.
export function csrfProtection(env: Env): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (
      req.get('x-csrf-protection') !== '1' ||
      (origin !== undefined && !env.allowedOrigins.includes(origin))
    ) {
      throw new AppError(403, 'CSRF_REJECTED', 'CSRF validation failed');
    }
    next();
  };
}
