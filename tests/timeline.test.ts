import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage, EventType } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Immutable Application Timeline Audit Trail', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewerToken: string;
  let unassignedInterviewerToken: string;

  const recruiterUser = {
    id: 'usr_recruiter_01',
    name: 'Sarah Connor',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewerUser = {
    id: 'usr_interviewer_01',
    name: 'Alex Rivera',
    email: 'alex@hireflow.test',
    role: Role.INTERVIEWER,
  };

  const unassignedInterviewerUser = {
    id: 'usr_interviewer_02',
    name: 'Elena Rostova',
    email: 'elena@hireflow.test',
    role: Role.INTERVIEWER,
  };

  beforeEach(async () => {
    // 1. Initialize PostgreSQL in-memory schema
    memDb = newDb();
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    memDb.public.none(schemaSql);

    const { Pool } = memDb.adapters.createPg();
    const mockPool = new Pool();
    dbModule.setPool(mockPool);

    // 2. Seed Users
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES 
        ('${recruiterUser.id}', '${recruiterUser.name}', '${recruiterUser.email}', '${passwordHash}', '${recruiterUser.role}'),
        ('${interviewerUser.id}', '${interviewerUser.name}', '${interviewerUser.email}', '${passwordHash}', '${interviewerUser.role}'),
        ('${unassignedInterviewerUser.id}', '${unassignedInterviewerUser.name}', '${unassignedInterviewerUser.email}', '${passwordHash}', '${unassignedInterviewerUser.role}');`
    );

    // 3. Seed Job Opening
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_eng', 'Staff Backend Engineer', 'Engineering', 'Build scalable pipelines', 'OPEN');`
    );

    // 4. Generate Tokens
    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);
    unassignedInterviewerToken = AuthService.generateToken(unassignedInterviewerUser);

    app = createApp();
  });

  it('records APPLICATION_CREATED in timeline when a candidate application is created', async () => {
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Grace Hopper',
        candidate_email: 'grace.hopper@example.com',
        source: 'Referral',
        notes: 'Exceptional computer scientist',
      });

    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    // Fetch timeline via dedicated GET /api/applications/:id/timeline
    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(timelineRes.status).toBe(200);
    expect(timelineRes.body.success).toBe(true);
    expect(timelineRes.body.data.length).toBe(1);

    const event = timelineRes.body.data[0];
    expect(event.event_type).toBe(EventType.APPLICATION_CREATED);
    expect(event.application_id).toBe(appId);
    expect(event.actor_id).toBe(recruiterUser.id);
    expect(event.actor_name).toBe(recruiterUser.name);
    expect(event.actor_role).toBe(Role.RECRUITER);
    expect(event.new_stage).toBe(Stage.APPLIED);
    expect(event.created_at).toBeDefined();
  });

  it('records STAGE_CHANGE with old_stage, new_stage, actor, and note', async () => {
    // 1. Create Application
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Alan Turing',
        candidate_email: 'alan.turing@example.com',
        source: 'LinkedIn',
      });
    const appId = createRes.body.data.id;

    // 2. Advance to SCREENING
    const advanceRes = await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        targetStage: Stage.SCREENING,
        note: 'Passed initial resume screening',
      });
    expect(advanceRes.status).toBe(200);

    // 3. Check timeline
    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(timelineRes.body.data.length).toBe(2);
    const stageEvent = timelineRes.body.data[1];

    expect(stageEvent.event_type).toBe(EventType.STAGE_CHANGE);
    expect(stageEvent.old_stage).toBe(Stage.APPLIED);
    expect(stageEvent.new_stage).toBe(Stage.SCREENING);
    expect(stageEvent.note_content).toBe('Passed initial resume screening');
    expect(stageEvent.actor_id).toBe(recruiterUser.id);
    expect(stageEvent.actor_name).toBe(recruiterUser.name);
  });

  it('records REJECTION with prior stage as old_stage and REJECTED as new_stage', async () => {
    // 1. Create Application
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Katherine Johnson',
        candidate_email: 'katherine.johnson@example.com',
        source: 'Direct',
      });
    const appId = createRes.body.data.id;

    // 2. Advance to SCREENING then INTERVIEW
    await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.SCREENING });

    await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.INTERVIEW });

    // 3. Reject candidate
    const rejectRes = await request(app)
      .post(`/api/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ note: 'Not advancing after technical panel' });
    expect(rejectRes.status).toBe(200);

    // 4. Verify timeline
    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    const rejectEvent = timelineRes.body.data.find(
      (e: any) => e.event_type === EventType.REJECTION
    );
    expect(rejectEvent).toBeDefined();
    expect(rejectEvent.old_stage).toBe(Stage.INTERVIEW);
    expect(rejectEvent.new_stage).toBe(Stage.REJECTED);
    expect(rejectEvent.note_content).toBe('Not advancing after technical panel');
    expect(rejectEvent.actor_id).toBe(recruiterUser.id);
  });

  it('records REINSTATEMENT with REJECTED as old_stage and restored stage as new_stage', async () => {
    // 1. Create Application & Advance to SCREENING
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Margaret Hamilton',
        candidate_email: 'margaret.hamilton@example.com',
        source: 'Referral',
      });
    const appId = createRes.body.data.id;

    await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.SCREENING });

    // 2. Reject
    await request(app)
      .post(`/api/applications/${appId}/reject`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ note: 'Candidate took another offer' });

    // 3. Reinstate
    const reinstateRes = await request(app)
      .post(`/api/applications/${appId}/reinstate`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ note: 'Candidate is available again' });
    expect(reinstateRes.status).toBe(200);

    // 4. Verify timeline
    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    const reinstateEvent = timelineRes.body.data.find(
      (e: any) => e.event_type === EventType.REINSTATEMENT
    );
    expect(reinstateEvent).toBeDefined();
    expect(reinstateEvent.old_stage).toBe(Stage.REJECTED);
    expect(reinstateEvent.new_stage).toBe(Stage.SCREENING);
    expect(reinstateEvent.note_content).toBe('Candidate is available again');
  });

  it('records INTERVIEWER_FEEDBACK as an immutable part of the timeline', async () => {
    // 1. Create Application
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Ada Lovelace',
        candidate_email: 'ada.lovelace@example.com',
        source: 'Direct',
      });
    const appId = createRes.body.data.id;

    // 2. Assign Interviewer
    await request(app)
      .post(`/api/applications/${appId}/interviewers`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ userId: interviewerUser.id });

    // 3. Interviewer submits feedback
    const feedbackRes = await request(app)
      .post(`/api/applications/${appId}/feedback`)
      .set('Authorization', `Bearer ${interviewerToken}`)
      .send({ feedback: 'Outstanding algorithmic comprehension and clear architecture vision.' });
    expect(feedbackRes.status).toBe(200);

    // 4. Verify timeline contains the feedback
    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${interviewerToken}`);

    const feedbackEvent = timelineRes.body.data.find(
      (e: any) => e.event_type === EventType.INTERVIEWER_FEEDBACK
    );
    expect(feedbackEvent).toBeDefined();
    expect(feedbackEvent.note_content).toBe('Outstanding algorithmic comprehension and clear architecture vision.');
    expect(feedbackEvent.actor_id).toBe(interviewerUser.id);
    expect(feedbackEvent.actor_name).toBe(interviewerUser.name);
    expect(feedbackEvent.actor_role).toBe(Role.INTERVIEWER);
  });

  it('guarantees events are returned in strict chronological order', async () => {
    // 1. Create Application
    const createRes = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        job_opening_id: 'job_eng',
        candidate_name: 'Claude Shannon',
        candidate_email: 'claude.shannon@example.com',
        source: 'Direct',
      });
    const appId = createRes.body.data.id;

    // 2. Assign Interviewer
    await request(app)
      .post(`/api/applications/${appId}/interviewers`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ userId: interviewerUser.id });

    // 3. Advance to SCREENING
    await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.SCREENING });

    // 4. Feedback
    await request(app)
      .post(`/api/applications/${appId}/feedback`)
      .set('Authorization', `Bearer ${interviewerToken}`)
      .send({ feedback: 'Strong information theory fundamentals' });

    // 5. Advance to INTERVIEW
    await request(app)
      .post(`/api/applications/${appId}/stage`)
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.INTERVIEW });

    const timelineRes = await request(app)
      .get(`/api/applications/${appId}/timeline`)
      .set('Authorization', `Bearer ${recruiterToken}`);

    const events = timelineRes.body.data;
    expect(events.length).toBe(5);

    const eventTypes = events.map((e: any) => e.event_type);
    expect(eventTypes).toEqual([
      EventType.APPLICATION_CREATED,
      EventType.INTERVIEWER_ASSIGNED,
      EventType.STAGE_CHANGE,
      EventType.INTERVIEWER_FEEDBACK,
      EventType.STAGE_CHANGE,
    ]);

    // Check timestamps are non-decreasing
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].created_at).getTime();
      const curr = new Date(events[i].created_at).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  describe('Authorization & Immutability Enforcement', () => {
    let appId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          job_opening_id: 'job_eng',
          candidate_name: 'Linus Torvalds',
          candidate_email: 'linus@example.com',
          source: 'Direct',
        });
      appId = createRes.body.data.id;

      // Assign only interviewerUser
      await request(app)
        .post(`/api/applications/${appId}/interviewers`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewerUser.id });
    });

    it('allows assigned Interviewer to access timeline', async () => {
      const res = await request(app)
        .get(`/api/applications/${appId}/timeline`)
        .set('Authorization', `Bearer ${interviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('STRICTLY FAILS with 403 Forbidden when unassigned Interviewer attempts to access timeline', async () => {
      const res = await request(app)
        .get(`/api/applications/${appId}/timeline`)
        .set('Authorization', `Bearer ${unassignedInterviewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 Not Found for non-existent application timeline', async () => {
      const res = await request(app)
        .get('/api/applications/app_non_existent/timeline')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects history update: PUT and PATCH on timeline events are not supported/allowed', async () => {
      // 1. Attempt PUT on timeline event
      const putRes = await request(app)
        .put(`/api/applications/${appId}/timeline`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ note_content: 'Tampered note content' });
      expect([404, 405]).toContain(putRes.status);

      // 2. Attempt PATCH on timeline event
      const patchRes = await request(app)
        .patch(`/api/applications/${appId}/timeline`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ note_content: 'Tampered note content' });
      expect([404, 405]).toContain(patchRes.status);
    });

    it('rejects history deletion: DELETE on timeline events is not supported/allowed', async () => {
      const deleteRes = await request(app)
        .delete(`/api/applications/${appId}/timeline`)
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect([404, 405]).toContain(deleteRes.status);
    });

    it('rejects feedback update: PUT and PATCH on feedback are not supported/allowed', async () => {
      // 1. Submit valid feedback first
      await request(app)
        .post(`/api/applications/${appId}/feedback`)
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({ feedback: 'Original immutable assessment' });

      // 2. Attempt PUT on feedback
      const putRes = await request(app)
        .put(`/api/applications/${appId}/feedback`)
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({ feedback: 'Modified assessment' });
      expect([404, 405]).toContain(putRes.status);

      // 3. Attempt PATCH on feedback
      const patchRes = await request(app)
        .patch(`/api/applications/${appId}/feedback`)
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({ feedback: 'Modified assessment' });
      expect([404, 405]).toContain(patchRes.status);
    });

    it('rejects feedback deletion: DELETE on feedback is not supported/allowed', async () => {
      const deleteRes = await request(app)
        .delete(`/api/applications/${appId}/feedback`)
        .set('Authorization', `Bearer ${interviewerToken}`);
      expect([404, 405]).toContain(deleteRes.status);
    });
  });
});
