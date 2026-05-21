# Gantt Task Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted task management web app with an infinitely-scrollable Gantt chart, project + user management, file uploads to S3, and finish-to-start task dependencies — matching the design in `docs/superpowers/specs/2026-05-20-gantt-task-manager-design.md`.

**Architecture:** Bun-workspaces monorepo with three packages — `shared` (Zod schemas + types), `server` (Hono API + Drizzle/Postgres), `client` (Vite + React + Tailwind + TanStack Router/Query). JWT auth in httpOnly cookie. Files uploaded directly to S3 via presigned URLs. Gantt rendered as DOM bars + SVG arrow overlay with dynamic range expansion (no virtualization in v1).

**Tech Stack:** Bun, Hono, Drizzle ORM, postgres.js, PostgreSQL, MinIO (dev S3), Zod, aws4fetch, React 18, Vite, Tailwind CSS, TanStack Router, TanStack Query.

---

## How to use this plan

- Tasks are grouped into **phases**. Each phase ends in a working, committed state.
- Within a task, **steps** are 2–5 minutes each — write a test, run it, write code, run again, commit.
- File paths are absolute from the repo root (`gantt-chart-app/`).
- Tests are required for non-trivial logic; scaffolding tasks don't have tests.
- All commit messages use Conventional Commits.

## Phase 0 — Repository scaffold (Tasks 1–6)

### Task 1: Initialize the repo

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `bunfig.toml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Init git**

Run from `gantt-chart-app/`:
```bash
git init
git branch -m main
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
.superpowers/
packages/server/src/db/migrations/meta/_journal.json.bak
coverage/
```

- [ ] **Step 3: Write root `package.json`**

```json
{
  "name": "gantt-chart-app",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter='@app/server' dev & bun run --filter='@app/client' dev",
    "build": "bun run --filter='@app/shared' build && bun run --filter='@app/client' build && bun run --filter='@app/server' build",
    "test": "bun run --filter='*' test",
    "typecheck": "bun run --filter='*' typecheck",
    "db:generate": "bun run --filter='@app/server' db:generate",
    "db:migrate": "bun run --filter='@app/server' db:migrate",
    "db:studio": "bun run --filter='@app/server' db:studio"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 4: Write `bunfig.toml`**

```toml
[install]
exact = true
```

- [ ] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: initial workspace scaffold"
```

---

### Task 2: docker-compose for Postgres + MinIO

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: gantt-postgres
    environment:
      POSTGRES_USER: gantt
      POSTGRES_PASSWORD: gantt
      POSTGRES_DB: gantt
    ports:
      - "5432:5432"
    volumes:
      - gantt-pg:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    container_name: gantt-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - gantt-minio:/data

  minio-bootstrap:
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "
      sleep 3 &&
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb -p local/gantt-files || true &&
      exit 0;
      "

volumes:
  gantt-pg:
  gantt-minio:
```

- [ ] **Step 2: Write `.env.example`**

```
# Server
DATABASE_URL=postgres://gantt:gantt@localhost:5432/gantt
DATABASE_URL_TEST=postgres://gantt:gantt@localhost:5432/gantt_test
JWT_SECRET=change-me-to-32-random-bytes-min
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin12345

# S3
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=gantt-files
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Limits
MAX_UPLOAD_BYTES=26214400
ALLOWED_CONTENT_TYPES=application/pdf,image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,text/markdown,application/zip

# Runtime
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

- [ ] **Step 3: Verify docker compose works**

Run:
```bash
docker compose up -d
docker compose ps
```
Expected: `gantt-postgres` and `gantt-minio` healthy. Visit `http://localhost:9001` (login `minioadmin/minioadmin`) and confirm bucket `gantt-files` exists.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "chore: add docker-compose with postgres + minio"
```

---

### Task 3: Shared package skeleton

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@app/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "build": "echo 'no build, source-only'"
  },
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `packages/shared/src/index.ts`**

```ts
export * from './user';
export * from './project';
export * from './task';
export * from './file';
export * from './auth';
export * from './errors';
```

(Files referenced are created in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "chore: shared package skeleton"
```

---

### Task 4: Server package skeleton

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/drizzle.config.ts`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: `packages/server/package.json`**

```json
{
  "name": "@app/server",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "build": "echo 'bun runs source directly, no build needed'",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/db/migrate.ts",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@app/shared": "workspace:*",
    "hono": "^4.5.0",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.4",
    "zod": "^3.23.0",
    "aws4fetch": "^1.0.20",
    "@hono/zod-validator": "^0.2.2"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "@types/bun": "latest",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: `packages/server/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*", "drizzle.config.ts"]
}
```

- [ ] **Step 3: `packages/server/drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://gantt:gantt@localhost:5432/gantt',
  },
} satisfies Config;
```

- [ ] **Step 4: Stub `packages/server/src/index.ts`**

```ts
console.log('server boot — full impl in Task 14');
```

- [ ] **Step 5: Install**

Run from repo root:
```bash
bun install
```
Expected: no errors. Lockfile `bun.lockb` created.

- [ ] **Step 6: Commit**

```bash
git add packages/server bun.lockb
git commit -m "chore: server package skeleton"
```

---

### Task 5: Client package skeleton

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/tailwind.config.ts`
- Create: `packages/client/postcss.config.js`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/app.tsx`
- Create: `packages/client/src/styles.css`

- [ ] **Step 1: `packages/client/package.json`**

```json
{
  "name": "@app/client",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@app/shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.51.0",
    "@tanstack/react-router": "^1.45.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: `packages/client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "vite.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 3: `packages/client/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

- [ ] **Step 4: `packages/client/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        paper: '#FFFFFF',
        mist: '#F4F4F4',
        rule: '#E5E5E5',
        muted: '#888888',
        focus: '#0066FF',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: `packages/client/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 6: `packages/client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gantt</title>
  </head>
  <body class="bg-paper text-ink font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: `packages/client/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
```

- [ ] **Step 8: `packages/client/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: `packages/client/src/app.tsx`** (stub — full router in Task 30)

```tsx
export function App() {
  return <div className="p-8">Gantt — boot. Router lands in Task 30.</div>;
}
```

- [ ] **Step 10: `packages/client/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 11: Install + verify**

```bash
bun install
bun run --filter='@app/client' dev
```
Expected: Vite running on `http://localhost:5173`, page renders "Gantt — boot."

- [ ] **Step 12: Commit**

```bash
git add packages/client bun.lockb
git commit -m "chore: client package skeleton with Vite + React + Tailwind"
```

---

### Task 6: Root README + verify all scripts work

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```md
# Gantt Task Manager

Self-hosted task management with an infinitely-scrollable Gantt chart.

## Quickstart

```bash
docker compose up -d                 # postgres + minio
cp .env.example .env                 # then edit JWT_SECRET, ADMIN_*
bun install
bun run db:migrate                   # apply migrations (after Task 10)
bun run dev                          # server :3000, client :5173
```

## Layout

- `packages/shared` — Zod schemas + TS types
- `packages/server` — Bun + Hono API
- `packages/client` — Vite + React + Tailwind

See `docs/superpowers/specs/2026-05-20-gantt-task-manager-design.md`.
```

- [ ] **Step 2: Verify root dev script (smoke)**

```bash
bun run --filter='@app/client' dev &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
```
Expected: HTML output starting with `<!doctype html>`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: quickstart README"
```

---

## Phase 1 — Shared schemas (Task 7)

### Task 7: Zod schemas in `@app/shared`

**Files:**
- Create: `packages/shared/src/user.ts`
- Create: `packages/shared/src/project.ts`
- Create: `packages/shared/src/task.ts`
- Create: `packages/shared/src/file.ts`
- Create: `packages/shared/src/auth.ts`
- Create: `packages/shared/src/errors.ts`
- Test: `packages/shared/src/task.test.ts`

- [ ] **Step 1: Write failing test `packages/shared/src/task.test.ts`**

```ts
import { describe, it, expect } from 'bun:test';
import { CreateTaskInput, TaskStatus } from './task';

describe('CreateTaskInput', () => {
  it('rejects end_date before start_date', () => {
    const res = CreateTaskInput.safeParse({
      title: 'x',
      startDate: '2026-05-20',
      endDate: '2026-05-19',
    });
    expect(res.success).toBe(false);
  });

  it('accepts valid input with defaults', () => {
    const res = CreateTaskInput.safeParse({
      title: 'x',
      startDate: '2026-05-20',
      endDate: '2026-05-21',
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.status).toBe('todo');
  });

  it('TaskStatus enum has exactly three values', () => {
    expect(TaskStatus.options).toEqual(['todo', 'in_progress', 'done']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test packages/shared/src/task.test.ts
```
Expected: FAIL ("Cannot find module './task'" or similar).

- [ ] **Step 3: Write `packages/shared/src/user.ts`**

```ts
import { z } from 'zod';

export const Role = z.enum(['admin', 'member']);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: Role,
  createdAt: z.string(),
});
export type User = z.infer<typeof User>;

export const CreateUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: Role,
});
export type CreateUserInput = z.infer<typeof CreateUserInput>;

export const UpdateUserInput = z.object({
  name: z.string().min(1).max(120).optional(),
  role: Role.optional(),
  password: z.string().min(8).optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateUserInput = z.infer<typeof UpdateUserInput>;
```

- [ ] **Step 4: Write `packages/shared/src/project.ts`**

```ts
import { z } from 'zod';
import { User } from './user';

export const Project = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof Project>;

export const ProjectWithMembers = Project.extend({
  members: z.array(User),
});
export type ProjectWithMembers = z.infer<typeof ProjectWithMembers>;

export const CreateProjectInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;
```

- [ ] **Step 5: Write `packages/shared/src/task.ts`**

```ts
import { z } from 'zod';

export const TaskStatus = z.enum(['todo', 'in_progress', 'done']);
export type TaskStatus = z.infer<typeof TaskStatus>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const Task = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startDate: dateStr,
  endDate: dateStr,
  status: TaskStatus,
  picUserId: z.string().uuid().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof Task>;

export const Dependency = z.object({
  predecessorId: z.string().uuid(),
  successorId: z.string().uuid(),
});
export type Dependency = z.infer<typeof Dependency>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: dateStr,
  endDate: dateStr,
  status: TaskStatus.default('todo'),
  picUserId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).refine((v) => v.startDate <= v.endDate, {
  path: ['endDate'],
  message: 'endDate must be on or after startDate',
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: dateStr.optional(),
  endDate: dateStr.optional(),
  status: TaskStatus.optional(),
  picUserId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).refine(
  (v) => !(v.startDate && v.endDate) || v.startDate <= v.endDate,
  { path: ['endDate'], message: 'endDate must be on or after startDate' },
).refine((v) => Object.keys(v).length > 0, { message: 'no fields to update' });
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;
```

- [ ] **Step 6: Write `packages/shared/src/file.ts`**

```ts
import { z } from 'zod';

export const TaskFile = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  filename: z.string(),
  s3Key: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedBy: z.string().uuid().nullable(),
  uploadedAt: z.string(),
});
export type TaskFile = z.infer<typeof TaskFile>;

export const PresignUploadInput = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});
export type PresignUploadInput = z.infer<typeof PresignUploadInput>;

export const PresignUploadResult = z.object({
  uploadUrl: z.string().url(),
  s3Key: z.string(),
  expiresAt: z.string(),
});
export type PresignUploadResult = z.infer<typeof PresignUploadResult>;

export const ConfirmUploadInput = z.object({
  filename: z.string().min(1).max(255),
  s3Key: z.string().min(1),
  contentType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
});
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInput>;
```

- [ ] **Step 7: Write `packages/shared/src/auth.ts`**

```ts
import { z } from 'zod';

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;
```

- [ ] **Step 8: Write `packages/shared/src/errors.ts`**

```ts
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INTERNAL';

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    issues?: unknown;
  };
};
```

- [ ] **Step 9: Run tests**

```bash
bun test packages/shared
```
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src
git commit -m "feat(shared): Zod schemas for user/project/task/file/auth"
```

---

## Phase 2 — Server foundation (Tasks 8–16)

### Task 8: DB client + env loader

**Files:**
- Create: `packages/server/src/env.ts`
- Create: `packages/server/src/db/client.ts`

- [ ] **Step 1: `packages/server/src/env.ts`**

```ts
import { z } from 'zod';

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_TEST: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(8),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_FORCE_PATH_STYLE: z.string().transform((v) => v === 'true').default('true'),
  MAX_UPLOAD_BYTES: z.string().transform((v) => Number(v)).default('26214400'),
  ALLOWED_CONTENT_TYPES: z.string().transform((v) => v.split(',').map((s) => s.trim())),
  PORT: z.string().transform((v) => Number(v)).default('3000'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = Env.parse(process.env);
export type AppEnv = z.infer<typeof Env>;
```

- [ ] **Step 2: `packages/server/src/db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

const url = env.NODE_ENV === 'test' && env.DATABASE_URL_TEST
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

export const queryClient = postgres(url, { max: 10 });
export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
```

- [ ] **Step 3: Commit** (won't run yet — schema.ts comes in Task 9)

```bash
git add packages/server/src/env.ts packages/server/src/db/client.ts
git commit -m "feat(server): env loader + drizzle client"
```

---

### Task 9: Drizzle schema (all tables)

**Files:**
- Create: `packages/server/src/db/schema.ts`

- [ ] **Step 1: Write the schema**

```ts
import { pgTable, uuid, text, timestamp, date, integer, bigint, primaryKey, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectMembers = pgTable('project_members', {
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.userId] }),
}));

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] }).notNull().default('todo'),
  picUserId: uuid('pic_user_id').references(() => users.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byProject: index('tasks_project_idx').on(t.projectId),
  byProjectSort: index('tasks_project_sort_idx').on(t.projectId, t.sortOrder),
  byDates: index('tasks_dates_idx').on(t.projectId, t.startDate, t.endDate),
  datesOrdered: check('tasks_dates_ordered', sql`${t.endDate} >= ${t.startDate}`),
}));

export const taskDependencies = pgTable('task_dependencies', {
  predecessorId: uuid('predecessor_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  successorId: uuid('successor_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.predecessorId, t.successorId] }),
  bySuccessor: index('deps_successor_idx').on(t.successorId),
  notSelf: check('deps_not_self', sql`${t.predecessorId} <> ${t.successorId}`),
}));

export const taskFiles = pgTable('task_files', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  s3Key: text('s3_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTask: index('files_task_idx').on(t.taskId),
}));
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat(server): drizzle schema for all tables"
```

---

### Task 10: Generate + apply first migration

**Files:**
- Create: `packages/server/src/db/migrate.ts`
- Generated: `packages/server/src/db/migrations/0000_*.sql` (drizzle-kit output)

- [ ] **Step 1: Write `packages/server/src/db/migrate.ts`**

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../env';

const url = env.NODE_ENV === 'test' && env.DATABASE_URL_TEST
  ? env.DATABASE_URL_TEST
  : env.DATABASE_URL;

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
await migrate(db, { migrationsFolder: './src/db/migrations' });
await sql.end();
console.log('migrations applied');
```

- [ ] **Step 2: Ensure `.env` exists**

```bash
cp -n .env.example .env || true
```

- [ ] **Step 3: Generate migration SQL**

```bash
bun run db:generate
```
Expected: a new file `packages/server/src/db/migrations/0000_*.sql` is created.

- [ ] **Step 4: Apply migration**

```bash
bun run db:migrate
```
Expected: `migrations applied`. Verify tables exist:
```bash
docker compose exec postgres psql -U gantt -d gantt -c '\dt'
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/migrate.ts packages/server/src/db/migrations
git commit -m "feat(server): initial migration"
```

---

### Task 11: Password lib (with tests)

**Files:**
- Create: `packages/server/src/lib/password.ts`
- Test: `packages/server/src/lib/password.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hash and verify round-trips', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('verify returns false on bad password', async () => {
    const hash = await hashPassword('a');
    expect(await verifyPassword('b', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
bun test packages/server/src/lib/password.test.ts
```

- [ ] **Step 3: Implement**

```ts
export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: 'argon2id' });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Re-run — expect PASS**

```bash
bun test packages/server/src/lib/password.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lib/password.ts packages/server/src/lib/password.test.ts
git commit -m "feat(server): argon2id password hashing"
```

---

### Task 12: JWT lib (with tests)

**Files:**
- Create: `packages/server/src/lib/jwt.ts`
- Test: `packages/server/src/lib/jwt.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'a'.repeat(40);

describe('jwt', () => {
  it('sign then verify round-trips claims', async () => {
    const token = await signJwt({ sub: 'user-1', role: 'admin' }, SECRET, 60);
    const payload = await verifyJwt(token, SECRET);
    expect(payload.sub).toBe('user-1');
    expect(payload.role).toBe('admin');
  });

  it('rejects an expired token', async () => {
    const token = await signJwt({ sub: 'u', role: 'member' }, SECRET, -1);
    await expect(verifyJwt(token, SECRET)).rejects.toThrow();
  });

  it('rejects token signed with another secret', async () => {
    const token = await signJwt({ sub: 'u', role: 'member' }, SECRET, 60);
    await expect(verifyJwt(token, 'b'.repeat(40))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/lib/jwt.ts`**

```ts
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array | string): string {
  const s = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export type JwtPayload = {
  sub: string;
  role: 'admin' | 'member';
  iat: number;
  exp: number;
};

export async function signJwt(
  claims: { sub: string; role: 'admin' | 'member' },
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat, exp: iat + ttlSeconds };
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlEncode(JSON.stringify(header));
  const p = b64urlEncode(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const key = await importKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sig = b64urlEncode(new Uint8Array(sigBuf));
  return `${data}.${sig}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const key = await importKey(secret);
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(s),
    enc.encode(`${h}.${p}`),
  );
  if (!ok) throw new Error('bad signature');
  const payload = JSON.parse(dec.decode(b64urlDecode(p))) as JwtPayload;
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('expired');
  }
  return payload;
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
bun test packages/server/src/lib/jwt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lib/jwt.ts packages/server/src/lib/jwt.test.ts
git commit -m "feat(server): HS256 JWT sign/verify"
```

---

### Task 13: Bootstrap admin

**Files:**
- Create: `packages/server/src/lib/bootstrap.ts`

- [ ] **Step 1: Write `packages/server/src/lib/bootstrap.ts`**

```ts
import { db } from '../db/client';
import { users } from '../db/schema';
import { env } from '../env';
import { hashPassword } from './password';
import { sql } from 'drizzle-orm';

