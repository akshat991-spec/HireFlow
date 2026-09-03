import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRecruiter } from '../middleware/auth.middleware.js';
import { ApiResponse, Stage, StalledAlert, UserPublic, Role } from '../types/index.js';
import { NotFoundError } from '../errors/AppError.js';
import { query } from '../db/index.js';

export const alertsRouter = Router();

const STALLED_THRESHOLD_DAYS = 10;
const ACTIVE_STAGES: Stage[] = [Stage.APPLIED, Stage.SCREENING, Stage.INTERVIEW, Stage.OFFER];

// GET /api/alerts/stalled — Retrieve all active, un-dismissed stalled application alerts (Recruiter only)
alertsRouter.get(
  '/stalled',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cutoffDate = new Date(Date.now() - STALLED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      // Query active applications whose current stage entered timestamp is older than threshold
      // and whose specific (application_id, current_stage, stage_entered_at) period has not been dismissed
      const result = await query<{
        application_id: string;
        candidate_name: string;
        candidate_email: string;
        job_opening_id: string;
        job_title: string;
        department: string;
        current_stage: Stage;
        applied_date: Date | string;
        stage_entered_at: Date | string;
        source: string;
      }>(
            `SELECT 
              a.id AS application_id,
              a.candidate_name,
              a.candidate_email,
              a.job_opening_id,
              j.title AS job_title,
              j.department,
              a.current_stage,
              a.applied_date,
              a.stage_entered_at,
              a.source
            FROM applications a
            JOIN job_openings j ON a.job_opening_id = j.id
            LEFT JOIN stalled_alert_dismissals sad 
              ON sad.application_id = a.id 
             AND sad.stage = a.current_stage 
             AND sad.stage_entered_at = a.stage_entered_at
            WHERE j.status = 'OPEN'
              AND a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')
              AND a.stage_entered_at <= $1
              AND sad.id IS NULL
            ORDER BY a.stage_entered_at ASC`,
            [cutoffDate.toISOString()]
          );

      // Collect application IDs to fetch panel interviewers
      const appIds = result.rows.map((r) => r.application_id);
      const interviewersMap: Record<string, UserPublic[]> = {};

      if (appIds.length > 0) {
        const intvResult = await query<{
          application_id: string;
          id: string;
          name: string;
          email: string;
          role: any;
        }>(
          `SELECT ai.application_id, u.id, u.name, u.email, u.role
           FROM application_interviewers ai
           JOIN users u ON ai.user_id = u.id
           WHERE ai.application_id = ANY($1::varchar[])
           ORDER BY u.name ASC`,
          [appIds]
        );

        for (const row of intvResult.rows) {
          if (!interviewersMap[row.application_id]) {
            interviewersMap[row.application_id] = [];
          }
          interviewersMap[row.application_id].push({
            id: row.id,
            name: row.name,
            email: row.email,
            role: row.role,
          });
        }
      }

      const now = Date.now();
      const alerts: StalledAlert[] = result.rows.map((row) => {
        const stageEnteredTime = new Date(row.stage_entered_at).getTime();
        const diffMs = Math.max(0, now - stageEnteredTime);
        const daysInStage = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: `alert_${row.application_id}_${row.current_stage}_${stageEnteredTime}`,
          applicationId: row.application_id,
          candidateName: row.candidate_name,
          candidateEmail: row.candidate_email,
          jobOpeningId: row.job_opening_id,
          jobTitle: row.job_title,
          department: row.department,
          currentStage: row.current_stage,
          stageEnteredAt: new Date(row.stage_entered_at).toISOString(),
          daysInStage,
          thresholdDays: STALLED_THRESHOLD_DAYS,
          source: row.source,
          appliedDate: new Date(row.applied_date).toISOString(),
          interviewers: interviewersMap[row.application_id] || [],
        };
      });

      const response: ApiResponse<{ count: number; thresholdDays: number; alerts: StalledAlert[] }> = {
        success: true,
        data: {
          count: alerts.length,
          thresholdDays: STALLED_THRESHOLD_DAYS,
          alerts,
        },
        message: `Retrieved ${alerts.length} stalled application alerts`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/alerts/count — Lightweight endpoint for navbar / sidebar badge
alertsRouter.get(
  '/count',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cutoffDate = new Date(Date.now() - STALLED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      const result = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
        FROM applications a
        JOIN job_openings j ON a.job_opening_id = j.id
        LEFT JOIN stalled_alert_dismissals sad 
          ON sad.application_id = a.id 
         AND sad.stage = a.current_stage 
         AND sad.stage_entered_at = a.stage_entered_at
        WHERE j.status = 'OPEN'
          AND a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')
          AND a.stage_entered_at <= $1
          AND sad.id IS NULL`,
        [cutoffDate.toISOString()]
      );

      const count = parseInt(result.rows[0]?.count || '0', 10);

      const response: ApiResponse<{ count: number }> = {
        success: true,
        data: { count },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/alerts/stalled/:applicationId/dismiss — Dismiss an alert for the candidate's current stage period
alertsRouter.post(
  '/stalled/:applicationId/dismiss',
  authenticate,
  requireRecruiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const user = req.user!;

      // Retrieve application to verify existence and get current stage and stage_entered_at
      const appResult = await query<{
        id: string;
        candidate_name: string;
        current_stage: Stage;
        stage_entered_at: Date;
      }>(
        `SELECT id, candidate_name, current_stage, stage_entered_at 
         FROM applications 
         WHERE id = $1`,
        [applicationId]
      );

      if (appResult.rows.length === 0) {
        throw new NotFoundError(`Application with ID '${applicationId}' was not found`);
      }

      const app = appResult.rows[0];
      const dismissalId = `dsm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Insert dismissal referencing the specific stage-period
      await query(
        `INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at, dismissed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (application_id, stage, stage_entered_at) DO NOTHING`,
        [
          dismissalId,
          app.id,
          user.id,
          app.current_stage,
          app.stage_entered_at,
          new Date(),
        ]
      );

      const response: ApiResponse<{
        dismissed: boolean;
        applicationId: string;
        candidateName: string;
        stage: Stage;
        stageEnteredAt: Date;
      }> = {
        success: true,
        data: {
          dismissed: true,
          applicationId: app.id,
          candidateName: app.candidate_name,
          stage: app.current_stage,
          stageEnteredAt: app.stage_entered_at,
        },
        message: `Stalled alert dismissed for ${app.candidate_name} in ${app.current_stage} stage`,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
