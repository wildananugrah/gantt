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
    build: {
      // Skip the per-chunk gzip-size reporting; saves several seconds on large bundles.
      reportCompressedSize: false,
      // Modern target — fewer transforms than the default 'modules' (~ES2015).
      target: 'es2020',
      // Raise the warning threshold so the build log isn't noisy with expected-large chunks.
      chunkSizeWarningLimit: 1500,
      sourcemap: false,
      rollupOptions: {
        output: {
          // Only split LAZY-LOADED heavy libs into stable named chunks.
          // Eager deps (React, TanStack, etc.) are left to Vite's default
          // chunking — manually splitting them caused a load-order bug where
          // a consumer chunk ran before its React chunk had executed,
          // producing `Ro.useState is undefined` on first paint.
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@excalidraw')) return 'vendor-excalidraw';
            if (id.includes('mermaid')) return 'vendor-mermaid';
            if (id.includes('exceljs')) return 'vendor-exceljs';
            if (id.includes('marked') || id.includes('dompurify')) return 'vendor-markdown';
            return undefined;
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
