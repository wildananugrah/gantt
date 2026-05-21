import { createApp, PORT } from './app';
import { ensureBootstrapAdmin } from './lib/bootstrap';

ensureBootstrapAdmin().catch((err) => {
  console.error('[bootstrap] failed:', err);
});

const app = createApp();

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[server] listening on http://localhost:${PORT}`);
