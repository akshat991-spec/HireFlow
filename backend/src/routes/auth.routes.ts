import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AuthService } from '../services/auth.service.js';
import { authenticate, requireRecruiter } from '../middleware/auth.middleware.js';
import { ApiResponse, Role, UserPublic } from '../types/index.js';
import { ValidationError } from '../errors/AppError.js';
import { query } from '../db/index.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const messages = parseResult.error.errors.map((e) => e.message).join(', ');
      throw new ValidationError(messages, parseResult.error.format());
    }

    const { email, password } = parseResult.data;
    const { user, token } = await AuthService.login(email, password);

    // Set secure HTTP-only cookie
    res.cookie(config.sessionCookieName, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: config.isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const response: ApiResponse<{ user: UserPublic; token: string }> = {
      success: true,
      data: { user, token },
      message: 'Logged in successfully',
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
  });

  const response: ApiResponse<null> = {
    success: true,
    data: null,
    message: 'Logged out successfully',
  };

  res.status(200).json(response);
});

// GET /api/auth/me
authRouter.get('/me', authenticate, (req: Request, res: Response) => {
  const response: ApiResponse<typeof req.user> = {
    success: true,
    data: req.user,
    message: 'Authenticated user profile',
  };

  res.status(200).json(response);
});

// GET /api/auth/interviewers (Recruiters can list interviewers to assign)
authRouter.get('/interviewers', authenticate, requireRecruiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const interviewersRes = await query<UserPublic>(
      'SELECT id, name, email, role, created_at FROM users WHERE role = $1 ORDER BY name ASC',
      [Role.INTERVIEWER]
    );

    const response: ApiResponse<UserPublic[]> = {
      success: true,
      data: interviewersRes.rows,
      message: 'Available interviewers retrieved',
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});
