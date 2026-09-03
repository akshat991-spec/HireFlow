import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, OpeningStatus, Stage } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Job Openings Management & Lifecycle (Requirement 2 & 3)', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;
  let interviewerToken: string;

  const recruiterUser = {
    id: 'usr_recruiter_01',
    name: 'Sarah Recruiter',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
  };

  const interviewerUser = {
    id: 'usr_interviewer_01',
    name: 'Ian Interviewer',
    email: 'interviewer@hireflow.test',
    role: Role.INTERVIEWER,
  };

  beforeEach(async () => {
    memDb = newDb();
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    memDb.public.none(schemaSql);

    const { Pool } = memDb.adapters.createPg();
    const mockPool = new Pool();
    dbModule.setPool(mockPool);

    // Seed users
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES 
        ('${recruiterUser.id}', '${recruiterUser.name}', '${recruiterUser.email}', '${passwordHash}', '${recruiterUser.role}'),
        ('${interviewerUser.id}', '${interviewerUser.name}', '${interviewerUser.email}', '${passwordHash}', '${interviewerUser.role}');
    `);

    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);

    app = createApp();
  });

  describe('1. Create Job Opening', () => {
    it('allows Recruiter to create a job opening with title, department, and description', async () => {
      const res = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: 'Senior Frontend Engineer',
          department: 'Engineering',
          description: 'Build modern React user interfaces with high performance.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Senior Frontend Engineer');
      expect(res.body.data.department).toBe('Engineering');
      expect(res.body.data.status).toBe(OpeningStatus.OPEN);
      expect(res.body.data).toHaveProperty('id');
    });

    it('rejects creation when required fields are missing or empty', async () => {
      const res = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: '',
          department: 'Engineering',
          description: '',
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('STRICTLY FAILS when Interviewer attempts to create a job opening', async () => {
      const res = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({
          title: 'Unauthorized Opening',
          department: 'Engineering',
          description: 'Description',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Edit Job Opening', () => {
    let openingId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: 'Initial Title',
          department: 'Product',
          description: 'Initial Description',
        });
      openingId = res.body.data.id;
    });

    it('allows Recruiter to edit job opening fields', async () => {
      const res = await request(app)
        .put(`/api/openings/${openingId}`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: 'Updated Product Manager',
          department: 'Product Growth',
          description: 'Updated responsibilities and growth targets.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify updated details
      const viewRes = await request(app)
        .get(`/api/openings/${openingId}`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(viewRes.body.data.title).toBe('Updated Product Manager');
      expect(viewRes.body.data.department).toBe('Product Growth');
    });

    it('STRICTLY FAILS when Interviewer attempts to edit a job opening', async () => {
      const res = await request(app)
        .put(`/api/openings/${openingId}`)
        .set('Authorization', `Bearer ${interviewerToken}`)
        .send({
          title: 'Hacked Title',
          department: 'Engineering',
          description: 'New Desc',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Archive & Restore Lifecycle (Application Preservation)', () => {
    let openingId: string;
    let appId: string;

    beforeEach(async () => {
      // 1. Create opening
      const opRes = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: 'Infrastructure Architect',
          department: 'Cloud',
          description: 'Manage AWS/GCP infrastructure.',
        });
      openingId = opRes.body.data.id;

      // 2. Insert candidate application in this opening
      appId = 'app_cand_101';
      memDb.public.none(`
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
        VALUES ('${appId}', '${openingId}', 'Grace Hopper', 'grace@navy.mil', 'Referral', 'INTERVIEW');
      `);
    });

    it('archives an opening without deleting associated applications', async () => {
      // Archive opening
      const archiveRes = await request(app)
        .post(`/api/openings/${openingId}/archive`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.success).toBe(true);
      expect(archiveRes.body.data.status).toBe(OpeningStatus.ARCHIVED);

      // Default active view should NOT include the archived opening
      const activeListRes = await request(app)
        .get('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`);

      const activeIds = activeListRes.body.data.map((o: any) => o.id);
      expect(activeIds).not.toContain(openingId);

      // Explicit archived view DOES include it
      const archivedListRes = await request(app)
        .get('/api/openings?status=ARCHIVED')
        .set('Authorization', `Bearer ${recruiterToken}`);

      const archivedIds = archivedListRes.body.data.map((o: any) => o.id);
      expect(archivedIds).toContain(openingId);

      // Application inside the archived opening must still exist and be intact
      const appRecord = memDb.public.one(`SELECT * FROM applications WHERE id = '${appId}';`);
      expect(appRecord.id).toBe(appId);
      expect(appRecord.candidate_name).toBe('Grace Hopper');
      expect(appRecord.current_stage).toBe('INTERVIEW');
    });

    it('restores an archived opening back to the active default view', async () => {
      // Archive first
      await request(app)
        .post(`/api/openings/${openingId}/archive`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      // Restore
      const restoreRes = await request(app)
        .post(`/api/openings/${openingId}/restore`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.data.status).toBe(OpeningStatus.OPEN);

      // Opening now appears in default active list
      const activeListRes = await request(app)
        .get('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`);

      const activeIds = activeListRes.body.data.map((o: any) => o.id);
      expect(activeIds).toContain(openingId);
    });

    it('STRICTLY FAILS when Interviewer attempts to archive or restore an opening', async () => {
      const archiveRes = await request(app)
        .post(`/api/openings/${openingId}/archive`)
        .set('Authorization', `Bearer ${interviewerToken}`);

      expect(archiveRes.status).toBe(403);

      const restoreRes = await request(app)
        .post(`/api/openings/${openingId}/restore`)
        .set('Authorization', `Bearer ${interviewerToken}`);

      expect(restoreRes.status).toBe(403);
    });
  });

  describe('4. View Opening Details with Candidate Breakdown', () => {
    it('returns opening details and its list of candidates with counts', async () => {
      // 1. Create opening
      const opRes = await request(app)
        .post('/api/openings')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          title: 'Sales Executive',
          department: 'Sales',
          description: 'Close enterprise software deals.',
        });
      const openingId = opRes.body.data.id;

      // 2. Add candidates in different stages
      memDb.public.none(`
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
        VALUES 
          ('app_1', '${openingId}', 'Cand 1', 'c1@test.com', 'Direct', 'APPLIED'),
          ('app_2', '${openingId}', 'Cand 2', 'c2@test.com', 'LinkedIn', 'INTERVIEW'),
          ('app_3', '${openingId}', 'Cand 3', 'c3@test.com', 'Referral', 'HIRED');
      `);

      const res = await request(app)
        .get(`/api/openings/${openingId}`)
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Sales Executive');
      expect(res.body.data.application_count).toBe(3);
      expect(res.body.data.active_count).toBe(2); // APPLIED and INTERVIEW are active; HIRED is terminal
      expect(res.body.data.applications.length).toBe(3);
    });
  });
});
