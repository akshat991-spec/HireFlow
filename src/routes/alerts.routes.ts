import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const alertsRouter = Router();

alertsRouter.get('/stalled', (req: Request, res: Response) => {
  const response: ApiResponse<{ count: number; alerts: unknown[] }> = {
    success: true,
    data: {
      count: 0,
      alerts: [],
    },
    message: 'Alerts endpoints initialized',
  };
  res.status(200).json(response);
});
