# Architecture

This document outlines the high-level architecture, runtime topology, data flow, and design boundaries of the **HireFlow** platform.

---

### What are the moving pieces, and how do they talk to each other?

HireFlow is architected as a decoupled full-stack application organized into two dedicated workspaces:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│          React 18 + TypeScript SPA (Vite Dev / Prod)        │
└──────────────┬───────────────────────────────▲──────────────┘
               │ HTTP Requests (/api/*)        │ JSON Responses
               │ (Cookies: JWT Session)        │
┌──────────────▼───────────────────────────────┴──────────────┐
│                    Node.js + Express API                    │
│    - Routing & Zod Validation Middleware                    │
│    - RBAC & Authorization Layer (Recruiter vs Interviewer)  │
│    - Pipeline State Machine & Domain Services               │
└──────────────┬───────────────────────────────▲──────────────┘
               │ Parameterized SQL Queries     │ Result Sets
               │ (Connection Pool: 'pg')       │
┌──────────────▼───────────────────────────────┴──────────────┐
│                  PostgreSQL Database Engine                 │
│    - Relational Schema with Foreign Key Constraints         │
│    - Check Constraints (Status, Stages, Origin Validity)    │
│    - Append-Only Audit Trail (timeline_events)              │
│    - Composite Dismissal Indexes (stalled_alert_dismissals) │
└─────────────────────────────────────────────────────────────┘
```

1. **Frontend Client (`frontend/`):**
   - React 18 Single Page Application built with TypeScript, React Router 6, and Lucide Icons.
   - Communicates with the backend exclusively via an `ApiClient` abstraction over the native `fetch` API.
   - In development, Vite provides an internal reverse-proxy mapping all `/api` requests to `http://localhost:8000`.

2. **Backend Application (`backend/`):**
   - Express REST API written in TypeScript and executed via `tsx` (dev) / compiled Node.js (prod).
   - Enforces authentication using signed HTTP-only cookies (`hireflow_session`), input validation via Zod schemas, and role-based access control (RBAC).
   - Houses the core business logic in isolated domain services (`PipelineService`, `AuthService`).

3. **Database Layer (`PostgreSQL`):**
   - Stores all domain entities with relational integrity.
   - Managed via a pooled connection (`pg.Pool`).
   - Uses native SQL constraints (`CHECK`, `FOREIGN KEY`, `UNIQUE`) to guarantee business invariants at the database level.

---

### Where does each piece run?

| Component | Runtime Environment | Port / Location | Description |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | Client Browser / Vite Server | `http://localhost:5173` | Serves HTML, bundles React components, and executes user interaction logic. |
| **Backend REST API** | Node.js Runtime (v20+) | `http://localhost:8000` | Handles authentication, RBAC authorization, validation, and domain rules. |
| **PostgreSQL DB** | Managed Cloud (Supabase/Neon) or Local | Port `5432` | ACID-compliant storage with relational tables, indexes, and constraints. |

---

### What is the request path for one representative user action, end to end?

**Representative Action:** *A Recruiter advances a candidate from `SCREENING` to `INTERVIEW` with an evaluation note.*

1. **User Interaction:**
   - The recruiter clicks **"Advance to Interview"** inside the candidate modal on the React frontend.
2. **Client Dispatch:**
   - The frontend's `api.post('/api/applications/app_123/stage', { targetStage: 'INTERVIEW', note: 'Strong technical screen' })` fires.
   - The browser automatically attaches the secure `hireflow_session` cookie.
3. **Vite Reverse Proxy:**
   - Vite intercepts `/api/applications/...` and proxies it to `http://localhost:8000/api/applications/...`.
4. **Backend Middleware Execution:**
   - **`authenticate`:** Verifies the JWT signature from the cookie and extracts `req.user` (`{ id, role: 'RECRUITER' }`).
   - **`requireApplicationAccess('ADVANCE')`:** Verifies that only recruiters can alter candidate stages (interviewers receive `403 Forbidden`).
   - **`stageChangeSchema` (Zod):** Validates that `targetStage` is a valid `Stage` enum member.
5. **Domain Service Execution (`PipelineService.advance`):**
   - Queries current candidate state from PostgreSQL: `SELECT current_stage, stage_entered_at FROM applications WHERE id = $1`.
   - Validates linear transition: Confirms `SCREENING` $\rightarrow$ `INTERVIEW` is exactly one step forward.
   - Verifies the candidate is not in a terminal state (`REJECTED`, `HIRED`).
6. **Database Persistence (Transaction):**
   - Updates the application record:
     ```sql
     UPDATE applications 
     SET current_stage = 'INTERVIEW', stage_entered_at = NOW(), updated_at = NOW() 
     WHERE id = $1
     ```
   - Inserts an immutable timeline event:
     ```sql
     INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
     VALUES ($1, $2, 'STAGE_CHANGE', $3, 'SCREENING', 'INTERVIEW', 'Strong technical screen', NOW())
     ```
7. **Response & Client Re-render:**
   - Server responds with HTTP `200 OK` and JSON: `{ success: true, data: { id: 'app_123', current_stage: 'INTERVIEW' } }`.
   - React updates the local state, moves the candidate badge to `INTERVIEW`, and appends the new event to the timeline view without a full page refresh.

---

### What did you decide *not* to build, and why?

1. **Heavy Object-Relational Mappers (ORMs):**
   - *Why rejected:* ORMs like Prisma or TypeORM introduce abstraction overhead, obscure the underlying SQL, and often handle complex composite joins or append-only audit triggers awkwardly. Writing typed raw SQL with `pg` gave us full control over query performance, index utilization, and exact SQL constraint definitions.
2. **Client-Side Filtering & Sorting:**
   - *Why rejected:* The assignment explicitly mandated that searching, filtering, and sorting happen server-side. Performing operations in memory breaks down once candidate counts scale into the thousands.
3. **WebSockets for Stalled Alerts:**
   - *Why rejected:* The inactivity threshold is defined in **days** (10 days). Running WebSocket servers adds operational complexity and connection overhead for state changes that occur on daily boundaries. Clean REST endpoints queried on view navigation or manual refresh provide optimal reliability.
4. **Soft Deletes on Timeline Events:**
   - *Why rejected:* The requirement states history cannot be rewritten. Soft deletes would allow `deleted_at` timestamps or hidden flags. We omitted any delete or update mechanism entirely from the timeline API surface.
