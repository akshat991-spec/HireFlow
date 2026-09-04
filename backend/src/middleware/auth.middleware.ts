import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';
import { AuthService } from '../services/auth.service.js';
import { Role, AuthUserPayload } from '../types/index.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../errors/AppError.js';
import { query } from '../db/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

// Extracts JWT from cookie or Bearer header
export function extractToken(req: Request): string | null {
  if (req.cookies && req.cookies[config.sessionCookieName]) {
    return req.cookies[config.sessionCookieName];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

// Verifies JWT and attaches user to req.user
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = AuthService.verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
}

// Middleware factory — rejects if user's role isn't in the allowed list
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: requires ${allowedRoles.join(' or ')} role, your role is ${req.user.role}`
        )
      );
    }

    next();
  };
}

export const requireRecruiter = requireRole(Role.RECRUITER);
export const requireInterviewer = requireRole(Role.INTERVIEWER);

export type ApplicationPermission =
  | 'VIEW'
  | 'MODIFY_STAGE'
  | 'REJECT'
  | 'REINSTATE'
  | 'ASSIGN_INTERVIEWER'
  | 'LEAVE_FEEDBACK';

// Object-level access guard — recruiters pass freely, interviewers must be assigned to the application
export function requireApplicationAccess(
  permission: ApplicationPermission,
  dbQuery: typeof query = query
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const applicationId = req.params.id || req.params.applicationId;
      if (!applicationId) {
        return next();
      }

      const appRes = await dbQuery<{ id: string }>(
        'SELECT id FROM applications WHERE id = $1',
        [applicationId]
      );
      if (appRes.rows.length === 0) {
        throw new NotFoundError(`Application with ID '${applicationId}' not found`);
      }

      if (req.user.role === Role.RECRUITER) {
        return next();
      }

      if (req.user.role === Role.INTERVIEWER) {
        if (
          permission === 'MODIFY_STAGE' ||
          permission === 'REJECT' ||
          permission === 'REINSTATE'
        ) {
          throw new ForbiddenError(
            'Interviewers are not permitted to change, advance, reject, or reinstate application stages'
          );
        }

        if (permission === 'ASSIGN_INTERVIEWER') {
          throw new ForbiddenError(
            'Interviewers are not permitted to assign or manage interviewers'
          );
        }

        if (permission === 'VIEW' || permission === 'LEAVE_FEEDBACK') {
          const assignmentRes = await dbQuery<{ application_id: string }>(
            'SELECT application_id FROM application_interviewers WHERE application_id = $1 AND user_id = $2',
            [applicationId, req.user.id]
          );

          if (assignmentRes.rows.length === 0) {
            throw new ForbiddenError(
              'Access denied: Interviewers can only view and leave feedback on applications assigned to them'
            );
          }

          return next();
        }
      }

      throw new ForbiddenError('Access denied for this role and operation');
    } catch (error) {
      next(error);
    }
  };
}
