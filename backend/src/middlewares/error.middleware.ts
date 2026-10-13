import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error.js';

export const notFound: RequestHandler = () => {
  throw new AppError(404, 'NOT_FOUND', 'Route not found');
};
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (res.headersSent) {
    _next(error);
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      message: error.message,
      error: { code: error.code, ...(error.details ? { details: error.details } : {}) },
    });
    return;
  }
  const type = error && typeof error === 'object' && 'type' in error ? error.type : undefined;
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    res.status(type === 'entity.too.large' ? 413 : 400).json({
      success: false,
      message: type === 'entity.too.large' ? 'Request body too large' : 'Malformed JSON',
      error: { code: 'BAD_REQUEST' },
    });
    return;
  }
  // Deliberately omit raw errors, request bodies, headers and Prisma query arguments.
  console.error(JSON.stringify({ event: 'request_failed', code: 'INTERNAL_SERVER_ERROR' }));
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: { code: 'INTERNAL_SERVER_ERROR' },
  });
};
