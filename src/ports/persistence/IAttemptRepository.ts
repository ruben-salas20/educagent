// src/ports/persistence/IAttemptRepository.ts
// Puerto de persistencia para Attempts. Append-only by contract
// (ver docs/architecture/02-schema-sqlite.md §"Attempt INMUTABLE").

import type { Result } from '../../core/result/Result.js';
import type { Attempt } from '../../core/entities/Attempt.js';

export type AttemptRepositoryError =
  | { kind: 'duplicate_id'; attemptId: string }
  | { kind: 'foreign_key_violation'; constraint: string }
  | { kind: 'immutability_violation'; reason: string }
  | { kind: 'not_found'; attemptId: string }
  | { kind: 'storage_error'; cause: string };

/**
 * Repository de Attempts. Append-only by contract:
 * - `save` solo INSERT, nunca UPDATE.
 * - `findBySessionId` retorna en orden cronológico ascendente (started_at).
 *
 * El trigger SQL en la tabla attempts bloquea UPDATE/DELETE — el adapter NUNCA
 * debe emitir esos statements. Si por bug los emite, el trigger aborta y el
 * error se mapea a `immutability_violation`.
 */
export interface IAttemptRepository {
  save(attempt: Attempt): Promise<Result<void, AttemptRepositoryError>>;
  findBySessionId(
    sessionId: string,
  ): Promise<Result<ReadonlyArray<Attempt>, AttemptRepositoryError>>;
  findById(id: string): Promise<Result<Attempt, AttemptRepositoryError>>;
}
