import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError.js';
import { config } from '../config.js';
import { ApiErrorResponse } from '../types/index.js';

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const errorResponse: ApiErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    },
  };
  res.status(404).json(errorResponse);
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,

  next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  console.error('Unhandled server error:', err);
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
      details: config.isDevelopment ? err.stack : undefined,
    },
  };
  res.status(500).json(response);
}
