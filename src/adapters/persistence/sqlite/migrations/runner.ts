// src/adapters/persistence/sqlite/migrations/runner.ts
// Aplica migraciones SQL numeradas idempotentemente.
//
// Convenciones:
// - Archivos: `NNNN_descripcion.sql` (NNNN zero-padded).
// - Registro en tabla `_migrations(id, applied_at)`.
// - Sin downgrade scripts en MVP — solo forward migrations.
// - Cada migration corre en una transacción atómica.

import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Result } from '../../../../core/result/Result.js';
import { ok, err } from '../../../../core/result/Result.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type MigrationError =
  | { kind: 'apply_failed'; migrationId: string; cause: string }
  | { kind: 'invalid_migration_id'; filename: string };

/**
 * Aplica migraciones idempotentemente. Lee archivos `.sql` numerados desde
 * `./` (relativo a este archivo) y los ejecuta en orden si no están registrados
 * en la tabla `_migrations`.
 *
 * La tabla `_migrations` se crea on-demand en la primera corrida.
 *
 * Idempotente: correr `applyMigrations` N veces produce el mismo estado.
 */
export function applyMigrations(
  db: Database.Database,
): Result<{ applied: string[] }, MigrationError> {
  // 1. Crear tabla _migrations si no existe
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id          TEXT PRIMARY KEY,
    applied_at  TEXT NOT NULL
  )`);

  // 2. Listar IDs ya aplicados
  const appliedRows = db.prepare('SELECT id FROM _migrations').all() as Array<{ id: string }>;
  const appliedIds = new Set(appliedRows.map((r) => r.id));

  // 3. Listar archivos .sql del directorio migrations/, en orden lexicográfico
  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const newApplied: string[] = [];

  // 4. Para cada archivo no aplicado: ejecutar + registrar (en transacción)
  for (const file of files) {
    if (!/^\d{4}_/.test(file)) {
      return err({ kind: 'invalid_migration_id', filename: file });
    }
    const id = file.replace(/\.sql$/, '');
    if (appliedIds.has(id)) continue;

    const sql = readFileSync(join(__dirname, file), 'utf-8');

    const txn = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id, applied_at) VALUES (?, ?)').run(
        id,
        new Date().toISOString(),
      );
    });

    try {
      txn();
      newApplied.push(id);
    } catch (e) {
      return err({
        kind: 'apply_failed',
        migrationId: id,
        cause: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return ok({ applied: newApplied });
}
