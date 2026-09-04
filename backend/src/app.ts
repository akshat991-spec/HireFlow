import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile, server-to-server)
      if (!origin) return callback(null, true);

      const configured = config.corsOrigin.split(',').map((s) => s.trim());
      const isAllowed =
        configured.includes(origin) ||
        configured.includes('*') ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        origin.endsWith('.vercel.app');

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api', apiRouter);

  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'HireFlow API is running successfully!',
      environment: config.nodeEnv,
      health: '/api/health',
      documentation: 'https://github.com/akshat991-spec/HireFlow',
    });
  });

  const prodPublicDir = path.resolve(process.cwd(), 'dist/public');
  const devFrontendDir = path.resolve(process.cwd(), 'frontend');
  const staticDir = fs.existsSync(prodPublicDir) ? prodPublicDir : devFrontendDir;

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      const indexPath = path.join(staticDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      next();
    });
  }

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}
