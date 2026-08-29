import { Router, Request, Response } from 'express';
import { checkDbHealth } from '../db/index.js';
import { config } from '../config.js';
import { ApiResponse } from '../types/index.js';

export const healthRouter = Router();

healthRouter.get('/health', async (req: Request, res: Response) => {
  const dbHealth = await checkDbHealth();

  const response: ApiResponse<{
    status: string;
    environment: string;
    database: string;
    uptime: number;
    timestamp: string;
  }> = {
    success: true,
    data: {
      status: 'healthy',
      environment: config.nodeEnv,
      database: dbHealth.status === 'connected' ? 'connected' : `disconnected (${dbHealth.error || 'unknown'})`,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    message: 'HireFlow Backend Service is operational',
  };

  res.status(200).json(response);
});
