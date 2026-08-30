import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/index.js';
import {
  authenticate,
  requireRecruiter,
  requireApplicationAccess,
} from '../middleware/auth.middleware.js';
import {
  ApiResponse,
  Role,
  Stage,
  EventType,
  Application,
  TimelineEvent,
  UserPublic,
} from '../types/index.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  IllegalStageTransitionError,
} from '../errors/AppError.js';

export const applicationsRouter = Router();

// GET /api/applications - List applications with server-side RBAC scoping
applicationsRouter.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string || '20', 10)));
      const offset = (page - 1) * pageSize;

      const search = (req.query.search as string || '').trim();
      const stage = req.query.stage as string;
      const jobOpeningId = req.query.jobOpeningId as string;
      const source = req.query.source as string;
      const sortBy = req.query.sortBy as string || 'applied_date';
      const sortOrder = (req.query.sortOrder as string || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Build WHERE clauses
      const conditions: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      // Server-side RBAC filter: Interviewers only see assigned candidates
      if (user.role === Role.INTERVIEWER) {
        conditions.push(`
          a.id IN (
            SELECT ai.application_id 
            FROM application_interviewers ai 
            WHERE ai.user_id = $${paramIndex}
          )
        `);
        values.push(user.id);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(a.candidate_name ILIKE $${paramIndex} OR a.candidate_email ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      if (stage) {
        conditions.push(`a.current_stage = $${paramIndex}`);
        values.push(stage);
        paramIndex++;
      }

      if (jobOpeningId) {
        conditions.push(`a.job_opening_id = $${paramIndex}`);
        values.push(jobOpeningId);
        paramIndex++;
      }

      if (source) {
        conditions.push(`a.source = $${paramIndex}`);
        values.push(source);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Validate sort column
      const allowedSortColumns: Record<string, string> = {
        applied_date: 'a.applied_date',
        current_stage: 'a.current_stage',
        updated_at: 'a.updated_at',
        candidate_name: 'a.candidate_name',
      };
      const orderColumn = allowedSortColumns[sortBy] || 'a.applied_date';

      // Count query
      const countSql = `SELECT COUNT(*) as total FROM applications a ${whereClause}`;
      const countRes = await query<{ total: string }>(countSql, values);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      // Data query
      const dataSql = `
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
          a.updated_at,
          j.title as job_title,
          j.department
        FROM applications a
        JOIN job_openings j ON a.job_opening_id = j.id
        ${whereClause}
        ORDER BY ${orderColumn} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const dataValues = [...values, pageSize, offset];
      const dataRes = await query<Application>(dataSql, dataValues);

      const response: ApiResponse<{
        items: Application[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }> = {
        success: true,
        data: {
          items: dataRes.rows,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
        message: 'Applications retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/applications/:id - Detailed view with timeline and assigned panel
applicationsRouter.get(
  '/:id',
  authenticate,
  requireApplicationAccess('VIEW'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;

      // Fetch application details
      const appRes = await query<Application>(
        `SELECT 
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
          a.updated_at,
          j.title as job_title,
          j.department
        FROM applications a
        JOIN job_openings j ON a.job_opening_id = j.id
        WHERE a.id = $1`,
        [applicationId]
      );

      if (appRes.rows.length === 0) {
        throw new NotFoundError(`Application with ID '${applicationId}' not found`);
      }

      const application = appRes.rows[0];

      // Fetch assigned interviewers
      const interviewersRes = await query<UserPublic>(
        `SELECT u.id, u.name, u.email, u.role, ai.assigned_at as created_at
         FROM application_interviewers ai
         JOIN users u ON ai.user_id = u.id
         WHERE ai.application_id = $1
         ORDER BY u.name ASC`,
        [applicationId]
      );

      // Fetch immutable timeline events
      const timelineRes = await query<TimelineEvent>(
        `SELECT 
          t.id,
          t.application_id,
          t.event_type,
          t.actor_id,
          u.name as actor_name,
          u.role as actor_role,
          t.old_stage,
          t.new_stage,
          t.note_content,
          t.created_at
        FROM timeline_events t
        LEFT JOIN users u ON t.actor_id = u.id
        WHERE t.application_id = $1
        ORDER BY t.created_at ASC`,
        [applicationId]
      );

      const response: ApiResponse<{
        application: Application;
        interviewers: UserPublic[];
        timeline: TimelineEvent[];
      }> = {
        success: true,
        data: {
          application,
          interviewers: interviewersRes.rows,
          timeline: timelineRes.rows,
        },
        message: 'Application details retrieved',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const stageChangeSchema = z.object({
  targetStage: z.nativeEnum(Stage, {
    errorMap: () => ({ message: 'Invalid target stage' }),
  }),
  note: z.string().optional(),
});

// POST /api/applications/:id/stage - Advance stage (Recruiter only)
applicationsRouter.post(
  '/:id/stage',
  authenticate,
  requireApplicationAccess('MODIFY_STAGE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;
      const user = req.user!;

      const parseResult = stageChangeSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { targetStage, note } = parseResult.data;

      // Fetch current application
      const currentRes = await query<Application>(
        'SELECT id, current_stage, rejected_from_stage FROM applications WHERE id = $1',
        [applicationId]
      );

      if (currentRes.rows.length === 0) {
        throw new NotFoundError('Application not found');
      }

      const currentApp = currentRes.rows[0];
      const currentStage = currentApp.current_stage;

      // Pipeline linear order check
      const PROGRESSION_ORDER = [
        Stage.APPLIED,
        Stage.SCREENING,
        Stage.INTERVIEW,
        Stage.OFFER,
        Stage.HIRED,
      ];

      const currentIndex = PROGRESSION_ORDER.indexOf(currentStage);
      const targetIndex = PROGRESSION_ORDER.indexOf(targetStage);

      if (currentStage === Stage.REJECTED) {
        throw new IllegalStageTransitionError(
          'Cannot advance a rejected application directly. You must reinstate the candidate first.'
        );
      }

      if (targetStage === Stage.REJECTED) {
        throw new IllegalStageTransitionError(
          'Use the reject endpoint to reject an application.'
        );
      }

      if (currentIndex === -1 || targetIndex === -1 || targetIndex !== currentIndex + 1) {
        throw new IllegalStageTransitionError(
          `Illegal stage transition from '${currentStage}' to '${targetStage}'. Applications must progress linearly: Applied → Screening → Interview → Offer → Hired.`
        );
      }

      const now = new Date();

      // Update application
      await query(
        `UPDATE applications 
         SET current_stage = $1, stage_entered_at = $2, updated_at = $2 
         WHERE id = $3`,
        [targetStage, now, applicationId]
      );

      // Record immutable timeline event
      const eventId = Math.random().toString(36).substring(2, 15);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          applicationId,
          EventType.STAGE_CHANGE,
          user.id,
          currentStage,
          targetStage,
          note || `Stage changed from ${currentStage} to ${targetStage}`,
          now,
        ]
      );

      const response: ApiResponse<{ id: string; current_stage: Stage }> = {
        success: true,
        data: { id: applicationId, current_stage: targetStage },
        message: `Candidate stage moved to ${targetStage}`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/applications/:id/reject - Reject application (Recruiter only)
applicationsRouter.post(
  '/:id/reject',
  authenticate,
  requireApplicationAccess('REJECT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;
      const user = req.user!;
      const note = (req.body.note as string || '').trim();

      const currentRes = await query<Application>(
        'SELECT id, current_stage FROM applications WHERE id = $1',
        [applicationId]
      );

      if (currentRes.rows.length === 0) {
        throw new NotFoundError('Application not found');
      }

      const currentStage = currentRes.rows[0].current_stage;
      if (currentStage === Stage.REJECTED) {
        throw new IllegalStageTransitionError('Application is already rejected');
      }

      const now = new Date();

      // Update application keeping rejected_from_stage
      await query(
        `UPDATE applications 
         SET current_stage = 'REJECTED', 
             rejected_from_stage = $1, 
             stage_entered_at = $2, 
             updated_at = $2 
         WHERE id = $3`,
        [currentStage, now, applicationId]
      );

      // Record immutable timeline event
      const eventId = Math.random().toString(36).substring(2, 15);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          applicationId,
          EventType.REJECTION,
          user.id,
          currentStage,
          Stage.REJECTED,
          note || `Application marked as rejected from ${currentStage}`,
          now,
        ]
      );

      const response: ApiResponse<{ id: string; current_stage: Stage; rejected_from_stage: Stage }> = {
        success: true,
        data: {
          id: applicationId,
          current_stage: Stage.REJECTED,
          rejected_from_stage: currentStage,
        },
        message: 'Application marked as rejected',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/applications/:id/reinstate - Reinstate application (Recruiter only)
applicationsRouter.post(
  '/:id/reinstate',
  authenticate,
  requireApplicationAccess('REINSTATE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;
      const user = req.user!;
      const note = (req.body.note as string || '').trim();

      const currentRes = await query<Application>(
        'SELECT id, current_stage, rejected_from_stage FROM applications WHERE id = $1',
        [applicationId]
      );

      if (currentRes.rows.length === 0) {
        throw new NotFoundError('Application not found');
      }

      const app = currentRes.rows[0];
      if (app.current_stage !== Stage.REJECTED) {
        throw new IllegalStageTransitionError('Only rejected applications can be reinstated');
      }

      const restoreStage = app.rejected_from_stage;
      if (!restoreStage) {
        throw new IllegalStageTransitionError(
          'Cannot determine prior stage to restore candidate to'
        );
      }

      const now = new Date();

      // Restore exact stage
      await query(
        `UPDATE applications 
         SET current_stage = $1, 
             rejected_from_stage = NULL, 
             stage_entered_at = $2, 
             updated_at = $2 
         WHERE id = $3`,
        [restoreStage, now, applicationId]
      );

      // Record immutable timeline event
      const eventId = Math.random().toString(36).substring(2, 15);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          applicationId,
          EventType.REINSTATEMENT,
          user.id,
          Stage.REJECTED,
          restoreStage,
          note || `Application reinstated back to ${restoreStage}`,
          now,
        ]
      );

      const response: ApiResponse<{ id: string; current_stage: Stage }> = {
        success: true,
        data: {
          id: applicationId,
          current_stage: restoreStage,
        },
        message: `Application reinstated to ${restoreStage}`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const assignInterviewerSchema = z.object({
  userId: z.string().min(1, 'Interviewer userId is required'),
});

// POST /api/applications/:id/interviewers - Assign interviewer to panel (Recruiter only)
applicationsRouter.post(
  '/:id/interviewers',
  authenticate,
  requireApplicationAccess('ASSIGN_INTERVIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;
      const actor = req.user!;

      const parseResult = assignInterviewerSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('userId is required');
      }

      const { userId } = parseResult.data;

      // Server-side validation: Verify user exists and has INTERVIEWER role
      const userRes = await query<UserPublic>(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [userId]
      );

      if (userRes.rows.length === 0) {
        throw new NotFoundError(`User with ID '${userId}' not found`);
      }

      const targetUser = userRes.rows[0];
      if (targetUser.role !== Role.INTERVIEWER) {
        throw new ValidationError(
          `Cannot assign user with role '${targetUser.role}'. Only users with the INTERVIEWER role may be assigned to an interview panel.`
        );
      }

      const now = new Date();

      // Insert assignment (upsert or ignore duplicate)
      await query(
        `INSERT INTO application_interviewers (application_id, user_id, assigned_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (application_id, user_id) DO NOTHING`,
        [applicationId, userId, now]
      );

      // Record timeline event
      const eventId = Math.random().toString(36).substring(2, 15);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          eventId,
          applicationId,
          EventType.INTERVIEWER_ASSIGNED,
          actor.id,
          `Assigned ${targetUser.name} (${targetUser.email}) to interview panel`,
          now,
        ]
      );

      const response: ApiResponse<{ applicationId: string; interviewer: UserPublic }> = {
        success: true,
        data: {
          applicationId,
          interviewer: targetUser,
        },
        message: 'Interviewer assigned to panel successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/applications/:id/interviewers/:userId - Remove interviewer from panel (Recruiter only)
applicationsRouter.delete(
  '/:id/interviewers/:userId',
  authenticate,
  requireApplicationAccess('ASSIGN_INTERVIEWER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: applicationId, userId } = req.params;
      const actor = req.user!;

      await query(
        'DELETE FROM application_interviewers WHERE application_id = $1 AND user_id = $2',
        [applicationId, userId]
      );

      // Record timeline event
      const eventId = Math.random().toString(36).substring(2, 15);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          eventId,
          applicationId,
          EventType.INTERVIEWER_REMOVED,
          actor.id,
          `Removed interviewer with ID ${userId} from interview panel`,
          new Date(),
        ]
      );

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Interviewer removed from panel',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const feedbackSchema = z.object({
  feedback: z.string().min(1, 'Feedback text cannot be empty'),
});

// POST /api/applications/:id/feedback - Leave interviewer feedback (Assigned Interviewer or Recruiter)
applicationsRouter.post(
  '/:id/feedback',
  authenticate,
  requireApplicationAccess('LEAVE_FEEDBACK'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;
      const actor = req.user!;

      const parseResult = feedbackSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Feedback text is required');
      }

      const { feedback } = parseResult.data;

      // Fetch current application stage
      const currentRes = await query<Application>(
        'SELECT current_stage FROM applications WHERE id = $1',
        [applicationId]
      );
      const currentStage = currentRes.rows[0]?.current_stage;

      const now = new Date();
      const eventId = Math.random().toString(36).substring(2, 15);

      // Record immutable feedback in timeline
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          eventId,
          applicationId,
          EventType.INTERVIEWER_FEEDBACK,
          actor.id,
          currentStage,
          currentStage,
          feedback,
          now,
        ]
      );

      const response: ApiResponse<{ id: string; event_type: EventType; note_content: string }> = {
        success: true,
        data: {
          id: eventId,
          event_type: EventType.INTERVIEWER_FEEDBACK,
          note_content: feedback,
        },
        message: 'Interviewer feedback recorded in application timeline',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
