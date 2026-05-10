// src/core/value-objects/SchedulingState.ts
// Tipos compartidos entre core/entities (MasteryState) y ports (IScheduler).
// Viven en core porque MasteryState los necesita y core no puede importar de ports
// (eslint-plugin-boundaries: core → core únicamente).
//
// Ver docs/architecture/03-interfaces.md §IScheduler.

/**
 * Estado de scheduling. Opaque por diseño: SM-2 tiene 4 campos,
 * FSRS tiene 7+. El consumidor NUNCA toca estos campos directamente.
 */
export interface SchedulingState {
  readonly algorithm: 'sm2' | 'fsrs';
  readonly version: number; // permite migración serializada
  readonly paramsHash: string; // detecta state stale post-recalibración (FSRS)
  readonly raw: Readonly<Record<string, number | string>>;
  readonly nextDueAt: string | null; // ISO 8601 — único campo público garantizado
}

export type SchedulerError =
  | { kind: 'invalid_state'; reason: string }
  | { kind: 'algorithm_mismatch'; expected: string; got: string };

/**
 * Parámetros calibrables del scheduler. Para SM-2 es vacío; para FSRS son los 17 weights.
 */
export type SchedulingParams = Readonly<Record<string, number | string>>;

export type CalibrationError =
  | { kind: 'insufficient_attempts'; needed: number; got: number }
  | { kind: 'optimization_failed'; reason: string }
  | { kind: 'algorithm_not_calibrable' };
