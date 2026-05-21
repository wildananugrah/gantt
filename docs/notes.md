docker compose up -d                                     # postgres + minio (already running)
bun run --filter='@app/server' dev &                     # :3000
bun run --filter='@app/client' dev                       # :5173

Sign in: admin@example.com / admin12345 (from .env).

there should be a notification if update or delete the task, including change the task bar for start and end date. 