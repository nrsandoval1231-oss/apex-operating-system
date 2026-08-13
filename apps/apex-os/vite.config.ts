import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The Gate API is the only source of project data. It binds to loopback for the
 * controlled pilot, so dev requests to /api are proxied to it rather than this
 * app holding a database of its own.
 */
const apiTarget = process.env['APEX_API_URL'] ?? 'http://127.0.0.1:4100';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@apex/contracts': resolve(import.meta.dirname, '../../packages/contracts/src/index.ts'),
      '@apex/domain': resolve(import.meta.dirname, '../../packages/domain/src/index.ts'),
      '@apex/pricing-engine': resolve(import.meta.dirname, '../../packages/pricing-engine/src/index.ts'),
    },
  },
  /**
   * The built app is served by the Gate API at /app, on the same origin as the
   * API it calls, so it needs no dev proxy in front of it. The dev server below
   * still serves from / with a proxy for fast iteration.
   */
  base: '/app/',
  server: {
    // Honour an assigned PORT so the app does not fight for a fixed one.
    ...(process.env['PORT'] ? { port: Number(process.env['PORT']) } : { port: 3000 }),
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
