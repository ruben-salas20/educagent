// tests/app/composition-root.test.ts
// Tests unit del composition root. Verifican que buildContainer arma el grafo
// correcto, aplica migraciones y mantiene aislamiento entre llamadas.

import { describe, it, expect } from 'vitest';
import {
  buildContainer,
  CompositionRootError,
} from '../../src/app/composition-root.js';
import { SqliteAttemptRepository } from '../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteMasteryStateRepository } from '../../src/adapters/persistence/sqlite/SqliteMasteryStateRepository.js';
import { Sm2Scheduler } from '../../src/adapters/inference/Sm2Scheduler.js';
import { SystemClock } from '../../src/adapters/infra/SystemClock.js';

describe('buildContainer', () => {
  it('retorna container con las 4 dependencies + db handle', () => {
    const container = buildContainer({ sqliteFilename: ':memory:' });
    try {
      expect(container.attempts).toBeInstanceOf(SqliteAttemptRepository);
      expect(container.masteryStates).toBeInstanceOf(SqliteMasteryStateRepository);
      expect(container.scheduler).toBeInstanceOf(Sm2Scheduler);
      expect(container.clock).toBeInstanceOf(SystemClock);
      expect(container.db).toBeDefined();
      expect(container.db.open).toBe(true);
    } finally {
      container.db.close();
    }
  });

  it('aplica migrations al arrancar (schema queda listo)', () => {
    const container = buildContainer({ sqliteFilename: ':memory:' });
    try {
      const row = container.db
        .prepare(
          `SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
        )
        .get() as { c: number };
      // 21 tablas de dominio + 1 tabla _migrations. Sanity check: >= 20.
      expect(row.c).toBeGreaterThanOrEqual(20);
    } finally {
      container.db.close();
    }
  });

  it('aplica migrations y registra entries en _migrations', () => {
    const container = buildContainer({ sqliteFilename: ':memory:' });
    try {
      const row = container.db
        .prepare(`SELECT count(*) as c FROM _migrations`)
        .get() as { c: number };
      expect(row.c).toBeGreaterThanOrEqual(1);
    } finally {
      container.db.close();
    }
  });

  it('PRAGMA foreign_keys queda ON tras buildContainer', () => {
    const container = buildContainer({ sqliteFilename: ':memory:' });
    try {
      const row = container.db.pragma('foreign_keys', { simple: true });
      expect(row).toBe(1);
    } finally {
      container.db.close();
    }
  });

  it('múltiples llamadas con :memory: crean DBs independientes', () => {
    const c1 = buildContainer({ sqliteFilename: ':memory:' });
    const c2 = buildContainer({ sqliteFilename: ':memory:' });
    try {
      expect(c1.db).not.toBe(c2.db);
      // Inserción en c1 no debe ser visible en c2
      const now = '2026-05-10T00:00:00.000Z';
      c1.db
        .prepare(
          `INSERT INTO projects (id, name, created_at, last_active_at) VALUES (?, ?, ?, ?)`,
        )
        .run('prj-aislado', 'aislado', now, now);
      const row = c2.db
        .prepare(`SELECT count(*) as c FROM projects WHERE id = ?`)
        .get('prj-aislado') as { c: number };
      expect(row.c).toBe(0);
    } finally {
      c1.db.close();
      c2.db.close();
    }
  });

  it('CompositionRootError preserva el cause', () => {
    // Construcción directa para verificar el shape de la clase de error.
    const underlying = new Error('disk full');
    const err = new CompositionRootError('wrap', underlying);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CompositionRootError);
    expect(err.name).toBe('CompositionRootError');
    expect(err.cause).toBe(underlying);
    expect(err.message).toBe('wrap');
  });
});
