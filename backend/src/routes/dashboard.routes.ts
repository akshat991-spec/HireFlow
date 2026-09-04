import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  ApiResponse,
  DashboardData,
  Stage,
  Role,
  PROGRESSION_STAGES,
} from '../types/index.js';
import { query } from '../db/index.js';

export const dashboardRouter = Router();

const STALLED_THRESHOLD_MS = 10 * 24 * 60 * 60 * 1000;

dashboardRouter.get(
  '/metrics',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const now = new Date();

      const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 1 is Monday...
      const diffToMonday = (dayOfWeek + 6) % 7;
      const startOfWeek = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 0, 0, 0, 0)
      );

      const startOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
      );

      const twelveWeeksAgo = new Date(startOfWeek.getTime() - 11 * 7 * 24 * 60 * 60 * 1000);
      const stalledCutoff = new Date(now.getTime() - STALLED_THRESHOLD_MS);

      const isInterviewer = req.user?.role === Role.INTERVIEWER;
      const userId = req.user?.id;

      const openPosQuery = isInterviewer
        ? query<{ count: string }>(
            `SELECT COUNT(DISTINCT a.job_opening_id)::text AS count 
             FROM applications a 
             JOIN application_interviewers ai ON a.id = ai.application_id 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' AND ai.user_id = $1`,
            [userId]
          )
        : query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM job_openings WHERE status = 'OPEN'`);

      const activeAppsQuery = isInterviewer
        ? query<{ count: string }>(
            `SELECT COUNT(*)::text AS count 
             FROM applications a 
             JOIN application_interviewers ai ON a.id = ai.application_id 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND ai.user_id = $1 
               AND a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')`,
            [userId]
          )
        : query<{ count: string }>(
            `SELECT COUNT(*)::text AS count 
             FROM applications a 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')`
          );

      const hiresQuery = isInterviewer
        ? query<{ count: string }>(
            `SELECT COUNT(*)::text AS count 
             FROM applications a 
             JOIN application_interviewers ai ON a.id = ai.application_id 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE a.current_stage = 'HIRED' 
               AND ai.user_id = $1 
               AND a.stage_entered_at >= $2`,
            [userId, startOfMonth.toISOString()]
          )
        : query<{ count: string }>(
            `SELECT COUNT(*)::text AS count 
             FROM applications a 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE a.current_stage = 'HIRED' 
               AND a.stage_entered_at >= $1`,
            [startOfMonth.toISOString()]
          );

      const interviewEventsQuery = isInterviewer
        ? query<{ application_id: string }>(
            `SELECT DISTINCT te.application_id 
             FROM timeline_events te 
             JOIN applications a ON te.application_id = a.id
             JOIN application_interviewers ai ON a.id = ai.application_id
             JOIN job_openings j ON a.job_opening_id = j.id
             WHERE j.status = 'OPEN' 
               AND ai.user_id = $1
               AND te.event_type = 'STAGE_CHANGE' 
               AND te.new_stage = 'INTERVIEW' 
               AND te.created_at >= $2`,
            [userId, startOfWeek.toISOString()]
          )
        : query<{ application_id: string }>(
            `SELECT DISTINCT te.application_id 
             FROM timeline_events te 
             JOIN applications a ON te.application_id = a.id
             JOIN job_openings j ON a.job_opening_id = j.id
             WHERE j.status = 'OPEN' 
               AND te.event_type = 'STAGE_CHANGE' 
               AND te.new_stage = 'INTERVIEW' 
               AND te.created_at >= $1`,
            [startOfWeek.toISOString()]
          );

      const currentInterviewAppsQuery = isInterviewer
        ? query<{ id: string }>(
            `SELECT a.id 
             FROM applications a 
             JOIN application_interviewers ai ON a.id = ai.application_id 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND ai.user_id = $1 
               AND a.current_stage = 'INTERVIEW'`,
            [userId]
          )
        : query<{ id: string }>(
            `SELECT a.id 
             FROM applications a 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND a.current_stage = 'INTERVIEW' 
               AND a.stage_entered_at >= $1`,
            [startOfWeek.toISOString()]
          );

      const [openPosRes, activeAppsRes, hiresRes, interviewEventsRes, currentInterviewAppsRes] = await Promise.all([
        openPosQuery,
        activeAppsQuery,
        hiresQuery,
        interviewEventsQuery,
        currentInterviewAppsQuery,
      ]);

      const openPositions = parseInt(openPosRes.rows[0]?.count || '0', 10);
      const activeApplications = parseInt(activeAppsRes.rows[0]?.count || '0', 10);
      const hiresThisMonth = parseInt(hiresRes.rows[0]?.count || '0', 10);

      const interviewAppIds = new Set<string>();
      interviewEventsRes.rows.forEach((r) => interviewAppIds.add(r.application_id));
      currentInterviewAppsRes.rows.forEach((r) => interviewAppIds.add(r.id));
      const interviewsThisWeek = interviewAppIds.size;

      const openingMetricsRes = isInterviewer
        ? await query<{
            job_opening_id: string;
            title: string;
            department: string;
            total_applications: string;
            active_applications: string;
          }>(
            `SELECT 
              j.id AS job_opening_id,
              j.title,
              j.department,
              COUNT(a.id)::text AS total_applications,
              COUNT(CASE WHEN a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER') THEN 1 END)::text AS active_applications
            FROM job_openings j
            JOIN applications a ON j.id = a.job_opening_id
            JOIN application_interviewers ai ON a.id = ai.application_id
            WHERE j.status = 'OPEN' AND ai.user_id = $1
            GROUP BY j.id, j.title, j.department
            ORDER BY COUNT(a.id) DESC, j.title ASC`,
            [userId]
          )
        : await query<{
            job_opening_id: string;
            title: string;
            department: string;
            total_applications: string;
            active_applications: string;
          }>(
            `SELECT 
              j.id AS job_opening_id,
              j.title,
              j.department,
              COUNT(a.id)::text AS total_applications,
              COUNT(CASE WHEN a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER') THEN 1 END)::text AS active_applications
            FROM job_openings j
            LEFT JOIN applications a ON j.id = a.job_opening_id
            WHERE j.status = 'OPEN'
            GROUP BY j.id, j.title, j.department
            ORDER BY COUNT(a.id) DESC, j.title ASC`
          );

      const byOpening = openingMetricsRes.rows.map((r) => ({
        jobOpeningId: r.job_opening_id,
        title: r.title,
        department: r.department,
        totalApplications: parseInt(r.total_applications || '0', 10),
        activeApplications: parseInt(r.active_applications || '0', 10),
      }));

      const stageCountsRes = isInterviewer
        ? await query<{
            stage: Stage;
            count: string;
          }>(
            `SELECT 
              a.current_stage AS stage,
              COUNT(*)::text AS count
            FROM applications a
            JOIN application_interviewers ai ON a.id = ai.application_id
            JOIN job_openings j ON a.job_opening_id = j.id
            WHERE j.status = 'OPEN' AND ai.user_id = $1
            GROUP BY a.current_stage`,
            [userId]
          )
        : await query<{
            stage: Stage;
            count: string;
          }>(
            `SELECT 
              a.current_stage AS stage,
              COUNT(*)::text AS count
            FROM applications a
            JOIN job_openings j ON a.job_opening_id = j.id
            WHERE j.status = 'OPEN'
            GROUP BY a.current_stage`
          );

      const stageCountsMap: Record<string, number> = {};
      let grandTotalApps = 0;
      stageCountsRes.rows.forEach((r) => {
        const count = parseInt(r.count || '0', 10);
        stageCountsMap[r.stage] = count;
        grandTotalApps += count;
      });

      const allStages: Stage[] = [
        Stage.APPLIED,
        Stage.SCREENING,
        Stage.INTERVIEW,
        Stage.OFFER,
        Stage.HIRED,
        Stage.REJECTED,
      ];

      const byStage = allStages.map((stage) => {
        const count = stageCountsMap[stage] || 0;
        const percentage = grandTotalApps > 0 ? Math.round((count / grandTotalApps) * 100) : 0;
        return {
          stage,
          count,
          percentage,
        };
      });

      const weeklyAppsRes = isInterviewer
        ? await query<{ applied_date: Date | string }>(
            `SELECT a.applied_date 
             FROM applications a 
             JOIN application_interviewers ai ON a.id = ai.application_id
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND ai.user_id = $1
               AND a.applied_date >= $2 
             ORDER BY a.applied_date ASC`,
            [userId, twelveWeeksAgo.toISOString()]
          )
        : await query<{ applied_date: Date | string }>(
            `SELECT a.applied_date 
             FROM applications a 
             JOIN job_openings j ON a.job_opening_id = j.id 
             WHERE j.status = 'OPEN' 
               AND a.applied_date >= $1 
             ORDER BY a.applied_date ASC`,
            [twelveWeeksAgo.toISOString()]
          );

      const weeklyTrend = [];
      for (let i = 0; i < 12; i++) {
        const bucketStart = new Date(twelveWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const bucketEnd = new Date(bucketStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        const monthName = bucketStart.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        const dayNum = bucketStart.getUTCDate();
        const weekLabel = `${monthName} ${dayNum}`;

        const count = weeklyAppsRes.rows.filter((r) => {
          const t = new Date(r.applied_date).getTime();
          return t >= bucketStart.getTime() && t < bucketEnd.getTime();
        }).length;

        weeklyTrend.push({
          weekLabel,
          weekStart: bucketStart.toISOString(),
          count,
        });
      }

      const stalledAppsRes = isInterviewer
        ? await query<{
            id: string;
            current_stage: Stage;
            stage_entered_at: Date | string;
          }>(
            `SELECT 
              a.id,
              a.current_stage,
              a.stage_entered_at
            FROM applications a
            JOIN application_interviewers ai ON a.id = ai.application_id
            JOIN job_openings j ON a.job_opening_id = j.id
            LEFT JOIN stalled_alert_dismissals sad 
              ON sad.application_id = a.id 
             AND sad.stage = a.current_stage 
             AND sad.stage_entered_at = a.stage_entered_at
            WHERE j.status = 'OPEN'
              AND ai.user_id = $1
              AND a.current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER')
              AND a.stage_entered_at <= $2
              AND sad.id IS NULL`,
            [userId, stalledCutoff.toISOString()]
          )
        : await query<{
            id: string;
            current_stage: Stage;
            stage_entered_at: Date | string;
          }>(
            `SELECT 
              a.id,
              a.current_stage,
              a.stage_entered_at
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
            [stalledCutoff.toISOString()]
          );

      const stalledByStage: Record<string, number> = {};
      let longestDays = 0;
      const nowTime = now.getTime();

      stalledAppsRes.rows.forEach((r) => {
        stalledByStage[r.current_stage] = (stalledByStage[r.current_stage] || 0) + 1;
        const days = Math.floor(Math.max(0, nowTime - new Date(r.stage_entered_at).getTime()) / (1000 * 60 * 60 * 24));
        if (days > longestDays) {
          longestDays = days;
        }
      });

      const stalledSummary = {
        totalStalled: stalledAppsRes.rows.length,
        longestDays,
        byStage: stalledByStage,
      };

      const dashboardData: DashboardData = {
        headline: {
          openPositions,
          activeApplications,
          interviewsThisWeek,
          hiresThisMonth,
        },
        byOpening,
        byStage,
        weeklyTrend,
        stalledSummary,
      };

      const response: ApiResponse<DashboardData> = {
        success: true,
        data: dashboardData,
        message: 'Recruiter dashboard metrics computed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