export async function ensureBootstrapAdmin(): Promise<void> {
  const row = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  const count = row[0]?.c ?? 0;
  if (count > 0) return;

  const hash = await hashPassword(env.ADMIN_PASSWORD);
  await db.insert(users).values({
    email: env.ADMIN_EMAIL,
    passwordHash: hash,
    name: 'Admin',
    role: 'admin',
  });

  console.log(`[bootstrap] created admin user: ${env.ADMIN_EMAIL}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/lib/bootstrap.ts
git commit -m "feat(server): bootstrap admin user from env"
```

---

### Task 14: Hono app + health endpoint

**Files:**
- Replace: `packages/server/src/index.ts`
- Create: `packages/server/src/app.ts`

- [ ] **Step 1: Write `packages/server/src/app.ts`**

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env';

export type AppContext = {
  Variables: {
    user: { id: string; role: 'admin' | 'member' };
  };
};

export function createApp() {
  const app = new Hono<AppContext>();

  app.use('*', cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }));

  app.get('/api/health', (c) => c.json({ ok: true }));

  return app;
}
```

- [ ] **Step 2: Replace `packages/server/src/index.ts`**

```ts
import { createApp } from './app';
import { env } from './env';
import { ensureBootstrapAdmin } from './lib/bootstrap';

await ensureBootstrapAdmin();

const app = createApp();

export default {
  port: env.PORT,
  fetch: app.fetch,
};

console.log(`[server] listening on http://localhost:${env.PORT}`);
```

- [ ] **Step 3: Smoke test**

```bash
bun run --filter='@app/server' dev &
sleep 2
curl -s http://localhost:3000/api/health
kill %1
```
Expected: `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/app.ts packages/server/src/index.ts
git commit -m "feat(server): Hono app with health endpoint and bootstrap"
```

---

### Task 15: `requireAuth` middleware (with tests)

**Files:**
- Create: `packages/server/src/middleware/auth.ts`
- Test: `packages/server/src/middleware/auth.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { requireAuth, requireAdmin } from './auth';
import { signJwt } from '../lib/jwt';

const SECRET = process.env.JWT_SECRET!;

function makeApp() {
  const app = new Hono();
  app.use('/secure/*', requireAuth);
  app.get('/secure/me', (c) => c.json(c.get('user')));
  app.use('/admin/*', requireAuth, requireAdmin);
  app.get('/admin/x', (c) => c.json({ ok: true }));
  return app;
}

describe('auth middleware', () => {
  it('returns 401 with no cookie', async () => {
    const res = await makeApp().request('/secure/me');
    expect(res.status).toBe(401);
  });

  it('attaches user when cookie is valid', async () => {
    const tok = await signJwt({ sub: 'u1', role: 'member' }, SECRET, 60);
    const res = await makeApp().request('/secure/me', {
      headers: { cookie: `auth=${tok}` },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'u1', role: 'member' });
  });

  it('403 for non-admin on admin route', async () => {
    const tok = await signJwt({ sub: 'u1', role: 'member' }, SECRET, 60);
    const res = await makeApp().request('/admin/x', {
      headers: { cookie: `auth=${tok}` },
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/middleware/auth.ts`**

```ts
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJwt } from '../lib/jwt';
import { env } from '../env';
import type { AppContext } from '../app';

export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = getCookie(c, 'auth');
  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'missing auth cookie' } }, 401);
  }
  try {
    const payload = await verifyJwt(token, env.JWT_SECRET);
    c.set('user', { id: payload.sub, role: payload.role });
    await next();
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'invalid or expired token' } }, 401);
  }
};

export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: { code: 'FORBIDDEN', message: 'admin only' } }, 403);
  }
  await next();
};
```

- [ ] **Step 4: Run — expect PASS**

```bash
bun test packages/server/src/middleware/auth.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/middleware/auth.ts packages/server/src/middleware/auth.test.ts
git commit -m "feat(server): requireAuth + requireAdmin middleware"
```

---

### Task 16: Error handler + Zod validation helper

**Files:**
- Create: `packages/server/src/middleware/error.ts`
- Create: `packages/server/src/middleware/validate.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: `packages/server/src/middleware/error.ts`**

```ts
import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import type { AppContext } from '../app';

export const errorHandler: ErrorHandler<AppContext> = (err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'invalid input', issues: err.issues } }, 400);
  }
  if ((err as any).status && (err as any).code) {
    const e = err as any;
    return c.json({ error: { code: e.code, message: e.message } }, e.status);
  }
  console.error('[unhandled]', err);
  return c.json({ error: { code: 'INTERNAL', message: 'internal error' } }, 500);
};

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
```

- [ ] **Step 2: `packages/server/src/middleware/validate.ts`**

```ts
import type { ZodSchema, z } from 'zod';
import type { Context } from 'hono';

export async function parseBody<S extends ZodSchema>(c: Context, schema: S): Promise<z.infer<S>> {
  const body = await c.req.json().catch(() => ({}));
  return schema.parse(body);
}
```

- [ ] **Step 3: Wire error handler in `app.ts`**

Modify `packages/server/src/app.ts` — after `app.use('*', cors(...))`, add:

```ts
app.onError(errorHandler);
```

and add import:

```ts
import { errorHandler } from './middleware/error';
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/middleware/error.ts packages/server/src/middleware/validate.ts packages/server/src/app.ts
git commit -m "feat(server): central error handler + zod body parser"
```

---

## Phase 3 — Auth & users routes (Tasks 17–20)

### Task 17: Test helpers for integration tests

**Files:**
- Create: `packages/server/src/test/helpers.ts`

- [ ] **Step 1: Write `packages/server/src/test/helpers.ts`**

```ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import { env } from '../env';
import * as schema from '../db/schema';
import { createApp } from '../app';

const TEST_URL = env.DATABASE_URL_TEST!;

export async function resetTestDb() {
  const admin = postgres(env.DATABASE_URL, { max: 1 });
  await admin`DROP DATABASE IF EXISTS gantt_test`;
  await admin`CREATE DATABASE gantt_test`;
  await admin.end();

  const sqlClient = postgres(TEST_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });
  await sqlClient`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await migrate(db, { migrationsFolder: './src/db/migrations' });
  await sqlClient.end();
}

export async function truncateAll() {
  const c = postgres(TEST_URL, { max: 1 });
  await c`TRUNCATE task_files, task_dependencies, tasks, project_members, projects, users RESTART IDENTITY CASCADE`;
  await c.end();
}

export function makeTestApp() {
  // re-require so env-driven modules pick test DB
  process.env.NODE_ENV = 'test';
  return createApp();
}

export async function loginAs(app: ReturnType<typeof makeTestApp>, email: string, password: string): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/auth=([^;]+)/);
  if (!match) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return match[1]!;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/test/helpers.ts
git commit -m "test(server): integration test helpers"
```

---

### Task 18: Auth routes — login / logout / me

**Files:**
- Create: `packages/server/src/routes/auth.ts`
- Test: `packages/server/src/routes/auth.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp } from '../test/helpers';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

describe('POST /api/auth/login', () => {
  it('rejects malformed email with 400', async () => {
    const app = makeTestApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'whatever' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects wrong password with 401', async () => {
    await db.insert(users).values({
      email: 'a@b.com', passwordHash: await hashPassword('hunter22hunter22'),
      name: 'A', role: 'admin',
    });
    const app = makeTestApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'WRONG_PASSWORD' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns user + sets cookie on valid credentials', async () => {
    await db.insert(users).values({
      email: 'a@b.com', passwordHash: await hashPassword('hunter22hunter22'),
      name: 'A', role: 'admin',
    });
    const app = makeTestApp();
    const res = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'hunter22hunter22' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/^auth=/);
    expect((await res.json()).user.email).toBe('a@b.com');
  });
});

describe('GET /api/auth/me', () => {
  it('401 without cookie', async () => {
    const res = await makeTestApp().request('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/auth.ts`**

```ts
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { LoginInput } from '@app/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import { verifyPassword } from '../lib/password';
import { signJwt } from '../lib/jwt';
import { env } from '../env';
import { parseBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import type { AppContext } from '../app';

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export const authRoutes = new Hono<AppContext>()

.post('/login', async (c) => {
  const { email, password } = await parseBody(c, LoginInput);
  const row = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = row[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'UNAUTHORIZED', 'invalid credentials');
  }
  const token = await signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, SEVEN_DAYS);
  setCookie(c, 'auth', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SEVEN_DAYS,
  });
  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt } });
})

.post('/logout', async (c) => {
  deleteCookie(c, 'auth', { path: '/' });
  return c.json({ ok: true });
})

.get('/me', requireAuth, async (c) => {
  const u = c.get('user');
  const row = await db.select().from(users).where(eq(users.id, u.id)).limit(1);
  if (!row[0]) throw new HttpError(401, 'UNAUTHORIZED', 'user not found');
  const user = row[0];
  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt } });
});
```

- [ ] **Step 4: Mount in `app.ts`**

Modify `packages/server/src/app.ts` — add inside `createApp()` before `return app`:

```ts
import { authRoutes } from './routes/auth';
// ...
app.route('/api/auth', authRoutes);
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
bun test packages/server/src/routes/auth.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/auth.ts packages/server/src/routes/auth.test.ts packages/server/src/app.ts
git commit -m "feat(server): /api/auth login + logout + me"
```

---

### Task 19: Login rate limit middleware

**Files:**
- Create: `packages/server/src/middleware/rate-limit.ts`
- Test: `packages/server/src/middleware/rate-limit.test.ts`
- Modify: `packages/server/src/routes/auth.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { rateLimit } from './rate-limit';

describe('rateLimit', () => {
  it('blocks after N requests in the window', async () => {
    const app = new Hono();
    app.use('/x', rateLimit({ max: 2, windowMs: 60_000, keyer: () => 'k' }));
    app.get('/x', (c) => c.text('ok'));

    expect((await app.request('/x')).status).toBe(200);
    expect((await app.request('/x')).status).toBe(200);
    expect((await app.request('/x')).status).toBe(429);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/middleware/rate-limit.ts`**

```ts
import type { Context, MiddlewareHandler } from 'hono';

type Opts = {
  max: number;
  windowMs: number;
  keyer?: (c: Context) => string;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(opts: Opts): MiddlewareHandler {
  const keyer = opts.keyer ?? ((c) => c.req.header('x-forwarded-for') ?? 'anon');
  return async (c, next) => {
    const key = keyer(c);
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    b.count += 1;
    if (b.count > opts.max) {
      return c.json({ error: { code: 'CONFLICT', message: 'too many requests' } }, 429);
    }
    return next();
  };
}
```

- [ ] **Step 4: Apply to login route**

In `packages/server/src/routes/auth.ts`, replace the `.post('/login', ...)` line with:

```ts
.post('/login', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }), async (c) => {
```

and add at the top:

```ts
import { rateLimit } from '../middleware/rate-limit';
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
bun test packages/server/src/middleware/rate-limit.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/middleware/rate-limit.ts packages/server/src/middleware/rate-limit.test.ts packages/server/src/routes/auth.ts
git commit -m "feat(server): rate-limit login"
```

---

### Task 20: Users routes

**Files:**
- Create: `packages/server/src/routes/users.ts`
- Test: `packages/server/src/routes/users.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp, loginAs } from '../test/helpers';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

async function seedAdmin() {
  await db.insert(users).values({
    email: 'admin@x.com', passwordHash: await hashPassword('admin12345'),
    name: 'Admin', role: 'admin',
  });
}

describe('POST /api/users', () => {
  it('admin can create a member', async () => {
    await seedAdmin();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'admin@x.com', 'admin12345');
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'm@x.com', password: 'm12345678', name: 'M', role: 'member' }),
    });
    expect(res.status).toBe(201);
  });

  it('non-admin gets 403', async () => {
    await seedAdmin();
    // create a member directly
    await db.insert(users).values({
      email: 'm@x.com', passwordHash: await hashPassword('m12345678'),
      name: 'M', role: 'member',
    });
    const app = makeTestApp();
    const cookie = await loginAs(app, 'm@x.com', 'm12345678');
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'z@x.com', password: 'z12345678', name: 'Z', role: 'member' }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/users.ts`**

```ts
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { CreateUserInput, UpdateUserInput } from '@app/shared';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../lib/password';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { HttpError } from '../middleware/error';
import { parseBody } from '../middleware/validate';
import type { AppContext } from '../app';

export const usersRoutes = new Hono<AppContext>()

.use('*', requireAuth)

.get('/', async (c) => {
  const rows = await db.select({
    id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
  }).from(users);
  return c.json(rows);
})

.post('/', requireAdmin, async (c) => {
  const body = await parseBody(c, CreateUserInput);
  const hash = await hashPassword(body.password);
  try {
    const [u] = await db.insert(users).values({
      email: body.email, passwordHash: hash, name: body.name, role: body.role,
    }).returning({
      id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
    });
    return c.json(u, 201);
  } catch (e: any) {
    if (String(e).includes('users_email_unique') || e?.code === '23505') {
      throw new HttpError(409, 'CONFLICT', 'email already in use');
    }
    throw e;
  }
})

.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const me = c.get('user');
  const body = await parseBody(c, UpdateUserInput);
  // admin can change anything; self can change name + password
  if (me.role !== 'admin') {
    if (me.id !== id) throw new HttpError(403, 'FORBIDDEN', 'cannot edit another user');
    if (body.role) throw new HttpError(403, 'FORBIDDEN', 'cannot change own role');
  }
  const patch: Partial<typeof users.$inferInsert> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.role !== undefined) patch.role = body.role;
  if (body.password !== undefined) patch.passwordHash = await hashPassword(body.password);
  const [u] = await db.update(users).set(patch).where(eq(users.id, id)).returning({
    id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
  });
  if (!u) throw new HttpError(404, 'NOT_FOUND', 'user not found');
  return c.json(u);
})

.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const me = c.get('user');
  if (me.id === id) throw new HttpError(409, 'CONFLICT', 'cannot delete self');
  const r = await db.delete(users).where(eq(users.id, id));
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount in `app.ts`**

```ts
import { usersRoutes } from './routes/users';
// ...
app.route('/api/users', usersRoutes);
```

- [ ] **Step 5: Run — expect PASS**

```bash
bun test packages/server/src/routes/users.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/users.ts packages/server/src/routes/users.test.ts packages/server/src/app.ts
git commit -m "feat(server): /api/users CRUD with admin guards"
```

---

## Phase 4 — Projects & members (Tasks 21–23)

### Task 21: `requireProjectAccess` middleware

**Files:**
- Create: `packages/server/src/middleware/project-access.ts`
- Test: `packages/server/src/middleware/project-access.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { resetTestDb, truncateAll } from '../test/helpers';
import { requireAuth } from './auth';
import { requireProjectAccess } from './project-access';
import { signJwt } from '../lib/jwt';
import { db } from '../db/client';
import { users, projects, projectMembers } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

const SECRET = process.env.JWT_SECRET!;

function app() {
  const a = new Hono();
  a.use('/p/:id/*', requireAuth, requireProjectAccess('id'));
  a.get('/p/:id/ping', (c) => c.text('ok'));
  return a;
}

describe('requireProjectAccess', () => {
  it('admin bypasses membership check', async () => {
    const [u] = await db.insert(users).values({
      email: 'a@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'A', role: 'admin',
    }).returning();
    const [p] = await db.insert(projects).values({ name: 'P', createdBy: u.id }).returning();
    const tok = await signJwt({ sub: u.id, role: 'admin' }, SECRET, 60);
    const res = await app().request(`/p/${p.id}/ping`, { headers: { cookie: `auth=${tok}` } });
    expect(res.status).toBe(200);
  });

  it('member with row passes', async () => {
    const [u] = await db.insert(users).values({
      email: 'a@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'A', role: 'admin',
    }).returning();
    const [m] = await db.insert(users).values({
      email: 'm@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'M', role: 'member',
    }).returning();
    const [p] = await db.insert(projects).values({ name: 'P', createdBy: u.id }).returning();
    await db.insert(projectMembers).values({ projectId: p.id, userId: m.id });
    const tok = await signJwt({ sub: m.id, role: 'member' }, SECRET, 60);
    const res = await app().request(`/p/${p.id}/ping`, { headers: { cookie: `auth=${tok}` } });
    expect(res.status).toBe(200);
  });

  it('non-member member gets 403', async () => {
    const [u] = await db.insert(users).values({
      email: 'a@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'A', role: 'admin',
    }).returning();
    const [m] = await db.insert(users).values({
      email: 'm@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'M', role: 'member',
    }).returning();
    const [p] = await db.insert(projects).values({ name: 'P', createdBy: u.id }).returning();
    const tok = await signJwt({ sub: m.id, role: 'member' }, SECRET, 60);
    const res = await app().request(`/p/${p.id}/ping`, { headers: { cookie: `auth=${tok}` } });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/middleware/project-access.ts`**

```ts
import type { MiddlewareHandler } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { projectMembers, projects } from '../db/schema';
import type { AppContext } from '../app';

export function requireProjectAccess(paramName: string): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    const projectId = c.req.param(paramName);
    if (!projectId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'missing project id' } }, 404);
    }
    const user = c.get('user');
    const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project[0]) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'project not found' } }, 404);
    }
    if (user.role === 'admin') return next();
    const m = await db.select({ uid: projectMembers.userId }).from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
      .limit(1);
    if (!m[0]) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'not a member of this project' } }, 403);
    }
    await next();
  };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/middleware/project-access.ts packages/server/src/middleware/project-access.test.ts
