import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/services/auth.service.js';
import { Role } from '../src/types/index.js';
import * as dbModule from '../src/db/index.js';

describe('Recruiter Pipeline CSV Export', () => {
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

    // 3. Seed Job Openings (2 OPEN, 1 ARCHIVED)
    memDb.public.none(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES 
        ('job_open_1', 'Staff Backend Engineer', 'Engineering', 'API development', 'OPEN'),
        ('job_open_2', 'Product Designer', 'Design', 'UI/UX design', 'OPEN'),
        ('job_archived_1', 'Legacy Analyst', 'Finance', 'Old role', 'ARCHIVED');`
    );

    // 4. Seed Applications across openings with special characters
    memDb.public.none(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage, applied_date)
       VALUES 
        ('app_1', 'job_open_1', 'Lovelace, Ada', 'ada@math.org', 'LinkedIn', 'Great with "algorithms" and logic', 'INTERVIEW', '2026-01-01T10:00:00Z'),
        ('app_2', 'job_open_1', 'Alan Turing', 'alan@cambridge.ac.uk', 'Referral', 'Strong technical background.\nSecond round pending.', 'SCREENING', '2026-01-02T10:00:00Z'),
        ('app_3', 'job_open_2', 'Margaret Hamilton', 'margaret@mit.edu', 'Direct', 'Apollo software lead', 'OFFER', '2026-01-03T10:00:00Z'),
        ('app_archived', 'job_archived_1', 'Archived Candidate', 'archived@test.com', 'Direct', 'Should not be in export', 'APPLIED', '2026-01-04T10:00:00Z');`
    );

    // 5. Assign Interviewer to app_1
    memDb.public.none(
      `INSERT INTO application_interviewers (application_id, user_id)
       VALUES ('app_1', '${interviewerUser.id}');`
    );

    recruiterToken = AuthService.generateToken(recruiterUser);
    interviewerToken = AuthService.generateToken(interviewerUser);
    app = createApp();
  });

  it('exports applications across all OPEN job openings as CSV with proper headers and data', async () => {
    const res = await request(app)
      .get('/api/applications/export')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename="hireflow_pipeline_export_');

    const csvText = res.text;
    expect(csvText).toBeDefined();

    // Verify CSV Header line
    expect(csvText).toContain('Application ID,Candidate Name,Candidate Email,Job Title,Department,Current Stage,Source,Applied Date,Interview Panel,Notes');

    // Verify OPEN opening candidates are included
    expect(csvText).toContain('Lovelace, Ada');
    expect(csvText).toContain('Alan Turing');
    expect(csvText).toContain('Margaret Hamilton');

    // Verify ARCHIVED opening candidate is excluded
    expect(csvText).not.toContain('Archived Candidate');
    expect(csvText).not.toContain('Legacy Analyst');
  });

  it('properly escapes commas, quotes, and newlines in CSV fields according to RFC 4180', async () => {
    const res = await request(app)
      .get('/api/applications/export')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    const csvText = res.text;

    // Name containing comma must be wrapped in quotes
    expect(csvText).toContain('"Lovelace, Ada"');

    // Note containing quotes must have double-quotes escaped as ""
    expect(csvText).toContain('"Great with ""algorithms"" and logic"');

    // Note containing newlines must be quoted
    expect(csvText).toContain('"Strong technical background.\nSecond round pending."');
  });

  it('includes assigned interviewers in the Interview Panel column', async () => {
    const res = await request(app)
      .get('/api/applications/export')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Alex Rivera');
  });

  it('returns valid CSV header row when no applications match open job openings', async () => {
    // Delete all applications
    memDb.public.none('DELETE FROM applications;');

    const res = await request(app)
      .get('/api/applications/export')
      .set('Authorization', `Bearer ${recruiterToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');

    const lines = res.text.trim().split('\r\n');
    expect(lines.length).toBe(1); // Header row only
    expect(lines[0]).toBe('Application ID,Candidate Name,Candidate Email,Job Title,Department,Current Stage,Source,Applied Date,Interview Panel,Notes');
  });

  it('STRICTLY FAILS with 403 Forbidden when an Interviewer attempts to export pipeline CSV', async () => {
    const res = await request(app)
      .get('/api/applications/export')
      .set('Authorization', `Bearer ${interviewerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('STRICTLY FAILS with 401 Unauthorized when no authentication token is provided', async () => {
    const res = await request(app)
      .get('/api/applications/export');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
