import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { globalRateLimiter } from './middlewares/rateLimiter.middleware';
import { APIError } from './errors/apiError';
import { APIResponse } from './utils/apiResponse';

const app = express();

// Security Headers
app.use(helmet());

const allowedOrigins = [
  "https://site-sync-rosy.vercel.app",
  "https://site-sync-proto.vercel.app",
  "http://localhost:5173",
];
// CORS configuration
app.use(
  cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGIN.includes('*') || env.CORS_ORIGIN.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request Parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// HTTP Request Logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Global Rate Limiting
app.use(globalRateLimiter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  return APIResponse.success(res, 'CRM Backend Service is healthy', {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// Mount Central API Routes
app.use('/api/v1', routes);
app.use('/api', routes);

// 404 Catch-all for undefined routes
app.use((req: Request, res: Response, next: NextFunction) => {
  next(APIError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
