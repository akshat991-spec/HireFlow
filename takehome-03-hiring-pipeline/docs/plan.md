# Plan

Answer each of these, in your own words.

### How did you break the work into sessions?

The project was executed across seven focused development sessions:

1. **Session 1: Requirements Breakdown & Schema Design**
   - Read the assignment brief thoroughly to extract non-negotiable invariants (strict linear stage progression, exact-stage reinstatement, immutable timeline, multi-interviewer access scoping, and the 10-day inactivity dismissal lifecycle).
   - Modeled the PostgreSQL database schema with check constraints, foreign keys, and indexes.

2. **Session 2: Foundation, Authentication & Server-Side RBAC**
   - Set up Node.js, Express, TypeScript, and database connection pooling (`pg`).
   - Implemented bcrypt password hashing, signed JWT HTTP-only session cookies, and middleware-based role-based access control (`requireRecruiter`, `requireApplicationAccess`).

3. **Session 3: Core Entities & Domain Services**
   - Implemented Job Openings CRUD with archive and restore capabilities.
   - Built the linear stage machine (`PipelineService`), candidate creation, rejection, and reinstatement back to the exact prior stage.
   - Implemented many-to-many interviewer assignments and interviewer feedback submission.

4. **Session 4: Search, Pagination, Bulk Actions & CSV Export**
   - Implemented server-side search (case-insensitive `ILIKE`), multi-field filtering, sorting, and pagination.
   - Built bulk advance and bulk reject with independent per-candidate processing and mixed-result reporting.
   - Built RFC 4180-compliant CSV streaming.

5. **Session 5: Stalled Inactivity Engine & Immutable Timeline**
   - Implemented the 10-day inactivity detection query.
   - Built the per-stage dismissal lifecycle (`stalled_alert_dismissals`) allowing dismissed alerts to reappear if candidates stall in subsequent stages.
   - Enforced append-only immutability on `timeline_events`.

6. **Session 6: Automated Test Suite**
   - Authored 143 comprehensive integration tests across 12 test suites using Vitest, Supertest, and `pg-mem`, verifying every requirement and boundary condition.

7. **Session 7: UI Experience, Monorepo Refactoring & Registration**
   - Built the React 18 + TypeScript SPA with Lucide icons, responsive sidebar, and real-time dashboard analytics.
   - Restructured the repository into clean, independent `backend/` and `frontend/` directories with npm workspaces.
   - Built the `AuthPage` supporting custom user registration with role selection and automated candidate assignment preservation.

---

### What order did you build in, and why that order?

1. **Database Schema & Constraints**
2. **Authentication & Authorization (RBAC) Middleware**
3. **Core Pipeline State Machine & Reinstatement Logic**
4. **REST Endpoints & Relational Scoping**
5. **Automated Test Harness (143 Tests)**
6. **Frontend User Interface (React + Vite)**
7. **Monorepo Separation & Self-Service Registration**

**Why that order?**
Building from the data persistence layer upward ensures that business invariants (such as preventing stage skips or ensuring timeline events cannot be updated) are guaranteed by the database and server-side state machine before any user interface is wired up. The UI is merely a presentation layer on top of a rock-solid, tamper-proof backend API. Testing the backend with 143 automated tests before refining the frontend guaranteed zero regressions.

---

### What did you estimate versus what it actually took?

| Component / Feature | Estimated Time | Actual Time | Difference & Why |
| :--- | :--- | :--- | :--- |
| **Schema Design & Migrations** | 1.5 hours | 1.5 hours | On track; clear relational boundaries between openings, applications, and timeline events. |
| **Pipeline State Machine & Reinstatement** | 2.0 hours | 1.5 hours | Ahead; linear array indexing made forward-step validation clean and straightforward. |
| **Stalled Inactivity Lifecycle** | 1.5 hours | 3.0 hours | Over estimate; supporting alert reappearance upon advancing to a new stage required a composite `(application_id, stage, stage_entered_at)` dismissal key rather than a simple boolean flag. |
| **Server-side Search & Pagination** | 1.0 hour | 1.0 hour | On track; dynamic SQL parameterization in PostgreSQL. |
| **Bulk Actions with Partial Failure Reporting** | 1.5 hours | 2.0 hours | Slightly over; structuring the independent per-application error reporting response so the batch doesn't abort required deliberate error handling. |
| **Automated Testing Suite (143 tests)** | 3.0 hours | 3.5 hours | Slightly over; testing every illegal stage combination and interviewer permission boundary thoroughly. |
| **Frontend UI & Monorepo Separation** | 4.0 hours | 5.0 hours | Over estimate; restructuring into clean `backend/` and `frontend/` directories and adding self-service registration with data preservation took additional polish. |

---

### What did you cut when you ran short?

1. **Client-Side Data Filtering:** We deliberately rejected building client-side table sorting and pagination. The requirement explicitly mandated server-side operations, so we ensured 100% of filtering and searching runs via PostgreSQL SQL queries.
2. **Third-Party Heavy UI Frameworks:** Avoided heavy component libraries like Material UI or Tailwind in favor of lightweight, custom CSS tokens and responsive flex/grid layouts. This kept the bundle size small (85 kB gzip) and build times lightning-fast (<4s).
3. **Optional Stretch Features:** Left out non-required stretch ideas (such as self-service interview booking links and automated offer letter PDF generation) to ensure all 10 mandatory core requirements were thoroughly engineered, test-covered, and documented.
