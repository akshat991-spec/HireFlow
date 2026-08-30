# Submission

Fill this in and commit it. This is the first file we open.

## Links

- **GitHub repository:** <public repo URL>
- **Live application:** <deployed URL>

## Notes for the reviewer

The application is built using a modern fullstack architecture with TypeScript, Express, and PostgreSQL, strictly enforcing all authorization and role boundary checks on the server.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Recruiter | `recruiter@hireflow.test` | `password123` |
| Interviewer 1 | `interviewer@hireflow.test` | `password123` |
| Interviewer 2 | `interviewer2@hireflow.test` | `password123` |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | React 18, Vite, TypeScript | Fast, type-safe, component-driven UI with instant HMR and client routing. |
| Backend | Node.js, Express, TypeScript | Highly maintainable, asynchronous, strict type safety, clean middleware architecture. |
| Database | PostgreSQL | ACID-compliant relational DB with robust constraints, foreign keys, and indexes. |
| Hosting | Render / Vercel / Supabase | High availability, SSL-enabled connection pooling, and seamless deployment. |

## Goal checklist

Mark each honestly. Partial is fine — say what is partial.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Server-enforced RBAC (Recruiter vs Interviewer), secure password hashing (bcrypt), and JWT auth. |
| 2 | Job openings | Partial | Openings CRUD and archive/restore endpoints implemented and protected. |
| 3 | Applications inside job openings | Partial | Application model and stage routing implemented. |
| 4 | A pipeline with rules | Partial | Linear stage validation and rejection restoration implemented on backend. |
| 5 | Interview panel | Partial | Many-to-many panel assignment with server-side interviewer role validation. |
| 6 | Finding candidates | In progress | Server-side filter and pagination backend query implemented. |
| 7 | Acting on many candidates at once | Not done | |
| 8 | A dashboard | Not done | |
| 9 | History you cannot rewrite | Partial | Append-only timeline model and event recording implemented. |
| 10 | Stalled-application alerts | Partial | Multi-stage dismissal schema and query structures implemented. |

## How much time did you actually spend?

## What would you do next, with another 12 hours?

## What are you least happy with in this codebase, and why?
