// src/adapters/persistence/sqlite/SqliteAttemptRepository.ts
// Implementación SQLite de IAttemptRepository. Append-only by contract:
// solo INSERT, nunca UPDATE/DELETE. El trigger SQL es el safety net.
//
// El port es async (Promise) aunque better-sqlite3 sea sync — mantenemos
// interfaz uniforme con futuros providers async (p.ej. Postgres remoto).

import type Database from 'better-sqlite3';
import type {
  IAttemptRepository,
  AttemptRepositoryError,
} from '../../../ports/persistence/IAttemptRepository.js';
import type { Attempt } from '../../../core/entities/Attempt.js';
import type { Result } from '../../../core/result/Result.js';
import { ok, err } from '../../../core/result/Result.js';
import { attemptToRow, rowToAttempt, type AttemptRow } from './mappers/AttemptMapper.js';

const INSERT_SQL = `
  INSERT INTO attempts (
    id, project_id, session_id, item_id, mode,
    started_at, submitted_at, latency_ms, response_text, outcome,
    scaffold_level_reached, scaffold_requested_by, error_type,
    pre_confidence, post_confidence, retry_count, affective_snapshot_json
  ) VALUES (
    @id, @project_id, @session_id, @item_id, @mode,
    @started_at, @submitted_at, @latency_ms, @response_text, @outcome,
    @scaffold_level_reached, @scaffold_requested_by, @error_type,
    @pre_confidence, @post_confidence, @retry_count, @affective_snapshot_json
  )
`;

const SELECT_BY_ID_SQL = `SELECT * FROM attempts WHERE id = ?`;
const SELECT_BY_SESSION_SQL = `SELECT * FROM attempts WHERE session_id = ? ORDER BY started_at ASC, id ASC`;

export class SqliteAttemptRepository implements IAttemptRepository {
  private readonly insertStmt: Database.Statement;
  private readonly selectByIdStmt: Database.Statement;
  private readonly selectBySessionStmt: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(INSERT_SQL);
    this.selectByIdStmt = db.prepare(SELECT_BY_ID_SQL);
    this.selectBySessionStmt = db.prepare(SELECT_BY_SESSION_SQL);
  }

  async save(attempt: Attempt): Promise<Result<void, AttemptRepositoryError>> {
    const row = attemptToRow(attempt);
    try {
      this.insertStmt.run(row);
      return ok(undefined);
    } catch (e) {
      return err(mapSqliteError(e, attempt.id));
    }
  }

  async findById(id: string): Promise<Result<Attempt, AttemptRepositoryError>> {
    try {
      const row = this.selectByIdStmt.get(id) as AttemptRow | undefined;
      if (!row) {
        return err({ kind: 'not_found', attemptId: id });
      }
      return ok(rowToAttempt(row));
    } catch (e) {
      return err(mapSqliteError(e, id));
    }
  }

  async findBySessionId(
    sessionId: string,
  ): Promise<Result<ReadonlyArray<Attempt>, AttemptRepositoryError>> {
    try {
      const rows = this.selectBySessionStmt.all(sessionId) as AttemptRow[];
      return ok(rows.map(rowToAttempt));
    } catch (e) {
      return err(mapSqliteError(e, sessionId));
    }
  }
}

/**
 * Mapea errores nativos de better-sqlite3 a AttemptRepositoryError.
 *
 * Detecta:
 * - Triggers append-only (mensajes con "immutable" / "updates not allowed" /
 *   "only be deleted") → immutability_violation
 * - UNIQUE constraint sobre attempts.id → duplicate_id
 * - FOREIGN KEY constraint → foreign_key_violation
 * - Cualquier otro → storage_error
 */
function mapSqliteError(e: unknown, contextId: string): AttemptRepositoryError {
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();

  if (
    lower.includes('immutable') ||
    lower.includes('updates not allowed') ||
    lower.includes('only be deleted')
  ) {
    return { kind: 'immutability_violation', reason: message };
  }

  // better-sqlite3 expone `code` en SqliteError
  const code = (e as { code?: string }).code;

  if (code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    if (lower.includes('attempts.id') || lower.includes('attempts')) {
      return { kind: 'duplicate_id', attemptId: contextId };
    }
    return { kind: 'duplicate_id', attemptId: contextId };
  }

  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || lower.includes('foreign key')) {
    return { kind: 'foreign_key_violation', constraint: message };
  }

  return { kind: 'storage_error', cause: message };
}
