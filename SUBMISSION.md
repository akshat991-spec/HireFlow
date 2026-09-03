# Submission

## Links

- **GitHub repository:** https://github.com/akshat991-spec/HireFlow
- **Live application:** Local Dev & Production Ready (http://localhost:5173 / http://localhost:3000)

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
| 7 | **Acting on many candidates at once** | **Done** | Recruiter bulk advance and bulk reject with independent per-candidate processing and mixed-result reporting. |
| 8 | **A dashboard** | **Done** | Live KPI summary cards (Total Active, Interviews This Week, Offers, Stalled Count), visual pipeline funnel breakdown, and opening breakdown with direct drill-down links. |
| 9 | **History you cannot rewrite** | **Done** | Immutable, append-only timeline events audit log recording state transitions, panel updates, rejection, and reinstatement. |
| 10 | **Stalled-application alerts** | **Done** | Automatic 10-day inactivity threshold detection, per-stage dismissal lifecycle, and new alert generation upon advancing to a new stage. |
| 11 | **CSV export** | **Done** | Recruiter-authorized CSV export with RFC 4180 escaping, active opening filtering, and interview panel member listing. |

## How to Run & Repeat Seeding

- **Run Dev Environment (Root):** `npm run dev` (starts backend and frontend concurrently)
- **Run Backend Only:** `cd backend && npm run dev` (or `npm run dev:backend` from root)
- **Run Frontend Only:** `cd frontend && npm run dev` (or `npm run dev:frontend` from root)
- **Run Seed Database:** `npm run db:seed`
- **Run Test Suite:** `npm run test` (143 automated tests across 12 test suites)
- **Build Client Bundle:** `npm run build:client`
- **Build Backend Server:** `npm run build:server`
