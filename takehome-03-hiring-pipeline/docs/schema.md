# Schema Documentation

This document describes the PostgreSQL relational database model for the **HireFlow** Hiring Pipeline Management System.

---

## 1. Table-by-Table Schema Definition

### `users`
Stores system accounts with credentials and role definitions for authorization.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | No | — | Primary Key (UUID) |
| `name` | `VARCHAR(255)` | No | — | User's full display name |
| `email` | `VARCHAR(255)` | No | — | Unique identifier / login email (`UNIQUE`) |
| `password_hash` | `VARCHAR(255)` | No | — | Securely hashed password (e.g. bcrypt) |
| `role` | `VARCHAR(32)` | No | — | `CHECK (role IN ('RECRUITER', 'INTERVIEWER'))` |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Timestamp of last user profile update |

---

### `job_openings`
Stores positions opened by recruiters with status tracking.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | No | — | Primary Key (UUID) |
| `title` | `VARCHAR(255)` | No | — | Job title (e.g. "Senior Backend Engineer") |
| `department` | `VARCHAR(255)` | No | — | Department (e.g. "Engineering", "Sales") |
| `description` | `TEXT` | No | — | Detailed job description and requirements |
| `status` | `VARCHAR(32)` | No | `'OPEN'` | `CHECK (status IN ('OPEN', 'ARCHIVED'))` |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Opening creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Opening modification timestamp |

---

