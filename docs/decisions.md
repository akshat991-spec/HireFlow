# Decisions

Log the decisions that actually shaped this codebase — the ones where a real alternative existed and you picked one. At least five entries. For each: what you chose, what you rejected, and why. At least one entry must be a decision you later reversed — say what changed your mind.

---

## Decision 1: Relational SQL Schema & Native Constraints vs NoSQL Document Model

- **Chose:** PostgreSQL with strict check constraints, foreign keys, and typed SQL queries via `pg`.
- **Rejected:** MongoDB or Document-oriented stores.
- **Why:** The hiring pipeline model is inherently relational: Job Openings own Applications, which own immutable Timeline Events and Many-to-Many Interviewer assignments. Relational ACID guarantees and native SQL check constraints (such as ensuring `rejected_from_stage` is non-null whenever `current_stage = 'REJECTED'`) prevent data corruption at the database layer before application code even executes.

---

## Decision 2: Composite Period Key for Inactivity Dismissals vs Simple Boolean Flag

- **Chose:** A dedicated table `stalled_alert_dismissals` with a composite key `(application_id, stage, stage_entered_at)`.
- **Rejected:** Adding an `is_stalled_dismissed BOOLEAN` flag on the `applications` table.
- **Why:** The specification states that if an application advances to a new stage and later stalls in that new stage for > 10 days, the alert must reappear. A single boolean flag on the application would permanently suppress future alerts for that candidate once dismissed in an earlier stage. By indexing dismissals to the candidate's exact stage and entry timestamp, dismissing an alert in `Screening` preserves dismissal state for `Screening`, but automatically triggers a new alert if the candidate advances to `Interview` and stalls for another 10 days.

---

## Decision 3: Independent Per-Candidate Processing for Bulk Actions vs All-or-Nothing Transactions

- **Chose:** Independent per-candidate evaluation returning a mixed-result summary (`results: [{ id, status: 'ADVANCED' | 'REFUSED', reason }]`).
- **Rejected:** Wrapping the bulk operation in a single database transaction that rolls back the entire batch if a single candidate is ineligible.
- **Why:** The brief explicitly mandated: *"Because some selected applications will not be eligible for the move, the result must report per candidate what succeeded and what was refused and why, not just fail the whole batch."* An all-or-nothing rollback would force recruiters to manually deselect candidates one by one rather than advancing all valid candidates in one click.

---

## Decision 4: Dedicated Authentication Gating & Registration vs Auto-Login Default

- **Chose:** A dedicated `AuthPage` requiring authentication with custom registration, role selection (Recruiter vs Interviewer), and 1-click demo logins.
- **Rejected:** Automatically logging the user in as `recruiter@hireflow.test` on application startup.
- **Why:** Real hiring pipelines require distinct security personas. Providing an explicit sign-in and registration screen allows reviewers to test both recruiter authority and restricted interviewer access from the initial load.
- **Later reversed:** During early development, we configured `AuthContext` to automatically log in as `Sarah Connor (Recruiter)` whenever no active session was detected, bypassing the login screen to save time while testing dashboard features. We later reversed this decision because automatic login prevented users from testing self-service registration, selecting their role, or experiencing the interviewer's scoped candidate view without manually signing out first.

---

## Decision 5: Server-Side Pipeline State Machine vs Client-Driven Stage Updates

- **Chose:** Centralized `PipelineService` with a strict linear progression state machine on the backend.
- **Rejected:** Trusting the frontend to calculate valid stage transitions and sending updated stages via generic `PUT /api/applications/:id` requests.
- **Why:** Security and domain integrity. Any malicious or buggy HTTP request attempting to skip stages (e.g. `Applied` $\rightarrow$ `Offer`) must be rejected by the server with HTTP `422` and a clear explanatory error message. The server is the single source of truth for the hiring progression rules.
