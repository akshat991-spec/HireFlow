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

      if (stage === 'ACTIVE' || req.query.status === 'active') {
        conditions.push(`a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')`);
      } else if (stage) {
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
        stage: 'a.current_stage',
        updated_at: 'a.updated_at',
        last_updated: 'a.updated_at',
        candidate_name: 'a.candidate_name',
        candidate_email: 'a.candidate_email',
        source: 'a.source',
      };
      const orderColumn = allowedSortColumns[sortBy.toLowerCase()] || 'a.applied_date';

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

      if (dataRes.rows.length > 0) {
        const appIds = dataRes.rows.map((a) => a.id);
        const placeholders = appIds.map((_, i) => `$${i + 1}`).join(',');
        const interviewersRes = await query<{
          application_id: string;
          id: string;
          name: string;
          email: string;
          role: Role;
        }>(
          `SELECT ai.application_id, u.id, u.name, u.email, u.role
           FROM application_interviewers ai
           JOIN users u ON ai.user_id = u.id
           WHERE ai.application_id IN (${placeholders})
           ORDER BY u.name ASC`,
          appIds
        );

        const map: Record<string, UserPublic[]> = {};
        for (const row of interviewersRes.rows) {
          if (!map[row.application_id]) map[row.application_id] = [];
          map[row.application_id].push({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
          });
        }

        for (const appItem of dataRes.rows) {
          appItem.interviewers = map[appItem.id] || [];
        }
      }

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

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /api/applications/export - Export applications across all OPEN job openings as CSV (Recruiter only)
applicationsRouter.get(
  '/export',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query applications across all OPEN job openings
      const exportSql = `
        SELECT 
          a.id,
          a.candidate_name,
          a.candidate_email,
          a.source,
          a.notes,
          a.current_stage,
          a.applied_date,
          j.title as job_title,
          j.department as job_department
        FROM applications a
        JOIN job_openings j ON a.job_opening_id = j.id
        WHERE j.status = 'OPEN'
        ORDER BY j.title ASC, a.applied_date DESC
      `;

      const dataRes = await query<{
        id: string;
        candidate_name: string;
        candidate_email: string;
        source: string;
        notes: string | null;
        current_stage: Stage;
        applied_date: Date;
        job_title: string;
        job_department: string;
      }>(exportSql);

      // Fetch interviewer assignments for these applications
      let interviewersMap: Record<string, string[]> = {};
      if (dataRes.rows.length > 0) {
        const appIds = dataRes.rows.map((a) => a.id);
        const placeholders = appIds.map((_, i) => `$${i + 1}`).join(',');
        const intvRes = await query<{
          application_id: string;
          name: string;
        }>(
          `SELECT ai.application_id, u.name
           FROM application_interviewers ai
           JOIN users u ON ai.user_id = u.id
           WHERE ai.application_id IN (${placeholders})
           ORDER BY u.name ASC`,
          appIds
        );

        for (const row of intvRes.rows) {
          if (!interviewersMap[row.application_id]) {
            interviewersMap[row.application_id] = [];
          }
          interviewersMap[row.application_id].push(row.name);
        }
      }

      // Build CSV headers and rows
      const headers = [
        'Application ID',
        'Candidate Name',
        'Candidate Email',
        'Job Title',
        'Department',
        'Current Stage',
        'Source',
        'Applied Date',
        'Interview Panel',
        'Notes',
      ];

      const csvRows: string[] = [headers.map(escapeCsvCell).join(',')];

      for (const app of dataRes.rows) {
        const panelStr = (interviewersMap[app.id] || []).join('; ');
        const appliedDateStr = app.applied_date
          ? new Date(app.applied_date).toISOString()
          : '';

        const row = [
          app.id,
          app.candidate_name,
          app.candidate_email,
          app.job_title,
          app.job_department,
          app.current_stage,
          app.source,
          appliedDateStr,
          panelStr,
          app.notes || '',
        ];

        csvRows.push(row.map(escapeCsvCell).join(','));
      }

      const csvContent = csvRows.join('\r\n');
      const filename = `hireflow_pipeline_export_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
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

// GET /api/applications/:id/timeline - Dedicated application timeline endpoint
applicationsRouter.get(
  '/:id/timeline',
  authenticate,
  requireApplicationAccess('VIEW'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = req.params.id;

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

      const response: ApiResponse<TimelineEvent[]> = {
        success: true,
        data: timelineRes.rows,
        message: 'Application timeline retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const applicationSchema = z.object({
  job_opening_id: z.string().min(1, 'Job opening ID is required'),
  candidate_name: z.string().trim().min(1, 'Candidate name is required'),
  candidate_email: z.string().email('Invalid email address'),
  source: z.string().trim().min(1, 'Source is required'),
  notes: z.string().optional(),
});

const editApplicationSchema = z.object({
  candidate_name: z.string().trim().min(1, 'Candidate name is required'),
  candidate_email: z.string().email('Invalid email address'),
  source: z.string().trim().min(1, 'Source is required'),
  notes: z.string().optional(),
});

// POST /api/applications - Create a new application (Recruiter only)
applicationsRouter.post(
  '/',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parseResult = applicationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { job_opening_id, candidate_name, candidate_email, source, notes } = parseResult.data;

      const openingRes = await query(
        'SELECT id FROM job_openings WHERE id = $1',
        [job_opening_id]
      );
      if (openingRes.rows.length === 0) {
        throw new NotFoundError(`Job opening with ID '${job_opening_id}' not found`);
      }

      const id = 'app_' + Math.random().toString(36).substring(2, 11);
      const now = new Date();
      const initialStage = Stage.APPLIED;

      await query(
        `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage, applied_date, stage_entered_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8, $8)`,
        [id, job_opening_id, candidate_name, candidate_email, source, notes || null, initialStage, now]
      );

      const eventId = 'evt_' + Math.random().toString(36).substring(2, 11);
      await query(
        `INSERT INTO timeline_events (id, application_id, event_type, actor_id, new_stage, note_content, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          eventId,
          id,
          EventType.APPLICATION_CREATED,
          user.id,
          initialStage,
          `Application created by ${user.name}`,
          now,
        ]
      );

      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id },
        message: 'Application created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/applications/:id - Edit an application (Recruiter only)
