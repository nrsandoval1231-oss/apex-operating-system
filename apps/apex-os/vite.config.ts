import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The Gate API is the only source of project data. It binds to loopback for the
 * controlled pilot, so dev requests to /api are proxied to it rather than this
 * app holding a database of its own.
 */
const apiTarget = process.env['APEX_API_URL'] ?? 'http://127.0.0.1:4100';

export default defineConfig({
  plugins: [react()],
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
