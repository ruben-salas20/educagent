// src/adapters/persistence/sqlite/mappers/MasteryStateMapper.ts
// Mapper row ↔ entity para MasteryState.
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE mastery_states".
//
// Nota crítica de diseño:
// Las columnas `ease_factor`, `interval_days`, `repetitions`, `next_due_at` están
// DENORMALIZADAS desde `schedulingState.raw` para permitir queries SQL eficientes
// (ej. `WHERE next_due_at <= NOW()` para spaced repetition lookup, índice
// idx_mastery_due). El JSON `scheduling_state_json` es la fuente CANÓNICA;
// esas 4 columnas son cache derivado. En la lectura (row → entity) se ignoran
// las columnas y se reconstruye el SchedulingState desde el JSON.

import type {
  MasteryState,
  AccuracyWindowEntry,
  ScaffoldTrajectoryPoint,
  MasteryLabel,
} from '../../../../core/entities/MasteryState.js';
import type { SchedulingState } from '../../../../core/value-objects/SchedulingState.js';
import type { Bloom } from '../../../../core/value-objects/Bloom.js';

/**
 * Row schema de la tabla `mastery_states` tal como viene de better-sqlite3.
 * Campos JSON-as-TEXT vienen como string crudo.
 */
export interface MasteryStateRow {
  concept_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_due_at: string | null;
  scheduling_state_json: string;
  accuracy_window_json: string;
  scaffold_trajectory_json: string;
  bloom_coverage_json: string;
  confidence_interval: number;
  mastery_label: string;
  last_review_at: string | null;
  updated_at: string;
}

export function rowToMasteryState(row: MasteryStateRow): MasteryState {
  return {
    conceptId: row.concept_id,
    schedulingState: JSON.parse(row.scheduling_state_json) as SchedulingState,
    accuracyWindow: JSON.parse(
      row.accuracy_window_json,
    ) as ReadonlyArray<AccuracyWindowEntry>,
    scaffoldTrajectory: JSON.parse(
      row.scaffold_trajectory_json,
    ) as ReadonlyArray<ScaffoldTrajectoryPoint>,
    bloomCoverage: JSON.parse(row.bloom_coverage_json) as ReadonlyArray<Bloom>,
    confidenceInterval: row.confidence_interval,
    masteryLabel: row.mastery_label as MasteryLabel,
    lastReviewAt: row.last_review_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lee un campo numérico del `schedulingState.raw` con fallback al default
 * del schema (las columnas denormalizadas tienen DEFAULT en SQL pero acá
 * preferimos consistencia raw → row).
 */
function rawNumber(
  raw: Readonly<Record<string, number | string>>,
  key: string,
  fallback: number,
): number {
  const v = raw[key];
  return typeof v === 'number' ? v : fallback;
}

export function masteryStateToRow(state: MasteryState): MasteryStateRow {
  const raw = state.schedulingState.raw;
  return {
    concept_id: state.conceptId,
    // Denormalizado desde schedulingState.raw — defaults coherentes con el schema
    ease_factor: rawNumber(raw, 'easeFactor', 2.5),
    interval_days: rawNumber(raw, 'intervalDays', 0),
    repetitions: rawNumber(raw, 'repetitions', 0),
    next_due_at: state.schedulingState.nextDueAt,
    // 4 campos JSON: scheduling_state es canónico
    scheduling_state_json: JSON.stringify(state.schedulingState),
    accuracy_window_json: JSON.stringify(state.accuracyWindow),
    scaffold_trajectory_json: JSON.stringify(state.scaffoldTrajectory),
    bloom_coverage_json: JSON.stringify(state.bloomCoverage),
    confidence_interval: state.confidenceInterval,
    mastery_label: state.masteryLabel,
    last_review_at: state.lastReviewAt,
    updated_at: state.updatedAt,
  };
}
