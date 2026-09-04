# HireFlow

HireFlow is a modern hiring pipeline and applicant tracking platform designed to manage job openings, candidate progressions across multi-stage interview pipelines, panel evaluations, and inactivity alerts with strict server-enforced role-based access control.

## Live demo

- **App:** [https://hire-flow-frontend-lovat.vercel.app/](https://hire-flow-frontend-lovat.vercel.app/)
- **Demo credentials:** see [SUBMISSION.md](SUBMISSION.md)

## Stack

| Layer | Technology | Details / Confirmation |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 6, TypeScript | Confirmed in [`frontend/package.json`](frontend/package.json) and [`frontend/vite.config.ts`](frontend/vite.config.ts) |
| **Routing & UI** | React Router 6, Lucide Icons, Vanilla CSS | Single-page application with modular component architecture and custom design system |
| **Backend** | Node.js, Express 4, TypeScript, Zod | Confirmed in [`backend/package.json`](backend/package.json) and [`backend/src/app.ts`](backend/src/app.ts) |
| **Database** | PostgreSQL (`pg` 8 pool) | Native connection pool with relational schema ([`backend/src/db/schema.sql`](backend/src/db/schema.sql)) |
| **Dev DB Fallback** | `pg-mem` 3 | In-memory PostgreSQL instance for zero-dependency local development and automated testing |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs`, Cookies | Server-side RBAC middleware supporting HTTP-only cookies and Bearer headers |
| **Testing** | Vitest 3, Supertest 7 | 144 automated unit and integration tests with 100% pass rate ([`backend/vitest.config.ts`](backend/vitest.config.ts)) |
| **Hosting** | Vercel (Frontend) + Render (Backend) + Supabase (PostgreSQL) | Decoupled Jamstack architecture with edge-routed SPA rewrite rules |

## Project structure

```
HireFlow/
├── backend/            # Express REST API, database layer, migrations, seeds, and test suites
│   ├── src/            # Application source code (routes, middleware, services, db, types)
│   └── tests/          # 12 automated test suites covering RBAC, pipeline logic, alerts, and audit trails
├── frontend/           # React 18 + Vite SPA client application
│   ├── src/            # Components, pages, context providers, services, and styling
│   └── vercel.json     # Client-side routing rewrites for SPA hosting
├── docs/               # Technical documentation (architecture, schema, build plan, key decisions)
├── SUBMISSION.md       # Project submission overview, live URLs, and demo credentials
├── package.json        # Root npm workspaces configuration with concurrent dev scripts
└── README.md           # Project entry point and local setup instructions
```

## Running locally

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/akshat991-spec/HireFlow.git
cd HireFlow
npm install
```
*(Uses npm workspaces to install root, frontend, and backend packages in one step).*

### 2. Configure Environment Variables
- **Backend:** Copy `backend/.env.example` to `backend/.env`:
  ```bash
  cp backend/.env.example backend/.env
  ```
  *(Default config runs on port `8000`. If `DATABASE_URL` is omitted or PostgreSQL is unreachable, the backend automatically boots an in-memory database).*
- **Frontend:** Copy `frontend/.env.example` to `frontend/.env`:
  ```bash
  cp frontend/.env.example frontend/.env
  ```
  *(In local development, leave `VITE_API_URL` empty to use the Vite proxy to `http://localhost:8000`).*

### 3. Database Setup (Optional if using local/remote PostgreSQL)
```bash
npm run db:migrate    # Runs DDL schema against DATABASE_URL
npm run db:seed       # Populates realistic demo candidates, openings, and reviews
```
*(Note: If no PostgreSQL server is running, the server automatically initializes an in-memory PostgreSQL instance seeded with sample accounts and data).*

### 4. Start Development Servers
Start both servers concurrently from the root directory:
```bash
npm run dev
```
Or run each service individually:
- **Backend:** `npm run dev:backend` (runs on `http://localhost:8000`)
- **Frontend:** `npm run dev:frontend` (runs on `http://localhost:5173`)

### 5. Run Automated Tests
```bash
npm test
```
Executes all 144 Vitest integration tests verifying RBAC permissions, pipeline state transitions, stalled alerts, and immutable timeline logs.

## Documentation

Deeper write-ups live in `docs/`:
- [Architecture](docs/architecture.md)
- [Database schema](docs/schema.md)
- [Build plan](docs/plan.md)
- [Key decisions](docs/decisions.md)
- [AI usage](docs/ai-prompts.md)
