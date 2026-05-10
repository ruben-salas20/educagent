// src/policies/p7-calibration.ts
// P7 — Calibración 85% (Wilson et al., 2019) y selección de próximo ítem.
// Ver docs/research/01-politicas-operativas.md §P7 y docs/architecture/04-testing-setup.md §P7.
//
// Funciones PURAS: sin I/O, sin LLM, sin DB.

import type { Mode } from '../core/value-objects/Mode.js';

// ---------------------------------------------------------------------------
// decideDifficultyAdjustment — regla del 85%
// ---------------------------------------------------------------------------

export type AccuracyOutcome = 'correct' | 'partial' | 'incorrect';

export interface DifficultyAdjustmentInput {
  /** Últimas N=10 outcomes en la window (peso por recencia ya aplicado aguas arriba). */
  readonly accuracyWindow: ReadonlyArray<AccuracyOutcome>;
}

export interface DifficultyAdjustmentDecision {
  /** -1 baja, 0 mantiene, +1 sube */
  readonly deltaDifficulty: -1 | 0 | 1;
  /** Razón humana para auditoría */
  readonly reason: string;
}

// Umbrales de la regla del 85% (Wilson et al., 2019).
// El punto óptimo es ~0.85; usamos una banda simétrica de ±0.075 alrededor:
//   <0.75   => baja
//   [0.75, 0.92] => mantiene
//   >0.92   => sube
const UPPER_THRESHOLD = 0.92;
const LOWER_THRESHOLD = 0.75;

/** Pondera partial=0.5, correct=1, incorrect=0. */
function weightedAccuracy(window: ReadonlyArray<AccuracyOutcome>): number {
  if (window.length === 0) return 0;
  let sum = 0;
  for (const o of window) {
    if (o === 'correct') sum += 1;
    else if (o === 'partial') sum += 0.5;
  }
  return sum / window.length;
}

/**
 * Regla del 85% (Wilson et al., 2019). Tasa de acierto óptima ≈ 85%.
 *  - >0.92: subir dificultad (alumno aburrido / bajo desafío)
 *  - <0.75: bajar dificultad (alumno frustrado / sobrecargado)
 *  - in [0.75, 0.92]: mantener (banda óptima)
 */
export function decideDifficultyAdjustment(
  input: DifficultyAdjustmentInput,
): DifficultyAdjustmentDecision {
  const accuracy = weightedAccuracy(input.accuracyWindow);

  if (accuracy > UPPER_THRESHOLD) {
    return {
      deltaDifficulty: +1,
      reason: `accuracy=${accuracy.toFixed(2)} > ${UPPER_THRESHOLD} (regla 85%, subir)`,
    };
  }
  if (accuracy < LOWER_THRESHOLD) {
    return {
      deltaDifficulty: -1,
      reason: `accuracy=${accuracy.toFixed(2)} < ${LOWER_THRESHOLD} (regla 85%, bajar)`,
    };
  }
  return {
    deltaDifficulty: 0,
    reason: `accuracy=${accuracy.toFixed(2)} en banda [${LOWER_THRESHOLD}, ${UPPER_THRESHOLD}] (regla 85%, mantener)`,
  };
}

// ---------------------------------------------------------------------------
// selectNextItem — algoritmo de prioridades
// ---------------------------------------------------------------------------

export interface DueItem {
  readonly conceptId: string;
  readonly overdueDays: number;
}

export interface WeakItem {
  readonly conceptId: string;
  readonly errorsInLast3: number;
}

export interface CandidateItem {
  readonly conceptId: string;
}

export interface SelectNextItemInput {
  readonly mode: Mode;
  readonly dueItems?: ReadonlyArray<DueItem>;
  readonly weakItems?: ReadonlyArray<WeakItem>;
  readonly candidatesNew?: ReadonlyArray<CandidateItem>;
  readonly accuracyWindow: ReadonlyArray<AccuracyOutcome>;
}

export type SelectReason =
  | 'sm2_overdue'
  | 'weak_concept'
  | 'new_material'
  | 'deepening'
  | 'no_candidate';

