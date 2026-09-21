import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { APIError } from '../errors/apiError';

export type ValidationSource = 'body' | 'query' | 'params';

/**
 * Zod schema validation middleware for Express
 */
export const validate = (schema: ZodSchema, source: ValidationSource = 'body') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req[source] || {});
      try {
        req[source] = parsed;
      } catch {
        Object.defineProperty(req, source, {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (err: any) {
      console.error(`Validation error on [${source}] for ${req.originalUrl}:`, err);
      const issues = err.errors || err.issues;
      if (issues && Array.isArray(issues)) {
        const details = issues.map((e: any) => ({
          field: (e.path || []).join('.'),
          message: e.message,
        }));
        return next(APIError.badRequest('Validation failed', details, 'VALIDATION_ERROR'));
      }
      return next(APIError.badRequest(err.message || 'Invalid request data'));
    }
  };
};

export default {
  validate,
};
