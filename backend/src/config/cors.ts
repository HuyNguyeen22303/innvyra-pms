import type { CorsOptions } from 'cors';
import type { Env } from './env.js';
import { AppError } from '../shared/errors/app-error.js';

export function corsOptions(env: Env): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.includes(origin)) callback(null, true);
      else callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Protection', 'Idempotency-Key'],
    maxAge: 600,
  };
}
