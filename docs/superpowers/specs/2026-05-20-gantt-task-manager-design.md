# Gantt Task Manager — Design Spec

**Date:** 2026-05-20
**Status:** Approved for implementation planning

## 1. Summary

A self-hosted task-management web app where projects contain tasks with start/end dates, rendered as bars on an infinitely-scrollable horizontal Gantt chart. Users log in with email/password, admins create projects and assign members, and any project member can create tasks, edit dates by dragging bars, set a PIC, upload files to S3, and link finish-to-start dependencies between tasks.

The design language is white-dominant with black + light gray — no chroma. Status is conveyed by fill pattern (outlined / filled / hatched), not color.

## 2. Goals & non-goals

### Goals
- Email/password auth with two roles: **admin** and **member**.
- Projects with M:N user assignment.
- Tasks with title, description, start/end dates, status (Todo / In Progress / Done), single PIC, file attachments.
- Gantt view: horizontal scroll across time, Day/Week/Month zoom, click bar → right-side detail panel, drag bar to move dates, drag edges to resize.
- Finish-to-start dependency arrows; cycle prevention.
- File uploads stored in S3-compatible storage via presigned URLs (bytes never pass through the API server).
- Stack: Bun + Vite + React + Tailwind + PostgreSQL.

### Non-goals (v1)
- Drag-to-link dependencies (use the side panel).
- Auto-shifting dependent tasks when a predecessor moves.
- Sub-tasks, milestones, recurring tasks, comments, activity feed, tags/labels.
- Critical-path highlighting, baselines, resource leveling.
- Print / PDF / CSV export.
- Real-time collaboration (multi-user live cursors, optimistic conflict resolution).
- Public signup. Admin creates users.
- Multi-workspace / multi-tenant.

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Bun** | User-specified; fast install & runtime; built-in argon2id and JWT helpers. |
| Web framework | **Hono** | Minimal, fast, runs natively on Bun, good middleware story. |
| Database | **PostgreSQL** | User-specified. |
| DB client | **`postgres`** (postgres.js) | Lean, Bun-compatible. |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | TypeScript-first schema; generates SQL migrations from `schema.ts`. |
| Validation / types | **Zod** in `@app/shared` | Runtime validation on the server, inferred types on the client. |
| Frontend bundler | **Vite** | User-specified. |
| UI | **React + Tailwind CSS** | User-specified. |
| Routing | **TanStack Router** | Type-safe, file-based, plays well with TanStack Query. |
| Server state | **TanStack Query** | Cache + optimistic mutations for drag-edits. |
| S3 signing | **`aws4fetch`** | Tiny SigV4 implementation; avoids AWS SDK bloat. |
| Object storage (dev) | **MinIO** in Docker | S3-compatible local dev. |

## 4. Repository layout

```
gantt-chart-app/
├── package.json                # Bun workspaces root
├── bunfig.toml
├── docker-compose.yml          # postgres + minio for dev
├── .env.example
├── packages/
│   ├── shared/                 # Zod schemas + TS types (auth, project, task, user, file)
│   │   └── src/
│   ├── server/                 # Bun + Hono API
│   │   ├── src/
│   │   │   ├── index.ts        # Bun.serve entry
│   │   │   ├── db/
│   │   │   │   ├── client.ts   # Drizzle + postgres.js
│   │   │   │   ├── schema.ts   # all tables in one file
│   │   │   │   └── migrations/
│   │   │   ├── routes/         # auth, users, projects, tasks, dependencies, files
│   │   │   ├── middleware/     # requireAuth, requireAdmin, requireProjectAccess, errorHandler
│   │   │   ├── lib/            # s3, password, jwt, cycle-check
│   │   │   └── services/       # business logic (e.g., task.service.ts)
│   │   └── drizzle.config.ts
│   └── client/                 # Vite + React + Tailwind
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       └── src/
│           ├── main.tsx
│           ├── app.tsx                       # TanStack Router root
│           ├── routes/
│           │   ├── _auth.tsx                 # auth gate
│           │   ├── login.tsx
│           │   ├── index.tsx                 # redirect to first project
│           │   ├── projects.$id.tsx          # main Gantt view
│           │   ├── projects.$id.members.tsx
│           │   └── settings.users.tsx        # admin only
│           ├── components/
│           │   ├── gantt/                    # GanttChart, GanttBar, GanttArrow, DateHeader, TodayLine, ZoomToggle
│           │   ├── task-panel/               # TaskDetailPanel, TaskForm, FileUploader, DependencyPicker
│           │   ├── project/                  # ProjectSwitcher, MemberAvatars, InviteDialog
│           │   └── ui/                       # Button, Input, Dialog, Avatar, Select (Tailwind primitives)
│           ├── lib/
│           │   ├── api.ts                    # typed fetch helpers
│           │   ├── auth.ts                   # client-side auth context
│           │   └── date.ts                   # daysSinceEpoch, addDays, etc.
│           └── hooks/
└── docs/superpowers/specs/
```

