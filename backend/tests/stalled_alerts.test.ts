import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role, Stage } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Stalled Application Alerts & Dismissal Lifecycle', () => {
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

    // 3. Seed Job Openings (1 OPEN, 1 ARCHIVED)
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_open_1', 'Senior Backend Engineer', 'Engineering', 'Core backend systems', 'OPEN'),
        ('job_archived_1', 'Legacy Analyst', 'Finance', 'Old role', 'ARCHIVED');`
    );

    app = createApp();
    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);
  });

  it('1. Threshold Detection: ignores applications under 10 days, detects applications over 10 days in active stage', async () => {
    const now = Date.now();
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    const twelveDaysAgo = new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString();

    // App 1: In Screening for 5 days (< 10 days threshold -> NOT stalled)
    // App 2: In Interview for 12 days (> 10 days threshold -> STALLED)
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at)
       VALUES 
        ('app_fresh', 'job_open_1', 'Fresh Candidate', 'fresh@example.com', 'LinkedIn', 'SCREENING', '${fiveDaysAgo}'),
        ('app_stalled', 'job_open_1', 'Stalled Candidate', 'stalled@example.com', 'Referral', 'INTERVIEW', '${twelveDaysAgo}');`
    );

    const res = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBe(1);
    expect(res.body.data.alerts.length).toBe(1);
    expect(res.body.data.alerts[0].applicationId).toBe('app_stalled');
    expect(res.body.data.alerts[0].candidateName).toBe('Stalled Candidate');
    expect(res.body.data.alerts[0].currentStage).toBe(Stage.INTERVIEW);
    expect(res.body.data.alerts[0].daysInStage).toBeGreaterThanOrEqual(12);
  });

  it('2. Excludes terminal stages (HIRED, REJECTED) and ARCHIVED job openings', async () => {
    const now = Date.now();
    const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();

    // Hired application (terminal)
    // Rejected application (terminal)
    // Application under archived opening
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at, rejected_from_stage)
       VALUES 
        ('app_hired', 'job_open_1', 'Hired Person', 'hired@example.com', 'LinkedIn', 'HIRED', '${fifteenDaysAgo}', NULL),
        ('app_rejected', 'job_open_1', 'Rejected Person', 'rejected@example.com', 'LinkedIn', 'REJECTED', '${fifteenDaysAgo}', 'INTERVIEW'),
        ('app_archived_job', 'job_archived_1', 'Archived Job Candidate', 'arch@example.com', 'Direct', 'SCREENING', '${fifteenDaysAgo}', NULL);`
    );

    const res = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.alerts).toEqual([]);
  });

  it('3. Complete Lifecycle: Stalled in Interview -> Dismissed -> Stays in Interview (Remains Dismissed) -> Advances to Offer -> Stalls in Offer (NEW Alert Appears)', async () => {
    const now = Date.now();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Candidate enters Interview and stays for 14 days
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at)
       VALUES ('app_lifecycle', 'job_open_1', 'Marcus Vance', 'marcus@example.com', 'Referral', 'INTERVIEW', '${fourteenDaysAgo}');`
    );

    // Step 2: Stalled alert appears
    const initialAlertsRes = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(initialAlertsRes.status).toBe(200);
    expect(initialAlertsRes.body.data.count).toBe(1);
    expect(initialAlertsRes.body.data.alerts[0].candidateName).toBe('Marcus Vance');
    expect(initialAlertsRes.body.data.alerts[0].currentStage).toBe(Stage.INTERVIEW);

    // Also check lightweight count endpoint
    const countRes = await request(app)
      .get('/api/alerts/count')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(countRes.status).toBe(200);
    expect(countRes.body.data.count).toBe(1);

    // Step 3: Recruiter dismisses the alert for this Interview period
    const dismissRes = await request(app)
      .post('/api/alerts/stalled/app_lifecycle/dismiss')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(dismissRes.status).toBe(200);
    expect(dismissRes.body.success).toBe(true);
    expect(dismissRes.body.data.dismissed).toBe(true);
    expect(dismissRes.body.data.stage).toBe(Stage.INTERVIEW);

    // Step 4: Active alerts list is now empty
    const afterDismissRes = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(afterDismissRes.status).toBe(200);
    expect(afterDismissRes.body.data.count).toBe(0);
    expect(afterDismissRes.body.data.alerts).toEqual([]);

    // Step 5: Candidate remains in INTERVIEW (simulate time passing without stage change)
    const laterDismissCheck = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(laterDismissCheck.body.data.count).toBe(0);

    // Step 6: Candidate advances from INTERVIEW to OFFER
    const advanceRes = await request(app)
      .post('/api/applications/app_lifecycle/stage')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ targetStage: Stage.OFFER, note: 'Advanced to Offer after interview panel review' });

    expect(advanceRes.status).toBe(200);
    expect(advanceRes.body.data.current_stage).toBe(Stage.OFFER);

    // Immediately after advance: Fresh in OFFER -> No stalled alert
    const freshOfferRes = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(freshOfferRes.body.data.count).toBe(0);

    // Step 7: Candidate remains in OFFER for > 10 days (simulate 15 days in OFFER)
    const fifteenDaysAgoOffer = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    memDb.public.none(
      `UPDATE applications SET stage_entered_at = '${fifteenDaysAgoOffer}' WHERE id = 'app_lifecycle';`
    );

    // Step 8: A NEW Offer stalled alert MUST appear!
    const newOfferAlertRes = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(newOfferAlertRes.status).toBe(200);
    expect(newOfferAlertRes.body.data.count).toBe(1);
    expect(newOfferAlertRes.body.data.alerts[0].applicationId).toBe('app_lifecycle');
    expect(newOfferAlertRes.body.data.alerts[0].currentStage).toBe(Stage.OFFER);
    expect(newOfferAlertRes.body.data.alerts[0].daysInStage).toBeGreaterThanOrEqual(15);
  });

  it('4. Authorization: Strictly blocks interviewers from viewing or dismissing alerts with 403 Forbidden', async () => {
    // 1. GET /api/alerts/stalled blocked for interviewers
    const getRes = await request(app)
      .get('/api/alerts/stalled')
      .set('Authorization', `Bearer ${interviewerToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.success).toBe(false);
    expect(getRes.body.error.code).toBe('FORBIDDEN');

    // 2. GET /api/alerts/count blocked for interviewers
    const countRes = await request(app)
      .get('/api/alerts/count')
      .set('Authorization', `Bearer ${interviewerToken}`);

    expect(countRes.status).toBe(403);

    // 3. POST /api/alerts/stalled/:id/dismiss blocked for interviewers
    const dismissRes = await request(app)
      .post('/api/alerts/stalled/any_app_id/dismiss')
      .set('Authorization', `Bearer ${interviewerToken}`);

    expect(dismissRes.status).toBe(403);

    // 4. Unauthenticated blocked with 401
    const unauthRes = await request(app).get('/api/alerts/stalled');
    expect(unauthRes.status).toBe(401);
  });

  it('5. Error Handling: Returns 404 when dismissing a non-existent application', async () => {
    const res = await request(app)
      .post('/api/alerts/stalled/non_existent_app_id/dismiss')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('6. Idempotent Dismissal: Multiple dismissals for the same stage period succeed without error', async () => {
    const now = Date.now();
    const twelveDaysAgo = new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString();

    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, stage_entered_at)
       VALUES ('app_idempotent', 'job_open_1', 'David Kim', 'david@example.com', 'LinkedIn', 'APPLIED', '${twelveDaysAgo}');`
    );

    // First dismissal
    const res1 = await request(app)
      .post('/api/alerts/stalled/app_idempotent/dismiss')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.dismissed).toBe(true);

    // Second dismissal on same stage period (idempotent)
    const res2 = await request(app)
      .post('/api/alerts/stalled/app_idempotent/dismiss')
      .set('Authorization', `Bearer ${recruiterToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.dismissed).toBe(true);
  });
});
