import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const applicationsRouter = Router();

applicationsRouter.get('/', (req: Request, res: Response) => {
  const response: ApiResponse<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
  }> = {
    success: true,
    data: {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    },
    message: 'Applications endpoints initialized',
  };
  res.status(200).json(response);
});
