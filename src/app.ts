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

  // Standard middleware
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API router
  app.use('/api', apiRouter);

  // Serve static frontend in production (dist/public) or fallback to frontend/
  const prodPublicDir = path.resolve(process.cwd(), 'dist/public');
  const devFrontendDir = path.resolve(process.cwd(), 'frontend');
  const staticDir = fs.existsSync(prodPublicDir) ? prodPublicDir : devFrontendDir;

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));

    // Client-side fallback for SPA routing
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

  // 404 handler for unmatched API routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
