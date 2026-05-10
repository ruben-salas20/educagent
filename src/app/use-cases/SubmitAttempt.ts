// src/app/use-cases/SubmitAttempt.ts
// Use case central: persiste un Attempt y actualiza el MasteryState del concepto
// asociado mediante el scheduler. Si el attempt tuvo error, genera FeedbackDecision
// vía P1.
//
// Reglas (principio §0.2 — Attempts inmutables, derivados se recalculan):
// - Attempt se persiste ANTES de cualquier otro side effect. Si falla, abort.
// - MasteryState se carga (o se inicializa con scheduler.initial() si no existe).
// - scheduler.next() computa el nuevo SchedulingState.
// - MasteryState completo se guarda con upsert.
// - Si attempt.errorType ≠ null, invocar decideFeedback (P1). Si null, feedbackDecision = null.

import type { Attempt } from '../../core/entities/Attempt.js';
import type {
  MasteryState,
  AccuracyWindowEntry,
  ScaffoldTrajectoryPoint,
  MasteryLabel,
} from '../../core/entities/MasteryState.js';
import type { ConfidenceTier } from '../../core/value-objects/ConfidenceTier.js';
import type { Outcome } from '../../core/value-objects/Outcome.js';
import type { Result } from '../../core/result/Result.js';
import { ok, err } from '../../core/result/Result.js';
import { decideFeedback } from '../../policies/p1-feedback.js';
import type { FeedbackDecision } from '../../policies/p1-feedback.js';
import type { IAttemptRepository } from '../../ports/persistence/IAttemptRepository.js';
import type { IMasteryStateRepository } from '../../ports/persistence/IMasteryStateRepository.js';
import type { IScheduler } from '../../ports/inference/IScheduler.js';
import type { IClock } from '../../ports/infra/IClock.js';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export interface SubmitAttemptInput {
  /** Attempt ya construido por el caller — con ID, timestamps, outcome, etc. */
  readonly attempt: Attempt;
  /** Nombre del concepto en juego (para FeedbackDecision en P1) */
  readonly conceptName: string;
  /** Tier de la fuente activa (RAG primary, web secondary, LLM tertiary) */
  readonly sourceTier: ConfidenceTier;
  /** Cita opcional inyectada cuando hay RAG con página/sección */
  readonly ragCitation?: {
    readonly source: string;
    readonly page: number;
  };
}

export type SubmitAttemptError =
  | { kind: 'attempt_persist_failed'; cause: string }
  | { kind: 'mastery_load_failed'; cause: string }
  | { kind: 'scheduler_failed'; cause: string }
  | { kind: 'mastery_persist_failed'; cause: string };

export interface SubmitAttemptOutcome {
  /** Attempt persisted con success */
  readonly attempt: Attempt;
  /** Nuevo MasteryState computado tras aplicar el scheduler */
  readonly masteryStateUpdated: MasteryState;
  /** Decision de feedback que el agente debe emitir al usuario.
   *  Null si el outcome fue 'correct' sin errorType (no hay feedback que dar). */
  readonly feedbackDecision: FeedbackDecision | null;
}

export interface SubmitAttemptDependencies {
  readonly attempts: IAttemptRepository;
  readonly masteryStates: IMasteryStateRepository;
  readonly scheduler: IScheduler;
  readonly clock: IClock;
}

// ---------------------------------------------------------------------------
// Constantes de heurística (MVP)
// ---------------------------------------------------------------------------

const ACCURACY_WINDOW_MAX = 10;
const SCAFFOLD_TRAJECTORY_MAX = 20;
const MASTERED_THRESHOLD = 0.85;
const LEARNING_MIN_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

/**
 * Outcomes "evaluativos" — los que cuentan como evidencia de mastery. Los
 * outcomes 'skipped' y 'gave_up' NO se agregan a la accuracy window.
 */
function isEvaluativeOutcome(
  outcome: Outcome,
): outcome is 'correct' | 'partial' | 'incorrect' {
  return outcome === 'correct' || outcome === 'partial' || outcome === 'incorrect';
}

function appendAccuracy(
  window: ReadonlyArray<AccuracyWindowEntry>,
  attempt: Attempt,
): ReadonlyArray<AccuracyWindowEntry> {
  if (!isEvaluativeOutcome(attempt.outcome)) return window;
  const entry: AccuracyWindowEntry = {
    outcome: attempt.outcome,
    weight: 1.0,
    at: attempt.submittedAt,
  };
  const next = [...window, entry];
  return next.length > ACCURACY_WINDOW_MAX
    ? next.slice(next.length - ACCURACY_WINDOW_MAX)
    : next;
}

function appendScaffold(
  trajectory: ReadonlyArray<ScaffoldTrajectoryPoint>,
  attempt: Attempt,
  now: Date,
): ReadonlyArray<ScaffoldTrajectoryPoint> {
  const point: ScaffoldTrajectoryPoint = {
    at: now.toISOString(),
    avgLevel: attempt.scaffoldLevelReached,
  };
  const next = [...trajectory, point];
  return next.length > SCAFFOLD_TRAJECTORY_MAX
    ? next.slice(next.length - SCAFFOLD_TRAJECTORY_MAX)
    : next;
}