- **Workspaces**: `bun install` at root installs everything.
- **Dev**: `bun run dev` (root script) starts server on `:3000` and client on `:5173`. Vite proxies `/api/*` → `:3000`.
- **Prod**: client built to static assets. The server can serve them (single deploy) or stay behind a reverse proxy. Default: server serves the built `dist/` for simplicity; deployment can override.

## 5. Data model (PostgreSQL)

All tables. App-level invariants are called out under the schema.

```sql
-- requires extension pgcrypto for gen_random_uuid()

users (
  id              uuid PK default gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  password_hash   text NOT NULL,
  name            text NOT NULL,
  role            text NOT NULL CHECK (role IN ('admin','member')),
  created_at      timestamptz NOT NULL default now()
)

projects (
  id              uuid PK default gen_random_uuid(),
  name            text NOT NULL,
  description     text,
  created_by      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL default now(),
  updated_at      timestamptz NOT NULL default now()
)

project_members (
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  added_at        timestamptz NOT NULL default now(),
  PRIMARY KEY (project_id, user_id)
)

tasks (
  id              uuid PK default gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           text NOT NULL,
  description     text,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  status          text NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo','in_progress','done')),
  pic_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL default now(),
  updated_at      timestamptz NOT NULL default now(),
  CHECK (end_date >= start_date)
)
CREATE INDEX tasks_project_idx       ON tasks(project_id);
CREATE INDEX tasks_project_sort_idx  ON tasks(project_id, sort_order);
CREATE INDEX tasks_dates_idx         ON tasks(project_id, start_date, end_date);

task_dependencies (
  predecessor_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successor_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (predecessor_id, successor_id),
  CHECK (predecessor_id <> successor_id)
)
CREATE INDEX deps_successor_idx ON task_dependencies(successor_id);

task_files (
  id              uuid PK default gen_random_uuid(),
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  s3_key          text NOT NULL UNIQUE,
  content_type    text NOT NULL,
  size_bytes      bigint NOT NULL,
  uploaded_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     timestamptz NOT NULL default now()
)
CREATE INDEX files_task_idx ON task_files(task_id);
```

### App-level invariants

1. **PIC must be a project member.** Enforced on task create/update by checking `(task.project_id, pic_user_id) ∈ project_members`.
2. **Dependencies are intra-project only.** On dependency create, predecessor and successor must share `project_id`.
3. **No cyclic dependencies.** DFS from new predecessor; reject with `409 CONFLICT` if it can reach the successor.
4. **Access scope.** Non-admin users can only access projects where `(project_id, user_id) ∈ project_members`. Admins access all.

### Deliberately omitted

- No `archived` or soft-delete columns (use `ON DELETE CASCADE`).
- No comments / activity / tags / sub-tasks / milestones.
- No `sessions` table — JWT is stateless. (Add `revoked_jti` later if needed.)

### Bootstrap

On server startup, if `users` is empty, create an admin from env `ADMIN_EMAIL` + `ADMIN_PASSWORD`. Loud log message. No public signup endpoint.

## 6. API surface

All routes under `/api`, JSON in/out. All require auth except `POST /api/auth/login`. Auth middleware reads JWT from the httpOnly `auth` cookie.

