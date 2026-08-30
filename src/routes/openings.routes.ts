import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate, requireRecruiter } from '../middleware/auth.middleware.js';
import { ApiResponse, Role, OpeningStatus, JobOpening } from '../types/index.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError.js';

export const openingsRouter = Router();

const openingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  department: z.string().min(1, 'Department is required'),
  description: z.string().min(1, 'Description is required'),
  status: z.nativeEnum(OpeningStatus).optional(),
});

// GET /api/openings - List openings (Recruiter sees all; Interviewers see openings with assigned candidates)
openingsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const includeArchived = req.query.includeArchived === 'true';

      let sql = 'SELECT id, title, department, description, status, created_at, updated_at FROM job_openings';
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (!includeArchived) {
        conditions.push(`status = 'OPEN'`);
      }

      if (user.role === Role.INTERVIEWER) {
        conditions.push(`
          id IN (
            SELECT a.job_opening_id 
            FROM applications a
            JOIN application_interviewers ai ON a.id = ai.application_id
            WHERE ai.user_id = $${paramIndex}
          )
        `);
        values.push(user.id);
        paramIndex++;
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query<JobOpening>(sql, values);

      const response: ApiResponse<JobOpening[]> = {
        success: true,
        data: result.rows,
        message: 'Job openings retrieved',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/openings - Create job opening (Recruiter only)
openingsRouter.post(
  '/',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = openingSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { title, department, description, status = OpeningStatus.OPEN } = parseResult.data;
      const id = Math.random().toString(36).substring(2, 15);
      const now = new Date();

      await query(
        `INSERT INTO job_openings (id, title, department, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, title, department, description, status, now, now]
      );

      const newOpening: JobOpening = {
        id,
        title,
        department,
        description,
        status,
        created_at: now,
        updated_at: now,
      };

      const response: ApiResponse<JobOpening> = {
        success: true,
        data: newOpening,
        message: 'Job opening created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/openings/:id - Edit job opening (Recruiter only)
openingsRouter.put(
  '/:id',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parseResult = openingSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { title, department, description, status } = parseResult.data;
      const now = new Date();

      const existing = await query<JobOpening>('SELECT id FROM job_openings WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError('Job opening not found');
      }

      await query(
        `UPDATE job_openings 
         SET title = $1, department = $2, description = $3, status = COALESCE($4, status), updated_at = $5
         WHERE id = $6`,
        [title, department, description, status || null, now, id]
      );

      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id },
        message: 'Job opening updated',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/openings/:id/archive - Archive opening (Recruiter only)
openingsRouter.post(
  '/:id/archive',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await query(
        `UPDATE job_openings SET status = 'ARCHIVED', updated_at = $1 WHERE id = $2`,
        [new Date(), id]
      );

      const response: ApiResponse<{ id: string; status: OpeningStatus }> = {
        success: true,
        data: { id, status: OpeningStatus.ARCHIVED },
        message: 'Job opening archived',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/openings/:id/restore - Restore opening (Recruiter only)
openingsRouter.post(
  '/:id/restore',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await query(
        `UPDATE job_openings SET status = 'OPEN', updated_at = $1 WHERE id = $2`,
        [new Date(), id]
      );

      const response: ApiResponse<{ id: string; status: OpeningStatus }> = {
        success: true,
        data: { id, status: OpeningStatus.OPEN },
        message: 'Job opening restored',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
