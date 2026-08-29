import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const dashboardRouter = Router();

dashboardRouter.get('/metrics', (req: Request, res: Response) => {
  const response: ApiResponse<{
    openPositions: number;
    activeApplications: number;
    interviewsThisWeek: number;
    hiresThisMonth: number;
    byOpening: unknown[];
    byStage: unknown[];
    weeklyTrend: unknown[];
  }> = {
    success: true,
    data: {
      openPositions: 0,
      activeApplications: 0,
      interviewsThisWeek: 0,
      hiresThisMonth: 0,
      byOpening: [],
      byStage: [],
      weeklyTrend: [],
    },
    message: 'Dashboard metrics initialized',
  };
  res.status(200).json(response);
});
