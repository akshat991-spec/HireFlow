import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage, OpeningStatus } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Server-Side Role-Based Access Control (RBAC)', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewer1Token: string;
  let interviewer2Token: string;

  const recruiterUser = {
    id: 'usr_recruiter_1',
    name: 'Rachel Recruiter',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewer1User = {
    id: 'usr_interviewer_1',
    name: 'Ian Interviewer',
    email: 'interviewer1@hireflow.test',
    role: Role.INTERVIEWER,
  };

  const interviewer2User = {
    id: 'usr_interviewer_2',
    name: 'Ivy Interviewer',
    email: 'interviewer2@hireflow.test',
    role: Role.INTERVIEWER,
  };

  beforeEach(async () => {
    // 1. Initialize PostgreSQL in-memory schema
    memDb = newDb();
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    memDb.public.none(schemaSql);

    // Use pg-mem createPg adapter
    const { Pool } = memDb.adapters.createPg();
    const mockPool = new Pool();
    dbModule.setPool(mockPool);

    // 2. Seed Users
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES 
        ('${recruiterUser.id}', '${recruiterUser.name}', '${recruiterUser.email}', '${passwordHash}', '${recruiterUser.role}'),
        ('${interviewer1User.id}', '${interviewer1User.name}', '${interviewer1User.email}', '${passwordHash}', '${interviewer1User.role}'),
        ('${interviewer2User.id}', '${interviewer2User.name}', '${interviewer2User.email}', '${passwordHash}', '${interviewer2User.role}');`
    );

    // 3. Seed Job Opening
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_1', 'Lead Backend Engineer', 'Engineering', 'Build APIs', 'OPEN'),
        ('job_2', 'Account Executive', 'Sales', 'B2B Sales', 'OPEN');`
    );

    // 4. Seed Applications
    // app_1 -> Assigned to interviewer1
    // app_2 -> Unassigned
    // app_3 -> Assigned to interviewer2
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
       VALUES 
        ('app_1', 'job_1', 'Alice Assigned', 'alice@candidate.test', 'LinkedIn', 'APPLIED'),
        ('app_2', 'job_1', 'Bob Unassigned', 'bob@candidate.test', 'Direct', 'APPLIED'),
        ('app_3', 'job_2', 'Charlie Other', 'charlie@candidate.test', 'Referral', 'APPLIED');`
    );

    // 5. Seed Interviewer Assignment (app_1 <-> interviewer1, app_3 <-> interviewer2)
    memDb.public.none(
      `INSERT INTO application_interviewers (application_id, user_id)
       VALUES 
        ('app_1', '${interviewer1User.id}'),
        ('app_3', '${interviewer2User.id}');`
    );

    // 6. Generate Tokens
    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewer1Token = AuthService.generateToken(interviewer1User);
    interviewer2Token = AuthService.generateToken(interviewer2User);

    app = createApp();
  });

  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/applications');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('authenticates valid credentials and issues JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'recruiter@hireflow.test', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe(Role.RECRUITER);
      expect(res.body.data).toHaveProperty('token');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects invalid credentials with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'recruiter@hireflow.test', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('1. Interviewer → GET Applications Access Control', () => {
    it('allows Interviewer to GET assigned application (app_1)', async () => {
      const res = await request(app)
        .get('/api/applications/app_1')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.id).toBe('app_1');
      expect(res.body.data.application.candidate_name).toBe('Alice Assigned');
    });

    it('STRICTLY FAILS when Interviewer attempts to GET unrelated unassigned application (app_2)', async () => {
      const res = await request(app)
        .get('/api/applications/app_2')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('assigned');
    });

    it('STRICTLY FAILS when Interviewer attempts to GET application assigned to someone else (app_3)', async () => {
      const res = await request(app)
        .get('/api/applications/app_3')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Recruiter to GET any application across the company', async () => {
      const res1 = await request(app)
        .get('/api/applications/app_1')
        .set('Authorization', `Bearer ${recruiterToken}`);
      const res2 = await request(app)
        .get('/api/applications/app_2')
        .set('Authorization', `Bearer ${recruiterToken}`);
      const res3 = await request(app)
        .get('/api/applications/app_3')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res3.status).toBe(200);
    });
  });

  describe('2. Interviewer → Change Stage Authorization', () => {
    it('STRICTLY FAILS server-side when Interviewer attempts to advance stage on assigned application', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/stage')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ targetStage: Stage.SCREENING });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Interviewers are not permitted');
    });

    it('STRICTLY FAILS server-side when Interviewer attempts to advance stage on unassigned application', async () => {
      const res = await request(app)
        .post('/api/applications/app_2/stage')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ targetStage: Stage.SCREENING });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Recruiter to advance stage linearly', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/stage')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ targetStage: Stage.SCREENING });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current_stage).toBe(Stage.SCREENING);
    });
  });

  describe('3. Interviewer → Reject Candidate Authorization', () => {
    it('STRICTLY FAILS server-side when Interviewer attempts to reject a candidate', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/reject')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ note: 'Not a fit' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Recruiter to reject a candidate and preserves prior stage', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/reject')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ note: 'Recruiter rejected' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.current_stage).toBe(Stage.REJECTED);
      expect(res.body.data.rejected_from_stage).toBe(Stage.APPLIED);
    });

    it('STRICTLY FAILS when Interviewer attempts to reinstate a candidate', async () => {
      // First reject via recruiter
      await request(app)
        .post('/api/applications/app_2/reject')
        .set('Authorization', `Bearer ${recruiterToken}`);

      // Attempt reinstate via interviewer
      const res = await request(app)
        .post('/api/applications/app_2/reinstate')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Interviewer → Assign Interviewer Authorization', () => {
    it('STRICTLY FAILS server-side when Interviewer attempts to assign an interviewer', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/interviewers')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ userId: interviewer2User.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Recruiter to assign a user with INTERVIEWER role', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer2User.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.interviewer.id).toBe(interviewer2User.id);
    });

    it('STRICTLY FAILS when Recruiter attempts to assign a user without INTERVIEWER role', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: recruiterUser.id });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Only users with the INTERVIEWER role');
    });
  });

  describe('5. Interviewer Feedback Permissions', () => {
    it('allows assigned Interviewer to leave feedback', async () => {
      const res = await request(app)
        .post('/api/applications/app_1/feedback')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ feedback: 'Candidate performed well in system design.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.note_content).toBe('Candidate performed well in system design.');
    });

    it('STRICTLY FAILS when unassigned Interviewer attempts to leave feedback', async () => {
      const res = await request(app)
        .post('/api/applications/app_2/feedback')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ feedback: 'Unsolicited feedback' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Application List Scoping per Role', () => {
    it('scopes GET /api/applications for Interviewer to ONLY assigned applications', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].id).toBe('app_1');
    });

    it('returns all applications across all openings for Recruiter', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items.length).toBe(3);
    });
  });
});
