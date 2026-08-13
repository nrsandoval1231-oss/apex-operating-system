import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@apex/contracts': resolve(import.meta.dirname, 'packages/contracts/src/index.ts'),
      '@apex/database': resolve(import.meta.dirname, 'packages/database/src/index.ts'),
      '@apex/domain': resolve(import.meta.dirname, 'packages/domain/src/index.ts'),
      '@apex/gate-service': resolve(import.meta.dirname, 'packages/gate-service/src/index.ts'),
      '@apex/pricing-engine': resolve(import.meta.dirname, 'packages/pricing-engine/src/index.ts'),
      '@apex/storage': resolve(import.meta.dirname, 'packages/storage/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
