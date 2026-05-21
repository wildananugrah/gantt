import { createApp } from './app';
import { env } from './env';
import { ensureBootstrapAdmin } from './lib/bootstrap';

await ensureBootstrapAdmin();

const app = createApp();

console.log(`[server] listening on http://localhost:${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
