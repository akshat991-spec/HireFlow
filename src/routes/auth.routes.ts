import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const authRouter = Router();

authRouter.get('/me', (req: Request, res: Response) => {
  const response: ApiResponse<null> = {
    success: true,
    data: null,
    message: 'Auth endpoints initialized',
  };
  res.status(200).json(response);
});