applicationsRouter.put(
  '/:id',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parseResult = editApplicationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { candidate_name, candidate_email, source, notes } = parseResult.data;

      const existing = await query('SELECT id FROM applications WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        throw new NotFoundError(`Application with ID '${id}' not found`);
      }

      const now = new Date();

      await query(
        `UPDATE applications 
         SET candidate_name = $1, candidate_email = $2, source = $3, notes = $4, updated_at = $5
         WHERE id = $6`,
        [candidate_name, candidate_email, source, notes || null, now, id]
      );

      const response: ApiResponse<{ id: string }> = {
        success: true,
        data: { id },
        message: 'Application updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const bulkActionSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1, 'At least one application must be selected'),
  note: z.string().optional(),
});

// POST /api/applications/bulk/advance - Bulk advance applications to their next linear stages (Recruiter only)
applicationsRouter.post(
  '/bulk/advance',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parseResult = bulkActionSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { applicationIds, note } = parseResult.data;
      const PipelineService = (await import('../services/PipelineService.js')).PipelineService;
      const summary = await PipelineService.bulkAdvance(user, applicationIds, note);

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        message: `Processed bulk advance for ${summary.total} application(s): ${summary.successful} succeeded, ${summary.refused} refused`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/applications/bulk/reject - Bulk reject applications (Recruiter only)
applicationsRouter.post(
  '/bulk/reject',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parseResult = bulkActionSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.errors.map((e) => e.message).join(', ')
        );
      }

      const { applicationIds, note } = parseResult.data;
      const PipelineService = (await import('../services/PipelineService.js')).PipelineService;
      const summary = await PipelineService.bulkReject(user, applicationIds, note);

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        message: `Processed bulk reject for ${summary.total} application(s): ${summary.successful} succeeded, ${summary.refused} refused`,
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

      const PipelineService = (await import('../services/PipelineService.js')).PipelineService;
      const finalStage = await PipelineService.advance(user, applicationId, targetStage, note);

      const response: ApiResponse<{ id: string; current_stage: Stage }> = {
        success: true,
        data: { id: applicationId, current_stage: finalStage },
        message: `Candidate stage moved to ${finalStage}`,
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

      const PipelineService = (await import('../services/PipelineService.js')).PipelineService;
      const result = await PipelineService.reject(user, applicationId, note);

      const response: ApiResponse<{ id: string; current_stage: Stage; rejected_from_stage: Stage }> = {
        success: true,
        data: {
          id: applicationId,
          current_stage: result.currentStage,
          rejected_from_stage: result.rejectedFromStage,
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

      const PipelineService = (await import('../services/PipelineService.js')).PipelineService;
      const restoreStage = await PipelineService.reinstate(user, applicationId, note);

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
  userId: z.string().optional(),
  userIds: z.array(z.string().min(1)).optional(),
}).refine((data) => !!data.userId || (Array.isArray(data.userIds) && data.userIds.length > 0), {
  message: 'Either userId or userIds must be provided',
});

// POST /api/applications/:id/interviewers - Assign one or multiple interviewers to panel (Recruiter only)
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
        throw new ValidationError('userId or userIds array is required');
      }

      const targetIds = Array.from(
        new Set(
          parseResult.data.userIds || (parseResult.data.userId ? [parseResult.data.userId] : [])
        )
      );

      // Verify all users exist and have INTERVIEWER role
      const usersToAssign: UserPublic[] = [];
      for (const uid of targetIds) {
        const userRes = await query<UserPublic>(
          'SELECT id, name, email, role FROM users WHERE id = $1',
          [uid]
        );

        if (userRes.rows.length === 0) {
          throw new NotFoundError(`User with ID '${uid}' not found`);
        }

        const targetUser = userRes.rows[0];
        if (targetUser.role !== Role.INTERVIEWER) {
          throw new ValidationError(
            `Cannot assign user with role '${targetUser.role}'. Only users with the INTERVIEWER role may be assigned to an interview panel.`
          );
        }
        usersToAssign.push(targetUser);
      }

      // Check existing assignments to prevent duplicates
      const existingRes = await query<{ user_id: string }>(
        'SELECT user_id FROM application_interviewers WHERE application_id = $1',
        [applicationId]
      );
      const existingSet = new Set(existingRes.rows.map((r) => r.user_id));

      const now = new Date();
      const newlyAssigned: UserPublic[] = [];

      for (const targetUser of usersToAssign) {
        if (!existingSet.has(targetUser.id)) {
          // Insert assignment
          await query(
            `INSERT INTO application_interviewers (application_id, user_id, assigned_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (application_id, user_id) DO NOTHING`,
            [applicationId, targetUser.id, now]
          );

          // Record immutable timeline event
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
          newlyAssigned.push(targetUser);
        }
      }

      const response: ApiResponse<{
        applicationId: string;
        interviewer: UserPublic;
        assigned: UserPublic[];
        newlyAssignedCount: number;
      }> = {
        success: true,
        data: {
          applicationId,
          interviewer: usersToAssign[0],
          assigned: usersToAssign,
          newlyAssignedCount: newlyAssigned.length,
        },
        message: newlyAssigned.length > 0
          ? `Successfully assigned ${newlyAssigned.length} interviewer(s) to panel`
          : 'Interviewer(s) are already assigned to this application',
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
