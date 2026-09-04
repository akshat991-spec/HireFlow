# Plan

Answer each of these, in your own words.

---

### How did you split the work into sessions?

The work was divided into seven focused sessions corresponding to the project's commit history:

1. **Session 1: Repository Setup & Core Modeling (Aug 29)**
   - Analyzed the assignment brief to isolate all hard invariants (strict linear stage progression, exact-stage reinstatement, immutable timeline, interviewer access boundaries, and 10-day inactivity alert reappearance).
   - Modeled the PostgreSQL database schema and drafted initial architectural documentation.

2. **Session 2: Backend Core & RBAC Layer (Aug 30, Morning/Afternoon)**
   - Set up Node.js, Express, TypeScript, and the PostgreSQL connection pool (`pg`).
   - Implemented bcrypt password hashing, signed HTTP-only JWT session cookies, and authorization middleware (`requireRecruiter`, `requireApplicationAccess`).
   - Implemented Job Openings CRUD (Create, Edit, Archive, Restore) and the linear pipeline state machine (`PipelineService`).

3. **Session 3: Relational Endpoints, Bulk Operations & CSV Export (Aug 30, Evening)**
   - Built interviewer panel assignments and scoped feedback logging.
   - Implemented the immutable, append-only timeline audit log.
   - Implemented server-side search (`ILIKE`), multi-field filtering, and SQL pagination.
   - Built bulk advance and bulk reject with independent per-candidate error reporting, and RFC 4180-compliant CSV export streaming.

4. **Session 4: Alerts Lifecycle & Recruiter Dashboard (Aug 31, Morning)**
   - Implemented the 10-day inactivity alert engine and the `stalled_alert_dismissals` per-stage period tracking table.
   - Built the Recruiter Dashboard backend routes and frontend view, calculating KPI totals, stage funnel breakdowns, and 12-week rolling influx trends.

5. **Session 5: Frontend Layout Polish & Automated Testing (Aug 31, Evening)**
   - Enhanced the UI layout with a collapsible sidebar, global header search drawer, candidate filter URL parameter synchronization, and modal error banners.
   - Authored the comprehensive Vitest automated test suite (143 tests across 12 test suites) running against in-memory PostgreSQL (`pg-mem`).

6. **Session 6: Seed Enhancements & Event Dispatcher (Sep 1)**
   - Expanded database seeding with diverse, realistic candidate profiles across all 6 stages.
   - Implemented a custom event listener (`hireflow:alerts-updated`) to synchronize badge counters between the header, sidebar, and dashboard without full reloads.

7. **Session 7: Self-Service Registration (Sep 3)**
   - Eliminated redundant dashboard counters and cleaned up terminology.
   - Built the `AuthPage` with interactive role selection (Recruiter vs Interviewer) and implemented automatic sample candidate assignment for new interviewers so they never land on an empty page.

---

### What order did you build in, and why that order?

1. **PostgreSQL Schema & Constraints** (tables, foreign keys, `check_rejected_origin`)
2. **Authentication & Authorization (RBAC) Middleware**
3. **Core Pipeline State Machine & Reinstatement Logic**
4. **Entity CRUD Endpoints & Relational Scoping**
5. **Automated Test Harness (143 Tests)**
6. **Frontend User Interface (React 18 + Vite)**

**Why that order?**
Building from the data persistence layer upward ensures that business rules (such as preventing stage skips or ensuring timeline events cannot be updated) are guaranteed by the database and server-side state machine before any user interface is built. The UI is merely a presentation layer on top of a rock-solid, tamper-proof backend API. Testing the backend with 143 automated tests before refining the frontend guaranteed zero regressions.

---

### What did you estimate versus what it actually took?

| Component / Feature | Estimated Time | Actual Time | Difference & Why |
| :--- | :--- | :--- | :--- |
| **Schema Design & Migrations** | 1.5 hours | 1.5 hours | On track; clear relational boundaries between openings, applications, and timeline events. |
| **Pipeline State Machine & Reinstatement** | 2.0 hours | 1.5 hours | Ahead of estimate; linear array indexing made forward-step validation clean and straightforward. |
| **Stalled Inactivity Lifecycle** | 1.5 hours | 3.0 hours | Took twice as long; supporting alert reappearance upon advancing to a new stage required a composite `(application_id, stage, stage_entered_at)` dismissal key rather than a simple boolean flag. |
| **Server-side Search & Pagination** | 1.0 hour | 1.0 hour | On track; dynamic SQL parameterization in PostgreSQL. |
| **Bulk Actions with Partial Failure Reporting** | 1.5 hours | 2.0 hours | Slightly over; structuring the independent per-application error reporting response so the batch doesn't abort required deliberate error handling. |
| **Automated Testing Suite (143 tests)** | 3.0 hours | 3.5 hours | Slightly over; testing every illegal stage combination and interviewer permission boundary thoroughly. |
| **Frontend UI** | 4.0 hours | 5.0 hours | Over estimate; restructuring into clean `backend/` and `frontend/` directories and adding self-service registration with data preservation took additional polish. |

---

### What did you cut when you ran short?

1. **Client-Side Data Filtering:** I deliberately rejected building client-side table sorting and pagination. The requirement explicitly mandated server-side operations, so I ensured 100% of filtering and searching runs via PostgreSQL SQL queries.
2. **Third-Party Heavy UI Frameworks:** Avoided heavy component libraries like Material UI or Tailwind in favor of lightweight, custom CSS tokens and responsive flex/grid layouts. This kept the bundle size small (85 kB gzip) and build times lightning-fast (<4s).
3. **Optional Stretch Features:** Left out non-required stretch ideas (such as self-service interview booking links and automated offer letter PDF generation) to ensure all 10 mandatory core requirements were thoroughly engineered, test-covered, and documented.
