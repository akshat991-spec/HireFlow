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

export class PipelineStateMachine {
  static validateRole(userRole: Role) {
    if (userRole !== Role.RECRUITER) {
      throw new ForbiddenError('Only recruiters can perform stage transitions');
    }
  }

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

  static reject(userRole: Role, currentStage: Stage) {
    this.validateRole(userRole);

    if (currentStage === Stage.REJECTED) {
      throw new IllegalStageTransitionError('Application is already rejected');
    }
  }

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

export class PipelineService {
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

  static async reinstate(user: UserPublic, applicationId: string, note?: string) {
    const currentRes = await query<Application>(
      'SELECT id, current_stage, rejected_from_stage FROM applications WHERE id = $1',
      [applicationId]
    );

    if (currentRes.rows.length === 0) {
      throw new NotFoundError('Application not found');
    }

    const app = currentRes.rows[0];
    PipelineStateMachine.reinstate(user.role, app.current_stage, app.rejected_from_stage);

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
}