/**
 * Heurística simple MVP para mastery_label:
 *   - 0 attempts → 'not_started'
 *   - < 3 attempts evaluativos → 'learning'
 *   - >= 3 y accuracy media >= 0.85 → 'mastered'
 *   - >= 3 y accuracy media < 0.85 → 'practicing'
 * (decay y 'needs_review' quedan para post-MVP)
 */
function computeMasteryLabel(
  window: ReadonlyArray<AccuracyWindowEntry>,
): MasteryLabel {
  if (window.length === 0) return 'not_started';
  if (window.length < LEARNING_MIN_ATTEMPTS) return 'learning';
  const accuracy = weightedAccuracy(window);
  return accuracy >= MASTERED_THRESHOLD ? 'mastered' : 'practicing';
}

function weightedAccuracy(window: ReadonlyArray<AccuracyWindowEntry>): number {
  if (window.length === 0) return 0;
  let sum = 0;
  let totalWeight = 0;
  for (const e of window) {
    const value = e.outcome === 'correct' ? 1 : e.outcome === 'partial' ? 0.5 : 0;
    sum += value * e.weight;
    totalWeight += e.weight;
  }
  return totalWeight === 0 ? 0 : sum / totalWeight;
}

function initialMasteryState(
  conceptId: string,
  scheduler: IScheduler,
  now: Date,
): MasteryState {
  return {
    conceptId,
    schedulingState: scheduler.initial(),
    accuracyWindow: [],
    scaffoldTrajectory: [],
    bloomCoverage: [],
    confidenceInterval: 0,
    masteryLabel: 'not_started',
    lastReviewAt: null,
    updatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

/**
 * Use case central: persiste un Attempt y actualiza el MasteryState del concepto
 * asociado mediante el scheduler. Si el attempt tuvo error, genera FeedbackDecision
 * vía P1.
 */
export async function submitAttempt(
  input: SubmitAttemptInput,
  deps: SubmitAttemptDependencies,
): Promise<Result<SubmitAttemptOutcome, SubmitAttemptError>> {
  const { attempt } = input;

  // 1. Persistir Attempt PRIMERO (regla de oro: inmutables, no retroceden).
  const saveAttempt = await deps.attempts.save(attempt);
  if (!saveAttempt.ok) {
    return err({
      kind: 'attempt_persist_failed',
      cause: JSON.stringify(saveAttempt.error),
    });
  }

  // 2. Resolver conceptId.
  // TODO: replace with item→concept lookup when item repository exists.
  // Por ahora, asumimos que itemId mapea 1:1 con conceptId.
  const conceptId = attempt.itemId;
  const now = deps.clock.now();

  // 3. Cargar MasteryState (o inicializar si no existe).
  const loaded = await deps.masteryStates.findByConceptId(conceptId);
  let currentState: MasteryState;
  if (loaded.ok) {
    currentState = loaded.value;
  } else if (loaded.error.kind === 'not_found') {
    currentState = initialMasteryState(conceptId, deps.scheduler, now);
  } else {
    return err({
      kind: 'mastery_load_failed',
      cause: JSON.stringify(loaded.error),
    });
  }

  // 4. Aplicar scheduler.next().
  const nextScheduling = deps.scheduler.next(
    currentState.schedulingState,
    {
      outcome: attempt.outcome,
      submittedAt: attempt.submittedAt,
      scaffoldLevelReached: attempt.scaffoldLevelReached,
    },
    now,
  );
  if (!nextScheduling.ok) {
    return err({
      kind: 'scheduler_failed',
      cause: JSON.stringify(nextScheduling.error),
    });
  }

  // 5. Recomputar campos derivados (heurística simple MVP).
  const newAccuracyWindow = appendAccuracy(currentState.accuracyWindow, attempt);
  const newScaffoldTrajectory = appendScaffold(
    currentState.scaffoldTrajectory,
    attempt,
    now,
  );
  const newMasteryLabel = computeMasteryLabel(newAccuracyWindow);

  const updatedState: MasteryState = {
    ...currentState,
    schedulingState: nextScheduling.value,
    accuracyWindow: newAccuracyWindow,
    scaffoldTrajectory: newScaffoldTrajectory,
    masteryLabel: newMasteryLabel,
    lastReviewAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // 6. Persistir MasteryState (upsert).
  const saveState = await deps.masteryStates.save(updatedState);
  if (!saveState.ok) {
    return err({
      kind: 'mastery_persist_failed',
      cause: JSON.stringify(saveState.error),
    });
  }

  // 7. Generar FeedbackDecision si hay errorType.
  let feedbackDecision: FeedbackDecision | null = null;
  if (attempt.errorType !== null) {
    feedbackDecision = decideFeedback({
      mode: attempt.mode,
      errorType: attempt.errorType,
      attemptText: attempt.responseText,
      conceptName: input.conceptName,
      sourceTier: input.sourceTier,
      ragCitation: input.ragCitation,
    });
  }

  return ok({
    attempt,
    masteryStateUpdated: updatedState,
    feedbackDecision,
  });
}