```
─── Auth ─────────────────────────────────────────────────────
POST   /api/auth/login          { email, password } → { user }     sets cookie
POST   /api/auth/logout                                            clears cookie
GET    /api/auth/me                                  → { user }

─── Users (admin-only writes) ────────────────────────────────
GET    /api/users                                    → User[]
POST   /api/users               { email, password, name, role }    admin
PATCH  /api/users/:id           { name?, role?, password? }        admin OR self for name/password
DELETE /api/users/:id                                              admin

─── Projects ─────────────────────────────────────────────────
GET    /api/projects                                 → Project[]   member: own; admin: all
POST   /api/projects            { name, description? }             admin
GET    /api/projects/:id                             → Project + members[]
PATCH  /api/projects/:id        { name?, description? }            admin
DELETE /api/projects/:id                                           admin

POST   /api/projects/:id/members      { userId }                   admin
DELETE /api/projects/:id/members/:userId                           admin

─── Tasks ────────────────────────────────────────────────────
GET    /api/projects/:id/tasks                       → { tasks, dependencies }
POST   /api/projects/:id/tasks  { title, description?, startDate, endDate, status?, picUserId?, sortOrder? }
GET    /api/tasks/:id                                → Task + files[] + deps[]
PATCH  /api/tasks/:id           { ...partial fields }
DELETE /api/tasks/:id

─── Dependencies ─────────────────────────────────────────────
POST   /api/tasks/:id/dependencies   { predecessorId }             :id is successor
DELETE /api/tasks/:id/dependencies/:predecessorId

─── Files (two-phase) ────────────────────────────────────────
POST   /api/tasks/:id/files/presign  { filename, contentType, sizeBytes }
                                     → { uploadUrl, s3Key, expiresAt }
POST   /api/tasks/:id/files          { filename, s3Key, contentType, sizeBytes } → File
GET    /api/files/:id/download                       → 302 to presigned GET URL
DELETE /api/files/:id
```

### Permission matrix

| Action | Admin | Member (of project) | Member (other) |
|---|---|---|---|
| List own projects | all | assigned only | — |
| Create / edit / delete project | ✓ | ✗ | ✗ |
| View / create / edit / delete tasks in project | ✓ | ✓ | ✗ |
| Upload / delete files in project | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✗ | ✗ |

### Error shape

```json
{ "error": { "code": "FORBIDDEN", "message": "Not a member of this project" } }
```

Codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR` (Zod issues attached), `CONFLICT`, `INTERNAL`.

## 7. Auth implementation

- **Hashing**: `Bun.password.hash(plain, { algorithm: 'argon2id' })`.
- **JWT**: HS256, signed with `JWT_SECRET` env. Payload `{ sub: userId, role, iat, exp }`. Expiry 7 days.
- **Cookie**: `auth=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
- **No localStorage** for tokens. No CSRF token (SameSite=Lax covers it).
- **Middleware**: `requireAuth` (verifies cookie); `requireAdmin` (role check); `requireProjectAccess(paramName)` (admin bypass, else project_members lookup).
- **Rate limit** `/auth/login`: 5 attempts per IP per 15 min (Hono middleware, in-memory store; Redis-backed later if needed).

## 8. File upload implementation

- **Bucket**: single bucket `gantt-files`. Dev = MinIO in Docker. Prod = any S3-compatible (AWS, R2, Wasabi).
- **Key format**: `tasks/<task_id>/<file_uuid>-<sanitized_filename>`.
- **Signing**: `aws4fetch` for both PUT (upload) and GET (download). Presigned URLs expire in 5 minutes.
- **Allowlist**: content types ∈ `{ pdf, png, jpg, jpeg, gif, webp, svg, doc, docx, xls, xlsx, ppt, pptx, txt, csv, md, zip }`. Configurable via `ALLOWED_CONTENT_TYPES` env.
- **Size cap**: `MAX_UPLOAD_BYTES` env, default 25 MB.
- **Flow**:
  1. `POST /api/tasks/:id/files/presign` → server validates, signs PUT URL, returns it with the final `s3Key`.
  2. Client `PUT`s file bytes directly to S3, with progress via `XMLHttpRequest.upload`.
  3. `POST /api/tasks/:id/files` → server inserts `task_files` row.
- **Download**: `GET /api/files/:id/download` checks permission → 302 to a fresh presigned GET URL.
- **Delete**: `DELETE /api/files/:id` checks permission → `S3.DeleteObject` → delete row. If S3 fails, the row stays; a nightly reconcile (`bun run reconcile-orphans`) cleans up stranded objects.
- **Bucket policy**: not public; all access via presigned URLs only.

