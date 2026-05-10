// ESLint 9+ flat config
// Enforces hexagonal boundaries (ADR-0001) via eslint-plugin-boundaries.
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'policies', pattern: 'src/policies/**' },
        { type: 'ports', pattern: 'src/ports/**' },
        { type: 'adapters', pattern: 'src/adapters/**' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'cli', pattern: 'src/cli/**' },
        { type: 'tests', pattern: 'tests/**' },
      ],
      'boundaries/include': ['src/**/*', 'tests/**/*'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'core', allow: ['core'] },
            { from: 'policies', allow: ['core', 'policies'] },
            { from: 'ports', allow: ['core'] },
            { from: 'adapters', allow: ['core', 'ports', 'adapters'] },
            { from: 'app', allow: ['core', 'policies', 'ports', 'app'] },
            { from: 'cli', allow: ['core', 'policies', 'ports', 'app', 'cli'] },
            // tests pueden importar de cualquier capa para verificar
            { from: 'tests', allow: ['core', 'policies', 'ports', 'adapters', 'app', 'cli', 'tests'] },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
