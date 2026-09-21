import rateLimit from 'express-rate-limit';
import env from '../config/env';
import { APIError } from '../errors/apiError';

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(APIError.tooManyRequests('Too many requests from this IP, please try again later.'));
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(APIError.tooManyRequests('Too many authentication attempts. Please try again in 15 minutes.'));
  },
});

export default {
  globalRateLimiter,
  authRateLimiter,
};
