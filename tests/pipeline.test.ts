import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Application Pipeline State Machine', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewerToken: string;

  const recruiterUser = {
    id: 'usr_recruiter_1',
    name: 'Rachel Recruiter',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewerUser = {
    id: 'usr_interviewer_1',
    name: 'Ian Interviewer',
    email: 'interviewer1@hireflow.test',
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
       VALUES 
        ('job_1', 'Lead Backend Engineer', 'Engineering', 'Build APIs', 'OPEN');`
    );

    // 4. Seed Applications at different stages
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, rejected_from_stage)
       VALUES 
        ('app_applied', 'job_1', 'Alice Applied', 'alice@test', 'Direct', 'APPLIED', NULL),
        ('app_screening', 'job_1', 'Bob Screening', 'bob@test', 'Direct', 'SCREENING', NULL),
        ('app_interview', 'job_1', 'Charlie Interview', 'charlie@test', 'Direct', 'INTERVIEW', NULL),
        ('app_offer', 'job_1', 'Dave Offer', 'dave@test', 'Direct', 'OFFER', NULL),
        ('app_hired', 'job_1', 'Eve Hired', 'eve@test', 'Direct', 'HIRED', NULL),
        ('app_rejected', 'job_1', 'Frank Rejected', 'frank@test', 'Direct', 'REJECTED', 'SCREENING');`
    );

    // Assign interviewer to app_applied so they can view it but shouldn't be able to change stage
    memDb.public.none(
      `INSERT INTO application_interviewers (application_id, user_id)
       VALUES 
        ('app_applied', '${interviewerUser.id}');`
    );

    // 5. Generate Tokens
    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);

    app = createApp();
  });

  describe('Valid Transitions', () => {
    it('allows progression: Applied -> Screening', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.SCREENING });
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.SCREENING);
    });

    it('allows progression: Screening -> Interview', async () => {
      const res = await request(app)
        .post('/api/applications/app_screening/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.INTERVIEW });
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.INTERVIEW);
    });

    it('allows progression: Interview -> Offer', async () => {
      const res = await request(app)
        .post('/api/applications/app_interview/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.OFFER });
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.OFFER);
    });

    it('allows progression: Offer -> Hired', async () => {
      const res = await request(app)
        .post('/api/applications/app_offer/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.HIRED });
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.HIRED);
    });
  });

  describe('Skipped & Invalid Transitions', () => {
    it('rejects skipping stages: Applied -> Interview', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.INTERVIEW });
      expect(res.status).toBe(422); // IllegalStageTransitionError maps to 422
      expect(res.body.error.message).toContain('progress linearly');
    });

    it('rejects backward transitions: Interview -> Screening', async () => {
      const res = await request(app)
        .post('/api/applications/app_interview/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.SCREENING });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('progress linearly');
    });

    it('rejects advancing to REJECTED via stage endpoint', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.REJECTED });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Use the reject endpoint');
    });
  });

  describe('Rejection & Reinstatement', () => {
    it('allows rejection from APPLIED stage', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/reject')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.REJECTED);
      expect(res.body.data.rejected_from_stage).toBe(Stage.APPLIED);
    });

    it('allows rejection from INTERVIEW stage', async () => {
      const res = await request(app)
        .post('/api/applications/app_interview/reject')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.REJECTED);
      expect(res.body.data.rejected_from_stage).toBe(Stage.INTERVIEW);
    });

    it('prevents rejecting an already rejected application', async () => {
      const res = await request(app)
        .post('/api/applications/app_rejected/reject')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('already rejected');
    });

    it('prevents advancing an application that is currently rejected', async () => {
      const res = await request(app)
        .post('/api/applications/app_rejected/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.INTERVIEW });
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('reinstate the candidate first');
    });

    it('reinstates a rejected application to its exact previous stage', async () => {
      const res = await request(app)
        .post('/api/applications/app_rejected/reinstate')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.current_stage).toBe(Stage.SCREENING);
    });

    it('prevents reinstating an application that is not rejected', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/reinstate')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('Only rejected applications can be reinstated');
    });
  });

  describe('Interviewer Role Constraints', () => {
    it('prevents interviewer from advancing stage', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/stage')
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({ targetStage: Stage.SCREENING });
      expect(res.status).toBe(403);
    });

    it('prevents interviewer from rejecting', async () => {
      const res = await request(app)
        .post('/api/applications/app_applied/reject')
        .set('Authorization', `Bearer ${interviewerToken}`);
      expect(res.status).toBe(403);
    });

    it('prevents interviewer from reinstating', async () => {
      const res = await request(app)
        .post('/api/applications/app_rejected/reinstate')
        .set('Authorization', `Bearer ${interviewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
