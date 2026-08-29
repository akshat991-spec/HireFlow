import dotenv from 'dotenv';
import path from 'path';

// Load .env if present
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  secretKey: string;
  sessionCookieName: string;
  stalledThresholdDays: number;
  corsOrigin: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export const config: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/hireflow',
  secretKey: process.env.SECRET_KEY || 'dev-secret-key-hireflow-change-in-production',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'hireflow_session',
  stalledThresholdDays: parseInt(process.env.STALLED_THRESHOLD_DAYS || '10', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