### `applications`
Core entity tracking candidate applications, stage progression, and rejection/restoration state.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | No | — | Primary Key (UUID) |
| `job_opening_id` | `VARCHAR(36)` | No | — | Foreign Key → `job_openings(id)` (`ON DELETE RESTRICT`) |
| `candidate_name` | `VARCHAR(255)` | No | — | Full name of the candidate |
| `candidate_email` | `VARCHAR(255)` | No | — | Email address of the candidate |
| `source` | `VARCHAR(255)` | No | — | Application source (e.g. "LinkedIn", "Referral", "Direct") |
| `notes` | `TEXT` | Yes | `NULL` | Optional recruiter/application notes |
| `current_stage` | `VARCHAR(32)` | No | — | `CHECK (current_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'))` |
| `applied_date` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Initial date application was received |
| `stage_entered_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Timestamp when application entered `current_stage` |
| `rejected_from_stage` | `VARCHAR(32)` | Yes | `NULL` | `CHECK (rejected_from_stage IS NULL OR rejected_from_stage IN ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'))` |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Last updated timestamp |

**Check Constraint**:
* `check_rejected_origin`: Ensures that if `current_stage = 'REJECTED'`, `rejected_from_stage` is non-null, guaranteeing that a candidate can always be reinstated back to their exact prior stage.

---

### `application_interviewers`
Junction table managing many-to-many assignments between applications and interviewer users.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `application_id` | `VARCHAR(36)` | No | — | Foreign Key → `applications(id)` (`ON DELETE CASCADE`) |
| `user_id` | `VARCHAR(36)` | No | — | Foreign Key → `users(id)` (`ON DELETE CASCADE`) |
| `assigned_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Assignment timestamp |

**Primary Key**: `(application_id, user_id)` (Composite Primary Key).

---

### `timeline_events`
Append-only immutable audit trail recording lifecycle events, stage transitions, rejections, reinstatements, and interviewer feedback.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | No | — | Primary Key (UUID) |
| `application_id` | `VARCHAR(36)` | No | — | Foreign Key → `applications(id)` (`ON DELETE CASCADE`) |
| `event_type` | `VARCHAR(64)` | No | — | `CHECK (event_type IN ('APPLICATION_CREATED', 'STAGE_CHANGE', 'REJECTION', 'REINSTATEMENT', 'INTERVIEWER_FEEDBACK', 'INTERVIEWER_ASSIGNED', 'INTERVIEWER_REMOVED'))` |
| `actor_id` | `VARCHAR(36)` | Yes | `NULL` | Foreign Key → `users(id)` (`ON DELETE SET NULL`) |
| `old_stage` | `VARCHAR(32)` | Yes | `NULL` | Previous stage before transition |
| `new_stage` | `VARCHAR(32)` | Yes | `NULL` | Next stage after transition |
| `note_content` | `TEXT` | Yes | `NULL` | Feedback text or note payload |
| `created_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | Event timestamp |

---

### `stalled_alert_dismissals`
Tracks recruiter dismissals for stalled applications associated with specific stage entry timestamps.

| Column | Type | Nullable | Default | Constraints & Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(36)` | No | — | Primary Key (UUID) |
| `application_id` | `VARCHAR(36)` | No | — | Foreign Key → `applications(id)` (`ON DELETE CASCADE`) |
| `user_id` | `VARCHAR(36)` | No | — | Foreign Key → `users(id)` (`ON DELETE CASCADE`) |
| `stage` | `VARCHAR(32)` | No | — | The stage in which the application stalled |
| `stage_entered_at` | `TIMESTAMPTZ` | No | — | Timestamp of entry into that stage |
| `dismissed_at` | `TIMESTAMPTZ` | No | `CURRENT_TIMESTAMP` | When recruiter dismissed the alert |

**Unique Constraint**: `UNIQUE (application_id, stage, stage_entered_at)` ensures dismissal applies only to that particular stalled period. If the candidate advances to a new stage and subsequently stalls, a new alert is generated.

---

## 2. Relationships Overview

* **One-to-Many**:
  * `job_openings` → `applications`: One job opening has many applications.
  * `users` (actors) → `timeline_events`: One user can produce many timeline events.
  * `applications` → `timeline_events`: One application has many append-only timeline events.
  * `applications` → `stalled_alert_dismissals`: One application has many historical dismissals across different stages.
* **Many-to-Many**:
  * `applications` ↔ `users`: Modeled via `application_interviewers` table (`application_id`, `user_id`). Only users with `role = 'INTERVIEWER'` can be assigned.

---

## 3. Enforced Constraints: Database vs. Application Layer

### Enforced in Database (DDL Level):
1. **Referential Integrity**: Foreign keys with `ON DELETE RESTRICT` on job openings (preventing accidental deletion of openings with candidates) and `ON DELETE CASCADE` on child junction tables.
2. **State Validity**: `CHECK` constraints on `role`, `status`, `current_stage`, `rejected_from_stage`, and `event_type`.
3. **Rejection State Preservation**: `check_rejected_origin` constraint ensuring `rejected_from_stage` is not null when `current_stage = 'REJECTED'`.
4. **Uniqueness**: Unique constraints on `users(email)` and composite unique on `(application_id, stage, stage_entered_at)` for stalled dismissals.
5. **Composite Primary Keys**: `(application_id, user_id)` preventing duplicate panel assignments.

### Enforced in Application Code:
1. **Strict Stage Transition Rules**: Legal linear order (`APPLIED → SCREENING → INTERVIEW → OFFER → HIRED`) and prevention of skipping forward (e.g. APPLIED → OFFER) with explanatory error messages.
2. **Role-Based Authorization (RBAC)**: Ensuring only recruiters can advance stages or create openings, and only interviewers can view assigned candidates and submit feedback.
3. **Panel Role Validation**: Validating that any `user_id` assigned in `application_interviewers` actually has `role = 'INTERVIEWER'` prior to insertion.
4. **Append-Only Immutability Enforcement**: Restricting any endpoint access that would modify or delete rows in `timeline_events`.

---

## 4. Deliberate Denormalization Choices

* **`rejected_from_stage` in `applications`**: Stored directly on the application record alongside `current_stage` rather than requiring a sequential scan of `timeline_events` to determine which stage a rejected candidate was in prior to rejection.
* **`stage_entered_at` in `applications`**: Stored on the application record to allow instantaneous O(1) indexed queries for 10-day stalled candidate detection without aggregate `MAX(created_at)` queries on `timeline_events`.

---

## 5. Scalability Considerations (100x Data Analysis)

At 100x current data scale (e.g., millions of applications and tens of millions of timeline events):
1. **`timeline_events` Table Growth**: The append-only timeline table will grow the fastest. We have indexed `(application_id, created_at ASC)`. At 100x scale, table partitioning by range on `created_at` (e.g. monthly partitions) would be introduced.
2. **Candidate Search & Filter Queries**: Multi-attribute filtering (opening, stage, source, full-text search) will benefit from composite indexes and PostgreSQL GIN indexes on `candidate_name` and `candidate_email` using `pg_trgm`.
3. **Stalled Application Calculations**: Currently indexed by `stage_entered_at` and `current_stage`. At 100x scale, a partial index `WHERE current_stage NOT IN ('HIRED', 'REJECTED')` optimizes stalled detection without scanning terminal applications.
