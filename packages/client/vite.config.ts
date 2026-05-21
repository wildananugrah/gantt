import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  // Load env from the repo root (..//.env), not from the client package dir.
  // `loadEnv(..., '')` returns ALL env vars (not just VITE_-prefixed).
  const env = loadEnv(mode, resolve(__dirname, '../..'), '');

  const CLIENT_PORT = Number(env.CLIENT_PORT) || 5173;
  const SERVER_PORT = Number(env.PORT) || 3000;
  const API_PROXY_TARGET = env.VITE_API_PROXY_TARGET || `http://localhost:${SERVER_PORT}`;

  return {
    plugins: [react()],
    server: {
      port: CLIENT_PORT,
      strictPort: false,
      proxy: {
        '/api': API_PROXY_TARGET,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