git commit -m "feat(server): requireProjectAccess middleware"
```

---

### Task 22: Projects routes (CRUD)

**Files:**
- Create: `packages/server/src/routes/projects.ts`
- Test: `packages/server/src/routes/projects.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp, loginAs } from '../test/helpers';
import { db } from '../db/client';
import { users } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

async function seedAdmin() {
  await db.insert(users).values({
    email: 'admin@example.com', passwordHash: await hashPassword('admin12345'),
    name: 'A', role: 'admin',
  });
}

describe('projects', () => {
  it('admin creates a project and lists it', async () => {
    await seedAdmin();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'admin@example.com', 'admin12345');
    const create = await app.request('/api/projects', {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'P1' }),
    });
    expect(create.status).toBe(201);
    const list = await app.request('/api/projects', { headers: { cookie: `auth=${cookie}` } });
    expect(list.status).toBe(200);
    const arr = await list.json();
    expect(arr.length).toBe(1);
    expect(arr[0].name).toBe('P1');
  });

  it('member sees only own projects', async () => {
    await seedAdmin();
    await db.insert(users).values({
      email: 'm@example.com', passwordHash: await hashPassword('member12345'),
      name: 'M', role: 'member',
    });
    const app = makeTestApp();
    const adminCookie = await loginAs(app, 'admin@example.com', 'admin12345');
    const memberCookie = await loginAs(app, 'm@example.com', 'member12345');

    // admin creates 2 projects, adds member to one
    const p1 = await (await app.request('/api/projects', {
      method: 'POST', headers: { cookie: `auth=${adminCookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'OPEN' }),
    })).json();
    await app.request('/api/projects', {
      method: 'POST', headers: { cookie: `auth=${adminCookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'CLOSED' }),
    });
    // member doesn't exist yet via API; insert link directly
    const memberRow = (await db.select().from(users)).find((u) => u.email === 'm@example.com')!;
    await app.request(`/api/projects/${p1.id}/members`, {
      method: 'POST', headers: { cookie: `auth=${adminCookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ userId: memberRow.id }),
    });

    const list = await app.request('/api/projects', { headers: { cookie: `auth=${memberCookie}` } });
    const arr = await list.json();
    expect(arr.map((p: any) => p.name)).toEqual(['OPEN']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/projects.ts`**

```ts
import { Hono } from 'hono';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { CreateProjectInput, UpdateProjectInput } from '@app/shared';
import { db } from '../db/client';
import { projects, projectMembers, users } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/project-access';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import type { AppContext } from '../app';

export const projectsRoutes = new Hono<AppContext>()

.use('*', requireAuth)

.get('/', async (c) => {
  const me = c.get('user');
  if (me.role === 'admin') {
    return c.json(await db.select().from(projects));
  }
  const rows = await db
    .select({ p: projects })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(eq(projectMembers.userId, me.id));
  return c.json(rows.map((r) => r.p));
})

.post('/', requireAdmin, async (c) => {
  const body = await parseBody(c, CreateProjectInput);
  const me = c.get('user');
  const [p] = await db.insert(projects).values({
    name: body.name,
    description: body.description ?? null,
    createdBy: me.id,
  }).returning();
  return c.json(p, 201);
})

.get('/:id', requireProjectAccess('id'), async (c) => {
  const id = c.req.param('id');
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'project not found');
  const members = await db
    .select({
      id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, id));
  return c.json({ ...p, members });
})

.patch('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const body = await parseBody(c, UpdateProjectInput);
  const [p] = await db.update(projects)
    .set({ ...body, updatedAt: sql`now()` })
    .where(eq(projects.id, id))
    .returning();
  if (!p) throw new HttpError(404, 'NOT_FOUND', 'project not found');
  return c.json(p);
})

.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  await db.delete(projects).where(eq(projects.id, id));
  return c.json({ ok: true });
})

.post('/:id/members', requireAdmin, async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json() as { userId?: string };
  if (!body.userId) throw new HttpError(400, 'VALIDATION_ERROR', 'userId required');
  await db.insert(projectMembers).values({ projectId, userId: body.userId }).onConflictDoNothing();
  return c.json({ ok: true });
})

.delete('/:id/members/:userId', requireAdmin, async (c) => {
  const projectId = c.req.param('id');
  const userId = c.req.param('userId');
  await db.delete(projectMembers).where(
    and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  );
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount in `app.ts`**

```ts
import { projectsRoutes } from './routes/projects';
app.route('/api/projects', projectsRoutes);
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/projects.ts packages/server/src/routes/projects.test.ts packages/server/src/app.ts
git commit -m "feat(server): projects CRUD + members"
```

---

### Task 23: PIC-must-be-member invariant check helper

**Files:**
- Create: `packages/server/src/lib/membership.ts`
- Test: `packages/server/src/lib/membership.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll } from '../test/helpers';
import { db } from '../db/client';
import { users, projects, projectMembers } from '../db/schema';
import { hashPassword } from './password';
import { assertProjectMember } from './membership';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

describe('assertProjectMember', () => {
  it('passes for member', async () => {
    const [u] = await db.insert(users).values({
      email: 'a@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'A', role: 'member',
    }).returning();
    const [p] = await db.insert(projects).values({ name: 'P', createdBy: u.id }).returning();
    await db.insert(projectMembers).values({ projectId: p.id, userId: u.id });
    await expect(assertProjectMember(p.id, u.id)).resolves.toBeUndefined();
  });

  it('throws CONFLICT for non-member', async () => {
    const [u] = await db.insert(users).values({
      email: 'a@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'A', role: 'member',
    }).returning();
    const [p] = await db.insert(projects).values({ name: 'P', createdBy: u.id }).returning();
    await expect(assertProjectMember(p.id, u.id)).rejects.toThrow(/not a project member/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/lib/membership.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { projectMembers } from '../db/schema';
import { HttpError } from '../middleware/error';

export async function assertProjectMember(projectId: string, userId: string): Promise<void> {
  const r = await db.select({ uid: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  if (!r[0]) throw new HttpError(409, 'CONFLICT', 'PIC is not a project member');
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lib/membership.ts packages/server/src/lib/membership.test.ts
git commit -m "feat(server): PIC membership invariant helper"
```

---

## Phase 5 — Tasks, dependencies, files (Tasks 24–29)

### Task 24: Tasks routes (CRUD)

**Files:**
- Create: `packages/server/src/routes/tasks.ts`
- Test: `packages/server/src/routes/tasks.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp, loginAs } from '../test/helpers';
import { db } from '../db/client';
import { users, projects, projectMembers } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

async function seed() {
  const [admin] = await db.insert(users).values({
    email: 'admin@example.com', passwordHash: await hashPassword('admin12345'),
    name: 'A', role: 'admin',
  }).returning();
  const [project] = await db.insert(projects).values({ name: 'P', createdBy: admin.id }).returning();
  await db.insert(projectMembers).values({ projectId: project.id, userId: admin.id });
  return { admin, project };
}

describe('tasks', () => {
  it('create + list', async () => {
    const { project } = await seed();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'admin@example.com', 'admin12345');
    const created = await app.request(`/api/projects/${project.id}/tasks`, {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'T1', startDate: '2026-05-20', endDate: '2026-05-22' }),
    });
    expect(created.status).toBe(201);

    const list = await app.request(`/api/projects/${project.id}/tasks`, { headers: { cookie: `auth=${cookie}` } });
    const data = await list.json();
    expect(data.tasks.length).toBe(1);
    expect(data.dependencies.length).toBe(0);
  });

  it('rejects PIC who is not a project member', async () => {
    const { project } = await seed();
    const [outsider] = await db.insert(users).values({
      email: 'o@example.com', passwordHash: await hashPassword('xxxxxxxx'), name: 'O', role: 'member',
    }).returning();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'admin@example.com', 'admin12345');
    const res = await app.request(`/api/projects/${project.id}/tasks`, {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'T', startDate: '2026-05-20', endDate: '2026-05-21', picUserId: outsider.id }),
    });
    expect(res.status).toBe(409);
  });

  it('PATCH updates dates', async () => {
    const { project } = await seed();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'admin@example.com', 'admin12345');
    const created = await (await app.request(`/api/projects/${project.id}/tasks`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'T', startDate: '2026-05-20', endDate: '2026-05-22' }),
    })).json();
    const upd = await app.request(`/api/tasks/${created.id}`, {
      method: 'PATCH', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate: '2026-05-21', endDate: '2026-05-25' }),
    });
    expect(upd.status).toBe(200);
    const u = await upd.json();
    expect(u.endDate).toBe('2026-05-25');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/tasks.ts`**

```ts
import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { CreateTaskInput, UpdateTaskInput } from '@app/shared';
import { db } from '../db/client';
import { tasks, taskDependencies, taskFiles } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { requireProjectAccess } from '../middleware/project-access';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import type { AppContext } from '../app';

export const projectTasksRoutes = new Hono<AppContext>()
.use('*', requireAuth)

// GET tasks + deps in one call (powers the Gantt)
.get('/:projectId/tasks', requireProjectAccess('projectId'), async (c) => {
  const projectId = c.req.param('projectId');
  const ts = await db.select().from(tasks).where(eq(tasks.projectId, projectId));
  const ids = ts.map((t) => t.id);
  const deps = ids.length === 0
    ? []
    : await db.select().from(taskDependencies).where(sql`${taskDependencies.successorId} = ANY(${ids})`);
  return c.json({ tasks: ts, dependencies: deps });
})

.post('/:projectId/tasks', requireProjectAccess('projectId'), async (c) => {
  const projectId = c.req.param('projectId');
  const body = await parseBody(c, CreateTaskInput);
  if (body.picUserId) await assertProjectMember(projectId, body.picUserId);
  const [t] = await db.insert(tasks).values({
    projectId,
    title: body.title,
    description: body.description ?? null,
    startDate: body.startDate,
    endDate: body.endDate,
    status: body.status,
    picUserId: body.picUserId ?? null,
    sortOrder: body.sortOrder ?? 0,
  }).returning();
  return c.json(t, 201);
});

// Per-task routes (no projectId in URL → lookup project from task)
export const taskRoutes = new Hono<AppContext>()
.use('*', requireAuth)

.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  // access check using project access middleware logic inline
  const me = c.get('user');
  if (me.role !== 'admin') {
    await assertProjectMember(t.projectId, me.id);
  }
  const files = await db.select().from(taskFiles).where(eq(taskFiles.taskId, id));
  const deps = await db.select().from(taskDependencies).where(eq(taskDependencies.successorId, id));
  return c.json({ ...t, files, dependencies: deps });
})

.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await parseBody(c, UpdateTaskInput);
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');

  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);

  if (body.picUserId) await assertProjectMember(existing.projectId, body.picUserId);

  const patch: Partial<typeof tasks.$inferInsert> = { updatedAt: sql`now()` as any };
  if (body.title !== undefined) patch.title = body.title;
  if (body.description !== undefined) patch.description = body.description;
  if (body.startDate !== undefined) patch.startDate = body.startDate;
  if (body.endDate !== undefined) patch.endDate = body.endDate;
  if (body.status !== undefined) patch.status = body.status;
  if (body.picUserId !== undefined) patch.picUserId = body.picUserId;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;

  const [t] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
  return c.json(t);
})

.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(existing.projectId, me.id);
  await db.delete(tasks).where(eq(tasks.id, id));
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount in `app.ts`**

```ts
import { projectTasksRoutes, taskRoutes } from './routes/tasks';
app.route('/api/projects', projectTasksRoutes);
app.route('/api/tasks', taskRoutes);
```

- [ ] **Step 5: Run tests — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/tasks.ts packages/server/src/routes/tasks.test.ts packages/server/src/app.ts
git commit -m "feat(server): tasks CRUD with PIC invariant"
```

---

### Task 25: Cycle detection lib

**Files:**
- Create: `packages/server/src/lib/cycle-check.ts`
- Test: `packages/server/src/lib/cycle-check.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { wouldCreateCycle } from './cycle-check';

// graph as adjacency: predecessor → successors[]
// edges represent "predecessor → successor"
const edges: Record<string, string[]> = {
  A: ['B'],
  B: ['C'],
  C: [],
  D: ['A'],
};

const fetchSuccessors = async (id: string) => edges[id] ?? [];

