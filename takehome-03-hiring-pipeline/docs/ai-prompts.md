# AI Prompts & Development Log

This document records the actual prompts used during the design, implementation, and refinement of **HireFlow**, organized chronologically by development phase and aligned directly with the repository's commit history. For each significant prompt, it details what was asked, what the AI produced, and what was corrected.

---

## Phase 1: Project Kickoff & Foundation

### 1. Role Setup & Project Kickoff
- **Prompt:**
  > "You are helping me with a web dev project and you are an expert web developer. We are going to build a hiring pipeline web app called HireFlow following the assignment requirements in README.md. The stack will be React, TypeScript, Node.js, Express, and PostgreSQL."
- **What you got:**
  - The AI acknowledged the role, confirmed the web stack constraints (no Python, no native mobile), outlined the 10 mandatory pipeline requirements from `README.md`, and proposed starting with the relational database schema.
- **What you corrected:**
  - The initial AI response proposed using an ORM like Prisma and generating static mock data. We corrected this immediately: we mandated native PostgreSQL connection pooling (`pg`) with explicit SQL constraints, strict server-side validation, and zero mocked or hardcoded pipeline data.

### 2. Database Schema & State Invariants
- **Prompt:**
  > "Set up the database schema in PostgreSQL for the hiring pipeline. We need tables for users with roles, job openings with statuses, applications with strict stages, interview panel assignments, and an immutable timeline."
- **What you got:**
  - SQL schema defining `users`, `job_openings`, `applications`, `application_interviewers`, and `timeline_events` tables with foreign keys and check constraints.
- **What you corrected:**
  - The initial draft allowed null values for `rejected_from_stage` when an application was marked `REJECTED`. We added a check constraint (`check_rejected_origin`) requiring `rejected_from_stage` to be populated whenever `current_stage = 'REJECTED'`. This guarantees that any rejected candidate can always be reinstated to their exact prior stage.

### 3. Authentication & Server-Side RBAC
- **Prompt:**
  > "Implement email and password login with bcrypt and HTTP-only cookies. There are two roles: Recruiter and Interviewer. Ensure Interviewers can only see their assigned applications and cannot touch openings or advance stages."
