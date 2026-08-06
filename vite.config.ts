import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  /*
   * Tauri points its dev window at a fixed URL, so the port cannot float. Left
   * on Vite's default the shell opens a blank window the moment anything else
   * on the machine is already using 5173 — which is exactly what happens when a
   * browser dev server is already running.
   */
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
