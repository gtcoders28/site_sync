import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  // Database
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('postgres'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().optional().default(''),
  DB_SSL: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return Boolean(val);
    }, z.boolean())
    .default(false),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // CORS
  CORS_ORIGIN: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        return val.split(',').map((o) => o.trim());
      }
      if (Array.isArray(val)) return val;
      return ['http://localhost:3000', 'http://localhost:5173'];
    }, z.array(z.string()))
    .default(['http://localhost:3000', 'http://localhost:5173']),

  // App settings
  ENABLE_DB_TRIGGERS: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() !== 'false';
      return Boolean(val);
    }, z.boolean())
    .default(true),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ FATAL CONFIGURATION ERROR: Invalid or missing environment variables:');
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type EnvConfig = typeof env;
export default env;
