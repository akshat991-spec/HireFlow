import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const openingsRouter = Router();

openingsRouter.get('/', (req: Request, res: Response) => {
  const response: ApiResponse<unknown[]> = {
    success: true,
    data: [],
    message: 'Openings endpoints initialized',
  };
  res.status(200).json(response);
});
