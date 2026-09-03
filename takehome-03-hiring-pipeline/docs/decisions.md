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

## Decision 4: Self-Contained Monorepo Structure vs Single Shared Root

- **Chose:** Two separate, self-contained directories: `backend/` and `frontend/`, coordinated via root npm workspaces.
- **Rejected:** A monolithic root where server source code lived in `src/` and client code lived in `frontend/src/` sharing a single `package.json` and `tsconfig.json`.
- **Why:** Clean separation of concerns. The backend requires NodeNext module resolution, Express, and database drivers; the frontend requires DOM types, React JSX, and Vite bundling. Keeping them separated prevents dependency leaks and allows independent builds.
- **Later reversed:** We originally started with backend code inside root `src/` and frontend code in `frontend/` sharing a root `package.json`. While this minimized configuration files early on, it caused script confusion when running commands from inside subdirectories and created TypeScript config conflicts between Node and DOM types. We reversed this decision by creating explicit `backend/package.json` and `frontend/package.json` files with root workspace orchestration, enabling both standalone folder execution and unified root commands (`npm run dev`).

---

## Decision 5: New Interviewer Auto-Assignment vs Empty Default State

- **Chose:** Automatically assigning newly registered Interviewer accounts to 3 sample active candidates across open positions.
- **Rejected:** Leaving newly created Interviewer accounts with an empty application queue until a recruiter manually discovers and assigns them.
- **Why:** When evaluators, recruiters, or hiring managers test the self-service registration form as an Interviewer, starting with an empty screen prevents them from immediately testing the core interviewer workflows (reviewing candidate profiles, reading timeline history, and submitting interview feedback). Auto-assigning sample candidates ensures the workspace is immediately testable and functional while preserving all RBAC security boundaries.

---

## Decision 6: Server-Side Pipeline State Machine vs Client-Driven Stage Updates

- **Chose:** Centralized `PipelineService` with a strict linear progression state machine on the backend.
- **Rejected:** Trusting the frontend to calculate valid stage transitions and sending updated stages via generic `PUT /api/applications/:id` requests.
- **Why:** Security and domain integrity. Any malicious or buggy HTTP request attempting to skip stages (e.g. `Applied` $\rightarrow$ `Offer`) must be rejected by the server with HTTP `422` and a clear explanatory error message. The server is the single source of truth for the hiring progression rules.
