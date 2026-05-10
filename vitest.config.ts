import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: false, isolate: true },
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli/**', 'src/**/index.ts', 'src/adapters/llm/**'],
      // thresholds desactivados hasta tener 3+ políticas implementadas (walking skeleton)
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 5000,
  },
});
