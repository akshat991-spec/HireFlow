import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Recruiter Dashboard Real PostgreSQL Metrics', () => {
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

    // 2. Seed User
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ('${recruiterUser.id}', '${recruiterUser.name}', '${recruiterUser.email}', '${passwordHash}', '${recruiterUser.role}');`
    );

    // 3. Seed Openings (2 OPEN, 1 ARCHIVED)
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_open_1', 'Senior Backend Engineer', 'Engineering', 'API development', 'OPEN'),
        ('job_open_2', 'Product Designer', 'Design', 'Design systems', 'OPEN'),
        ('job_archived_1', 'Legacy Analyst', 'Finance', 'Old role', 'ARCHIVED');`
    );

    app = createApp();
    recruiterToken = AuthService.generateToken(recruiterUser);
  });

  it('1. Computes headline metrics with real data and precise date boundaries', async () => {
    const now = new Date();
    // Monday of current week
    const dayOfWeek = now.getUTCDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday, 12, 0, 0));
    const threeWeeksAgo = new Date(thisMonday.getTime() - 21 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2, 10, 0, 0));
    const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 10, 0, 0));

    // Seed diverse applications
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at, applied_date, rejected_from_stage)
       VALUES 
        ('app_1', 'job_open_1', 'Alice Applied', 'alice@test.com', 'LinkedIn', 'APPLIED', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', NULL),
        ('app_2', 'job_open_1', 'Bob Screening', 'bob@test.com', 'Referral', 'SCREENING', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', NULL),
        ('app_3', 'job_open_1', 'Charlie Interview This Week', 'charlie@test.com', 'Direct', 'INTERVIEW', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', NULL),
        ('app_4', 'job_open_1', 'David Interview Old', 'david@test.com', 'Direct', 'INTERVIEW', '${threeWeeksAgo.toISOString()}', '${threeWeeksAgo.toISOString()}', NULL),
        ('app_5', 'job_open_2', 'Eve Offer', 'eve@test.com', 'LinkedIn', 'OFFER', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', NULL),
        ('app_6', 'job_open_2', 'Frank Hired This Month', 'frank@test.com', 'LinkedIn', 'HIRED', '${thisMonthStart.toISOString()}', '${thisMonthStart.toISOString()}', NULL),
        ('app_7', 'job_open_2', 'Grace Hired Last Month', 'grace@test.com', 'LinkedIn', 'HIRED', '${previousMonth.toISOString()}', '${previousMonth.toISOString()}', NULL),
        ('app_8', 'job_open_2', 'Heidi Rejected', 'heidi@test.com', 'Agency', 'REJECTED', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', 'SCREENING'),
        ('app_archived', 'job_archived_1', 'Archived Opening Candidate', 'arch@test.com', 'LinkedIn', 'APPLIED', '${thisMonday.toISOString()}', '${thisMonday.toISOString()}', NULL);`
    );

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { headline } = res.body.data;

    // 2 open positions (excludes 1 archived)
    expect(headline.openPositions).toBe(2);

    // Active applications in open positions: app_1 (Applied), app_2 (Screening), app_3 (Interview), app_4 (Interview), app_5 (Offer) = 5
    expect(headline.activeApplications).toBe(5);

    // Interviews scheduled/entered this week: app_3 (entered this week), app_4 was 3 weeks ago -> exactly 1
    expect(headline.interviewsThisWeek).toBe(1);

    // Hires this month: app_6 (this month), app_7 was last month -> exactly 1
    expect(headline.hiresThisMonth).toBe(1);
  });

  it('2. Returns accurate stage and job opening breakdowns', async () => {
    const nowIso = new Date().toISOString();

    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at, applied_date)
       VALUES 
        ('app_a', 'job_open_1', 'Candidate A', 'a@test.com', 'LinkedIn', 'APPLIED', '${nowIso}', '${nowIso}'),
        ('app_b', 'job_open_1', 'Candidate B', 'b@test.com', 'LinkedIn', 'SCREENING', '${nowIso}', '${nowIso}'),
        ('app_c', 'job_open_1', 'Candidate C', 'c@test.com', 'LinkedIn', 'INTERVIEW', '${nowIso}', '${nowIso}'),
        ('app_d', 'job_open_2', 'Candidate D', 'd@test.com', 'Referral', 'OFFER', '${nowIso}', '${nowIso}');`
    );

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    const { byOpening, byStage } = res.body.data;

    // Opening 1 has 3 applications, Opening 2 has 1 application
    expect(byOpening.length).toBe(2);
    const open1 = byOpening.find((o: any) => o.jobOpeningId === 'job_open_1');
    const open2 = byOpening.find((o: any) => o.jobOpeningId === 'job_open_2');
    expect(open1.totalApplications).toBe(3);
    expect(open1.activeApplications).toBe(3);
    expect(open2.totalApplications).toBe(1);
    expect(open2.activeApplications).toBe(1);

    // Stage counts
    expect(byStage.find((s: any) => s.stage === Stage.APPLIED).count).toBe(1);
    expect(byStage.find((s: any) => s.stage === Stage.SCREENING).count).toBe(1);
    expect(byStage.find((s: any) => s.stage === Stage.INTERVIEW).count).toBe(1);
    expect(byStage.find((s: any) => s.stage === Stage.OFFER).count).toBe(1);
    expect(byStage.find((s: any) => s.stage === Stage.HIRED).count).toBe(0);
  });

  it('3. Computes 12-week quarterly application volume trend', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    const { weeklyTrend } = res.body.data;

    // 12 weeks of data
    expect(weeklyTrend.length).toBe(12);
    expect(weeklyTrend[0]).toHaveProperty('weekLabel');
    expect(weeklyTrend[0]).toHaveProperty('weekStart');
    expect(weeklyTrend[0]).toHaveProperty('count');
  });

  it('4. Provides useful stalled-application information and excludes dismissed periods', async () => {
    const twelveDaysAgo = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at, applied_date)
       VALUES 
        ('app_stalled_1', 'job_open_1', 'Stalled One', 's1@test.com', 'Direct', 'INTERVIEW', '${twelveDaysAgo}', '${twelveDaysAgo}'),
        ('app_fresh_1', 'job_open_1', 'Fresh One', 'f1@test.com', 'Direct', 'INTERVIEW', '${twoDaysAgo}', '${twoDaysAgo}');`
    );

    const res1 = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.data.stalledSummary.totalStalled).toBe(1);
    expect(res1.body.data.stalledSummary.longestDays).toBeGreaterThanOrEqual(12);
    expect(res1.body.data.stalledSummary.byStage[Stage.INTERVIEW]).toBe(1);

    // Dismiss the alert
    await request(app)
      .post('/api/alerts/stalled/app_stalled_1/dismiss')
      .set('Authorization', `Bearer ${recruiterToken}`);

    // Re-query dashboard
    const res2 = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.stalledSummary.totalStalled).toBe(0);
  });

  it('5. Requires authentication for dashboard metrics access', async () => {
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('6. Scopes dashboard metrics strictly to assigned candidates when user is an interviewer', async () => {
    // Seed interviewer user
    const interviewerUser = {
      id: 'usr_interviewer_test',
      name: 'Test Interviewer',
      email: 'interviewer_test@hireflow.test',
      role: Role.INTERVIEWER,
    };
    const passwordHash = await AuthService.hashPassword('password123');
    memDb.public.none(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ('${interviewerUser.id}', '${interviewerUser.name}', '${interviewerUser.email}', '${passwordHash}', '${interviewerUser.role}');`
    );

    // Seed 3 applications across 2 openings
    // App 1: In job_open_1, ASSIGNED to interviewerUser
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, applied_date, stage_entered_at)
       VALUES ('app_assigned_1', 'job_open_1', 'Assigned Candidate', 'assigned@example.com', 'LinkedIn', 'INTERVIEW', NOW(), NOW());`
    );
    memDb.public.none(
      `INSERT INTO application_interviewers (application_id, user_id, assigned_at)
       VALUES ('app_assigned_1', '${interviewerUser.id}', NOW());`
    );

    // App 2: In job_open_1, NOT ASSIGNED
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, applied_date, stage_entered_at)
       VALUES ('app_unassigned_1', 'job_open_1', 'Other Candidate', 'other@example.com', 'Referral', 'SCREENING', NOW(), NOW());`
    );

    // App 3: In job_open_2, NOT ASSIGNED
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, applied_date, stage_entered_at)
       VALUES ('app_unassigned_2', 'job_open_2', 'Design Candidate', 'design@example.com', 'Direct', 'APPLIED', NOW(), NOW());`
    );

    const interviewerToken = AuthService.generateToken(interviewerUser);

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${interviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Interviewer must ONLY see their 1 assigned candidate
    expect(res.body.data.headline.activeApplications).toBe(1);
    // Interviewer must ONLY see the 1 opening where they have an assigned candidate
    expect(res.body.data.headline.openPositions).toBe(1);
    // Openings list should only contain job_open_1
    expect(res.body.data.byOpening.length).toBe(1);
    expect(res.body.data.byOpening[0].jobOpeningId).toBe('job_open_1');
    expect(res.body.data.byOpening[0].activeApplications).toBe(1);

    // Stage counts should only count their assigned candidate (1 in INTERVIEW)
    const interviewStage = res.body.data.byStage.find((s: any) => s.stage === Stage.INTERVIEW);
    expect(interviewStage?.count).toBe(1);
    const appliedStage = res.body.data.byStage.find((s: any) => s.stage === Stage.APPLIED);
    expect(appliedStage?.count).toBe(0);
  });
});
