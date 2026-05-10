// src/adapters/persistence/sqlite/connection.ts
// Apertura de conexión SQLite con PRAGMAs requeridos por el schema.
// Ver docs/architecture/02-schema-sqlite.md §"Decisiones globales del schema".

import Database from 'better-sqlite3';

export interface ConnectionConfig {
  /** Path al archivo .sqlite o ':memory:' para tests. */
  readonly filename: string;
  /**
   * Si true, NO aplica WAL. Útil para `:memory:` (donde WAL no sirve) o
   * entornos especiales. Default: se desactiva automáticamente para `:memory:`.
   */
  readonly disableWAL?: boolean;
}

/**
 * Abre conexión SQLite con los PRAGMAs requeridos por el schema:
 * - foreign_keys = ON
 * - journal_mode = WAL (salvo `:memory:` o `disableWAL=true`)
 *
 * Retorna instancia better-sqlite3.Database lista para usar.
 */
export function openConnection(config: ConnectionConfig): Database.Database {
  const db = new Database(config.filename);
  db.pragma('foreign_keys = ON');

  const useWAL = !config.disableWAL && config.filename !== ':memory:';
  if (useWAL) {
    db.pragma('journal_mode = WAL');
  }

  return db;
}
