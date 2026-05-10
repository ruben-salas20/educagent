// src/ports/persistence/IMasteryStateRepository.ts
// Puerto de persistencia para MasteryState. Una row por (concept_id).
// Ver docs/architecture/02-schema-sqlite.md §"Mastery State (1 por concepto + proyecto)".

import type { Result } from '../../core/result/Result.js';
import type { MasteryState } from '../../core/entities/MasteryState.js';

export type MasteryStateRepositoryError =
  | { kind: 'not_found'; conceptId: string }
  | { kind: 'foreign_key_violation'; constraint: string }
  | { kind: 'storage_error'; cause: string };

/**
 * Repository de MasteryState. Una row por (concept_id).
 * - `findByConceptId` retorna `not_found` si no existe (primer attempt sobre el concept).
 * - `save` hace upsert (INSERT OR REPLACE en SQLite — semántica de derivado recalculable).
 */
export interface IMasteryStateRepository {
  findByConceptId(
    conceptId: string,
  ): Promise<Result<MasteryState, MasteryStateRepositoryError>>;
  save(state: MasteryState): Promise<Result<void, MasteryStateRepositoryError>>;
}
