import { Request, Response, NextFunction } from 'express';
import { APIError } from '../errors/apiError';
import env from '../config/env';

/**
 * Centralized error-handling middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // 1. Handle PostgreSQL Specific Errors
  if (err && err.code) {
    // Unique violation (23505)
    if (err.code === '23505') {
      const detail = err.detail || 'Duplicate key violation';
      error = APIError.conflict(`Duplicate value error: ${detail}`, 'DUPLICATE_ENTRY', {
        constraint: err.constraint,
      });
    }
    // Foreign key violation (23503)
    else if (err.code === '23503') {
      error = APIError.badRequest(
        'Referenced record does not exist or is constrained.',
        {
          constraint: err.constraint,
          detail: err.detail,
        },
        'FOREIGN_KEY_VIOLATION'
      );
    }
    // Check violation (23514)
    else if (err.code === '23514') {
      error = APIError.badRequest(
        `Data violates database integrity rule (${err.constraint || 'check constraint'}).`,
        {
          constraint: err.constraint,
        },
        'CHECK_CONSTRAINT_VIOLATION'
      );
    }
    // Custom PostgreSQL trigger RAISE EXCEPTION (P0001)
    else if (err.code === 'P0001') {
      const msg = err.message || 'Illegal database state transition';
      // Map illegal state machine transitions to 409 Conflict
      if (
        msg.toLowerCase().includes('terminal') ||
        msg.toLowerCase().includes('delivered') ||
        msg.toLowerCase().includes('cancelled') ||
        msg.toLowerCase().includes('cannot be') ||
        msg.toLowerCase().includes('illegal')
      ) {
        error = APIError.conflict(msg, 'ILLEGAL_STATE_TRANSITION');
      } else {
        error = APIError.badRequest(msg, null, 'TRIGGER_RULE_VIOLATION');
      }
    }
  }

  // 2. Handle JSON parse errors
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    error = APIError.badRequest('Malformed JSON payload received');
  }

  // 3. Fallback for unhandled unexpected errors
  if (!(error instanceof APIError)) {
    const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'An unexpected error occurred';
    error = APIError.internal(message);
    if (env.NODE_ENV !== 'test') {
      console.error('Unhandled System Error:', err);
    }
  }

  // Build standardized error response
  const statusCode = error.statusCode || 500;
  const response: Record<string, any> = {
    success: false,
    statusCode,
    errorCode: error.errorCode || 'INTERNAL_SERVER_ERROR',
    message: error.message || 'An error occurred',
  };

  if (error.details) {
    response.details = error.details;
  }

  if (env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

export default {
  errorHandler,
};