describe('wouldCreateCycle', () => {
  it('detects direct back-edge', async () => {
    // Adding C → A would close A→B→C→A
    expect(await wouldCreateCycle('C', 'A', fetchSuccessors)).toBe(true);
  });

  it('returns false for a fresh edge', async () => {
    expect(await wouldCreateCycle('D', 'C', fetchSuccessors)).toBe(false);
  });

  it('treats self-edge as cycle', async () => {
    expect(await wouldCreateCycle('A', 'A', fetchSuccessors)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/lib/cycle-check.ts`**

```ts
/**
 * Returns true if adding edge predecessor → successor would create a cycle.
 *
 * Algorithm: DFS forward from `successor`. If we can reach `predecessor`, a back
 * edge would form. Also treats self-loops (pred === succ) as a cycle.
 */
export async function wouldCreateCycle(
  predecessorId: string,
  successorId: string,
  fetchSuccessors: (id: string) => Promise<string[]>,
): Promise<boolean> {
  if (predecessorId === successorId) return true;
  const seen = new Set<string>();
  const stack = [successorId];
  while (stack.length) {
    const node = stack.pop()!;
    if (node === predecessorId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    const next = await fetchSuccessors(node);
    for (const n of next) stack.push(n);
  }
  return false;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lib/cycle-check.ts packages/server/src/lib/cycle-check.test.ts
git commit -m "feat(server): dependency cycle detection"
```

---

### Task 26: Dependency routes

**Files:**
- Create: `packages/server/src/routes/dependencies.ts`
- Test: `packages/server/src/routes/dependencies.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp, loginAs } from '../test/helpers';
import { db } from '../db/client';
import { users, projects, projectMembers, tasks } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

async function setup() {
  const [admin] = await db.insert(users).values({
    email: 'a@example.com', passwordHash: await hashPassword('admin12345'),
    name: 'A', role: 'admin',
  }).returning();
  const [project] = await db.insert(projects).values({ name: 'P', createdBy: admin.id }).returning();
  await db.insert(projectMembers).values({ projectId: project.id, userId: admin.id });
  const [t1] = await db.insert(tasks).values({
    projectId: project.id, title: 'A', startDate: '2026-05-20', endDate: '2026-05-21',
  }).returning();
  const [t2] = await db.insert(tasks).values({
    projectId: project.id, title: 'B', startDate: '2026-05-22', endDate: '2026-05-23',
  }).returning();
  const [t3] = await db.insert(tasks).values({
    projectId: project.id, title: 'C', startDate: '2026-05-24', endDate: '2026-05-25',
  }).returning();
  return { project, t1, t2, t3 };
}

describe('dependencies', () => {
  it('creates a finish-to-start link', async () => {
    const { t1, t2 } = await setup();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'a@example.com', 'admin12345');
    const res = await app.request(`/api/tasks/${t2.id}/dependencies`, {
      method: 'POST',
      headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ predecessorId: t1.id }),
    });
    expect(res.status).toBe(201);
  });

  it('rejects cycle', async () => {
    const { t1, t2, t3 } = await setup();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'a@example.com', 'admin12345');
    // A→B
    await app.request(`/api/tasks/${t2.id}/dependencies`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ predecessorId: t1.id }),
    });
    // B→C
    await app.request(`/api/tasks/${t3.id}/dependencies`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ predecessorId: t2.id }),
    });
    // try C→A (would close A→B→C→A)
    const bad = await app.request(`/api/tasks/${t1.id}/dependencies`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ predecessorId: t3.id }),
    });
    expect(bad.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/dependencies.ts`**

```ts
import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { tasks, taskDependencies } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { wouldCreateCycle } from '../lib/cycle-check';
import type { AppContext } from '../app';

const CreateDepBody = z.object({ predecessorId: z.string().uuid() });

export const dependencyRoutes = new Hono<AppContext>()
.use('*', requireAuth)

.post('/:id/dependencies', async (c) => {
  const successorId = c.req.param('id');
  const { predecessorId } = await parseBody(c, CreateDepBody);

  const [succ] = await db.select().from(tasks).where(eq(tasks.id, successorId));
  const [pred] = await db.select().from(tasks).where(eq(tasks.id, predecessorId));
  if (!succ || !pred) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  if (succ.projectId !== pred.projectId) {
    throw new HttpError(409, 'CONFLICT', 'tasks belong to different projects');
  }

  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(succ.projectId, me.id);

  const fetchSuccessors = async (id: string) => {
    const rows = await db.select({ s: taskDependencies.successorId })
      .from(taskDependencies)
      .where(eq(taskDependencies.predecessorId, id));
    return rows.map((r) => r.s);
  };
  if (await wouldCreateCycle(predecessorId, successorId, fetchSuccessors)) {
    throw new HttpError(409, 'CONFLICT', 'dependency would create a cycle');
  }

  await db.insert(taskDependencies).values({ predecessorId, successorId }).onConflictDoNothing();
  return c.json({ predecessorId, successorId }, 201);
})

.delete('/:id/dependencies/:predecessorId', async (c) => {
  const successorId = c.req.param('id');
  const predecessorId = c.req.param('predecessorId');
  const [succ] = await db.select().from(tasks).where(eq(tasks.id, successorId));
  if (!succ) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(succ.projectId, me.id);

  await db.delete(taskDependencies).where(
    and(eq(taskDependencies.predecessorId, predecessorId), eq(taskDependencies.successorId, successorId)),
  );
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount**

```ts
import { dependencyRoutes } from './routes/dependencies';
app.route('/api/tasks', dependencyRoutes);
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/dependencies.ts packages/server/src/routes/dependencies.test.ts packages/server/src/app.ts
git commit -m "feat(server): task dependencies with cycle prevention"
```

---

### Task 27: S3 lib — presigned URLs

**Files:**
- Create: `packages/server/src/lib/s3.ts`
- Test: `packages/server/src/lib/s3.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'bun:test';
import { presignPut, presignGet, buildS3Key } from './s3';

describe('s3', () => {
  it('buildS3Key includes task id and sanitizes filename', () => {
    const key = buildS3Key('00000000-0000-0000-0000-000000000001', 'My File.pdf');
    expect(key.startsWith('tasks/00000000-0000-0000-0000-000000000001/')).toBe(true);
    expect(key.endsWith('-My_File.pdf')).toBe(true);
  });

  it('presignPut returns a signed URL', async () => {
    const url = await presignPut('tasks/abc/x.pdf', 'application/pdf', 60);
    expect(url).toMatch(/X-Amz-Signature=/);
  });

  it('presignGet returns a signed URL', async () => {
    const url = await presignGet('tasks/abc/x.pdf', 60);
    expect(url).toMatch(/X-Amz-Signature=/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/lib/s3.ts`**

```ts
import { AwsClient } from 'aws4fetch';
import { env } from '../env';

const client = new AwsClient({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  region: env.S3_REGION,
  service: 's3',
});

function objectUrl(key: string): string {
  // path-style for MinIO; virtual-host for AWS
  if (env.S3_FORCE_PATH_STYLE) {
    return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  }
  return `${env.S3_ENDPOINT.replace('://', `://${env.S3_BUCKET}.`)}/${key}`;
}

export function buildS3Key(taskId: string, originalFilename: string): string {
  const sanitized = originalFilename.replace(/[^A-Za-z0-9._-]/g, '_');
  return `tasks/${taskId}/${crypto.randomUUID()}-${sanitized}`;
}

export async function presignPut(key: string, contentType: string, ttlSeconds: number): Promise<string> {
  const url = `${objectUrl(key)}?X-Amz-Expires=${ttlSeconds}`;
  const req = await client.sign(url, {
    method: 'PUT',
    aws: { signQuery: true },
    headers: { 'content-type': contentType },
  });
  return req.url;
}

export async function presignGet(key: string, ttlSeconds: number): Promise<string> {
  const url = `${objectUrl(key)}?X-Amz-Expires=${ttlSeconds}`;
  const req = await client.sign(url, { method: 'GET', aws: { signQuery: true } });
  return req.url;
}

export async function deleteObject(key: string): Promise<void> {
  const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`S3 delete failed: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
bun test packages/server/src/lib/s3.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/lib/s3.ts packages/server/src/lib/s3.test.ts
git commit -m "feat(server): S3 SigV4 presigning via aws4fetch"
```

---

### Task 28: Files routes — presign + confirm

**Files:**
- Create: `packages/server/src/routes/files.ts`
- Test: `packages/server/src/routes/files.test.ts`
- Modify: `packages/server/src/app.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { resetTestDb, truncateAll, makeTestApp, loginAs } from '../test/helpers';
import { db } from '../db/client';
import { users, projects, projectMembers, tasks } from '../db/schema';
import { hashPassword } from '../lib/password';

beforeAll(async () => { await resetTestDb(); });
beforeEach(async () => { await truncateAll(); });

async function setup() {
  const [admin] = await db.insert(users).values({
    email: 'a@example.com', passwordHash: await hashPassword('admin12345'),
    name: 'A', role: 'admin',
  }).returning();
  const [project] = await db.insert(projects).values({ name: 'P', createdBy: admin.id }).returning();
  await db.insert(projectMembers).values({ projectId: project.id, userId: admin.id });
  const [task] = await db.insert(tasks).values({
    projectId: project.id, title: 'T', startDate: '2026-05-20', endDate: '2026-05-21',
  }).returning();
  return { task };
}

describe('files', () => {
  it('presign returns uploadUrl + s3Key', async () => {
    const { task } = await setup();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'a@example.com', 'admin12345');
    const res = await app.request(`/api/tasks/${task.id}/files/presign`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toMatch(/X-Amz-Signature=/);
    expect(body.s3Key).toMatch(/^tasks\//);
  });

  it('rejects disallowed content type', async () => {
    const { task } = await setup();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'a@example.com', 'admin12345');
    const res = await app.request(`/api/tasks/${task.id}/files/presign`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'a.exe', contentType: 'application/x-msdownload', sizeBytes: 1024 }),
    });
    expect(res.status).toBe(409);
  });

  it('confirm creates a file row', async () => {
    const { task } = await setup();
    const app = makeTestApp();
    const cookie = await loginAs(app, 'a@example.com', 'admin12345');
    const presign = await (await app.request(`/api/tasks/${task.id}/files/presign`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({ filename: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
    })).json();
    const confirm = await app.request(`/api/tasks/${task.id}/files`, {
      method: 'POST', headers: { cookie: `auth=${cookie}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'a.pdf', s3Key: presign.s3Key, contentType: 'application/pdf', sizeBytes: 1024,
      }),
    });
    expect(confirm.status).toBe(201);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/server/src/routes/files.ts`**

```ts
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { PresignUploadInput, ConfirmUploadInput } from '@app/shared';
import { db } from '../db/client';
import { tasks, taskFiles } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { HttpError } from '../middleware/error';
import { assertProjectMember } from '../lib/membership';
import { buildS3Key, presignPut, presignGet, deleteObject } from '../lib/s3';
import { env } from '../env';
import type { AppContext } from '../app';

async function loadTaskAndCheckAccess(c: any, taskId: string) {
  const [t] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!t) throw new HttpError(404, 'NOT_FOUND', 'task not found');
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(t.projectId, me.id);
  return { task: t, me };
}

export const taskFilesRoutes = new Hono<AppContext>()
.use('*', requireAuth)

.post('/:id/files/presign', async (c) => {
  const taskId = c.req.param('id');
  await loadTaskAndCheckAccess(c, taskId);
  const body = await parseBody(c, PresignUploadInput);
  if (body.sizeBytes > env.MAX_UPLOAD_BYTES) {
    throw new HttpError(409, 'CONFLICT', `file exceeds ${env.MAX_UPLOAD_BYTES} bytes`);
  }
  if (!env.ALLOWED_CONTENT_TYPES.includes(body.contentType)) {
    throw new HttpError(409, 'CONFLICT', `content type not allowed: ${body.contentType}`);
  }
  const s3Key = buildS3Key(taskId, body.filename);
  const uploadUrl = await presignPut(s3Key, body.contentType, 300);
  return c.json({ uploadUrl, s3Key, expiresAt: new Date(Date.now() + 300_000).toISOString() });
})

.post('/:id/files', async (c) => {
  const taskId = c.req.param('id');
  const { me } = await loadTaskAndCheckAccess(c, taskId);
  const body = await parseBody(c, ConfirmUploadInput);
  const [row] = await db.insert(taskFiles).values({
    taskId,
    filename: body.filename,
    s3Key: body.s3Key,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    uploadedBy: me.id,
  }).returning();
  return c.json(row, 201);
});

export const fileRoutes = new Hono<AppContext>()
.use('*', requireAuth)

.get('/:id/download', async (c) => {
  const id = c.req.param('id');
  const [f] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
  if (!f) throw new HttpError(404, 'NOT_FOUND', 'file not found');
  const [t] = await db.select().from(tasks).where(eq(tasks.id, f.taskId));
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(t!.projectId, me.id);
  const url = await presignGet(f.s3Key, 300);
  return c.redirect(url, 302);
})

.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [f] = await db.select().from(taskFiles).where(eq(taskFiles.id, id));
  if (!f) throw new HttpError(404, 'NOT_FOUND', 'file not found');
  const [t] = await db.select().from(tasks).where(eq(tasks.id, f.taskId));
  const me = c.get('user');
  if (me.role !== 'admin') await assertProjectMember(t!.projectId, me.id);
  try {
    await deleteObject(f.s3Key);
  } catch (e) {
    console.warn('[files] S3 delete failed, row removed anyway:', e);
  }
  await db.delete(taskFiles).where(eq(taskFiles.id, id));
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount**

```ts
import { taskFilesRoutes, fileRoutes } from './routes/files';
app.route('/api/tasks', taskFilesRoutes);
app.route('/api/files', fileRoutes);
```

- [ ] **Step 5: Run — expect PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/routes/files.ts packages/server/src/routes/files.test.ts packages/server/src/app.ts
git commit -m "feat(server): file presign + confirm + download + delete"
```

---

### Task 29: Reconcile-orphans script

**Files:**
- Create: `packages/server/src/scripts/reconcile-orphans.ts`
- Modify: `packages/server/package.json`

- [ ] **Step 1: Write `packages/server/src/scripts/reconcile-orphans.ts`**

```ts
/**
 * Lists S3 objects under `tasks/` and deletes any whose s3_key does not match
 * an existing task_files row. Run nightly.
 */
import { AwsClient } from 'aws4fetch';
import { db } from '../db/client';
import { taskFiles } from '../db/schema';
import { env } from '../env';

const client = new AwsClient({
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  region: env.S3_REGION,
  service: 's3',
});

const ROOT = env.S3_FORCE_PATH_STYLE
  ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`
  : env.S3_ENDPOINT.replace('://', `://${env.S3_BUCKET}.`);

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(`${ROOT}/?list-type=2&prefix=${encodeURIComponent(prefix)}`);
    if (token) url.searchParams.set('continuation-token', token);
    const res = await client.fetch(url.toString());
    const xml = await res.text();
    const matches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)];
    for (const m of matches) keys.push(m[1]!);
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1];
  } while (token);
  return keys;
}

const known = new Set((await db.select({ k: taskFiles.s3Key }).from(taskFiles)).map((r) => r.k));
const found = await listKeys('tasks/');
const orphans = found.filter((k) => !known.has(k));
console.log(`Found ${found.length} keys; ${orphans.length} orphans`);

for (const k of orphans) {
  await client.fetch(`${ROOT}/${encodeURIComponent(k).replace(/%2F/g, '/')}`, { method: 'DELETE' });
  console.log(`deleted ${k}`);
}
console.log('done');
process.exit(0);
```

- [ ] **Step 2: Add script entry to `packages/server/package.json`**

In the `scripts` block:
```json
"reconcile-orphans": "bun run src/scripts/reconcile-orphans.ts"
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/scripts packages/server/package.json
git commit -m "feat(server): nightly orphan file reconciler"
```

---

**End of Phase 5.** At this point the server is feature-complete. Run all tests:

```bash
bun test
```
Expected: all green.

---

## Phase 6 — Client foundation (Tasks 30–34)

### Task 30: Typed API client

**Files:**
- Create: `packages/client/src/lib/api.ts`

- [ ] **Step 1: Write `packages/client/src/lib/api.ts`**

```ts
import type { ApiError } from '@app/shared';

class ApiException extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = (data as ApiError | undefined)?.error;
    throw new ApiException(res.status, err?.code ?? 'INTERNAL', err?.message ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  get:    <T>(p: string) => request<T>('GET', p),
  post:   <T>(p: string, body?: unknown) => request<T>('POST', p, body),
  patch:  <T>(p: string, body?: unknown) => request<T>('PATCH', p, body),
  delete: <T>(p: string) => request<T>('DELETE', p),
};

export { ApiException };
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/lib/api.ts
git commit -m "feat(client): typed fetch wrapper"
```

---

### Task 31: Auth context + hook

**Files:**
- Create: `packages/client/src/lib/auth.tsx`

- [ ] **Step 1: Write `packages/client/src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@app/shared';
import { api, ApiException } from './api';

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiException) || e.status !== 401) console.warn(e);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Ctx.Provider value={{
      user, loading,
      login: async (email, password) => {
        const r = await api.post<{ user: User }>('/auth/login', { email, password });
        setUser(r.user);
      },
      logout: async () => {
        await api.post('/auth/logout');
        setUser(null);
      },
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/lib/auth.tsx
git commit -m "feat(client): auth context"
```

---

### Task 32: Router setup + Login route + auth gate

**Files:**
- Create: `packages/client/src/router.tsx`
- Create: `packages/client/src/routes/__root.tsx`
- Create: `packages/client/src/routes/login.tsx`
- Create: `packages/client/src/routes/_auth.tsx`
- Create: `packages/client/src/routes/_auth.index.tsx`
- Replace: `packages/client/src/app.tsx`
- Create: `packages/client/src/components/ui/Button.tsx`
- Create: `packages/client/src/components/ui/Input.tsx`

- [ ] **Step 1: `packages/client/src/components/ui/Button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const base = 'inline-flex items-center justify-center gap-1.5 h-7 px-3 text-[13px] rounded border transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40';
const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper border-ink hover:bg-black',
  ghost:   'bg-paper text-ink border-rule hover:bg-mist',
  danger:  'bg-paper text-ink border-rule hover:bg-mist hover:text-red-600',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant = 'primary', className = '', ...props }, ref) => (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...props} />
  ),
);
Button.displayName = 'Button';
```

- [ ] **Step 2: `packages/client/src/components/ui/Input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`h-8 px-2.5 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [ ] **Step 3: `packages/client/src/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <Outlet />,
});
```

- [ ] **Step 4: `packages/client/src/routes/login.tsx`**

```tsx
import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    nav({ to: '/' });
    return null;
  }

  return (
    <div className="min-h-full grid place-items-center bg-paper">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null); setBusy(true);
          try { await login(email, pw); nav({ to: '/' }); }
          catch (x: any) { setErr(x.message ?? 'login failed'); }
          finally { setBusy(false); }
        }}
        className="w-[320px] flex flex-col gap-3 p-6 border border-rule rounded-md bg-paper"
      >
        <h1 className="text-lg font-semibold">Sign in</h1>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" autoComplete="email" />
        <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password" type="password" autoComplete="current-password" />
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <Button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: `packages/client/src/routes/_auth.tsx`** (layout that requires auth)

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuth } from '../lib/auth';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!user) {
    // redirect via window since hooks must run before router redirect
    window.location.assign('/login');
    return null;
  }
  return <Outlet />;
}
```

- [ ] **Step 6: `packages/client/src/routes/_auth.index.tsx`** (post-login landing)

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project } from '@app/shared';
import { useEffect } from 'react';

export const Route = createFileRoute('/_auth/')({
  component: Landing,
});

function Landing() {
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  });
  useEffect(() => {
    if (data && data.length > 0) nav({ to: '/projects/$id', params: { id: data[0]!.id } });
  }, [data, nav]);
  if (!data) return <div className="p-8 text-muted">Loading…</div>;
  if (data.length === 0) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <h2 className="text-base font-semibold mb-2">No projects yet</h2>
        <p className="text-muted text-[13px]">An admin needs to create a project and add you to it.</p>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 7: `packages/client/src/router.tsx`** — generated by TanStack Router

```tsx
import { createRouter } from '@tanstack/react-router';
import { Route as RootRoute } from './routes/__root';
import { Route as LoginRoute } from './routes/login';
import { Route as AuthLayoutRoute } from './routes/_auth';
import { Route as AuthIndexRoute } from './routes/_auth.index';