export interface SelectNextItemDecision {
  readonly priority: 1 | 2 | 3 | 4;
  readonly reason: SelectReason;
  readonly conceptId: string | null;
}

// Umbral para "habilitar nuevo material": accuracy >= 0.85 en la window.
const NEW_MATERIAL_GATE = 0.85;
// Umbral para considerar un concepto "débil": >= 2 errores en últimos 3.
const WEAK_ERROR_THRESHOLD = 2;

/**
 * Selección del próximo ítem según prioridades del blueprint:
 *   1. Repaso SM-2 (due_items vencidos) — mayor `overdueDays` gana.
 *   2. Concepto débil (>= 2 errores recientes) — mayor `errorsInLast3` gana.
 *   3. Item nuevo (si accuracy >= 0.85 en window y no hay due/weak).
 *   4. Profundización del concepto activo (default — caller decide cuál).
 *
 * Overrides por modo:
 *   - Simulacro: 100% items SM-2 (no nuevo material). Si no hay due, cae a deepening.
 *   - Explorador: NO selecciona items SM-2 forzados; los disparos viven en P4 (off-ramps).
 *     Si no hay candidatos, retorna `no_candidate`.
 */
export function selectNextItem(input: SelectNextItemInput): SelectNextItemDecision {
  const dueItems = input.dueItems ?? [];
  const weakItems = input.weakItems ?? [];
  const candidatesNew = input.candidatesNew ?? [];

  // ---- Modo Simulacro: solo SM-2, sin nuevo material ----
  if (input.mode === 'simulacro') {
    if (dueItems.length > 0) {
      const top = pickMostOverdue(dueItems);
      return { priority: 1, reason: 'sm2_overdue', conceptId: top.conceptId };
    }
    // Sin dues: NO entregamos nuevo material, caemos a profundización.
    // El caller (app layer) decide qué concepto profundizar.
    return { priority: 4, reason: 'deepening', conceptId: null };
  }

  // ---- Modo Explorador: no fuerza SM-2; defer a app layer ----
  if (input.mode === 'explorer') {
    if (candidatesNew.length > 0) {
      return {
        priority: 3,
        reason: 'new_material',
        conceptId: candidatesNew[0]!.conceptId,
      };
    }
    return { priority: 4, reason: 'no_candidate', conceptId: null };
  }

  // ---- Modos socratic / architect: prioridades estándar ----
  // 1. SM-2 overdue.
  if (dueItems.length > 0) {
    const top = pickMostOverdue(dueItems);
    return { priority: 1, reason: 'sm2_overdue', conceptId: top.conceptId };
  }

  // 2. Concepto débil.
  const weakCandidate = pickWeakest(weakItems);
  if (weakCandidate !== null) {
    return { priority: 2, reason: 'weak_concept', conceptId: weakCandidate.conceptId };
  }

  // 3. Item nuevo: solo si accuracy en window habilita.
  const accuracy = weightedAccuracy(input.accuracyWindow);
  if (candidatesNew.length > 0 && accuracy >= NEW_MATERIAL_GATE) {
    return {
      priority: 3,
      reason: 'new_material',
      conceptId: candidatesNew[0]!.conceptId,
    };
  }

  // 4. Profundización del concepto activo (default).
  return { priority: 4, reason: 'deepening', conceptId: null };
}

function pickMostOverdue(dueItems: ReadonlyArray<DueItem>): DueItem {
  let top = dueItems[0]!;
  for (const d of dueItems) {
    if (d.overdueDays > top.overdueDays) top = d;
  }
  return top;
}

function pickWeakest(weakItems: ReadonlyArray<WeakItem>): WeakItem | null {
  let top: WeakItem | null = null;
  for (const w of weakItems) {
    if (w.errorsInLast3 < WEAK_ERROR_THRESHOLD) continue;
    if (top === null || w.errorsInLast3 > top.errorsInLast3) top = w;
  }
  return top;
}
