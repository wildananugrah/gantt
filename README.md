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