const tree = RootRoute.addChildren([
  LoginRoute,
  AuthLayoutRoute.addChildren([AuthIndexRoute]),
]);

export const router = createRouter({ routeTree: tree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 8: Replace `packages/client/src/app.tsx`**

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { AuthProvider } from './lib/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 9: Smoke test**

Run server in one terminal:
```bash
bun run --filter='@app/server' dev
```
Client in another:
```bash
bun run --filter='@app/client' dev
```
Open `http://localhost:5173`. Expect redirect to `/login`. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Expect landing page with "No projects yet".

- [ ] **Step 10: Commit**

```bash
git add packages/client/src/router.tsx packages/client/src/routes packages/client/src/components/ui packages/client/src/app.tsx
git commit -m "feat(client): router + login + auth gate"
```

---

### Task 33: TopBar with project switcher + user menu

**Files:**
- Create: `packages/client/src/components/project/ProjectSwitcher.tsx`
- Create: `packages/client/src/components/AppTopBar.tsx`

- [ ] **Step 1: `packages/client/src/components/project/ProjectSwitcher.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { api } from '../../lib/api';
import type { Project } from '@app/shared';

export function ProjectSwitcher() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  });
  const params = useParams({ strict: false }) as { id?: string };
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const current = projects?.find((p) => p.id === params.id);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2.5 text-[13px] flex items-center gap-1.5 border border-rule rounded bg-paper hover:bg-mist"
      >
        <span className="truncate max-w-[180px]">{current?.name ?? 'Select project'}</span>
        <span className="text-muted text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[240px] border border-rule rounded bg-paper shadow-lg py-1 max-h-[300px] overflow-y-auto">
          {(projects ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => { setOpen(false); nav({ to: '/projects/$id', params: { id: p.id } }); }}
              className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-mist ${p.id === params.id ? 'bg-mist' : ''}`}
            >
              {p.name}
            </button>
          ))}
          {!projects?.length && <div className="px-3 py-2 text-[12px] text-muted">No projects</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `packages/client/src/components/AppTopBar.tsx`**

```tsx
import { Link } from '@tanstack/react-router';
import { useAuth } from '../lib/auth';
import { ProjectSwitcher } from './project/ProjectSwitcher';

export function AppTopBar() {
  const { user, logout } = useAuth();
  return (
    <header className="h-12 border-b border-rule bg-paper flex items-center px-4 gap-4">
      <Link to="/" className="font-semibold text-[14px]">Gantt</Link>
      <ProjectSwitcher />
      <div className="ml-auto flex items-center gap-3">
        {user?.role === 'admin' && (
          <Link to="/settings/users" className="text-[12px] text-muted hover:text-ink">Users</Link>
        )}
        <span className="text-[12px] text-muted">{user?.email}</span>
        <button onClick={logout} className="text-[12px] text-muted hover:text-ink">Sign out</button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/project packages/client/src/components/AppTopBar.tsx
git commit -m "feat(client): top bar with project switcher"
```

---

### Task 34: Project page skeleton

**Files:**
- Create: `packages/client/src/routes/_auth.projects.$id.tsx`
- Modify: `packages/client/src/router.tsx`

- [ ] **Step 1: `packages/client/src/routes/_auth.projects.$id.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectWithMembers } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';

export const Route = createFileRoute('/_auth/projects/$id')({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${id}`),
  });

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">{project?.name ?? '…'}</h1>
        <span className="text-[11px] text-muted">
          {project ? `${project.members.length} member${project.members.length === 1 ? '' : 's'}` : ''}
        </span>
        {/* +Task button, ZoomToggle, Today button arrive in Phase 7 */}
      </div>
      <main className="flex-1 overflow-hidden">
        {isLoading
          ? <div className="p-8 text-muted">Loading…</div>
          : <div className="p-8 text-muted">Gantt chart lands in Phase 7.</div>}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Update `packages/client/src/router.tsx`**

```tsx
import { createRouter } from '@tanstack/react-router';
import { Route as RootRoute } from './routes/__root';
import { Route as LoginRoute } from './routes/login';
import { Route as AuthLayoutRoute } from './routes/_auth';
import { Route as AuthIndexRoute } from './routes/_auth.index';
import { Route as ProjectRoute } from './routes/_auth.projects.$id';

const tree = RootRoute.addChildren([
  LoginRoute,
  AuthLayoutRoute.addChildren([AuthIndexRoute, ProjectRoute]),
]);

export const router = createRouter({ routeTree: tree });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
```

- [ ] **Step 3: Smoke test**

