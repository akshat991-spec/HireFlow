import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage, OpeningStatus } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Recruiter Applications Listing & Server-Side Queries', () => {
  let memDb: any;
  let app: any;
  let recruiterToken: string;

  const recruiterUser = {
    id: 'usr_recruiter_01',
    name: 'Sarah Connor',
    email: 'recruiter@hireflow.test',
    role: Role.RECRUITER,
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

    // 2. Seed Recruiter User
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ('${recruiterUser.id}', '${recruiterUser.name}', '${recruiterUser.email}', '${passwordHash}', '${recruiterUser.role}');`
    );

    // 3. Seed Job Openings
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_backend', 'Backend Engineer', 'Engineering', 'Build APIs', 'OPEN'),
        ('job_frontend', 'Frontend Engineer', 'Engineering', 'Build UIs', 'OPEN'),
        ('job_sales', 'Account Executive', 'Sales', 'Enterprise Sales', 'OPEN');`
    );

    // 4. Seed Diverse Applications for Query Testing
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, rejected_from_stage, applied_date, updated_at)
       VALUES 
        ('app_01', 'job_backend', 'Ada Lovelace', 'ada.lovelace@math.org', 'LinkedIn', 'APPLIED', NULL, '2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z'),
        ('app_02', 'job_backend', 'Alan Turing', 'alan.turing@cambridge.ac.uk', 'Referral', 'SCREENING', NULL, '2026-01-02T10:00:00Z', '2026-01-03T10:00:00Z'),
        ('app_03', 'job_backend', 'Grace Hopper', 'grace.hopper@navy.mil', 'Direct', 'INTERVIEW', NULL, '2026-01-03T10:00:00Z', '2026-01-05T10:00:00Z'),
        ('app_04', 'job_backend', 'Claude Shannon', 'claude.shannon@bell.com', 'LinkedIn', 'OFFER', NULL, '2026-01-04T10:00:00Z', '2026-01-07T10:00:00Z'),
        ('app_05', 'job_backend', 'John von Neumann', 'john.neumann@ias.edu', 'Direct', 'HIRED', NULL, '2026-01-05T10:00:00Z', '2026-01-09T10:00:00Z'),
        ('app_06', 'job_frontend', 'Margaret Hamilton', 'margaret.hamilton@mit.edu', 'Referral', 'INTERVIEW', NULL, '2026-01-06T10:00:00Z', '2026-01-06T10:00:00Z'),
        ('app_07', 'job_frontend', 'Katherine Johnson', 'katherine.johnson@nasa.gov', 'LinkedIn', 'SCREENING', NULL, '2026-01-07T10:00:00Z', '2026-01-08T10:00:00Z'),
        ('app_08', 'job_frontend', 'Dennis Ritchie', 'dennis.ritchie@bell.com', 'Career Portal', 'APPLIED', NULL, '2026-01-08T10:00:00Z', '2026-01-08T10:00:00Z'),
        ('app_09', 'job_sales', 'Barbara Liskov', 'barbara.liskov@mit.edu', 'Referral', 'APPLIED', NULL, '2026-01-09T10:00:00Z', '2026-01-09T10:00:00Z'),
        ('app_10', 'job_sales', 'Donald Knuth', 'donald.knuth@stanford.edu', 'Direct', 'REJECTED', 'SCREENING', '2026-01-10T10:00:00Z', '2026-01-11T10:00:00Z');`
    );

    recruiterToken = AuthService.generateToken(recruiterUser);
    app = createApp();
  });

  describe('1. Search Functionality', () => {
    it('searches candidates by name (case-insensitive partial match)', async () => {
      const res = await request(app)
        .get('/api/applications?search=lovelace')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].candidate_name).toBe('Ada Lovelace');
    });

    it('searches candidates by email (case-insensitive partial match)', async () => {
      const res = await request(app)
        .get('/api/applications?search=@bell.com')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const names = res.body.data.items.map((i: any) => i.candidate_name);
      expect(names).toEqual(expect.arrayContaining(['Claude Shannon', 'Dennis Ritchie']));
    });
  });

  describe('2. Multi-Field Filter Criteria', () => {
    it('filters applications by stage', async () => {
      const res = await request(app)
        .get('/api/applications?stage=INTERVIEW')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(2);
      const names = res.body.data.items.map((i: any) => i.candidate_name);
      expect(names).toEqual(expect.arrayContaining(['Grace Hopper', 'Margaret Hamilton']));
    });

    it('filters applications by job opening', async () => {
      const res = await request(app)
        .get('/api/applications?jobOpeningId=job_frontend')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      const names = res.body.data.items.map((i: any) => i.candidate_name);
      expect(names).toEqual(expect.arrayContaining(['Margaret Hamilton', 'Katherine Johnson', 'Dennis Ritchie']));
    });

    it('filters applications by source', async () => {
      const res = await request(app)
        .get('/api/applications?source=Referral')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      const names = res.body.data.items.map((i: any) => i.candidate_name);
      expect(names).toEqual(expect.arrayContaining(['Alan Turing', 'Margaret Hamilton', 'Barbara Liskov']));
    });
  });

  describe('3. Combined Multi-Criteria Filtering', () => {
    it('supports search + stage + source + jobOpeningId combined in a single query', async () => {
      // Backend engineer, Referral, Alan Turing
      const res = await request(app)
        .get('/api/applications?jobOpeningId=job_backend&stage=SCREENING&source=Referral&search=Alan')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.items[0].candidate_name).toBe('Alan Turing');
    });

    it('returns empty list when combined filters match no candidates', async () => {
      const res = await request(app)
        .get('/api/applications?jobOpeningId=job_frontend&stage=HIRED&source=LinkedIn')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });
  });

  describe('4. Server-Side Sorting', () => {
    it('sorts applications by applied_date ascending and descending', async () => {
      const ascRes = await request(app)
        .get('/api/applications?sortBy=applied_date&sortOrder=asc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(ascRes.status).toBe(200);
      expect(ascRes.body.data.items[0].candidate_name).toBe('Ada Lovelace'); // Applied Jan 1

      const descRes = await request(app)
        .get('/api/applications?sortBy=applied_date&sortOrder=desc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(descRes.status).toBe(200);
      expect(descRes.body.data.items[0].candidate_name).toBe('Donald Knuth'); // Applied Jan 10
    });

    it('sorts applications by stage', async () => {
      const res = await request(app)
        .get('/api/applications?sortBy=stage&sortOrder=asc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBeGreaterThan(0);
    });

    it('sorts applications by last updated', async () => {
      const res = await request(app)
        .get('/api/applications?sortBy=updated_at&sortOrder=desc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].candidate_name).toBe('Donald Knuth'); // Updated Jan 11
    });
  });

  describe('5. Server-Side Pagination & Metadata', () => {
    it('paginates results across pages with exact total matching records and page metadata', async () => {
      // 10 total records, pageSize=4 -> 3 total pages
      const page1Res = await request(app)
        .get('/api/applications?page=1&pageSize=4&sortBy=applied_date&sortOrder=asc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.total).toBe(10);
      expect(page1Res.body.data.page).toBe(1);
      expect(page1Res.body.data.pageSize).toBe(4);
      expect(page1Res.body.data.totalPages).toBe(3);
      expect(page1Res.body.data.items.length).toBe(4);
      expect(page1Res.body.data.items[0].candidate_name).toBe('Ada Lovelace');

      // Page 2
      const page2Res = await request(app)
        .get('/api/applications?page=2&pageSize=4&sortBy=applied_date&sortOrder=asc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.data.total).toBe(10);
      expect(page2Res.body.data.page).toBe(2);
      expect(page2Res.body.data.items.length).toBe(4);
      expect(page2Res.body.data.items[0].candidate_name).toBe('John von Neumann'); // 5th record

      // Page 3 (Remaining 2 records)
      const page3Res = await request(app)
        .get('/api/applications?page=3&pageSize=4&sortBy=applied_date&sortOrder=asc')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(page3Res.status).toBe(200);
      expect(page3Res.body.data.total).toBe(10);
      expect(page3Res.body.data.page).toBe(3);
      expect(page3Res.body.data.items.length).toBe(2);
    });

    it('handles zero-results state gracefully with clean metadata', async () => {
      const res = await request(app)
        .get('/api/applications?search=NonExistentCandidateName')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.totalPages).toBe(1);
    });
  });
});
