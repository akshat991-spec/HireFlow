-- ============================================================================
-- PostgreSQL Schema for HireFlow Hiring Pipeline Management System
-- ============================================================================

-- 1. Users Table
-- Supports roles: RECRUITER, INTERVIEWER
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('RECRUITER', 'INTERVIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Job Openings Table
-- Statuses: OPEN, ARCHIVED
CREATE TABLE IF NOT EXISTS job_openings (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Applications Table
-- Stages: APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED
-- Retains rejected_from_stage to enable exact stage restoration
CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) PRIMARY KEY,
    job_opening_id VARCHAR(36) NOT NULL REFERENCES job_openings(id) ON DELETE RESTRICT,
    candidate_name VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,
    notes TEXT,
    current_stage VARCHAR(32) NOT NULL CHECK (current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED')),
    applied_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rejected_from_stage VARCHAR(32) CHECK (rejected_from_stage IS NULL OR rejected_from_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_rejected_origin CHECK (
        (current_stage = 'REJECTED' AND rejected_from_stage IS NOT NULL) OR
        (current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'))
    )
);

-- 4. Interviewer Assignments Table (Many-to-Many: Application <-> Interviewer)
CREATE TABLE IF NOT EXISTS application_interviewers (
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (application_id, user_id)
);

-- 5. Application History / Timeline Events (Append-Only Audit Log)
-- Event Types: APPLICATION_CREATED, STAGE_CHANGE, REJECTION, REINSTATEMENT, INTERVIEWER_FEEDBACK, INTERVIEWER_ASSIGNED, INTERVIEWER_REMOVED
CREATE TABLE IF NOT EXISTS timeline_events (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN (
        'APPLICATION_CREATED',
        'STAGE_CHANGE',
        'REJECTION',
        'REINSTATEMENT',
        'INTERVIEWER_FEEDBACK',
        'INTERVIEWER_ASSIGNED',
        'INTERVIEWER_REMOVED'
    )),
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    old_stage VARCHAR(32),
    new_stage VARCHAR(32),
    note_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Stalled Alerts Dismissals Table
-- Tracks dismissal per application stage instance
CREATE TABLE IF NOT EXISTS stalled_alert_dismissals (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage VARCHAR(32) NOT NULL,
    stage_entered_at TIMESTAMPTZ NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (application_id, stage, stage_entered_at)
);

-- ============================================================================
-- Indexes for High Performance Queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_job_openings_status ON job_openings(status);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_applications_current_stage ON applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_email ON applications(candidate_email);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_name ON applications(candidate_name);
CREATE INDEX IF NOT EXISTS idx_applications_source ON applications(source);
CREATE INDEX IF NOT EXISTS idx_applications_applied_date ON applications(applied_date DESC);
CREATE INDEX IF NOT EXISTS idx_applications_updated_at ON applications(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_stage_entered ON applications(stage_entered_at);
CREATE INDEX IF NOT EXISTS idx_applications_composite_filter ON applications(job_opening_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_app_interviewers_user ON application_interviewers(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_app_created ON timeline_events(application_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_stalled_dismissals_lookup ON stalled_alert_dismissals(application_id, stage);
