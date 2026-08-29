-- PostgreSQL Schema for HireFlow Hiring Pipeline Management System

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('recruiter', 'interviewer')),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_openings (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
    id VARCHAR(36) PRIMARY KEY,
    job_opening_id VARCHAR(36) NOT NULL REFERENCES job_openings(id) ON DELETE CASCADE,
    candidate_name VARCHAR(255) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,
    notes TEXT,
    current_stage VARCHAR(32) NOT NULL CHECK (current_stage IN ('Applied', 'Screening', 'Interview', 'Offer', 'Hired')),
    stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    rejected_from_stage VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_interviewers (
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (application_id, user_id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('created', 'stage_change', 'rejected', 'reinstated', 'feedback', 'interviewer_assigned', 'interviewer_removed')),
    actor_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
    old_stage VARCHAR(32),
    new_stage VARCHAR(32),
    note_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stalled_alert_dismissals (
    id VARCHAR(36) PRIMARY KEY,
    application_id VARCHAR(36) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dismissed_stage VARCHAR(32) NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (application_id, dismissed_stage)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_opening_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(current_stage);
CREATE INDEX IF NOT EXISTS idx_applications_candidate_email ON applications(candidate_email);
CREATE INDEX IF NOT EXISTS idx_timeline_app ON timeline_events(application_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON timeline_events(created_at);
CREATE INDEX IF NOT EXISTS idx_app_interviewers_user ON application_interviewers(user_id);
