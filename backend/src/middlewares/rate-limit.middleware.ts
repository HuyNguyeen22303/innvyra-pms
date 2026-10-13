import { rateLimit } from 'express-rate-limit';
import type { Env } from '../config/env.js';

const message = { success: false, message: 'Too many requests', error: { code: 'RATE_LIMITED' } };
export function loginRateLimit(env: Env) {
  return rateLimit({
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: env.LOGIN_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
  });
}
export function refreshRateLimit(env: Env) {
  return rateLimit({
    windowMs: 60000,
    limit: env.REFRESH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
  });
}
