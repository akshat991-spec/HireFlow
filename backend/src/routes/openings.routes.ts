import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import { authenticate, requireRecruiter } from '../middleware/auth.middleware.js';
import { ApiResponse, Role, OpeningStatus, JobOpening, Application } from '../types/index.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors/AppError.js';

export const openingsRouter = Router();

const openingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  department: z.string().trim().min(1, 'Department is required'),
  description: z.string().trim().min(1, 'Description is required'),
  status: z.nativeEnum(OpeningStatus).optional(),
});

openingsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const includeArchived = req.query.includeArchived === 'true' || req.query.status === 'ALL';
      const statusFilter = req.query.status as string;

      let sql = `
        SELECT 
          j.id, 
          j.title, 
          j.department, 
          j.description, 
          j.status, 
          j.created_at, 
          j.updated_at,
          COUNT(a.id)::int as application_count,
          COUNT(CASE WHEN a.current_stage NOT IN ('HIRED', 'REJECTED') THEN 1 END)::int as active_count
        FROM job_openings j
        LEFT JOIN applications a ON j.id = a.job_opening_id
      `;

      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (statusFilter === 'ARCHIVED') {
        conditions.push(`j.status = 'ARCHIVED'`);
      } else if (statusFilter === 'OPEN') {
        conditions.push(`j.status = 'OPEN'`);
      } else if (!includeArchived) {

        conditions.push(`j.status = 'OPEN'`);
      }

      if (user.role === Role.INTERVIEWER) {
        conditions.push(`
          j.id IN (
            SELECT app.job_opening_id 
            FROM applications app
            JOIN application_interviewers ai ON app.id = ai.application_id
            WHERE ai.user_id = $${paramIndex}
          )
        `);
        values.push(user.id);
        paramIndex++;
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      sql += ` GROUP BY j.id, j.title, j.department, j.description, j.status, j.created_at, j.updated_at ORDER BY j.created_at DESC`;

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

openingsRouter.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      const openingRes = await query<JobOpening>(
        `SELECT id, title, department, description, status, created_at, updated_at 
         FROM job_openings 
         WHERE id = $1`,
        [id]
      );

      if (openingRes.rows.length === 0) {
        throw new NotFoundError(`Job opening with ID '${id}' not found`);
      }

      const opening = openingRes.rows[0];

      if (user.role === Role.INTERVIEWER) {
        const assignedCheck = await query<{ count: string }>(
          `SELECT COUNT(*)::text as count
           FROM applications a
           JOIN application_interviewers ai ON a.id = ai.application_id
           WHERE a.job_opening_id = $1 AND ai.user_id = $2`,
          [id, user.id]
        );

        if (parseInt(assignedCheck.rows[0]?.count || '0', 10) === 0) {
          throw new ForbiddenError(
            'Access denied: Interviewers cannot view openings where they have no assigned candidates'
          );
        }
      }

      let appSql = `
        SELECT 
          a.id,
          a.job_opening_id,
          a.candidate_name,
          a.candidate_email,
          a.source,
          a.notes,
          a.current_stage,
          a.applied_date,
          a.stage_entered_at,
          a.rejected_from_stage,
          a.created_at,
          a.updated_at
        FROM applications a
        WHERE a.job_opening_id = $1
      `;
      const appParams: unknown[] = [id];

      if (user.role === Role.INTERVIEWER) {
        appSql += ` AND a.id IN (SELECT application_id FROM application_interviewers WHERE user_id = $2)`;
        appParams.push(user.id);
      }

      appSql += ` ORDER BY a.applied_date DESC`;

      const appsRes = await query<Application>(appSql, appParams);
      opening.applications = appsRes.rows;
      opening.application_count = appsRes.rows.length;
      opening.active_count = appsRes.rows.filter(
        (a) => a.current_stage !== 'HIRED' && a.current_stage !== 'REJECTED'
      ).length;

      const response: ApiResponse<JobOpening> = {
        success: true,
        data: opening,
        message: 'Job opening details retrieved',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

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
      const id = 'job_' + Math.random().toString(36).substring(2, 11);
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
        application_count: 0,
        active_count: 0,
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
        throw new NotFoundError(`Job opening with ID '${id}' not found`);
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
        message: 'Job opening updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

openingsRouter.post(
  '/:id/archive',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await query<JobOpening>('SELECT id FROM job_openings WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError(`Job opening with ID '${id}' not found`);
      }

      const now = new Date();
      await query(
        `UPDATE job_openings SET status = 'ARCHIVED', updated_at = $1 WHERE id = $2`,
        [now, id]
      );

      const response: ApiResponse<{ id: string; status: OpeningStatus }> = {
        success: true,
        data: { id, status: OpeningStatus.ARCHIVED },
        message: 'Job opening archived. Applications have been preserved.',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

openingsRouter.post(
  '/:id/restore',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const existing = await query<JobOpening>('SELECT id FROM job_openings WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError(`Job opening with ID '${id}' not found`);
      }

      const now = new Date();
      await query(
        `UPDATE job_openings SET status = 'OPEN', updated_at = $1 WHERE id = $2`,
        [now, id]
      );

      const response: ApiResponse<{ id: string; status: OpeningStatus }> = {
        success: true,
        data: { id, status: OpeningStatus.OPEN },
        message: 'Job opening restored to active status.',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
