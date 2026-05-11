import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: false, isolate: true },
    },
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/**',
        'src/**/index.ts',
        // Entities y value-objects son type-only: sin runtime code, coverage 0% es esperable
        'src/core/entities/**',
        'src/core/value-objects/**',
        // ports son interfaces puras
        'src/ports/**',
      ],
      thresholds: {
        // Activados con 5 políticas + Sm2Scheduler + persistence layer.
        // 75/75/75/70 cubre el coverage actual con margen. Subir a 80 cuando P3
        // tenga las ramas faltantes cubiertas (handleInsistence tier=tertiary
        // + fallback sanitizeOutput).
        lines: 75,
        statements: 75,
        functions: 75,
        branches: 70,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 5000,
  },
});
