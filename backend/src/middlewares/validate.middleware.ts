import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../shared/errors/app-error.js';

export function validate(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body as unknown,
      params: req.params,
      query: req.query,
    });
    if (!result.success)
      throw new AppError(
        422,
        'VALIDATION_ERROR',
        'Invalid request',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    // Express 5 query is a getter: keep parsed data in locals rather than assigning req.query.
    res.locals.validated = result.data;
    next();
  };
}