Restart both dev servers. Login → land on Landing → if no projects, manually `curl -X POST` a project as admin (or use Phase 9's UI later). For now, insert directly:

```bash
docker compose exec postgres psql -U gantt -d gantt -c "
INSERT INTO projects (name, created_by)
  SELECT 'Test', id FROM users WHERE role='admin' LIMIT 1;
INSERT INTO project_members (project_id, user_id)
  SELECT (SELECT id FROM projects LIMIT 1), (SELECT id FROM users WHERE role='admin' LIMIT 1);
"
```

Refresh the browser → expect to land on the project page with the top bar + project name.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/routes/_auth.projects.$id.tsx packages/client/src/router.tsx
git commit -m "feat(client): project page skeleton"
```

---

## Phase 7 — Gantt chart (Tasks 35–43)

### Task 35: Date utilities

**Files:**
- Create: `packages/client/src/lib/date.ts`
- Test: `packages/client/src/lib/date.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { EPOCH, daysSinceEpoch, addDays, parseDate, formatDate, daysBetween, computeInitialRange } from './date';

describe('date math', () => {
  it('EPOCH is 2020-01-01', () => {
    expect(EPOCH).toBe('2020-01-01');
  });

  it('daysSinceEpoch is 0 at epoch', () => {
    expect(daysSinceEpoch('2020-01-01')).toBe(0);
  });

  it('daysSinceEpoch advances correctly', () => {
    expect(daysSinceEpoch('2020-01-02')).toBe(1);
    expect(daysSinceEpoch('2021-01-01')).toBe(366); // 2020 is a leap year
  });

  it('addDays adds days', () => {
    expect(addDays('2026-05-20', 5)).toBe('2026-05-25');
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
  });

  it('daysBetween counts inclusive-exclusive', () => {
    expect(daysBetween('2026-05-20', '2026-05-22')).toBe(2);
  });

  it('parseDate round-trips formatDate', () => {
    expect(formatDate(parseDate('2026-05-20'))).toBe('2026-05-20');
  });

  it('computeInitialRange falls back when no tasks', () => {
    const r = computeInitialRange([], '2026-05-20');
    expect(daysSinceEpoch(r.end) - daysSinceEpoch(r.start)).toBe(120);
  });

  it('computeInitialRange covers tasks with buffer', () => {
    const r = computeInitialRange(
      [{ startDate: '2026-04-01', endDate: '2026-06-30' }],
      '2026-05-20',
    );
    expect(r.start <= '2026-04-01').toBe(true);
    expect(r.end >= '2026-06-30').toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
bun run --filter='@app/client' test src/lib/date.test.ts
```

- [ ] **Step 3: Implement `packages/client/src/lib/date.ts`**

```ts
export const EPOCH = '2020-01-01';
const MS_PER_DAY = 86_400_000;

export function parseDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function daysSinceEpoch(yyyymmdd: string): number {
  return Math.round((parseDate(yyyymmdd).getTime() - parseDate(EPOCH).getTime()) / MS_PER_DAY);
}

export function addDays(yyyymmdd: string, n: number): string {
  return formatDate(new Date(parseDate(yyyymmdd).getTime() + n * MS_PER_DAY));
}

export function daysBetween(a: string, b: string): number {
  return daysSinceEpoch(b) - daysSinceEpoch(a);
}

export function today(): string {
  return formatDate(new Date());
}

export type DateRange = { start: string; end: string };

export function computeInitialRange(
  tasks: { startDate: string; endDate: string }[],
  todayDate: string = today(),
): DateRange {
  if (tasks.length === 0) {
    return { start: addDays(todayDate, -30), end: addDays(todayDate, 90) };
  }
  let earliest = tasks[0]!.startDate;
  let latest = tasks[0]!.endDate;
  for (const t of tasks) {
    if (t.startDate < earliest) earliest = t.startDate;
    if (t.endDate > latest) latest = t.endDate;
  }
  const start = addDays(earliest < todayDate ? earliest : todayDate, -30);
  const end = addDays(latest > todayDate ? latest : todayDate, 90);
  return { start, end };
}

export function expandRangeIfNearEdge(
  range: DateRange,
  visibleStart: string,
  visibleEnd: string,
  thresholdDays = 30,
  extendDays = 90,
): DateRange {
  let { start, end } = range;
  if (daysBetween(start, visibleStart) < thresholdDays) start = addDays(start, -extendDays);
  if (daysBetween(visibleEnd, end) < thresholdDays) end = addDays(end, extendDays);
  return { start, end };
}

export type Zoom = 'day' | 'week' | 'month';

export function dayWidthFor(zoom: Zoom): number {
  return zoom === 'day' ? 40 : zoom === 'week' ? 8 : 3;
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/lib/date.ts packages/client/src/lib/date.test.ts
git commit -m "feat(client): date math + range expansion utilities"
```

---

### Task 36: Gantt layout shell — LeftColumn + Scroller

**Files:**
- Create: `packages/client/src/components/gantt/GanttLayout.tsx`
- Create: `packages/client/src/components/gantt/types.ts`

- [ ] **Step 1: `packages/client/src/components/gantt/types.ts`**

```ts
import type { Task, Dependency, User } from '@app/shared';
import type { DateRange, Zoom } from '../../lib/date';

export type GanttData = { tasks: Task[]; dependencies: Dependency[] };

export type GanttViewState = {
  zoom: Zoom;
  range: DateRange;
  rowHeight: number;
  leftColumnWidth: number;
  members: User[];
};

export const ROW_HEIGHT = 36;
export const LEFT_COLUMN_WIDTH = 260;
```

- [ ] **Step 2: `packages/client/src/components/gantt/GanttLayout.tsx`**

```tsx
import type { ReactNode } from 'react';
import { LEFT_COLUMN_WIDTH } from './types';

export function GanttLayout({
  left, header, body,
  contentWidth,
  scrollerRef,
}: {
  left: ReactNode;
  header: ReactNode;
  body: ReactNode;
  contentWidth: number;
  scrollerRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="h-full flex border-t border-rule">
      <div className="flex-shrink-0 border-r border-rule bg-paper overflow-y-auto"
           style={{ width: LEFT_COLUMN_WIDTH }}>
        {left}
      </div>
      <div ref={scrollerRef} className="flex-1 overflow-auto relative">
        <div style={{ width: contentWidth }} className="relative">
          <div className="sticky top-0 z-10 bg-paper border-b border-rule">
            {header}
          </div>
          {body}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/gantt/GanttLayout.tsx packages/client/src/components/gantt/types.ts
git commit -m "feat(client): Gantt layout shell"
```

---

### Task 37: Date header

**Files:**
- Create: `packages/client/src/components/gantt/DateHeader.tsx`

- [ ] **Step 1: Write `packages/client/src/components/gantt/DateHeader.tsx`**

```tsx
import { addDays, daysBetween, daysSinceEpoch, parseDate, type DateRange, type Zoom } from '../../lib/date';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function DateHeader({ range, dayWidth, zoom }: { range: DateRange; dayWidth: number; zoom: Zoom }) {
  const totalDays = daysBetween(range.start, range.end);
  const dayCells: { iso: string; dow: number; day: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(range.start, i);
    const d = parseDate(iso);
    dayCells.push({ iso, dow: d.getUTCDay(), day: d.getUTCDate() });
  }

  // Build month bands: groups of consecutive days sharing year+month
  const months: { label: string; left: number; width: number }[] = [];
  let i = 0;
  while (i < dayCells.length) {
    const start = dayCells[i]!;
    const d = parseDate(start.iso);
    const ym = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    let j = i;
    while (j < dayCells.length) {
      const d2 = parseDate(dayCells[j]!.iso);
      if (`${d2.getUTCFullYear()}-${d2.getUTCMonth()}` !== ym) break;
      j++;
    }
    months.push({
      label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      left: i * dayWidth,
      width: (j - i) * dayWidth,
    });
    i = j;
  }

  return (
    <div className="select-none">
      <div className="relative h-6 border-b border-rule">
        {months.map((m) => (
          <div
            key={m.left}
            style={{ left: m.left, width: m.width }}
            className="absolute top-0 h-6 text-[11px] text-muted flex items-center pl-2 border-r border-rule"
          >
            {m.label}
          </div>
        ))}
      </div>
      <div className="relative h-6">
        {dayCells.map((c, idx) => {
          const showLabel = zoom === 'day' || (zoom === 'week' && c.dow === 1) || (zoom === 'month' && c.day === 1);
          return (
            <div
              key={c.iso}
              style={{ left: idx * dayWidth, width: dayWidth }}
              className={`absolute top-0 h-6 text-[10px] text-muted flex items-center justify-center ${
                c.dow === 0 || c.dow === 6 ? 'bg-mist/50' : ''
              }`}
            >
              {showLabel ? c.day : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/gantt/DateHeader.tsx
git commit -m "feat(client): DateHeader with month + day bands"
```

---

### Task 38: Grid + today line

**Files:**
- Create: `packages/client/src/components/gantt/GridLayer.tsx`
- Create: `packages/client/src/components/gantt/TodayLine.tsx`

- [ ] **Step 1: `packages/client/src/components/gantt/GridLayer.tsx`**

```tsx
import { addDays, daysBetween, parseDate, type DateRange, type Zoom } from '../../lib/date';

export function GridLayer({ range, dayWidth, zoom, height }: { range: DateRange; dayWidth: number; zoom: Zoom; height: number }) {
  const totalDays = daysBetween(range.start, range.end);
  const lines: { left: number; strong: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(range.start, i);
    const d = parseDate(iso);
    let strong = false;
    if (zoom === 'day') strong = d.getUTCDay() === 1; // Mondays
    else if (zoom === 'week') strong = d.getUTCDate() === 1; // month starts
    else strong = d.getUTCDate() === 1 && d.getUTCMonth() === 0; // year starts
    lines.push({ left: i * dayWidth, strong });
  }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{ left: l.left, height }}
          className={`absolute top-0 w-px ${l.strong ? 'bg-rule' : 'bg-rule/30'}`}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `packages/client/src/components/gantt/TodayLine.tsx`**

```tsx
import { daysBetween, today, type DateRange } from '../../lib/date';

export function TodayLine({ range, dayWidth, height }: { range: DateRange; dayWidth: number; height: number }) {
  const todayIso = today();
  if (todayIso < range.start || todayIso > range.end) return null;
  const left = daysBetween(range.start, todayIso) * dayWidth + dayWidth / 2;
  return (
    <div
      className="absolute top-0 w-px bg-focus/60 pointer-events-none"
      style={{ left, height }}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/gantt/GridLayer.tsx packages/client/src/components/gantt/TodayLine.tsx
git commit -m "feat(client): grid + today line"
```

---

### Task 39: GanttBar with status encoding

**Files:**
- Create: `packages/client/src/components/gantt/GanttBar.tsx`

- [ ] **Step 1: Write `packages/client/src/components/gantt/GanttBar.tsx`**

```tsx
import type { Task, User } from '@app/shared';
import { daysBetween } from '../../lib/date';

const STATUS_BAR: Record<Task['status'], string> = {
  todo:        'bg-paper border border-ink text-ink',
  in_progress: 'bg-ink text-paper border border-ink',
  done:        'bg-mist text-muted border border-rule line-through',
};

const HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0 4px, rgba(0,0,0,0) 4px 8px)',
};

export function GanttBar({
  task, rangeStart, dayWidth, top, height, pic, selected, onSelect, onPointerDown,
}: {
  task: Task;
  rangeStart: string;
  dayWidth: number;
  top: number;
  height: number;
  pic?: User;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const left = daysBetween(rangeStart, task.startDate) * dayWidth;
  const width = (daysBetween(task.startDate, task.endDate) + 1) * dayWidth;
  const inset = 2;
  const barHeight = height - inset * 2;
  const initials = pic ? pic.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() : '';

  return (
    <div
      data-task-id={task.id}
      onPointerDown={onPointerDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{ left, top: top + inset, width: Math.max(width, 8), height: barHeight }}
      className={`absolute rounded text-[11px] flex items-center px-2 gap-1.5 cursor-grab active:cursor-grabbing ${STATUS_BAR[task.status]} ${selected ? 'ring-2 ring-focus/60 ring-offset-1' : ''}`}
    >
      {/* hatched overlay for done */}
      {task.status === 'done' && (
        <span className="absolute inset-0 pointer-events-none rounded" style={HATCH_STYLE} />
      )}
      {/* resize handles */}
      <span data-handle="start" className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize" />
      <span data-handle="end"   className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize" />
      {/* PIC initials */}
      {initials && width > 60 && (
        <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-paper text-ink border border-rule text-[9px] font-semibold flex-shrink-0">
          {initials}
        </span>
      )}
      <span className="truncate">{task.title}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/gantt/GanttBar.tsx
git commit -m "feat(client): GanttBar with status fill patterns"
```

---

### Task 40: Wire it all into GanttChart + project page

**Files:**
- Create: `packages/client/src/components/gantt/GanttChart.tsx`
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: Write `packages/client/src/components/gantt/GanttChart.tsx`**

```tsx
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { Task, Dependency, User } from '@app/shared';
import {
  computeInitialRange, daysBetween, dayWidthFor, type DateRange, type Zoom,
} from '../../lib/date';
import { ROW_HEIGHT } from './types';
import { GanttLayout } from './GanttLayout';
import { DateHeader } from './DateHeader';
import { GridLayer } from './GridLayer';
import { TodayLine } from './TodayLine';
import { GanttBar } from './GanttBar';

export function GanttChart({
  tasks, dependencies, members, zoom,
}: {
  tasks: Task[]; dependencies: Dependency[]; members: User[]; zoom: Zoom;
}) {
  const nav = useNavigate();
  const search = useSearch({ strict: false }) as { task?: string };
  const selectedId = search.task;

  const [range, setRange] = useState<DateRange>(() => computeInitialRange(tasks));
  const dayWidth = dayWidthFor(zoom);
  const totalDays = daysBetween(range.start, range.end);
  const contentWidth = totalDays * dayWidth;
  const scrollerRef = useRef<HTMLDivElement>(null);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) =>
    a.sortOrder - b.sortOrder || a.startDate.localeCompare(b.startDate),
  ), [tasks]);
  const bodyHeight = sortedTasks.length * ROW_HEIGHT;

  const left = (
    <>
      <div className="h-12 border-b border-rule px-3 flex items-center text-[11px] text-muted uppercase tracking-wider">
        Task / PIC
      </div>
      {sortedTasks.map((t, i) => {
        const pic = members.find((m) => m.id === t.picUserId);
        return (
          <div
            key={t.id}
            className={`h-9 px-3 border-b border-rule flex items-center gap-2 cursor-pointer hover:bg-mist ${
              selectedId === t.id ? 'bg-mist' : ''
            }`}
            onClick={() => nav({ to: '.', search: { task: t.id }, replace: true })}
          >
            <span className="text-[13px] truncate flex-1">{t.title}</span>
            {pic && (
              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-paper text-ink border border-rule text-[9px] font-semibold">
                {pic.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
    </>
  );

  const header = <DateHeader range={range} dayWidth={dayWidth} zoom={zoom} />;

  const body = (
    <div className="relative" style={{ height: bodyHeight }}>
      <GridLayer range={range} dayWidth={dayWidth} zoom={zoom} height={bodyHeight} />
      <TodayLine range={range} dayWidth={dayWidth} height={bodyHeight} />
      {sortedTasks.map((t, i) => {
        const pic = members.find((m) => m.id === t.picUserId);
        return (
          <GanttBar
            key={t.id}
            task={t}
            rangeStart={range.start}
            dayWidth={dayWidth}
            top={i * ROW_HEIGHT}
            height={ROW_HEIGHT}
            pic={pic}
            selected={selectedId === t.id}
            onSelect={() => nav({ to: '.', search: { task: t.id }, replace: true })}
            onPointerDown={() => { /* drag wired in Task 42 */ }}
          />
        );
      })}
    </div>
  );

  return (
    <GanttLayout
      left={left}
      header={header}
      body={body}
      contentWidth={contentWidth}
      scrollerRef={scrollerRef}
    />
  );
}
```

- [ ] **Step 2: Update the project page**

Replace the body of `packages/client/src/routes/_auth.projects.$id.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import type { ProjectWithMembers, Task, Dependency } from '@app/shared';
import { AppTopBar } from '../components/AppTopBar';
import { GanttChart } from '../components/gantt/GanttChart';
import type { Zoom } from '../lib/date';

type Search = { task?: string };

export const Route = createFileRoute('/_auth/projects/$id')({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s.task === 'string' ? { task: s.task } : {},
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const [zoom, setZoom] = useState<Zoom>('week');

  const projectQ = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${id}`),
  });
  const tasksQ = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => api.get<{ tasks: Task[]; dependencies: Dependency[] }>(`/projects/${id}/tasks`),
  });

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">{projectQ.data?.name ?? '…'}</h1>
        <span className="text-[11px] text-muted">
          {projectQ.data ? `${projectQ.data.members.length} member${projectQ.data.members.length === 1 ? '' : 's'}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex border border-rule rounded overflow-hidden">
            {(['day','week','month'] as Zoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`h-7 px-2.5 text-[11px] capitalize ${zoom === z ? 'bg-ink text-paper' : 'bg-paper hover:bg-mist'}`}
              >{z}</button>
            ))}
          </div>
        </div>
      </div>
      <main className="flex-1 overflow-hidden">
        {tasksQ.data && projectQ.data ? (
          <GanttChart
            tasks={tasksQ.data.tasks}
            dependencies={tasksQ.data.dependencies}
            members={projectQ.data.members}
            zoom={zoom}
          />
        ) : (
          <div className="p-8 text-muted">Loading…</div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Smoke test**

Add a couple of tasks via SQL:
```bash
docker compose exec postgres psql -U gantt -d gantt -c "
INSERT INTO tasks (project_id, title, start_date, end_date, status, sort_order)
  SELECT id, 'Design', '2026-05-20', '2026-05-25', 'in_progress', 0 FROM projects LIMIT 1;
INSERT INTO tasks (project_id, title, start_date, end_date, status, sort_order)
  SELECT id, 'Build',  '2026-05-23', '2026-06-05', 'todo', 1 FROM projects LIMIT 1;
INSERT INTO tasks (project_id, title, start_date, end_date, status, sort_order)
  SELECT id, 'Launch', '2026-06-04', '2026-06-06', 'done', 2 FROM projects LIMIT 1;
"
```

Reload the project page. Expected: three bars on the chart, status colors applied, today line visible.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/gantt/GanttChart.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): GanttChart wired into project page with zoom toggle"
```

---

### Task 41: ArrowsLayer (dependency rendering)

**Files:**
- Create: `packages/client/src/components/gantt/ArrowsLayer.tsx`
- Modify: `packages/client/src/components/gantt/GanttChart.tsx`

- [ ] **Step 1: `packages/client/src/components/gantt/ArrowsLayer.tsx`**

```tsx
import type { Task, Dependency } from '@app/shared';
import { daysBetween } from '../../lib/date';

export function ArrowsLayer({
  tasks, dependencies, rangeStart, dayWidth, rowHeight, width, height,
}: {
  tasks: Task[];
  dependencies: Dependency[];
  rangeStart: string;
  dayWidth: number;
  rowHeight: number;
  width: number;
  height: number;
}) {
  const index = new Map(tasks.map((t, i) => [t.id, { task: t, row: i }]));

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width} height={height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#111" />
        </marker>
        <marker id="arrow-warn" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#b45309" />
        </marker>
      </defs>
      {dependencies.map((d) => {
        const p = index.get(d.predecessorId);
        const s = index.get(d.successorId);
        if (!p || !s) return null;
        const conflict = p.task.endDate > s.task.startDate;
        const x1 = (daysBetween(rangeStart, p.task.endDate) + 1) * dayWidth;
        const y1 = p.row * rowHeight + rowHeight / 2;
        const x2 = daysBetween(rangeStart, s.task.startDate) * dayWidth;
        const y2 = s.row * rowHeight + rowHeight / 2;
        const dropX = Math.max(x1 + 8, x2 - 8);
        const path = `M ${x1},${y1} H ${dropX} V ${y2} H ${x2}`;
        const stroke = conflict ? '#b45309' : '#111';
        return (
          <g key={`${d.predecessorId}-${d.successorId}`}>
            <path d={path} fill="none" stroke={stroke} strokeWidth={1} markerEnd={`url(#${conflict ? 'arrow-warn' : 'arrow'})`} />
            {conflict && (
              <text x={x2 - 14} y={y2 - 6} fontSize={10} fill="#b45309">!</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Insert into `GanttChart.tsx`**

In the `body` JSX of `GanttChart.tsx`, after `<TodayLine ... />` and before the bars map, add:

```tsx
<ArrowsLayer
  tasks={sortedTasks}
  dependencies={dependencies}
  rangeStart={range.start}
  dayWidth={dayWidth}
  rowHeight={ROW_HEIGHT}
  width={contentWidth}
  height={bodyHeight}
/>
```

And add the import at the top:
```ts
import { ArrowsLayer } from './ArrowsLayer';
```

- [ ] **Step 3: Smoke test**

Add a dependency via SQL:
```bash
docker compose exec postgres psql -U gantt -d gantt -c "
INSERT INTO task_dependencies (predecessor_id, successor_id)
  SELECT (SELECT id FROM tasks WHERE title='Design'),
         (SELECT id FROM tasks WHERE title='Build');
INSERT INTO task_dependencies (predecessor_id, successor_id)
  SELECT (SELECT id FROM tasks WHERE title='Build'),
         (SELECT id FROM tasks WHERE title='Launch');
"
```
Reload. Expected: arrows from Design → Build and Build → Launch.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/gantt/ArrowsLayer.tsx packages/client/src/components/gantt/GanttChart.tsx
git commit -m "feat(client): SVG dependency arrows with conflict indicator"
```

---

### Task 42: Bar drag — move + resize

**Files:**
- Create: `packages/client/src/components/gantt/useBarDrag.ts`
- Test: `packages/client/src/components/gantt/useBarDrag.test.ts`
- Modify: `packages/client/src/components/gantt/GanttChart.tsx`

- [ ] **Step 1: Write failing test (pure math helper inside the hook)**

```ts
import { describe, it, expect } from 'vitest';
import { computeDragDelta, applyDrag } from './useBarDrag';

describe('drag math', () => {
  it('snaps to whole days', () => {
    expect(computeDragDelta(0, 41, 40)).toBe(1);
    expect(computeDragDelta(0, 19, 40)).toBe(0);
    expect(computeDragDelta(0, 80, 40)).toBe(2);
    expect(computeDragDelta(0, -41, 40)).toBe(-1);
  });

  it('move shifts both dates equally', () => {
    expect(applyDrag('2026-05-20', '2026-05-22', 3, 'move'))
      .toEqual({ startDate: '2026-05-23', endDate: '2026-05-25' });
  });

  it('resizeStart changes start only and clamps to end', () => {
    expect(applyDrag('2026-05-20', '2026-05-25', 3, 'resizeStart'))
      .toEqual({ startDate: '2026-05-23', endDate: '2026-05-25' });
    expect(applyDrag('2026-05-20', '2026-05-22', 5, 'resizeStart'))
      .toEqual({ startDate: '2026-05-22', endDate: '2026-05-22' });
  });

  it('resizeEnd changes end only and clamps to start', () => {
    expect(applyDrag('2026-05-20', '2026-05-25', -3, 'resizeEnd'))
      .toEqual({ startDate: '2026-05-20', endDate: '2026-05-22' });
    expect(applyDrag('2026-05-20', '2026-05-22', -5, 'resizeEnd'))
      .toEqual({ startDate: '2026-05-20', endDate: '2026-05-20' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `packages/client/src/components/gantt/useBarDrag.ts`**

```ts
import { useRef } from 'react';
import { addDays, daysSinceEpoch } from '../../lib/date';

export type DragMode = 'move' | 'resizeStart' | 'resizeEnd';

export function computeDragDelta(startX: number, currentX: number, dayWidth: number): number {
  return Math.round((currentX - startX) / dayWidth);
}

export function applyDrag(
  startDate: string,
  endDate: string,
  deltaDays: number,
  mode: DragMode,
): { startDate: string; endDate: string } {
  if (mode === 'move') {
    return { startDate: addDays(startDate, deltaDays), endDate: addDays(endDate, deltaDays) };
  }
  if (mode === 'resizeStart') {
    const proposed = addDays(startDate, deltaDays);
    return {
      startDate: daysSinceEpoch(proposed) > daysSinceEpoch(endDate) ? endDate : proposed,
      endDate,
    };
  }
  // resizeEnd
  const proposed = addDays(endDate, deltaDays);
  return {
    startDate,
    endDate: daysSinceEpoch(proposed) < daysSinceEpoch(startDate) ? startDate : proposed,
  };
}

export function useBarDrag(opts: {
  dayWidth: number;
  onCommit: (startDate: string, endDate: string) => void;
}) {
  const state = useRef<{
    mode: DragMode;
    startX: number;
    initial: { startDate: string; endDate: string };
    el: HTMLDivElement;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, initial: { startDate: string; endDate: string }) {
    const target = e.target as HTMLElement;
    const handle = target.getAttribute('data-handle');
    const mode: DragMode = handle === 'start' ? 'resizeStart' : handle === 'end' ? 'resizeEnd' : 'move';
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    state.current = { mode, startX: e.clientX, initial, el };
    el.style.willChange = 'transform';
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!state.current) return;
    const { mode, startX, initial, el } = state.current;
    const delta = computeDragDelta(startX, e.clientX, opts.dayWidth);
    if (mode === 'move') {
      el.style.transform = `translateX(${delta * opts.dayWidth}px)`;
    } else if (mode === 'resizeStart') {
      el.style.transform = `translateX(${delta * opts.dayWidth}px)`;
      el.style.width = `${parseFloat(el.dataset.baseWidth ?? `${el.clientWidth}`) - delta * opts.dayWidth}px`;
    } else {
      el.style.width = `${parseFloat(el.dataset.baseWidth ?? `${el.clientWidth}`) + delta * opts.dayWidth}px`;
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!state.current) return;
    const { mode, startX, initial, el } = state.current;
    el.style.transform = '';
    el.style.width = '';
    el.style.willChange = '';
    state.current = null;
    const delta = computeDragDelta(startX, e.clientX, opts.dayWidth);
    if (delta === 0) return;
    const next = applyDrag(initial.startDate, initial.endDate, delta, mode);
    opts.onCommit(next.startDate, next.endDate);
  }

  return { onPointerDown, onPointerMove, onPointerUp };
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Wire into `GanttChart.tsx`**

In `GanttChart.tsx`, add at the top of the component:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useBarDrag } from './useBarDrag';
```

Inside the component (above the `return`):

```tsx
const qc = useQueryClient();
const projectIdRef = useRef<string | null>(null);
projectIdRef.current = tasks[0]?.projectId ?? null;

const updateTask = useMutation({
  mutationFn: (v: { id: string; startDate: string; endDate: string }) =>
    api.patch(`/tasks/${v.id}`, { startDate: v.startDate, endDate: v.endDate }),
  onMutate: async (v) => {
    if (!projectIdRef.current) return;
    await qc.cancelQueries({ queryKey: ['tasks', projectIdRef.current] });
    const prev = qc.getQueryData<{ tasks: Task[]; dependencies: Dependency[] }>(['tasks', projectIdRef.current]);
    if (prev) {
      qc.setQueryData(['tasks', projectIdRef.current], {
        ...prev,
        tasks: prev.tasks.map((t) => t.id === v.id ? { ...t, startDate: v.startDate, endDate: v.endDate } : t),
      });
    }
    return { prev };
  },
  onError: (_e, _v, ctx: any) => {
    if (ctx?.prev && projectIdRef.current) qc.setQueryData(['tasks', projectIdRef.current], ctx.prev);
  },
  onSettled: () => {
    if (projectIdRef.current) qc.invalidateQueries({ queryKey: ['tasks', projectIdRef.current] });
  },
});

const drag = useBarDrag({
  dayWidth,
  onCommit: () => {/* set per-bar in onPointerDown */},
});
```

Then replace the `sortedTasks.map(...)` block in the body with the `BarWithDrag` wrapper:

```tsx
{sortedTasks.map((t, i) => {
  const pic = members.find((m) => m.id === t.picUserId);
  return (
    <BarWithDrag
      key={t.id}
      task={t}
      pic={pic}
      rangeStart={range.start}
      dayWidth={dayWidth}
      top={i * ROW_HEIGHT}
      height={ROW_HEIGHT}
      selected={selectedId === t.id}
      onSelect={() => nav({ to: '.', search: { task: t.id }, replace: true })}
      onCommit={(start, end) => updateTask.mutate({ id: t.id, startDate: start, endDate: end })}
    />
  );
})}
```

And add `BarWithDrag` to the same file:

```tsx
function BarWithDrag(props: {
  task: Task; pic?: User; rangeStart: string; dayWidth: number; top: number; height: number;
  selected: boolean; onSelect: () => void; onCommit: (s: string, e: string) => void;
}) {
  const drag = useBarDrag({
    dayWidth: props.dayWidth,
    onCommit: props.onCommit,
  });
  return (
    <GanttBar
      task={props.task}
      pic={props.pic}
      rangeStart={props.rangeStart}
      dayWidth={props.dayWidth}
      top={props.top}
      height={props.height}
      selected={props.selected}
      onSelect={props.onSelect}
      onPointerDown={(e) => {
        const initial = { startDate: props.task.startDate, endDate: props.task.endDate };
        drag.onPointerDown(e, initial);
        const el = e.currentTarget;
        el.addEventListener('pointermove', drag.onPointerMove as any);
        el.addEventListener('pointerup', (ev) => {
          drag.onPointerUp(ev as any);
          el.removeEventListener('pointermove', drag.onPointerMove as any);
        }, { once: true });
      }}
    />
  );
}
```

- [ ] **Step 6: Smoke test**

Drag a bar — expect it to move; on release the PATCH fires and the bar settles at the new date. Drag the left or right 6px edge to resize.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/components/gantt/useBarDrag.ts packages/client/src/components/gantt/useBarDrag.test.ts packages/client/src/components/gantt/GanttChart.tsx
git commit -m "feat(client): bar drag-to-move + resize edges with optimistic update"
```

---

### Task 43: Dynamic range expansion + "Today" button

**Files:**
- Modify: `packages/client/src/components/gantt/GanttChart.tsx`
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: Add range expansion + scroll handler in `GanttChart.tsx`**

Inside the component, replace the `useState` for range with:

```tsx
const [range, setRange] = useState<DateRange>(() => computeInitialRange(tasks));

useEffect(() => {
  const el = scrollerRef.current;
  if (!el) return;
  const onScroll = () => {
    const visibleStart = addDays(range.start, Math.floor(el.scrollLeft / dayWidth));
    const visibleEnd = addDays(range.start, Math.ceil((el.scrollLeft + el.clientWidth) / dayWidth));
    const next = expandRangeIfNearEdge(range, visibleStart, visibleEnd);
    if (next.start !== range.start || next.end !== range.end) {
      // preserve scroll position when extending the left edge
      const leftExtendDays = daysBetween(next.start, range.start);
      setRange(next);
      if (leftExtendDays > 0) {
        requestAnimationFrame(() => {
          el.scrollLeft += leftExtendDays * dayWidth;
        });
      }
    }
  };
  el.addEventListener('scroll', onScroll, { passive: true });
  return () => el.removeEventListener('scroll', onScroll);
}, [range, dayWidth]);
```

Add imports:
```ts
import { useEffect } from 'react';
import { addDays, expandRangeIfNearEdge, daysBetween } from '../../lib/date';
```

- [ ] **Step 2: Expose `scrollToToday` via ref handle**

In `GanttChart.tsx`, change the component signature to accept a `controlRef`:

```tsx
export type GanttControl = { scrollToToday: () => void };

export const GanttChart = forwardRef<GanttControl, GanttChartProps>(function GanttChart(props, ref) {
  // ... existing body ...
  useImperativeHandle(ref, () => ({
    scrollToToday: () => {
      const el = scrollerRef.current;
      if (!el) return;
      const todayLeft = daysBetween(range.start, today()) * dayWidth;
      el.scrollLeft = Math.max(0, todayLeft - el.clientWidth / 2);
    },
  }), [range, dayWidth]);
  // ... return JSX ...
});
```

Add imports:
```ts
import { forwardRef, useImperativeHandle } from 'react';
import { today } from '../../lib/date';
```

(`GanttChartProps` = the existing props interface; extract it into a named type.)

- [ ] **Step 3: Wire "Today" button in `_auth.projects.$id.tsx`**

```tsx
import { useRef } from 'react';
import type { GanttControl } from '../components/gantt/GanttChart';

// inside ProjectPage:
const ganttRef = useRef<GanttControl>(null);
```

In the toolbar block, before the zoom toggle:
```tsx
<button
  onClick={() => ganttRef.current?.scrollToToday()}
  className="h-7 px-2.5 text-[11px] border border-rule rounded bg-paper hover:bg-mist"
>Today</button>
```

And pass the ref to the chart:
```tsx
<GanttChart ref={ganttRef} ... />
```

- [ ] **Step 4: Smoke test**

Scroll right far enough — the date header should keep extending forever. Click Today — the chart re-centers on today.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/gantt/GanttChart.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): dynamic range expansion + Today button"
```

---

## Phase 8 — Task detail panel + dependency picker + files (Tasks 44–49)

### Task 44: Side panel shell + URL-driven selection

**Files:**
- Create: `packages/client/src/components/ui/Select.tsx`
- Create: `packages/client/src/components/ui/Textarea.tsx`
- Create: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: `packages/client/src/components/ui/Select.tsx`**

```tsx
import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`h-8 px-2 text-[13px] border border-rule rounded bg-paper text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
```

- [ ] **Step 2: `packages/client/src/components/ui/Textarea.tsx`**

```tsx
import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-[72px] px-2.5 py-1.5 text-[13px] border border-rule rounded bg-paper text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 ${className}`}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
```

- [ ] **Step 3: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`** (shell only — form lands in Task 45)

```tsx
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { Task, TaskFile, Dependency, User } from '@app/shared';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';

type Detail = Task & { files: TaskFile[]; dependencies: Dependency[] };

export function TaskDetailPanel({
  taskId, projectMembers, allTasks,
}: {
  taskId: string;
  projectMembers: User[];
  allTasks: Task[];
}) {
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<Detail>(`/tasks/${taskId}`),
  });

  return (
    <aside
      className="absolute top-0 right-0 bottom-0 w-[46%] min-w-[420px] max-w-[640px] bg-paper border-l border-rule shadow-[-6px_0_16px_rgba(0,0,0,0.05)] flex flex-col z-30"
    >
      <header className="h-12 border-b border-rule flex items-center px-4">
        <h2 className="text-[14px] font-semibold truncate flex-1">{data?.title ?? '…'}</h2>
        <Button
          variant="ghost"
          onClick={() => nav({ to: '.', search: {}, replace: true })}
        >Close</Button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading || !data
          ? <div className="text-muted text-[13px]">Loading…</div>
          : <div className="text-muted text-[13px]">Form, dependencies, files — Tasks 45-47.</div>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Mount in the project page**

In `_auth.projects.$id.tsx`, modify the `<main>` to render the panel when `?task=` is set:

```tsx
import { TaskDetailPanel } from '../components/task-panel/TaskDetailPanel';
// ...
const search = Route.useSearch();
// ...
<main className="flex-1 overflow-hidden relative">
  {tasksQ.data && projectQ.data ? (
    <>
      <GanttChart
        ref={ganttRef}
        tasks={tasksQ.data.tasks}
        dependencies={tasksQ.data.dependencies}
        members={projectQ.data.members}
        zoom={zoom}
      />
      {search.task && (
        <TaskDetailPanel
          key={search.task}
          taskId={search.task}
          projectMembers={projectQ.data.members}
          allTasks={tasksQ.data.tasks}
        />
      )}
    </>
  ) : (
    <div className="p-8 text-muted">Loading…</div>
  )}
</main>
```

- [ ] **Step 5: Smoke test**

Click a Gantt bar → URL gains `?task=<uuid>` → panel slides in from the right with title and "Close" button. Click Close → URL clears.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/ui packages/client/src/components/task-panel/TaskDetailPanel.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): task detail panel shell"
```

---

### Task 45: TaskForm — edit title / description / dates / status / PIC

**Files:**
- Create: `packages/client/src/components/task-panel/TaskForm.tsx`
- Modify: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`

- [ ] **Step 1: Write `packages/client/src/components/task-panel/TaskForm.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, User, TaskStatus, UpdateTaskInput } from '@app/shared';
import { api } from '../../lib/api';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

export function TaskForm({ task, projectMembers, onDeleted }: {
  task: Task;
  projectMembers: User[];
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [picUserId, setPicUserId] = useState<string>(task.picUserId ?? '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStartDate(task.startDate);
    setEndDate(task.endDate);
    setStatus(task.status);
    setPicUserId(task.picUserId ?? '');
  }, [task.id]);

  const save = useMutation({
    mutationFn: (body: UpdateTaskInput) => api.patch<Task>(`/tasks/${task.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
    onError: (e: any) => setErr(e.message ?? 'save failed'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/tasks/${task.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      onDeleted();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        save.mutate({
          title,
          description: description.length === 0 ? null : description,
          startDate,
          endDate,
          status,
          picUserId: picUserId === '' ? null : picUserId,
        });
      }}
      className="flex flex-col gap-3"
    >
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="End">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </Field>
        <Field label="PIC">
          <Select value={picUserId} onChange={(e) => setPicUserId(e.target.value)}>
            <option value="">— none —</option>
            {projectMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (confirm(`Delete "${task.title}"? This cannot be undone.`)) del.mutate();
          }}
          disabled={del.isPending}
        >Delete</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 2: Mount in `TaskDetailPanel.tsx`**

Replace the placeholder body with:

```tsx
import { TaskForm } from './TaskForm';
// ...
<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
  {isLoading || !data ? (
    <div className="text-muted text-[13px]">Loading…</div>
  ) : (
    <TaskForm
      task={data}
      projectMembers={projectMembers}
      onDeleted={() => nav({ to: '.', search: {}, replace: true })}
    />
  )}
</div>
```

- [ ] **Step 3: Smoke test**

Click a bar → edit fields → Save → bar updates. Delete a task → it disappears from the chart.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/task-panel/TaskForm.tsx packages/client/src/components/task-panel/TaskDetailPanel.tsx
git commit -m "feat(client): TaskForm with save + delete"
```

---

### Task 46: DependencyPicker

**Files:**
- Create: `packages/client/src/components/task-panel/DependencyPicker.tsx`
- Modify: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`

- [ ] **Step 1: `packages/client/src/components/task-panel/DependencyPicker.tsx`**

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, Dependency } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useState } from 'react';

export function DependencyPicker({
  task, allTasks, dependencies,
}: {
  task: Task;
  allTasks: Task[];
  dependencies: Dependency[];
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const myPreds = dependencies.filter((d) => d.successorId === task.id);
  const predIds = new Set(myPreds.map((d) => d.predecessorId));
  const candidates = allTasks.filter((t) => t.id !== task.id && !predIds.has(t.id));

  const add = useMutation({
    mutationFn: (predecessorId: string) =>
      api.post(`/tasks/${task.id}/dependencies`, { predecessorId }),
    onSuccess: () => {
      setAdding('');
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  const remove = useMutation({
    mutationFn: (predecessorId: string) =>
      api.delete(`/tasks/${task.id}/dependencies/${predecessorId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', task.projectId] });
    },
  });

  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Depends on</h3>
      {myPreds.length === 0 && <p className="text-[12px] text-muted">— none —</p>}
      <ul className="flex flex-col gap-1">
        {myPreds.map((d) => {
          const p = taskById.get(d.predecessorId);
          if (!p) return null;
          return (
            <li key={d.predecessorId} className="flex items-center gap-2 border border-rule rounded px-2 py-1 text-[13px]">
              <span className="flex-1 truncate">{p.title}</span>
              <span className="text-[11px] text-muted">{p.endDate}</span>
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove.mutate(d.predecessorId)}
              >Remove</Button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Select value={adding} onChange={(e) => { setErr(null); setAdding(e.target.value); }} className="flex-1">
          <option value="">+ add predecessor…</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </Select>
        <Button
          type="button"
          disabled={!adding || add.isPending}
          onClick={() => add.mutate(adding)}
        >Add</Button>
      </div>
      {err && <p className="text-[12px] text-red-600">{err}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Mount in `TaskDetailPanel.tsx`**

Replace the body block (the one inside `flex-1 overflow-y-auto p-4`) with:

```tsx
<div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
  {isLoading || !data ? (
    <div className="text-muted text-[13px]">Loading…</div>
  ) : (
    <>
      <TaskForm
        task={data}
        projectMembers={projectMembers}
        onDeleted={() => nav({ to: '.', search: {}, replace: true })}
      />
      <DependencyPicker
        task={data}
        allTasks={allTasks}
        dependencies={data.dependencies}
      />
    </>
  )}
</div>
```

Add the import:
```ts
import { DependencyPicker } from './DependencyPicker';
```

- [ ] **Step 3: Smoke test**

Open a task → add a predecessor → arrow appears between bars. Remove a predecessor → arrow disappears. Try adding a predecessor that would create a cycle (`A → B → C`, try `C → A`) → server returns 409, error message shown.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/task-panel/DependencyPicker.tsx packages/client/src/components/task-panel/TaskDetailPanel.tsx
git commit -m "feat(client): dependency picker with add/remove"
```

---

### Task 47: FileUploader — presign → PUT → confirm (with progress)

**Files:**
- Create: `packages/client/src/components/task-panel/FileUploader.tsx`
- Modify: `packages/client/src/components/task-panel/TaskDetailPanel.tsx`

- [ ] **Step 1: `packages/client/src/components/task-panel/FileUploader.tsx`**

```tsx
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TaskFile, PresignUploadResult } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Button } from '../ui/Button';

function uploadWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(file);
  });
}

export function FileUploader({ taskId, files, onDeleted }: {
  taskId: string;
  files: TaskFile[];
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setErr(null);
      setProgress(0);
      const presign = await api.post<PresignUploadResult>(`/tasks/${taskId}/files/presign`, {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      await uploadWithProgress(presign.uploadUrl, file, setProgress);
      await api.post(`/tasks/${taskId}/files`, {
        filename: file.name,
        s3Key: presign.s3Key,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
    },
    onSuccess: () => {
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (e) => {
      setProgress(null);
      setErr(e instanceof ApiException ? e.message : 'upload failed');
    },
  });

  const del = useMutation({
    mutationFn: (fileId: string) => api.delete(`/files/${fileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      onDeleted?.();
    },
  });

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11px] uppercase tracking-wider text-muted">Files</h3>
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border border-rule rounded px-2 py-1 text-[13px]">
            <a
              href={`/api/files/${f.id}/download`}
              className="flex-1 truncate hover:underline"
              target="_blank" rel="noreferrer"
            >{f.filename}</a>
            <span className="text-[11px] text-muted">{Math.round(f.sizeBytes / 1024)} KB</span>
            <Button type="button" variant="ghost" onClick={() => del.mutate(f.id)}>Delete</Button>
          </li>
        ))}
        {files.length === 0 && <li className="text-[12px] text-muted">— none —</li>}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? `Uploading… ${progress ?? 0}%` : 'Upload file'}
        </Button>
        {err && <span className="text-[12px] text-red-600">{err}</span>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in `TaskDetailPanel.tsx`**

After the `<DependencyPicker ... />`, add:

```tsx
<FileUploader taskId={data.id} files={data.files} />
```

Import:
```ts
import { FileUploader } from './FileUploader';
```

- [ ] **Step 3: Smoke test**

Open a task → click Upload file → pick a PDF or image → progress shows during PUT → file appears in list with size and download link. Click Delete → file removed. Try uploading a `.exe` → expect "content type not allowed" error.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/task-panel/FileUploader.tsx packages/client/src/components/task-panel/TaskDetailPanel.tsx
git commit -m "feat(client): file upload with presigned PUT + progress"
```

---

### Task 48: "+ Task" button — quick create modal

**Files:**
- Create: `packages/client/src/components/ui/Dialog.tsx`
- Create: `packages/client/src/components/task-panel/NewTaskDialog.tsx`
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: `packages/client/src/components/ui/Dialog.tsx`**

```tsx
import { type ReactNode, useEffect } from 'react';

export function Dialog({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/20" onClick={onClose}>
      <div
        className="bg-paper border border-rule rounded-md shadow-xl w-[420px] max-w-[90vw] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="h-11 border-b border-rule flex items-center px-4">
          <h2 className="text-[14px] font-semibold">{title}</h2>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `packages/client/src/components/task-panel/NewTaskDialog.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, User, TaskStatus } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { today } from '../../lib/date';

export function NewTaskDialog({ open, onClose, projectId, members }: {
  open: boolean; onClose: () => void; projectId: string; members: User[];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [picUserId, setPicUserId] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<Task>(`/projects/${projectId}/tasks`, {
      title, startDate, endDate, status,
      picUserId: picUserId || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setTitle(''); setStartDate(today()); setEndDate(today()); setStatus('todo'); setPicUserId('');
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </Select>
          <Select value={picUserId} onChange={(e) => setPicUserId(e.target.value)}>
            <option value="">PIC — none</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add the "+ Task" button to the project toolbar**

In `_auth.projects.$id.tsx`, inside `ProjectPage`:

```tsx
import { useState } from 'react';
import { NewTaskDialog } from '../components/task-panel/NewTaskDialog';
// ...
const [newOpen, setNewOpen] = useState(false);
```

In the toolbar, just before the `<button onClick={ganttRef...}>Today</button>` button:
```tsx
<Button onClick={() => setNewOpen(true)}>+ Task</Button>
```

And at the bottom of the page (sibling to `<main>`):
```tsx
{projectQ.data && (
  <NewTaskDialog
    open={newOpen}
    onClose={() => setNewOpen(false)}
    projectId={id}
    members={projectQ.data.members}
  />
)}
```

Imports as needed:
```ts
import { Button } from '../components/ui/Button';
```

- [ ] **Step 4: Smoke test**

Click "+ Task" → modal opens → fill title + dates → Create → new bar appears on the Gantt. Escape closes.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ui/Dialog.tsx packages/client/src/components/task-panel/NewTaskDialog.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): new-task dialog"
```

---

### Task 49: Empty-project state

**Files:**
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: Replace the main body conditional with an empty state**

In `_auth.projects.$id.tsx`, change:

```tsx
{tasksQ.data && projectQ.data ? (
  // existing chart + panel
) : (
  <div className="p-8 text-muted">Loading…</div>
)}
```

to:

```tsx
{tasksQ.data && projectQ.data ? (
  tasksQ.data.tasks.length === 0 ? (
    <div className="h-full grid place-items-center">
      <div className="text-center max-w-sm">
        <h3 className="text-[15px] font-semibold mb-1">No tasks yet</h3>
        <p className="text-muted text-[13px] mb-4">Create the first task to start planning.</p>
        <Button onClick={() => setNewOpen(true)}>+ Create first task</Button>
      </div>
    </div>
  ) : (
    <>
      <GanttChart
        ref={ganttRef}
        tasks={tasksQ.data.tasks}
        dependencies={tasksQ.data.dependencies}
        members={projectQ.data.members}
        zoom={zoom}
      />
      {search.task && (
        <TaskDetailPanel
          key={search.task}
          taskId={search.task}
          projectMembers={projectQ.data.members}
          allTasks={tasksQ.data.tasks}
        />
      )}
    </>
  )
) : (
  <div className="p-8 text-muted">Loading…</div>
)}
```

- [ ] **Step 2: Smoke test**

Delete all tasks (or create a new project) → expect centered "No tasks yet" card with a "+ Create first task" button.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): empty-project state"
```

---

## Phase 9 — Members & admin users page (Tasks 50–53)

### Task 50: Projects API — also expose admin-only "create project" UI

**Files:**
- Create: `packages/client/src/components/project/NewProjectDialog.tsx`
- Modify: `packages/client/src/components/project/ProjectSwitcher.tsx`

- [ ] **Step 1: `packages/client/src/components/project/NewProjectDialog.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@app/shared';
import { api, ApiException } from '../../lib/api';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

export function NewProjectDialog({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated?: (p: Project) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<Project>('/projects', {
      name,
      description: description ? description : undefined,
    }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setName(''); setDescription('');
      onClose();
      onCreated?.(p);
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="New project">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add "+ New project" to the switcher (admin only)**

In `ProjectSwitcher.tsx`, add admin-only entry at the bottom of the dropdown. Import auth + the new dialog:

```tsx
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { NewProjectDialog } from './NewProjectDialog';
```

Add state at the top of the component:
```tsx
const { user } = useAuth();
const [newOpen, setNewOpen] = useState(false);
```

Inside the dropdown JSX, after the project list `.map(...)`, add:
```tsx
{user?.role === 'admin' && (
  <button
    onClick={() => { setOpen(false); setNewOpen(true); }}
    className="w-full text-left px-3 py-1.5 text-[13px] text-muted hover:bg-mist border-t border-rule mt-1"
  >+ New project</button>
)}
```

Render the dialog at the end of the returned JSX:
```tsx
<NewProjectDialog
  open={newOpen}
  onClose={() => setNewOpen(false)}
  onCreated={(p) => nav({ to: '/projects/$id', params: { id: p.id } })}
/>
```

- [ ] **Step 3: Smoke test**

As admin: switcher dropdown has "+ New project" — click → modal → create → redirects to new project page.
As member: no "+ New project" entry.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/project/NewProjectDialog.tsx packages/client/src/components/project/ProjectSwitcher.tsx
git commit -m "feat(client): create-project dialog (admin)"
```

---

### Task 51: Members page

**Files:**
- Create: `packages/client/src/routes/_auth.projects.$id.members.tsx`
- Modify: `packages/client/src/router.tsx`
- Modify: `packages/client/src/components/AppTopBar.tsx`

- [ ] **Step 1: `packages/client/src/routes/_auth.projects.$id.members.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectWithMembers, User } from '@app/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/projects/$id/members')({
  component: MembersPage,
});

function MembersPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const projectQ = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectWithMembers>(`/projects/${id}`),
  });
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
    enabled: user?.role === 'admin',
  });

  const add = useMutation({
    mutationFn: (userId: string) => api.post(`/projects/${id}/members`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`/projects/${id}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  const [adding, setAdding] = useState('');
  const memberIds = new Set(projectQ.data?.members.map((m) => m.id) ?? []);
  const candidates = (usersQ.data ?? []).filter((u) => !memberIds.has(u.id));

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">{projectQ.data?.name ?? '…'} · Members</h1>
        <Link to="/projects/$id" params={{ id }} className="text-[12px] text-muted hover:text-ink ml-auto">← Back to Gantt</Link>
      </div>
      <main className="flex-1 overflow-y-auto p-6 max-w-[600px] mx-auto w-full flex flex-col gap-4">
        <ul className="flex flex-col gap-1">
          {(projectQ.data?.members ?? []).map((m) => (
            <li key={m.id} className="flex items-center gap-3 border border-rule rounded px-3 py-2 text-[13px]">
              <span className="flex-1">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted"> · {m.email} · {m.role}</span>
              </span>
              {user?.role === 'admin' && (
                <Button variant="ghost" onClick={() => remove.mutate(m.id)}>Remove</Button>
              )}
            </li>
          ))}
          {projectQ.data?.members.length === 0 && <li className="text-[13px] text-muted">No members yet.</li>}
        </ul>
        {user?.role === 'admin' && (
          <div className="flex gap-2">
            <Select value={adding} onChange={(e) => setAdding(e.target.value)} className="flex-1">
              <option value="">+ add user…</option>
              {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </Select>
            <Button
              disabled={!adding || add.isPending}
              onClick={() => { add.mutate(adding); setAdding(''); }}
            >Add</Button>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Register route in `packages/client/src/router.tsx`**

```tsx
import { Route as MembersRoute } from './routes/_auth.projects.$id.members';

const tree = RootRoute.addChildren([
  LoginRoute,
  AuthLayoutRoute.addChildren([AuthIndexRoute, ProjectRoute, MembersRoute]),
]);
```

- [ ] **Step 3: Add a "Members" link to the toolbar of the project page**

In `_auth.projects.$id.tsx`, inside the toolbar `<div className="h-10 ...">`, change the trailing right-aligned block to include a link before the zoom toggle:

```tsx
<Link
  to="/projects/$id/members"
  params={{ id }}
  className="text-[12px] text-muted hover:text-ink"
>Members</Link>
```

Add import:
```ts
import { Link } from '@tanstack/react-router';
```

- [ ] **Step 4: Smoke test**

Project page → click "Members" → see member list. As admin, add or remove a user. Member: list visible, no add/remove controls.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/routes/_auth.projects.$id.members.tsx packages/client/src/router.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): project members page"
```

---

### Task 52: Admin users page

**Files:**
- Create: `packages/client/src/routes/_auth.settings.users.tsx`
- Modify: `packages/client/src/router.tsx`

- [ ] **Step 1: `packages/client/src/routes/_auth.settings.users.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@app/shared';
import { api, ApiException } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AppTopBar } from '../components/AppTopBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Dialog } from '../components/ui/Dialog';
import { useState } from 'react';

export const Route = createFileRoute('/_auth/settings/users')({
  component: UsersAdmin,
});

function UsersAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="h-full flex flex-col">
        <AppTopBar />
        <div className="p-8 text-muted">Admin only.</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <AppTopBar />
      <div className="h-10 border-b border-rule bg-paper flex items-center px-4 gap-3">
        <h1 className="text-[14px] font-semibold">Users</h1>
        <Button onClick={() => setOpen(true)} className="ml-auto">+ Add user</Button>
      </div>
      <main className="flex-1 overflow-y-auto p-6 max-w-[700px] mx-auto w-full">
        <ul className="flex flex-col gap-1">
          {(usersQ.data ?? []).map((u) => (
            <li key={u.id} className="flex items-center gap-3 border border-rule rounded px-3 py-2 text-[13px]">
              <span className="flex-1">
                <span className="font-medium">{u.name}</span>
                <span className="text-muted"> · {u.email}</span>
              </span>
              <span className="text-[11px] text-muted uppercase tracking-wider">{u.role}</span>
              {u.id !== user.id && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Delete user ${u.email}?`)) del.mutate(u.id);
                  }}
                >Delete</Button>
              )}
            </li>
          ))}
        </ul>
      </main>
      <NewUserDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post<User>('/users', { email, name, password, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEmail(''); setName(''); setPassword(''); setRole('member');
      onClose();
    },
    onError: (e) => setErr(e instanceof ApiException ? e.message : 'failed'),
  });

  return (
    <Dialog open={open} onClose={onClose} title="Add user">
      <form
        onSubmit={(e) => { e.preventDefault(); setErr(null); create.mutate(); }}
        className="flex flex-col gap-3"
      >
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input placeholder="email@example.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input placeholder="Password (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member')}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
        {err && <p className="text-[12px] text-red-600">{err}</p>}
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 2: Register route in `packages/client/src/router.tsx`**

```tsx
import { Route as UsersAdminRoute } from './routes/_auth.settings.users';

const tree = RootRoute.addChildren([
  LoginRoute,
  AuthLayoutRoute.addChildren([AuthIndexRoute, ProjectRoute, MembersRoute, UsersAdminRoute]),
]);
```

- [ ] **Step 3: Smoke test**

As admin: top bar → click "Users" link → create a member account → log out → log in as that member → projects list is empty, no "+ New project", no "Users" link, no admin features.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/routes/_auth.settings.users.tsx packages/client/src/router.tsx
git commit -m "feat(client): admin users page"
```

---

### Task 53: 401 → redirect to login

**Files:**
- Modify: `packages/client/src/lib/api.ts`

- [ ] **Step 1: Add a global 401 handler**

In `packages/client/src/lib/api.ts`, modify the `request` function so a 401 redirects to `/login`:

```ts
if (res.status === 401 && !path.startsWith('/auth/')) {
  window.location.assign('/login');
  throw new ApiException(401, 'UNAUTHORIZED', 'session expired');
}
```

Place this immediately after `const data = text ? JSON.parse(text) : undefined;` and before the existing `if (!res.ok)` block.

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/lib/api.ts
git commit -m "feat(client): redirect to /login on 401"
```

---

## Phase 10 — Production build & polish (Tasks 54–57)

### Task 54: Server serves built client in production

**Files:**
- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add static handler to `app.ts`**

After the API routes are mounted, before `return app;`, add:

```ts
import { serveStatic } from 'hono/bun';
// ...
if (env.NODE_ENV === 'production') {
  // serve built client
  app.use('/*', serveStatic({ root: '../client/dist' }));
  // SPA fallback — any non-/api path returns index.html so client router can handle it
  app.get('*', serveStatic({ path: '../client/dist/index.html' }));
}
```

(Adjust `root` if your packaged layout differs — at runtime, cwd will be `packages/server`.)

- [ ] **Step 2: Test the production build locally**

```bash
NODE_ENV=production bun run build
NODE_ENV=production bun run --filter='@app/server' start
```
Visit `http://localhost:3000`. Expect the full app served from a single port. Login, project page, Gantt all work.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/app.ts
git commit -m "feat(server): serve client static files in production"
```

---

### Task 55: Network-error inline banner

**Files:**
- Create: `packages/client/src/components/ErrorBanner.tsx`
- Modify: `packages/client/src/routes/_auth.projects.$id.tsx`

- [ ] **Step 1: `packages/client/src/components/ErrorBanner.tsx`**

```tsx
export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-b border-red-200 bg-red-50 text-red-700 px-4 py-2 text-[12px] flex items-center gap-3">
      <span className="flex-1">{message}</span>
      {onRetry && <button className="underline hover:no-underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}
```

- [ ] **Step 2: Show it in project page**

In `_auth.projects.$id.tsx`, just under `<AppTopBar />`, add:

```tsx
{(tasksQ.error || projectQ.error) && (
  <ErrorBanner
    message={`Couldn't load this project: ${(tasksQ.error || projectQ.error)!.message}`}
    onRetry={() => { tasksQ.refetch(); projectQ.refetch(); }}
  />
)}
```

Add the import:
```ts
import { ErrorBanner } from '../components/ErrorBanner';
```

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/ErrorBanner.tsx packages/client/src/routes/_auth.projects.$id.tsx
git commit -m "feat(client): error banner with retry"
```

---

### Task 56: README — full ops guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with the full version**

```md
# Gantt Task Manager

Self-hosted task management with an infinitely-scrollable Gantt chart, finish-to-start dependencies, file attachments via S3, and email/password auth.

## Stack
- **Runtime**: Bun
- **API**: Hono + Drizzle ORM + PostgreSQL
- **Client**: Vite + React + Tailwind + TanStack Router/Query
- **Storage**: S3-compatible (MinIO in dev)

## Quickstart

```bash
docker compose up -d                 # postgres + minio
cp .env.example .env                 # edit JWT_SECRET + ADMIN_* before first run
bun install
bun run db:migrate                   # apply migrations
bun run dev                          # server :3000, client :5173
```

Open `http://localhost:5173` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`).

## Workspace scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Run server + client in dev (hot reload) |
| `bun run build` | Build client into `packages/client/dist/` |
| `bun run --filter='@app/server' start` | Run server (prod) |
| `bun run db:generate` | Generate a new Drizzle migration from `schema.ts` |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:studio` | Drizzle Studio (DB browser) |
| `bun test` | Run server + client tests |
| `bun run --filter='@app/server' reconcile-orphans` | Delete S3 objects with no DB row (run nightly) |

## Production deploy

```bash
NODE_ENV=production bun run build
NODE_ENV=production bun run --filter='@app/server' start
```

The server serves the built client from `packages/client/dist/` at `http://0.0.0.0:$PORT`. Put it behind a TLS-terminating reverse proxy and set:

- `JWT_SECRET` — 32+ random bytes (`openssl rand -base64 48`)
- `DATABASE_URL` — managed Postgres connection string
- `S3_*` — real S3 / R2 / Wasabi credentials; set `S3_FORCE_PATH_STYLE=false` for AWS
- `CLIENT_ORIGIN` — same origin as the deployed app (CORS)

## Layout

- `packages/shared` — Zod schemas + TS types
- `packages/server` — Hono API
- `packages/client` — Vite + React UI
- `docs/superpowers/specs/2026-05-20-gantt-task-manager-design.md` — design spec
- `docs/superpowers/plans/2026-05-20-gantt-task-manager.md` — this plan

## Permission model

- **Admin**: create/edit/delete projects, manage users, full access to every project.
- **Member**: view + edit projects they are assigned to. Cannot create projects or manage users.

## Operational notes

- File uploads go directly to S3 via presigned PUT URLs — the API never touches the bytes.
- Orphaned S3 objects (uploads that finished step 3 but never confirmed in step 4) are cleaned by the nightly reconcile script. Schedule it via cron or your scheduler.
- JWT cookie expiry is 7 days. Adjust the `SEVEN_DAYS` constant in `packages/server/src/routes/auth.ts` if needed.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: full README"
```

---

### Task 57: Full-suite verification

**Files:** (none)

- [ ] **Step 1: Run all tests**

```bash
bun test
```
Expected: every server + client test passes.

- [ ] **Step 2: Build the client**

```bash
bun run build
```
Expected: builds without errors. `packages/client/dist/` exists with `index.html` and an `assets/` folder.

- [ ] **Step 3: Production smoke test**

```bash
NODE_ENV=production bun run --filter='@app/server' start &
sleep 2
curl -s http://localhost:3000/api/health
curl -s -I http://localhost:3000/ | head -3
kill %1
```
Expected: `/api/health` returns `{"ok":true}`. Root returns `200 OK` with `text/html`.

- [ ] **Step 4: Acceptance walk-through (manual)**

Run dev mode and confirm each item end-to-end:

- [ ] Log in as admin
- [ ] Create a project
- [ ] Add a member user via /settings/users
- [ ] Add that member to the project via the Members page
- [ ] Create three tasks via "+ Task"
- [ ] Click a bar → side panel opens with form, dependency picker, files
- [ ] Edit a task's title + dates → save → bar updates
- [ ] Drag a bar to a new date → server PATCH fires → bar settles
- [ ] Drag right edge to resize → end date updates
- [ ] Add a dependency in the side panel → arrow appears
- [ ] Try to add a cyclic dependency → error message shown
- [ ] Upload a PDF to a task → progress, then file listed
- [ ] Download the file → opens correctly
- [ ] Delete the file → removed from list
- [ ] Delete a task → bar disappears
- [ ] Log out → log in as member → sees only assigned projects, no admin links
- [ ] Switch zoom Day/Week/Month → bars reflow correctly
- [ ] Click Today → chart re-centers on today
- [ ] Scroll right indefinitely → date header keeps extending

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: v1 acceptance complete" --allow-empty
```

---

## Done

You have a complete, working Gantt task manager. Subsequent work (notifications, mobile responsiveness, drag-to-link, auto-shift on dependency moves, sub-tasks, etc.) should each get their own spec → plan → implementation cycle.
