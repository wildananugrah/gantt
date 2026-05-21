# Gantt Task Manager

Self-hosted task management with an infinitely-scrollable Gantt chart, finish-to-start dependencies, file attachments via S3, and email/password auth.

## Stack
- **Runtime**: Bun
- **API**: Hono + Drizzle ORM + PostgreSQL
- **Client**: Vite + React + Tailwind + TanStack Router/Query
- **Storage**: S3-compatible (MinIO in dev)

## Quickstart

```bash
docker compose up -d                                          # postgres + minio
cp .env.example .env                                          # edit JWT_SECRET + ADMIN_* before first run
bun install
bun run db:migrate                                            # apply migrations
bun run --filter='@app/server' dev &                          # server :3000
bun run --filter='@app/client' dev                            # client :5173
```

Open `http://localhost:5173` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`).

## Workspace scripts

| Script | Purpose |
|---|---|
| `bun run dev` (each package) | Hot-reload dev server |
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
- `docs/superpowers/plans/2026-05-20-gantt-task-manager.md` — implementation plan

## Permission model

- **Admin**: create/edit/delete projects, manage users, full access to every project.
- **Member**: view + edit projects they are assigned to. Cannot create projects or manage users.

## Operational notes

- File uploads go directly to S3 via presigned PUT URLs — the API never touches the bytes.
- Orphaned S3 objects (uploads that finished step 3 but never confirmed in step 4) are cleaned by the nightly reconcile script. Schedule it via cron or your scheduler.
- JWT cookie expiry is 7 days. Adjust the `SEVEN_DAYS` constant in `packages/server/src/routes/auth.ts` if needed.
