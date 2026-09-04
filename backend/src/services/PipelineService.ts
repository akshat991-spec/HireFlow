import { query } from '../db/index.js';
import { Application, Stage, Role, EventType, UserPublic } from '../types/index.js';
import { IllegalStageTransitionError, ForbiddenError, NotFoundError } from '../errors/AppError.js';

const PROGRESSION_ORDER = [
  Stage.APPLIED,
  Stage.SCREENING,
  Stage.INTERVIEW,
  Stage.OFFER,
  Stage.HIRED,
];

// Pure validation layer — throws before any DB write
export class PipelineStateMachine {
  // Only recruiters can trigger stage changes
  static validateRole(userRole: Role) {
    if (userRole !== Role.RECRUITER) {
      throw new ForbiddenError('Only recruiters can perform stage transitions');
    }
  }

  // Must be exactly one step forward in the progression order
  static advanceStage(userRole: Role, currentStage: Stage, targetStage: Stage) {
    this.validateRole(userRole);

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

    const currentIndex = PROGRESSION_ORDER.indexOf(currentStage);
    const targetIndex = PROGRESSION_ORDER.indexOf(targetStage);

    if (currentIndex === -1 || targetIndex === -1 || targetIndex !== currentIndex + 1) {
      throw new IllegalStageTransitionError(
        `Illegal stage transition from '${currentStage}' to '${targetStage}'. Applications must progress linearly: Applied → Screening → Interview → Offer → Hired.`
      );
    }
  }

  // Ensures the app isn't already rejected
  static reject(userRole: Role, currentStage: Stage) {
    this.validateRole(userRole);

    if (currentStage === Stage.REJECTED) {
      throw new IllegalStageTransitionError('Application is already rejected');
    }
  }

  // App must be REJECTED and have a known prior stage to return to
  static reinstate(userRole: Role, currentStage: Stage, rejectedFromStage: Stage | null) {
    this.validateRole(userRole);

    if (currentStage !== Stage.REJECTED) {
      throw new IllegalStageTransitionError('Only rejected applications can be reinstated');
    }

    if (!rejectedFromStage) {
      throw new IllegalStageTransitionError(
        'Cannot determine prior stage to restore candidate to'
      );
    }
  }
}

