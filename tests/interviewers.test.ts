import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage, EventType } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Interviewer Assignment & Interviewer Views (End-to-End)', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewer1Token: string;
  let interviewer2Token: string;
  let interviewer3Token: string;

  const recruiterUser = {
    id: 'usr_recruiter_1',
    name: 'Sarah Recruiter',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewer1User = {
    id: 'usr_interviewer_1',
    name: 'Alex Rivera',
    email: 'alex.interviewer@hireflow.test',
    role: Role.INTERVIEWER,
  };

  const interviewer2User = {
    id: 'usr_interviewer_2',
    name: 'Elena Rostova',
    email: 'elena.interviewer@hireflow.test',
    role: Role.INTERVIEWER,
  };

  const interviewer3User = {
    id: 'usr_interviewer_3',
    name: 'Marcus Chen',
    email: 'marcus.interviewer@hireflow.test',
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
        ('${interviewer1User.id}', '${interviewer1User.name}', '${interviewer1User.email}', '${passwordHash}', '${interviewer1User.role}'),
        ('${interviewer2User.id}', '${interviewer2User.name}', '${interviewer2User.email}', '${passwordHash}', '${interviewer2User.role}'),
        ('${interviewer3User.id}', '${interviewer3User.name}', '${interviewer3User.email}', '${passwordHash}', '${interviewer3User.role}');`
    );

    // 3. Seed Job Openings across multiple departments
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_eng', 'Senior Backend Engineer', 'Engineering', 'Build cloud APIs', 'OPEN'),
        ('job_prod', 'Product Manager', 'Product', 'Drive product strategy', 'OPEN'),
        ('job_design', 'Staff Product Designer', 'Design', 'Design system & UI', 'OPEN');`
    );

    // 4. Seed Applications across openings
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
       VALUES 
        ('app_eng_1', 'job_eng', 'Candidate Alpha', 'alpha@cand.test', 'LinkedIn', 'INTERVIEW'),
        ('app_eng_2', 'job_eng', 'Candidate Beta', 'beta@cand.test', 'Direct', 'SCREENING'),
        ('app_prod_1', 'job_prod', 'Candidate Gamma', 'gamma@cand.test', 'Referral', 'INTERVIEW'),
        ('app_design_1', 'job_design', 'Candidate Delta', 'delta@cand.test', 'Direct', 'APPLIED');`
    );

    // 5. Generate Tokens
    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewer1Token = AuthService.generateToken(interviewer1User);
    interviewer2Token = AuthService.generateToken(interviewer2User);
    interviewer3Token = AuthService.generateToken(interviewer3User);

    app = createApp();
  });

  describe('1. Many-to-Many Assignment Flexibility', () => {
    it('allows any number of interviewers to be assigned to a single application', async () => {
      // Recruiter assigns Interviewer 1 to Candidate Alpha
      const res1 = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });
      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);

      // Recruiter assigns Interviewer 2 to Candidate Alpha
      const res2 = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer2User.id });
      expect(res2.status).toBe(200);

      // Recruiter assigns Interviewer 3 to Candidate Alpha
      const res3 = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer3User.id });
      expect(res3.status).toBe(200);

      // Verify all 3 are in the panel on GET
      const detailRes = await request(app)
        .get('/api/applications/app_eng_1')
        .set('Authorization', `Bearer ${recruiterToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.interviewers.length).toBe(3);

      const assignedIds = detailRes.body.data.interviewers.map((i: any) => i.id);
      expect(assignedIds).toContain(interviewer1User.id);
      expect(assignedIds).toContain(interviewer2User.id);
      expect(assignedIds).toContain(interviewer3User.id);
    });

    it('allows an interviewer to be assigned to many applications across different job openings', async () => {
      // Assign Interviewer 1 to app_eng_1 (Engineering opening)
      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      // Assign Interviewer 1 to app_prod_1 (Product opening)
      await request(app)
        .post('/api/applications/app_prod_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      // Interviewer 1 views their applications list
      const listRes = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.total).toBe(2);
      expect(listRes.body.data.items.length).toBe(2);

      const assignedAppIds = listRes.body.data.items.map((a: any) => a.id);
      expect(assignedAppIds).toContain('app_eng_1');
      expect(assignedAppIds).toContain('app_prod_1');
    });
  });

  describe('2. Role Verification on Assignment', () => {
    it('allows assigning only users with the INTERVIEWER role', async () => {
      const res = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      expect(res.status).toBe(200);
      expect(res.body.data.interviewer.role).toBe(Role.INTERVIEWER);
    });

    it('STRICTLY FAILS when trying to assign a user who has RECRUITER role to an interview panel', async () => {
      const res = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: recruiterUser.id });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Only users with the INTERVIEWER role');
    });

    it('returns 404 when assigning a non-existent userId', async () => {
      const res = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: 'usr_non_existent' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Recruiter Assignment Management & Interviewer Authorization Boundaries', () => {
    it('allows Recruiter to remove an interviewer from a panel and logs a timeline event', async () => {
      // Assign first
      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      // Remove
      const deleteRes = await request(app)
        .delete(`/api/applications/app_eng_1/interviewers/${interviewer1User.id}`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify panel is now empty
      const detailRes = await request(app)
        .get('/api/applications/app_eng_1')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(detailRes.body.data.interviewers.length).toBe(0);

      // Verify INTERVIEWER_REMOVED timeline event
      const eventTypes = detailRes.body.data.timeline.map((e: any) => e.event_type);
      expect(eventTypes).toContain('INTERVIEWER_REMOVED');
    });

    it('STRICTLY FAILS when an Interviewer attempts to assign an interviewer', async () => {
      const res = await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ userId: interviewer2User.id });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('STRICTLY FAILS when an Interviewer attempts to remove an interviewer', async () => {
      const res = await request(app)
        .delete(`/api/applications/app_eng_1/interviewers/${interviewer2User.id}`)
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Server-Side Scoped Interviewer Views', () => {
    beforeEach(async () => {
      // Setup assignments:
      // app_eng_1 -> Interviewer 1 & Interviewer 2
      // app_prod_1 -> Interviewer 1
      // app_design_1 -> Interviewer 2
      // app_eng_2 -> Unassigned
      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer2User.id });

      await request(app)
        .post('/api/applications/app_prod_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });

      await request(app)
        .post('/api/applications/app_design_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer2User.id });
    });

    it('Interviewer 1 sees exactly one list containing every application they are assigned to across all openings', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const ids = res.body.data.items.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining(['app_eng_1', 'app_prod_1']));
      expect(ids).not.toContain('app_design_1');
      expect(ids).not.toContain('app_eng_2');
    });

    it('Interviewer 2 sees exactly their assigned applications across openings', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${interviewer2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const ids = res.body.data.items.map((a: any) => a.id);
      expect(ids).toEqual(expect.arrayContaining(['app_eng_1', 'app_design_1']));
      expect(ids).not.toContain('app_prod_1');
      expect(ids).not.toContain('app_eng_2');
    });

    it('Interviewer 3 with no assignments sees an empty list', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${interviewer3Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it('Recruiter sees all 4 applications across the organization', async () => {
      const res = await request(app)
        .get('/api/applications')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(4);
    });
  });

  describe('5. Application Detail Access Authorization', () => {
    beforeEach(async () => {
      // Assign Interviewer 1 to app_eng_1 only
      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });
    });

    it('allows Interviewer 1 to view details of assigned application app_eng_1', async () => {
      const res = await request(app)
        .get('/api/applications/app_eng_1')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.application.id).toBe('app_eng_1');
    });

    it('STRICTLY FAILS with 403 Forbidden when Interviewer 1 attempts to view unassigned application app_eng_2', async () => {
      const res = await request(app)
        .get('/api/applications/app_eng_2')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Access denied: Interviewers can only view');
    });
  });

  describe('6. Interviewer Feedback Workflow', () => {
    beforeEach(async () => {
      // Assign Interviewer 1 to app_eng_1
      await request(app)
        .post('/api/applications/app_eng_1/interviewers')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ userId: interviewer1User.id });
    });

    it('allows assigned Interviewer to submit feedback and records it in the timeline', async () => {
      const feedbackRes = await request(app)
        .post('/api/applications/app_eng_1/feedback')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ feedback: 'Strong problem-solving and clean code.' });

      expect(feedbackRes.status).toBe(200);
      expect(feedbackRes.body.success).toBe(true);
      expect(feedbackRes.body.data.note_content).toBe('Strong problem-solving and clean code.');

      // Inspect timeline
      const detailRes = await request(app)
        .get('/api/applications/app_eng_1')
        .set('Authorization', `Bearer ${interviewer1Token}`);

      const feedbackEvent = detailRes.body.data.timeline.find(
        (e: any) => e.event_type === EventType.INTERVIEWER_FEEDBACK
      );
      expect(feedbackEvent).toBeDefined();
      expect(feedbackEvent.note_content).toBe('Strong problem-solving and clean code.');
      expect(feedbackEvent.actor_id).toBe(interviewer1User.id);
    });

    it('STRICTLY FAILS when unassigned Interviewer attempts to leave feedback on app_eng_2', async () => {
      const res = await request(app)
        .post('/api/applications/app_eng_2/feedback')
        .set('Authorization', `Bearer ${interviewer1Token}`)
        .send({ feedback: 'Unauthorized feedback attempt' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
