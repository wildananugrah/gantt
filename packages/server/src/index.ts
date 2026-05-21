import { createApp, PORT } from './app';
import { ensureBootstrapAdmin } from './lib/bootstrap';

await ensureBootstrapAdmin();

const app = createApp();

console.log(`[server] listening on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