// Executes DB writes — validates first, then updates stage and appends an immutable timeline event
export class PipelineService {
  // Advances to next stage and records a STAGE_CHANGE event
  static async advance(user: UserPublic, applicationId: string, targetStage: Stage, note?: string) {
    const currentRes = await query<Application>(
      'SELECT id, current_stage, rejected_from_stage FROM applications WHERE id = $1',
      [applicationId]
    );

    if (currentRes.rows.length === 0) {
      throw new NotFoundError('Application not found');
    }

    const currentApp = currentRes.rows[0];
    PipelineStateMachine.advanceStage(user.role, currentApp.current_stage, targetStage);

    const now = new Date();

    await query(
      `UPDATE applications 
       SET current_stage = $1, stage_entered_at = $2, updated_at = $2 
       WHERE id = $3`,
      [targetStage, now, applicationId]
    );

    const eventId = 'evt_' + Math.random().toString(36).substring(2, 11);
    await query(
      `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        eventId,
        applicationId,
        EventType.STAGE_CHANGE,
        user.id,
        currentApp.current_stage,
        targetStage,
        note || `Stage changed from ${currentApp.current_stage} to ${targetStage}`,
        now,
      ]
    );

    return targetStage;
  }

  // Rejects and records which stage it came from (needed for reinstatement)
  static async reject(user: UserPublic, applicationId: string, note?: string) {
    const currentRes = await query<Application>(
      'SELECT id, current_stage FROM applications WHERE id = $1',
      [applicationId]
    );

    if (currentRes.rows.length === 0) {
      throw new NotFoundError('Application not found');
    }

    const currentStage = currentRes.rows[0].current_stage;
    PipelineStateMachine.reject(user.role, currentStage);

    const now = new Date();

    await query(
      `UPDATE applications 
       SET current_stage = 'REJECTED', 
           rejected_from_stage = $1, 
           stage_entered_at = $2, 
           updated_at = $2 
       WHERE id = $3`,
      [currentStage, now, applicationId]
    );

    const eventId = 'evt_' + Math.random().toString(36).substring(2, 11);
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

    return { currentStage: Stage.REJECTED, rejectedFromStage: currentStage };
  }

  // Returns app to exactly the stage it was rejected from — no arbitrary selection
  static async reinstate(user: UserPublic, applicationId: string, note?: string) {
    const currentRes = await query<Application>(
      'SELECT id, current_stage, rejected_from_stage FROM applications WHERE id = $1',
      [applicationId]
    );

    if (currentRes.rows.length === 0) {
      throw new NotFoundError('Application not found');
    }

    const app = currentRes.rows[0];
    PipelineStateMachine.reinstate(user.role, app.current_stage, app.rejected_from_stage ?? null);

    const restoreStage = app.rejected_from_stage!;
    const now = new Date();

    await query(
      `UPDATE applications 
       SET current_stage = $1, 
           rejected_from_stage = NULL, 
           stage_entered_at = $2, 
           updated_at = $2 
       WHERE id = $3`,
      [restoreStage, now, applicationId]
    );

    const eventId = 'evt_' + Math.random().toString(36).substring(2, 11);
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

    return restoreStage;
  }

  // Each app processed independently — partial success is allowed
  static async bulkAdvance(
    user: UserPublic,
    applicationIds: string[],
    note?: string
  ): Promise<{
    total: number;
    successful: number;
    refused: number;
    results: Array<{
      applicationId: string;
      candidateName: string;
      candidateEmail?: string;
      success: boolean;
      status: 'SUCCESS' | 'REFUSED';
      oldStage?: Stage;
      targetStage?: Stage;
      reason?: string;
      message?: string;
    }>;
  }> {
    PipelineStateMachine.validateRole(user.role);

    const results: Array<{
      applicationId: string;
      candidateName: string;
      candidateEmail?: string;
      success: boolean;
      status: 'SUCCESS' | 'REFUSED';
      oldStage?: Stage;
      targetStage?: Stage;
      reason?: string;
      message?: string;
    }> = [];

    let successfulCount = 0;
    let refusedCount = 0;

    for (const id of applicationIds) {
      try {
        const appRes = await query<Application>(
          'SELECT id, candidate_name, candidate_email, current_stage, rejected_from_stage FROM applications WHERE id = $1',
          [id]
        );

        if (appRes.rows.length === 0) {
          results.push({
            applicationId: id,
            candidateName: 'Unknown',
            success: false,
            status: 'REFUSED',
            reason: `Application with ID '${id}' not found`,
          });
          refusedCount++;
          continue;
        }

        const app = appRes.rows[0];

        if (app.current_stage === Stage.REJECTED) {
          results.push({
            applicationId: id,
            candidateName: app.candidate_name,
            candidateEmail: app.candidate_email,
            success: false,
            status: 'REFUSED',
            oldStage: Stage.REJECTED,
            reason: 'Candidate is Rejected. Must be reinstated before advancing.',
          });
          refusedCount++;
          continue;
        }

        if (app.current_stage === Stage.HIRED) {
          results.push({
            applicationId: id,
            candidateName: app.candidate_name,
            candidateEmail: app.candidate_email,
            success: false,
            status: 'REFUSED',
            oldStage: Stage.HIRED,
            reason: 'Candidate is already in the final stage (HIRED).',
          });
          refusedCount++;
          continue;
        }

        const currentIndex = PROGRESSION_ORDER.indexOf(app.current_stage);
        if (currentIndex === -1 || currentIndex >= PROGRESSION_ORDER.length - 1) {
          results.push({
            applicationId: id,
            candidateName: app.candidate_name,
            candidateEmail: app.candidate_email,
            success: false,
            status: 'REFUSED',
            oldStage: app.current_stage,
            reason: `Cannot advance from stage '${app.current_stage}'`,
          });
          refusedCount++;
          continue;
        }

        const nextStage = PROGRESSION_ORDER[currentIndex + 1];

        const targetStage = await this.advance(user, id, nextStage, note);

        results.push({
          applicationId: id,
          candidateName: app.candidate_name,
          candidateEmail: app.candidate_email,
          success: true,
          status: 'SUCCESS',
          oldStage: app.current_stage,
          targetStage,
          message: `Advanced to ${targetStage}`,
        });
        successfulCount++;
      } catch (err: any) {
        results.push({
          applicationId: id,
          candidateName: 'Candidate',
          success: false,
          status: 'REFUSED',
          reason: err.message || 'Transition failed',
        });
        refusedCount++;
      }
    }

    return {
      total: applicationIds.length,
      successful: successfulCount,
      refused: refusedCount,
      results,
    };
  }

  static async bulkReject(
    user: UserPublic,
    applicationIds: string[],
    note?: string
  ): Promise<{
    total: number;
    successful: number;
    refused: number;
    results: Array<{
      applicationId: string;
      candidateName: string;
      candidateEmail?: string;
      success: boolean;
      status: 'SUCCESS' | 'REFUSED';
      oldStage?: Stage;
      targetStage?: Stage;
      reason?: string;
      message?: string;
    }>;
  }> {
    PipelineStateMachine.validateRole(user.role);

    const results: Array<{
      applicationId: string;
      candidateName: string;
      candidateEmail?: string;
      success: boolean;
      status: 'SUCCESS' | 'REFUSED';
      oldStage?: Stage;
      targetStage?: Stage;
      reason?: string;
      message?: string;
    }> = [];

    let successfulCount = 0;
    let refusedCount = 0;

    for (const id of applicationIds) {
      try {
        const appRes = await query<Application>(
          'SELECT id, candidate_name, candidate_email, current_stage FROM applications WHERE id = $1',
          [id]
        );

        if (appRes.rows.length === 0) {
          results.push({
            applicationId: id,
            candidateName: 'Unknown',
            success: false,
            status: 'REFUSED',
            reason: `Application with ID '${id}' not found`,
          });
          refusedCount++;
          continue;
        }

        const app = appRes.rows[0];

        if (app.current_stage === Stage.REJECTED) {
          results.push({
            applicationId: id,
            candidateName: app.candidate_name,
            candidateEmail: app.candidate_email,
            success: false,
            status: 'REFUSED',
            oldStage: Stage.REJECTED,
            reason: 'Application is already rejected',
          });
          refusedCount++;
          continue;
        }

        const oldStage = app.current_stage;
        await this.reject(user, id, note);

        results.push({
          applicationId: id,
          candidateName: app.candidate_name,
          candidateEmail: app.candidate_email,
          success: true,
          status: 'SUCCESS',
          oldStage,
          targetStage: Stage.REJECTED,
          message: 'Candidate rejected',
        });
        successfulCount++;
      } catch (err: any) {
        results.push({
          applicationId: id,
          candidateName: 'Candidate',
          success: false,
          status: 'REFUSED',
          reason: err.message || 'Rejection failed',
        });
        refusedCount++;
      }
    }

    return {
      total: applicationIds.length,
      successful: successfulCount,
      refused: refusedCount,
      results,
    };
  }
}