## 9. Gantt rendering & interaction

### Coordinate system

All time math runs through a single `day index` = days since epoch `2020-01-01`.

```
dayWidth (px) by zoom:
  day   → 40    (column = 1 day)
  week  →  8    (column = 1 week ≈ 56px)
  month →  3    (column = 1 month ≈ 90px)

bar.left   = (task.startDate − epoch) * dayWidth
bar.width  = (task.endDate   − task.startDate + 1) * dayWidth
```

Zoom is just a `dayWidth` change; no relayout logic, bars re-render in place.

### Component tree

```
<GanttPage>
  <TopBar />                # logo, project switcher dropdown, tabs (Gantt / Members / Settings), user menu
  <ProjectToolbar>          # project name, "+ Task" button, ZoomToggle, "Today" button
  <GanttChart>
    <LeftColumn>            # fixed width (≈260px), no horizontal scroll
      <HeaderCorner />
      <RowLabel />          # one per task: title + PIC avatar
    </LeftColumn>
    <Scroller>              # horizontal scroll container; shares vertical scroll with LeftColumn
      <DateHeader />        # sticky top: months / weeks / days bands by zoom
      <GridLayer />
      <TodayLine />
      <RowsLayer>
        <GanttBar />        # absolutely positioned per task
      </RowsLayer>
      <ArrowsLayer />       # SVG overlay, one path per dependency
    </Scroller>
  </GanttChart>
  <TaskDetailPanel />       # right slide-in, mounted when ?task=<id> is in URL
</GanttPage>
```

`LeftColumn` and `Scroller` are wrapped in a shared vertical scroll container. Row height constant at `36px`.

### "Infinite" horizontal scroll

Dynamic range expansion, not literal infinite:

- Initial range = `[min(today, earliest task start) − 30d, max(today, latest task end) + 90d]`. When the project has no tasks, the range falls back to `[today − 30d, today + 90d]`.
- On scroll within `30d` of either edge, extend that edge by `+90d`. Scroll position preserved.
- Only bars / grid / header cells inside the current range are rendered.

### Drag interactions

`pointerdown` on a bar hit-tests to determine mode:

```
[ ← resizeStart (0–6px) ][ move (middle) ][ resizeEnd (last 6px) → ]
```

- `pointermove`: compute `deltaDays = round((clientX − startX) / dayWidth)`. Update bar position via `transform: translateX(...)` on a ref (no React state churn during drag).
- `pointerup`: if `deltaDays ≠ 0`, fire optimistic `PATCH /api/tasks/:id` with new dates. Roll back on error.
- Clamp `end ≥ start` during resize.

### Dependency arrows

One `<svg>` overlay covers the scroller content. Per dependency:

```
predecessor.right → V drop → H run → small triangle arrowhead at successor.left
Path: M x1,y1 H x1+8 V y2 H x2  plus a 6px triangle marker
```

**Creating**: from the task detail panel's "Depends on" multi-select listing other tasks in the same project. No drag-to-link in v1.

**Cycle prevention**: server-side DFS on `POST /tasks/:id/dependencies`; reject with `409 CONFLICT` on cycle.

**Conflict indication**: if `predecessor.endDate > successor.startDate` after a drag, no auto-shift — the arrow gets a small "!" badge near its arrowhead. User resolves manually.

### Status encoding (palette-locked)

Black / white / light gray only. Differentiate by fill pattern:

- **Todo** — outlined: white fill, 1.5px black border, black text label.
- **In Progress** — solid: black fill, white text label.
- **Done** — hatched: diagonal stripe background, muted gray, strikethrough title.

PIC avatar = 18px circle with initials, inside the bar at the left when the bar is wide enough; hover tooltip otherwise.

### Selection state

`?task=<uuid>` URL search param is the single source of truth. Clicking a bar sets it; closing the panel clears it. The panel reads the param and fetches `GET /api/tasks/:id` via TanStack Query.

### Empty / loading / error states

- **No tasks** → centered card, "Create first task" button.
- **Loading** → skeleton rows, no spinner.
- **Network error** → inline banner above chart with retry.
- **No projects (first login)** → "Create your first project" CTA (admin) or "Ask an admin to add you to a project" (member).

### Performance

