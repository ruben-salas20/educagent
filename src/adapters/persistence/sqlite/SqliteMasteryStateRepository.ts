// src/adapters/persistence/sqlite/SqliteMasteryStateRepository.ts
// Implementación SQLite de IMasteryStateRepository.
//
// A diferencia de SqliteAttemptRepository (append-only), MasteryState es
// derivado RECALCULABLE: una row por concept_id, `save` hace UPSERT
// (INSERT OR REPLACE). El schema NO instala triggers anti-update sobre
// `mastery_states`, así que la idempotencia recae 100% en este adapter.

import type Database from 'better-sqlite3';
import type {
  IMasteryStateRepository,
  MasteryStateRepositoryError,
} from '../../../ports/persistence/IMasteryStateRepository.js';
import type { MasteryState } from '../../../core/entities/MasteryState.js';
import type { Result } from '../../../core/result/Result.js';
import { ok, err } from '../../../core/result/Result.js';
import {
  rowToMasteryState,
  masteryStateToRow,
  type MasteryStateRow,
} from './mappers/MasteryStateMapper.js';

const UPSERT_SQL = `
  INSERT OR REPLACE INTO mastery_states (
    concept_id, ease_factor, interval_days, repetitions, next_due_at,
    scheduling_state_json, accuracy_window_json, scaffold_trajectory_json,
    bloom_coverage_json, confidence_interval, mastery_label, last_review_at,
    updated_at
  ) VALUES (
    @concept_id, @ease_factor, @interval_days, @repetitions, @next_due_at,
    @scheduling_state_json, @accuracy_window_json, @scaffold_trajectory_json,
    @bloom_coverage_json, @confidence_interval, @mastery_label, @last_review_at,
    @updated_at
  )
`;

const SELECT_BY_CONCEPT_SQL = `SELECT * FROM mastery_states WHERE concept_id = ?`;

export class SqliteMasteryStateRepository implements IMasteryStateRepository {
  private readonly upsertStmt: Database.Statement;
  private readonly selectStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.upsertStmt = db.prepare(UPSERT_SQL);
    this.selectStmt = db.prepare(SELECT_BY_CONCEPT_SQL);
  }

  async save(state: MasteryState): Promise<Result<void, MasteryStateRepositoryError>> {
    try {
      const row = masteryStateToRow(state);
      this.upsertStmt.run(row);
      return ok(undefined);
    } catch (e) {
      return err(mapSqliteError(e));
    }
  }

  async findByConceptId(
    conceptId: string,
  ): Promise<Result<MasteryState, MasteryStateRepositoryError>> {
    try {
      const row = this.selectStmt.get(conceptId) as MasteryStateRow | undefined;
      if (row === undefined) {
        return err({ kind: 'not_found', conceptId });
      }
      return ok(rowToMasteryState(row));
    } catch (e) {
      return err(mapSqliteError(e));
    }
  }
}

/**
 * Mapea errores nativos de better-sqlite3 a MasteryStateRepositoryError.
 *
 * Detecta:
 * - FOREIGN KEY constraint (concept_id no existe) → foreign_key_violation
 * - CHECK constraint (mastery_label, confidence_interval) → storage_error
 *   con cause descriptivo
 * - Cualquier otro → storage_error
 */
function mapSqliteError(e: unknown): MasteryStateRepositoryError {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();
  const code = (e as { code?: string }).code;

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || lower.includes('foreign key')) {
    return { kind: 'foreign_key_violation', constraint: message };
  }

  if (code === 'SQLITE_CONSTRAINT_CHECK' || lower.includes('check constraint')) {
    return { kind: 'storage_error', cause: `check constraint failed: ${message}` };
  }

  return { kind: 'storage_error', cause: message };
}