- **What you got:**
  - Auth routes (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`), password verification with bcrypt, signed JWT cookies, and RBAC middleware (`requireRecruiter`, `requireApplicationAccess`).
- **What you corrected:**
  - The first middleware draft checked roles by looking only at route URL patterns. We replaced this with object-level checks (`requireApplicationAccess`) that query the `application_interviewers` join table to verify that the requesting interviewer is actually assigned to that specific application before granting access.

### 4. Pipeline State Machine & Linear Progression
- **Prompt:**
  > "Build the stage progression logic. It must be strictly linear: Applied -> Screening -> Interview -> Offer -> Hired. Reject invalid jumps like Applied straight to Offer with a clear error. Also handle rejection from any stage and reinstatement back to the exact prior stage."
- **What you got:**
  - `PipelineService` with sequential stage index comparisons, rejection handling, and reinstatement logic.
- **What you corrected:**
  - The initial implementation allowed reinstating a candidate directly from `REJECTED` into `APPLIED` as a fallback if `rejected_from_stage` was missing. We enforced that reinstatement must restore strictly to the exact recorded `rejected_from_stage`, and rejected requests attempting to reinstate non-rejected candidates.

### 5. Server-Side Application Search & Pagination
- **Prompt:**
  > "Add server-side search and pagination for applications. Support filtering by job opening, stage, and source."
- **What you got:**
  - Parameterized SQL queries using case-insensitive `ILIKE` for name and email search, multi-field filters, and `LIMIT/OFFSET` pagination.
- **What you corrected:**
  - The total count query initially ran without the active filter `WHERE` clauses, returning the global application count instead of the filtered count. We aligned the `COUNT(*)` query with the exact filtered query parameters.

---

## Phase 2: Bulk Actions, Export & Dashboard

### 6. Bulk Advance and Reject Actions
- **Prompt:**
  > "Implement bulk advance and reject actions for candidate applications so recruiters can select multiple candidates from the list and move or reject them at once."
- **What you got:**
  - `POST /api/applications/bulk/advance` and `POST /api/applications/bulk/reject` routes, multi-select table checkboxes, and `BulkActionResultsModal.tsx`.
- **What you corrected (Mistake & Fix):**
  - **The Problem:** The initial implementation wrapped the whole batch in an atomic database transaction. If even one candidate was ineligible (e.g. already in `HIRED` or `REJECTED`), the entire batch aborted and rolled back.
  - **The Correction:** The brief explicitly mandated: *"Because some selected applications will not be eligible for the move, the result must report per candidate what succeeded and what was refused and why, not just fail the whole batch."* We updated the service to evaluate each candidate independently and return a mixed array of `{ applicationId, status: 'ADVANCED' | 'REFUSED', reason }`.

### 7. Pipeline CSV Export
- **Prompt:**
  > "Add a CSV export feature on the candidates page so recruiters can download the candidate data."
- **What you got:**
  - `GET /api/applications/export` endpoint streaming a CSV file download.
- **What you corrected:**
  - **The Problem:** The first version used naive comma-joining (`row.join(',')`), which broke whenever candidate notes contained commas, quotation marks, or newlines. Also, interviewer assignments were missing.
  - **The Correction:** Implemented strict RFC 4180 escaping (double-quote wrapping and escaping internal quotes as `""`), added assigned interviewers formatted as a semicolon-separated column, and ensured the export honors active filters (opening, stage, source).

### 8. In-Memory Database Seeding & StageProgressionBar
- **Prompt:**
  > "Add in-memory database seeding for local development and build the StageProgressionBar component for candidate details."
- **What you got:**
  - `StageProgressionBar.tsx` visually depicting the 5 stages (`APPLIED`, `SCREENING`, `INTERVIEW`, `OFFER`, `HIRED`), and seed data for local testing.
- **What you corrected:**
  - **The Problem:** The progression bar initially allowed users to click directly on future stage pills to jump stages from the UI.
  - **The Correction:** Disabled arbitrary clicking. We enforced that forward progress is only possible by advancing one step forward at a time, and added a distinct red status display when an application is in `REJECTED` showing the previous stage it can be reinstated to.

### 9. Stalled Application Alerts & Dismissal Lifecycle
- **Prompt:**
  > "Implement stalled application alerts for applications stuck in a stage for more than 10 days, with a dismissal system and role-based access control."
- **What you got:**
  - `alerts.routes.ts`, `AlertsPage.tsx`, and the 10-day inactivity query (`stage_entered_at <= NOW() - INTERVAL '10 days'`).
- **What you corrected (Major Mistake & Fix):**
  - **The Problem:** The AI originally suggested a simple `is_dismissed: boolean` column on the `applications` table.
  - **The Correction:** If a candidate's alert is dismissed in `Screening`, advancing them to `Interview` would leave `is_dismissed = true`, permanently hiding future alerts if they stalled again. We replaced the boolean with a dedicated `stalled_alert_dismissals` table indexed by `(application_id, stage, stage_entered_at)`. When the candidate enters a new stage, `stage_entered_at` changes, so the dismissal naturally expires and a new alert triggers if they stall again.

### 10. Recruiter Dashboard & Weekly Metrics
- **Prompt:**
  > "Implement the recruiter dashboard showing key metrics, stage breakdown, and hiring trends."
- **What you got:**
  - `DashboardPage.tsx` and `dashboard.routes.ts` with KPI cards (Active Candidates, Offers, Interviews This Week), stage funnel, and 12-week influx chart.
- **What you corrected:**
  - **The Problem:** The 12-week trend calculation initially calculated week intervals using JavaScript client timestamps, causing discrepancies across timezones.
  - **The Correction:** Moved the aggregation to PostgreSQL UTC date truncation (`date_trunc('week', applied_date AT TIME ZONE 'UTC')`), ensuring consistent historical weekly numbers.

### 11. Collapsible Sidebar & Header Search
- **Prompt:**
  > "Redesign the layout with a collapsible sidebar and add global search in the header."
- **What you got:**
  - Updated `AppLayout.tsx`, `Sidebar.tsx`, and `Header.tsx` with responsive layout controls, notification badges, and a search bar.
- **What you corrected:**
  - **The Problem:** The header search input caused full page reloads and lost the user's active filter context.
  - **The Correction:** Connected the search input to an interactive dropdown drawer and candidate state with debouncing, allowing users to search across candidate names, emails, and job roles instantly without page reloads.

### 12. Sync Candidate Filters with URL Search Params
- **Prompt:**
  > "Sync candidate filters with URL search params so clicking dashboard stage cards filters the candidates list directly."
- **What you got:**
  - Integrated `useSearchParams` into `CandidatesPage.tsx` and updated dashboard stage bars to link to `/candidates?stage=INTERVIEW` or `/candidates?jobOpeningId=...`.
- **What you corrected:**
  - **The Problem:** Navigating with URL params occasionally conflicted with pagination, leaving the user stranded on page 3 of a filtered view with 0 results.
  - **The Correction:** Added logic to reset `page = 1` whenever the URL search parameters (stage or opening) change.

### 13. Application UX and Modal Feedback States
- **Prompt:**
  > "Improve application UX, modal interactions, and feedback states."
- **What you got:**
  - Refined `ApplicationDetailModal.tsx` and added feedback toast containers.
- **What you corrected:**
  - **The Problem:** When a stage transition was rejected by the server (e.g. `422 Unprocessable Entity` for an illegal jump), the modal silently failed or closed without an informative explanation.
  - **The Correction:** Added explicit error display inside the modal that renders the exact backend error message (`IllegalStageTransitionError`), added loading spinners on action buttons, and added a confirmation prompt before rejecting a candidate.

### 14. Automated Pipeline & Timeline Test Coverage
- **Prompt:**
  > "Write tests covering critical hiring pipeline rules like stage progression, rejection, reinstatement, and timeline immutability."
- **What you got:**
  - Automated test suites in `tests/pipeline.test.ts` and `tests/timeline.test.ts`.
- **What you corrected:**
  - **The Problem:** The initial test draft used mock response objects instead of testing real database constraint violations.
  - **The Correction:** Updated the tests to run against a real in-memory PostgreSQL instance (`pg-mem`), explicitly asserting that `422` is returned on stage skips, that reinstatement restores to the exact `rejected_from_stage`, and that `UPDATE` or `DELETE` on `timeline_events` fails.

---

## Phase 3: Project Restructuring, Terminology & Registration


### 16. Dashboard De-duplication & Terminology Polish
- **Prompt:**
  > "Dont keep repetative info in the dashboard and instead of using 'stalled pipeline alerts' and the word 'pipeline' use other meaningful word."
- **What you got:**
  - Replaced "pipeline" in subtitles and card titles with terms like "Hiring Stages", "Workflow", and "Candidates Requiring Attention".
- **What you corrected (Mistake & Fix):**
  - **The Problem:** The initial pass simply renamed the alert card to "Candidates Requiring Attention", but still displayed repetitive numbers: a box saying `UN-DISMISSED STALLED: 2` and right underneath repeated `INTERVIEW: 1, OFFER: 1`. It failed to tell recruiters *who* was actually stalled.
  - **The Correction:** Connected the card to `/api/alerts/stalled` to render actual candidate cards directly (showing initials, name, job opening, stage, and days inactive) with one-click review links. Also streamlined the Job Openings card to remove redundant `5 total / 5 active` stacked text.

### 17. Custom Registration with Role Selection & Data Preservation
- **Prompt:**
  > "I want a login/sign up registration form at the starting so that i can take users from input and they can choose their role themselves and preserve the dummy data for the respective roles so that when i signup/login i dont get empty page."
- **What you got:**
  - Dual-tab `AuthPage` for Sign In and Create Account with role selector cards (Recruiter vs Interviewer) and a backend `POST /api/auth/register` endpoint.
- **What you corrected (Mistake & Fix):**
  - **Error 1:** On first submit in the browser, the registration request returned `404 Not Found` because the backend server had been running via `tsx` without watch mode and had not reloaded the newly added `/register` route. We restarted the server with `tsx watch`.
  - **Error 2 (Empty page for new interviewers):** Under strict RBAC rules, interviewers only see candidates assigned to them. When registering a new interviewer, their queue was completely empty (`0 candidates`).
  - **The Correction:** In `AuthService.register`, we added logic that automatically assigns newly registered interviewers to 3 sample active candidates across open positions and logs `INTERVIEWER_ASSIGNED` timeline events. This ensured new interviewers immediately have a populated queue to review without breaking RBAC boundaries.

### 18. Role-Based Dashboard Scoping (Interviewer Workspace vs. Recruiter Dashboard)
- **Prompt:**
  > "All I can see that the dashboard and the contents of the dashboard for both the interviewer and the recruiter look the exact same, do you think they should be the same? I think interviewer shouldn't be able to see all the candidates, but only the candidates assigned to them by recruiter."
- **What you got:**
  - Implemented server-side SQL scoping on `GET /api/dashboard/metrics` to restrict all headline counts, job openings, and stage breakdowns to candidates assigned to `application_interviewers` when the user has the interviewer role. Transformed the dashboard UI into a dedicated "Interviewer Workspace" showing "My Candidates", "Assigned Roles", and panel interview metrics. Added automated test coverage for interviewer dashboard scoping.
- **What you corrected (Mistake & Fix):**
  - **The Problem:** The initial implementation threw an unhandled `ReferenceError: Role is not defined` on the server because the `Role` enum was missing from imports in `dashboard.routes.ts`. Additionally, the frontend attempted to call the recruiter-only `/api/alerts/stalled` endpoint, rendering a red 403 error banner.
  - **The Correction:** Imported `Role` from `types`, conditionally bypassed `/api/alerts/stalled` on the client when `role === 'INTERVIEWER'`, fixed variable scoping in the quarterly trend chart, and verified zero-error rendering across both personas in the browser.