- Bound: ~500 tasks × ~365 days visible. Plain DOM + transforms; no row virtualization in v1.
- If we hit 2000+ tasks: add `@tanstack/react-virtual` for vertical row virtualization.

## 10. Visual design

- Palette: `#FFFFFF` (background), `#111111` (text + filled bar), `#F4F4F4` (light gray surfaces), `#E5E5E5` (borders), `#888888` (secondary text).
- No chroma anywhere except a single muted blue (`#0066FF`) for focus rings / selection — small, deliberate.
- Type: system stack (`ui-sans-serif, system-ui, -apple-system, ...`). 14px base, 12px secondary, 18–20px headings.
- Density: compact. Row height `36px`, padding `8/12px`, button height `28px`.
- Borders: 1px solid `#E5E5E5`, radius `4–6px`.
- Shadows: only on the side panel (`-6px 0 16px rgba(0,0,0,0.05)`) and modal overlays. No drop shadows on bars.
- App shell: **top nav + project dropdown**, tabs for Gantt / Members / Settings, user menu on the right.
- Task detail: **right-side slide-in panel** (~46% width), Gantt remains visible on the left.

## 11. Testing strategy

- **Server unit tests** (Bun's built-in test runner):
  - Permission middleware (admin vs member vs non-member)
  - Cycle-detection on dependency creation
  - PIC-must-be-member invariant
  - Password hashing & verification
  - JWT sign/verify edge cases
- **Server integration tests**: use the same `docker-compose` Postgres instance, on a separate test database (`gantt_test`). A `beforeAll` hook drops + recreates `gantt_test` and applies migrations; a `beforeEach` truncates all tables. Exercise routes end-to-end via a real HTTP client (`fetch` against the started Hono app).
- **Client unit tests** (Vitest + React Testing Library):
  - Date math (`daysSinceEpoch`, `addDays`, zoom conversion)
  - GanttBar drag math (mocked pointer events → expected new dates)
  - DependencyPicker rejects same-project cycles client-side too (UX speed; server is authoritative)
- **No e2e / Playwright in v1.** Add later if regressions justify it.

## 12. Dev workflow

```
docker compose up -d                 # postgres + minio
cp .env.example .env                 # set JWT_SECRET, S3 creds, ADMIN_EMAIL/PASSWORD
bun install
bun run --filter='@app/server' db:migrate
bun run dev                          # server :3000, client :5173
```

- `bun run db:generate` — Drizzle generates a new migration from `schema.ts` changes.
- `bun run db:migrate` — apply migrations.
- `bun run db:studio` — Drizzle Studio for browsing DB.
- `bun test` — server + client tests.
- `bun run build` — builds client into `packages/client/dist/`; server runs in production with `bun run start`.

## 13. Environment variables

```
# Server
DATABASE_URL=postgres://user:pass@localhost:5432/gantt
JWT_SECRET=<32+ random bytes>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong>

# S3
S3_ENDPOINT=http://localhost:9000           # MinIO in dev, blank/AWS in prod
S3_REGION=us-east-1
S3_BUCKET=gantt-files
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

# Limits
MAX_UPLOAD_BYTES=26214400                   # 25 MB
ALLOWED_CONTENT_TYPES=application/pdf,image/png,...

# Server runtime
PORT=3000
CLIENT_ORIGIN=http://localhost:5173         # CORS in dev
```

## 14. Security checklist

- ✅ argon2id password hashing (Bun built-in)
- ✅ JWT in httpOnly + Secure + SameSite=Lax cookie
- ✅ Permission middleware on every project/task/file route
- ✅ Zod validation rejecting extra fields on all request bodies
- ✅ File type/size allowlist enforced at presign time
- ✅ Presigned URLs short-lived (5 min)
- ✅ S3 bucket private; all access via presigned URLs
- ✅ Parameterized queries via Drizzle — no SQL injection
- ✅ Rate-limited `/auth/login` (5 attempts / IP / 15 min)
- ✅ CORS restricted to configured client origin (prod)

## 15. Open questions (deferred to implementation)

None blocking. The following are deliberately decided in v1 but worth revisiting later:

- Soft-delete vs hard-delete for tasks/projects (currently hard, with cascade).
- Notifications / email on task assignment (out of scope).
- Audit log of task edits (out of scope).
- Multiple file uploads in one go (v1 supports one at a time; trivial extension).
