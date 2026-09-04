# Submission

## Links

- **GitHub repository:** https://github.com/akshat991-spec/HireFlow
- **Live application:** https://hire-flow-frontend-lovat.vercel.app/

## Notes for the reviewer

HireFlow is a production-grade hiring pipeline management platform built with a modern full-stack architecture (**React 18 + Vite** frontend, **Node.js + Express + TypeScript** backend, and **PostgreSQL**).

All security, authorization boundaries, pipeline progression rules, and history immutability rules are strictly enforced server-side. The seeded environment contains realistic, fictional candidates across all hiring stages, multi-interviewer panel assignments, interview feedback, stalled applications, and audit logs.

## Demo credentials

| Role | Name | Email | Password |
|------|------|-------|----------|
| **Recruiter** | Sarah Connor | `recruiter@hireflow.test` | `password123` |
| **Interviewer 1** | Alex Rivera | `interviewer@hireflow.test` | `password123` |
| **Interviewer 2** | Elena Rostova | `interviewer2@hireflow.test` | `password123` |
| **Interviewer 3** | Marcus Brody | `interviewer3@hireflow.test` | `password123` |

## Stack

| Layer | What was used | Why |
|-------|---------------|-----|
| **Frontend** | React 18, Vite, TypeScript, React Router 6, Lucide Icons | High-performance SPA with instant navigation, type safety, responsive design, and rich UI feedback. |
| **Backend** | Node.js, Express, TypeScript | Robust REST API architecture, strict middleware RBAC enforcement, and typed business logic services. |
| **Database** | PostgreSQL | Relational ACID guarantees, strict foreign keys, multi-column indexes, and append-only audit trail integrity. |
| **Testing** | Vitest, Supertest, pg-mem | Fast, comprehensive automated test suite testing the highest-risk business rules with 100% pass rate. |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | **Accounts and roles** | **Done** | Server-enforced RBAC (Recruiter vs Interviewer), bcrypt password hashing, and signed JWT auth. |
| 2 | **Job openings** | **Done** | Complete opening lifecycle (Create, Edit, Archive, Restore), active filter scoping, and archive protection. |
| 3 | **Applications inside job openings** | **Done** | Complete application management, candidate profiling, notes, multi-source attribution, and stage tracking. |
| 4 | **A pipeline with rules** | **Done** | Strict linear pipeline validation (`Applied` → `Screening` → `Interview` → `Offer` → `Hired`), rejection recording, and exact-stage reinstatement. |
| 5 | **Interview panel** | **Done** | Multi-interviewer assignments per candidate, object-level access scoping, and interviewer feedback submissions. |
| 6 | **Finding candidates** | **Done** | Server-side case-insensitive search, multi-field filtering (opening, stage, source), sorting, and pagination. |
| 7 | **Acting on many candidates at once** | **Done** | Recruiter bulk advance and bulk reject with independent per-candidate processing and mixed-result reporting. Also includes recruiter-authorized CSV export with RFC 4180 escaping, active opening filtering, and interview panel member listing. |
| 8 | **A dashboard** | **Done** | Live KPI summary cards (Total Active, Interviews This Week, Offers, Stalled Count), visual pipeline funnel breakdown, and opening breakdown with direct drill-down links. |
| 9 | **History you cannot rewrite** | **Done** | Immutable, append-only timeline events audit log recording state transitions, panel updates, rejection, and reinstatement. |
| 10 | **Stalled-application alerts** | **Done** | Automatic 10-day inactivity threshold detection, per-stage dismissal lifecycle, and new alert generation upon advancing to a new stage. |

## How to Run & Repeat Seeding

- **Run Dev Environment (Root):** `npm run dev` (starts backend and frontend concurrently)
- **Run Backend Only:** `cd backend && npm run dev` (or `npm run dev:backend` from root)
- **Run Frontend Only:** `cd frontend && npm run dev` (or `npm run dev:frontend` from root)
- **Run Seed Database:** `npm run db:seed`
- **Run Test Suite:** `npm run test` (144 automated tests across 12 test suites)
- **Build Client Bundle:** `npm run build:client`
- **Build Backend Server:** `npm run build:server`

