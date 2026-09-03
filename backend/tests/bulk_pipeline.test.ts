import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage, EventType } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Recruiter Bulk Pipeline Actions (Bulk Advance & Bulk Reject)', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewerToken: string;

  const recruiterUser = {
    id: 'usr_recruiter_01',
    name: 'Sarah Connor',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewerUser = {
    id: 'usr_interviewer_01',
    name: 'Alex Rivera',
    email: 'interviewer@hireflow.test',
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
        ('${interviewerUser.id}', '${interviewerUser.name}', '${interviewerUser.email}', '${passwordHash}', '${interviewerUser.role}');`
    );

    // 3. Seed Job Opening
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES ('job_eng', 'Staff Engineer', 'Engineering', 'Core backend', 'OPEN');`
    );

    // 4. Seed Applications at various pipeline stages
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, rejected_from_stage)
       VALUES 
        ('app_applied', 'job_eng', 'Sarah Applied', 'sarah@test.com', 'LinkedIn', 'APPLIED', NULL),
        ('app_screening', 'job_eng', 'Rahul Screening', 'rahul@test.com', 'Referral', 'SCREENING', NULL),
        ('app_interview', 'job_eng', 'Maya Interview', 'maya@test.com', 'Direct', 'INTERVIEW', NULL),
        ('app_offer', 'job_eng', 'Leo Offer', 'leo@test.com', 'LinkedIn', 'OFFER', NULL),
        ('app_hired', 'job_eng', 'Emily Hired', 'emily@test.com', 'Direct', 'HIRED', NULL),
        ('app_rejected', 'job_eng', 'John Rejected', 'john@test.com', 'LinkedIn', 'REJECTED', 'INTERVIEW');`
    );

    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);
    app = createApp();
  });

  describe('1. Bulk Advance - Mixed Success & Independent Processing', () => {
    it('processes mixed batch of candidates independently returning per-application results', async () => {
      const res = await request(app)
        .post('/api/applications/bulk/advance')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          applicationIds: [
            'app_applied',
            'app_screening',
            'app_interview',
            'app_offer',
            'app_hired',
            'app_rejected',
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(6);
      expect(res.body.data.successful).toBe(4);
      expect(res.body.data.refused).toBe(2);

      const results = res.body.data.results;

      // 1. app_applied -> Advanced to SCREENING
      const appliedResult = results.find((r: any) => r.applicationId === 'app_applied');
      expect(appliedResult.success).toBe(true);
      expect(appliedResult.status).toBe('SUCCESS');
      expect(appliedResult.oldStage).toBe(Stage.APPLIED);
      expect(appliedResult.targetStage).toBe(Stage.SCREENING);

      // 2. app_screening -> Advanced to INTERVIEW
      const screeningResult = results.find((r: any) => r.applicationId === 'app_screening');
      expect(screeningResult.success).toBe(true);
      expect(screeningResult.status).toBe('SUCCESS');
      expect(screeningResult.oldStage).toBe(Stage.SCREENING);
      expect(screeningResult.targetStage).toBe(Stage.INTERVIEW);

      // 3. app_interview -> Advanced to OFFER
      const interviewResult = results.find((r: any) => r.applicationId === 'app_interview');
      expect(interviewResult.success).toBe(true);
      expect(interviewResult.status).toBe('SUCCESS');
      expect(interviewResult.oldStage).toBe(Stage.INTERVIEW);
      expect(interviewResult.targetStage).toBe(Stage.OFFER);

      // 4. app_offer -> Advanced to HIRED
      const offerResult = results.find((r: any) => r.applicationId === 'app_offer');
      expect(offerResult.success).toBe(true);
      expect(offerResult.status).toBe('SUCCESS');
      expect(offerResult.oldStage).toBe(Stage.OFFER);
      expect(offerResult.targetStage).toBe(Stage.HIRED);

      // 5. app_hired -> Refused (Already in final stage HIRED)
      const hiredResult = results.find((r: any) => r.applicationId === 'app_hired');
      expect(hiredResult.success).toBe(false);
      expect(hiredResult.status).toBe('REFUSED');
      expect(hiredResult.reason).toContain('already in the final stage (HIRED)');

      // 6. app_rejected -> Refused (Candidate is rejected)
      const rejectedResult = results.find((r: any) => r.applicationId === 'app_rejected');
      expect(rejectedResult.success).toBe(false);
      expect(rejectedResult.status).toBe('REFUSED');
      expect(rejectedResult.reason).toContain('Candidate is Rejected');
    });

    it('creates immutable timeline STAGE_CHANGE events only for successful advances', async () => {
      await request(app)
        .post('/api/applications/bulk/advance')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          applicationIds: ['app_applied', 'app_hired'],
        });

      // Verify app_applied timeline has STAGE_CHANGE event
      const appAppliedTimeline = await request(app)
        .get('/api/applications/app_applied/timeline')
        .set('Authorization', `Bearer ${recruiterToken}`);

      const stageEvents = appAppliedTimeline.body.data.filter(
        (e: any) => e.event_type === EventType.STAGE_CHANGE
      );
      expect(stageEvents.length).toBe(1);
      expect(stageEvents[0].old_stage).toBe(Stage.APPLIED);
      expect(stageEvents[0].new_stage).toBe(Stage.SCREENING);

      // Verify app_hired timeline has NO extra events
      const appHiredTimeline = await request(app)
        .get('/api/applications/app_hired/timeline')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(appHiredTimeline.body.data.length).toBe(0);
    });
  });

  describe('2. Bulk Reject - Mixed Success & Independent Processing', () => {
    it('rejects eligible candidates and refuses already rejected candidates', async () => {
      const res = await request(app)
        .post('/api/applications/bulk/reject')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          applicationIds: ['app_applied', 'app_screening', 'app_rejected'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.successful).toBe(2);
      expect(res.body.data.refused).toBe(1);

      const results = res.body.data.results;

      // 1. app_applied -> Success rejected
      const appliedResult = results.find((r: any) => r.applicationId === 'app_applied');
      expect(appliedResult.success).toBe(true);
      expect(appliedResult.targetStage).toBe(Stage.REJECTED);

      // 2. app_screening -> Success rejected
      const screeningResult = results.find((r: any) => r.applicationId === 'app_screening');
      expect(screeningResult.success).toBe(true);
      expect(screeningResult.targetStage).toBe(Stage.REJECTED);

      // 3. app_rejected -> Refused
      const rejectedResult = results.find((r: any) => r.applicationId === 'app_rejected');
      expect(rejectedResult.success).toBe(false);
      expect(rejectedResult.status).toBe('REFUSED');
      expect(rejectedResult.reason).toContain('already rejected');
    });

    it('creates immutable REJECTION timeline events with origin stage preserved', async () => {
      await request(app)
        .post('/api/applications/bulk/reject')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          applicationIds: ['app_screening'],
        });

      const timelineRes = await request(app)
        .get('/api/applications/app_screening/timeline')
        .set('Authorization', `Bearer ${recruiterToken}`);

      const rejectEvent = timelineRes.body.data.find(
        (e: any) => e.event_type === EventType.REJECTION
      );
      expect(rejectEvent).toBeDefined();
      expect(rejectEvent.old_stage).toBe(Stage.SCREENING);
      expect(rejectEvent.new_stage).toBe(Stage.REJECTED);
      expect(rejectEvent.actor_id).toBe(recruiterUser.id);
    });
  });

  describe('3. Validation & Authorization Boundaries', () => {
    it('STRICTLY FAILS with 422 Unprocessable Entity when applicationIds is empty', async () => {
      const res = await request(app)
        .post('/api/applications/bulk/advance')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          applicationIds: [],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('STRICTLY FAILS with 403 Forbidden when an Interviewer attempts bulk advance', async () => {
      const res = await request(app)
        .post('/api/applications/bulk/advance')
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({
          applicationIds: ['app_applied'],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('STRICTLY FAILS with 403 Forbidden when an Interviewer attempts bulk reject', async () => {
      const res = await request(app)
        .post('/api/applications/bulk/reject')
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({
          applicationIds: ['app_applied'],
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
