import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';

describe('Database Schema & Model Verification', () => {
  let db: any;
  let schemaSql: string;

  beforeEach(() => {
    db = newDb();
    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.public.none(schemaSql);
  });

  it('creates all required tables and indexes', () => {
    const tables = db.public.many(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const tableNames = tables.map((t: any) => t.table_name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('job_openings');
    expect(tableNames).toContain('applications');
    expect(tableNames).toContain('application_interviewers');
    expect(tableNames).toContain('timeline_events');
    expect(tableNames).toContain('stalled_alert_dismissals');
  });

  describe('Users Table', () => {
    it('allows valid RECRUITER and INTERVIEWER roles', () => {
      db.public.none(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES 
          ('u1', 'Alice Recruiter', 'alice@example.com', 'hash1', 'RECRUITER'),
          ('u2', 'Bob Interviewer', 'bob@example.com', 'hash2', 'INTERVIEWER');
      `);

      const users = db.public.many(`SELECT * FROM users ORDER BY name ASC;`);
      expect(users.length).toBe(2);
      expect(users[0].name).toBe('Alice Recruiter');
      expect(users[0].role).toBe('RECRUITER');
      expect(users[1].name).toBe('Bob Interviewer');
      expect(users[1].role).toBe('INTERVIEWER');
    });

    it('enforces unique email constraint', () => {
      db.public.none(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('u1', 'Alice', 'alice@example.com', 'hash1', 'RECRUITER');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO users (id, name, email, password_hash, role)
          VALUES ('u2', 'Alice 2', 'alice@example.com', 'hash2', 'INTERVIEWER');
        `);
      }).toThrow();
    });

    it('rejects invalid roles', () => {
      expect(() => {
        db.public.none(`
          INSERT INTO users (id, name, email, password_hash, role)
          VALUES ('u1', 'Invalid User', 'invalid@example.com', 'hash1', 'ADMIN');
        `);
      }).toThrow();
    });
  });

  describe('Job Openings Table', () => {
    it('supports OPEN and ARCHIVED statuses', () => {
      db.public.none(`
        INSERT INTO job_openings (id, title, department, description, status)
        VALUES 
          ('j1', 'Senior Backend Engineer', 'Engineering', 'Build scalable APIs', 'OPEN'),
          ('j2', 'Sales Lead', 'Sales', 'Lead sales team', 'ARCHIVED');
      `);

      const openings = db.public.many(`SELECT * FROM job_openings;`);
      expect(openings.length).toBe(2);
    });

    it('rejects invalid status', () => {
      expect(() => {
        db.public.none(`
          INSERT INTO job_openings (id, title, department, description, status)
          VALUES ('j1', 'Bad Job', 'Engineering', 'Desc', 'CLOSED');
        `);
      }).toThrow();
    });
  });

  describe('Applications Table & Stage Integrity', () => {
    beforeEach(() => {
      db.public.none(`
        INSERT INTO job_openings (id, title, department, description, status)
        VALUES ('j1', 'Software Engineer', 'Engineering', 'Desc', 'OPEN');
      `);
    });

    it('supports all required stages and notes', () => {
      db.public.none(`
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage)
        VALUES 
          ('a1', 'j1', 'John Doe', 'john@example.com', 'LinkedIn', 'Top candidate', 'APPLIED'),
          ('a2', 'j1', 'Jane Smith', 'jane@example.com', 'Referral', 'Strong portfolio', 'SCREENING'),
          ('a3', 'j1', 'Charlie Brown', 'charlie@example.com', 'Direct', 'Great culture fit', 'INTERVIEW'),
          ('a4', 'j1', 'Diana Prince', 'diana@example.com', 'Agency', 'Offer extended', 'OFFER'),
          ('a5', 'j1', 'Evan Wright', 'evan@example.com', 'GitHub', 'Accepted offer', 'HIRED');
      `);

      const apps = db.public.many(`SELECT * FROM applications;`);
      expect(apps.length).toBe(5);
    });

    it('stores rejected_from_stage when application is marked REJECTED', () => {
      db.public.none(`
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage, rejected_from_stage)
        VALUES ('a1', 'j1', 'Rejected Candidate', 'rej@example.com', 'Career Site', 'REJECTED', 'INTERVIEW');
      `);

      const app = db.public.one(`SELECT * FROM applications WHERE id = 'a1';`);
      expect(app.current_stage).toBe('REJECTED');
      expect(app.rejected_from_stage).toBe('INTERVIEW');
    });

    it('enforces foreign key relation to job_openings', () => {
      expect(() => {
        db.public.none(`
          INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
          VALUES ('a1', 'non-existent-job', 'Ghost', 'ghost@example.com', 'Source', 'APPLIED');
        `);
      }).toThrow();
    });
  });

  describe('Interviewer Assignments (Many-to-Many)', () => {
    beforeEach(() => {
      db.public.none(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES 
          ('u1', 'Interviewer 1', 'int1@example.com', 'h1', 'INTERVIEWER'),
          ('u2', 'Interviewer 2', 'int2@example.com', 'h2', 'INTERVIEWER');
        INSERT INTO job_openings (id, title, department, description, status)
        VALUES ('j1', 'Frontend Engineer', 'Engineering', 'Desc', 'OPEN');
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
        VALUES ('a1', 'j1', 'Candidate 1', 'c1@example.com', 'Direct', 'INTERVIEW');
      `);
    });

    it('allows assigning multiple interviewers to an application', () => {
      db.public.none(`
        INSERT INTO application_interviewers (application_id, user_id)
        VALUES 
          ('a1', 'u1'),
          ('a1', 'u2');
      `);

      const assignments = db.public.many(`SELECT * FROM application_interviewers WHERE application_id = 'a1';`);
      expect(assignments.length).toBe(2);
    });

    it('enforces composite primary key on assignment', () => {
      db.public.none(`
        INSERT INTO application_interviewers (application_id, user_id)
        VALUES ('a1', 'u1');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO application_interviewers (application_id, user_id)
          VALUES ('a1', 'u1');
        `);
      }).toThrow();
    });
  });

  describe('Timeline Events (Application History)', () => {
    beforeEach(() => {
      db.public.none(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('u1', 'Recruiter Jane', 'jane@example.com', 'h1', 'RECRUITER');
        INSERT INTO job_openings (id, title, department, description, status)
        VALUES ('j1', 'DevOps Engineer', 'Infrastructure', 'Desc', 'OPEN');
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
        VALUES ('a1', 'j1', 'Sam Tech', 'sam@example.com', 'LinkedIn', 'APPLIED');
      `);
    });

    it('records immutable audit events with actor, stages, and notes', () => {
      db.public.none(`
        INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content)
        VALUES 
          ('t1', 'a1', 'APPLICATION_CREATED', 'u1', NULL, 'APPLIED', 'Application created by recruiter'),
          ('t2', 'a1', 'STAGE_CHANGE', 'u1', 'APPLIED', 'SCREENING', 'Passed resume screening'),
          ('t3', 'a1', 'INTERVIEWER_FEEDBACK', 'u1', 'SCREENING', 'SCREENING', 'Strong algorithmic skills'),
          ('t4', 'a1', 'REJECTION', 'u1', 'SCREENING', 'REJECTED', 'Culture fit mismatch'),
          ('t5', 'a1', 'REINSTATEMENT', 'u1', 'REJECTED', 'SCREENING', 'Reinstated for alternative team consideration');
      `);

      const events = db.public.many(`SELECT * FROM timeline_events WHERE application_id = 'a1' ORDER BY created_at ASC;`);
      expect(events.length).toBe(5);
      expect(events[0].event_type).toBe('APPLICATION_CREATED');
      expect(events[1].event_type).toBe('STAGE_CHANGE');
      expect(events[2].event_type).toBe('INTERVIEWER_FEEDBACK');
      expect(events[3].event_type).toBe('REJECTION');
      expect(events[4].event_type).toBe('REINSTATEMENT');
      expect(events[4].new_stage).toBe('SCREENING');
    });
  });

  describe('Stalled Alerts Dismissals', () => {
    beforeEach(() => {
      db.public.none(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ('u1', 'Recruiter Jane', 'jane@example.com', 'h1', 'RECRUITER');
        INSERT INTO job_openings (id, title, department, description, status)
        VALUES ('j1', 'QA Engineer', 'QA', 'Desc', 'OPEN');
        INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, current_stage)
        VALUES ('a1', 'j1', 'Test Candidate', 'test@example.com', 'Internal', 'SCREENING');
      `);
    });

    it('associates dismissal with specific stage period allowing subsequent stage alerts', () => {
      const stage1Time = '2026-01-01 10:00:00+00';
      const stage2Time = '2026-01-20 10:00:00+00';

      // Dismiss alert for SCREENING stage
      db.public.none(`
        INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at)
        VALUES ('d1', 'a1', 'u1', 'SCREENING', '${stage1Time}');
      `);

      // Candidate later advances to INTERVIEW stage and stalls -> New dismissal record allowed for INTERVIEW
      db.public.none(`
        INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at)
        VALUES ('d2', 'a1', 'u1', 'INTERVIEW', '${stage2Time}');
      `);

      const dismissals = db.public.many(`SELECT * FROM stalled_alert_dismissals WHERE application_id = 'a1';`);
      expect(dismissals.length).toBe(2);
      expect(dismissals[0].stage).toBe('SCREENING');
      expect(dismissals[1].stage).toBe('INTERVIEW');
    });

    it('prevents duplicate dismissals for the same stage instance', () => {
      const stageTime = '2026-01-01 10:00:00+00';

      db.public.none(`
        INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at)
        VALUES ('d1', 'a1', 'u1', 'SCREENING', '${stageTime}');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at)
          VALUES ('d2', 'a1', 'u1', 'SCREENING', '${stageTime}');
        `);
      }).toThrow();
    });
  });
});