## Reflection

### How much time did you actually spend?

Based on git commit logs spanning August 29, 2026 to September 4, 2026, total active engineering time was approximately **30 hours** spread over 6 days:
- **Core Architecture & Backend API (Days 1–2, ~8 hrs):** Relational PostgreSQL schema design, Express API endpoints, JWT cookie/header authentication, and server-side RBAC middleware.
- **Frontend SPA & Component System (Days 2–3, ~10 hrs):** Custom design system in Vanilla CSS, collapsible sidebar, responsive candidate table, pipeline progression bars, and interactive modals.
- **Business Logic & Pipeline Rules (Days 3–4, ~5 hrs):** Linear state machine enforcement, immutable timeline event logging, bulk operations with mixed-result handling, 10-day inactivity alert engine, and RFC 4180 CSV export.
- **Test Engineering (Day 4, ~4 hrs):** 12 Vitest integration test suites (144 tests) covering edge-case permission bypasses, state violations, and dismissal lifecycles using `pg-mem`.
- **Cloud Deployment & Production Hardening (Days 5–6, ~3 hrs):** Vercel edge routing with SPA rewrites, Render containerization, Supabase IPv4 connection pooling, CORS origin resolution, and end-to-end audit.

### What would you do next, with another 12 hours?

If allocated another 12 hours, priority would focus on these specific architectural and user experience additions:
1. **Real-time Event Streaming (SSE / WebSockets):** Currently, pipeline updates and alert dismissals broadcast via local custom DOM events (`hireflow:alerts-updated`) for intra-page reactivity. Implementing Server-Sent Events (SSE) from the Express backend would enable real-time collaboration across multiple concurrent recruiter and interviewer tabs without requiring page refreshes.
2. **Resume File Uploads & Document Storage:** Candidate applications currently track profiles, links, and text notes. Adding multipart file upload (via AWS S3 or Supabase Storage presigned URLs) paired with an embedded PDF viewer in [`ApplicationDetailModal.tsx`](frontend/src/components/Applications/ApplicationDetailModal.tsx) would provide a complete resume review experience.
3. **Advanced Time-in-Stage Analytics:** Extend [`DashboardPage.tsx`](frontend/src/pages/DashboardPage.tsx) and the backend metrics service with bottleneck diagnostics (median days per stage, drop-off rates across stages, and interviewer feedback latency) to give recruiting managers predictive insight into hiring velocity.
4. **End-to-End Playwright CI Test Suite:** While the backend has 144 automated integration tests, adding Playwright tests running against the production build in a GitHub Actions workflow would automatically test cross-browser drag/drop, modal keyboard accessibility, and role switching.

### What are you least happy with in this codebase, and why?

The single area I am least satisfied with is **[`ApplicationDetailModal.tsx`](frontend/src/components/Applications/ApplicationDetailModal.tsx)**:
- **Violates Single Responsibility Principle:** At ~550 lines of code, this modal is carrying excessive responsibility. It manages candidate profile editing, linear stage advancement, rejection flows, interviewer assignment and removal, feedback scorecards, and the immutable history timeline — all with over 15 interconnected `useState` variables in one component.
- **Why it's problematic:** This high coupling makes testing individual sub-flows difficult and increases the risk of subtle state synchronization bugs when refreshing candidate data.
- **How it should be refactored:** It should be decomposed into dedicated, isolated sub-components: `<CandidateTimelineList />`, `<InterviewerPanelAssignment />`, `<FeedbackSubmissionForm />`, and `<StageProgressionActions />`, backed by a dedicated custom hook (`useApplicationDetails`) that encapsulates the data fetching and optimistic mutations.

