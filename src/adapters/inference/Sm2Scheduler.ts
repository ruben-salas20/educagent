// src/adapters/inference/Sm2Scheduler.ts
// Implementación SM-2 clásica (Wozniak 1990) + piso EF=1.3 (ADR-0002 mitigación ease hell).
//
// Algoritmo:
//   q = outcomeToQualityFactor(outcome, scaffold_level_reached)
//   if q < 3:
//     repetitions = 0
//     intervalDays = 1
//     easeFactor = sin cambio (SM-2 puro)
//   else:
//     if repetitions == 0: intervalDays = 1
//     elif repetitions == 1: intervalDays = 6
//     else: intervalDays = round(intervalDays * easeFactor)
//     repetitions += 1
//     easeFactor = max(1.3, easeFactor + (0.1 - (5-q)*(0.08 + (5-q)*0.02)))
//   nextDueAt = now + intervalDays * 1 día

import type {
  IScheduler,
  ICalibrableScheduler,
  SchedulingState,
  SchedulerError,
  SchedulingParams,
  CalibrationError,
} from '../../ports/inference/IScheduler.js';
import type { Attempt } from '../../core/entities/Attempt.js';
import type { Result } from '../../core/result/Result.js';
import { ok, err } from '../../core/result/Result.js';
import { outcomeToQualityFactor } from '../../core/value-objects/QualityFactor.js';

interface Sm2Raw extends Record<string, number | string> {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

const SM2_PARAMS_HASH = 'sm2-default-v1';
const EF_FLOOR = 1.3;
const INITIAL_EF = 2.5;
const MS_PER_DAY = 86_400_000;

export class Sm2Scheduler implements ICalibrableScheduler {
  initial(): SchedulingState {
    return {
      algorithm: 'sm2',
      version: 1,
      paramsHash: SM2_PARAMS_HASH,
      raw: { easeFactor: INITIAL_EF, intervalDays: 0, repetitions: 0 } satisfies Sm2Raw,
      nextDueAt: null,
    };
  }

  next(
    state: SchedulingState,
    attempt: Pick<Attempt, 'outcome' | 'submittedAt' | 'scaffoldLevelReached'>,
    now: Date,
  ): Result<SchedulingState, SchedulerError> {
    if (state.algorithm !== 'sm2') {
      return err({ kind: 'algorithm_mismatch', expected: 'sm2', got: state.algorithm });
    }
    const raw = state.raw as unknown as Sm2Raw;
    const q = outcomeToQualityFactor(attempt.outcome, attempt.scaffoldLevelReached);

    let newRepetitions: number;
    let newIntervalDays: number;
    let newEaseFactor: number;

    if (q < 3) {
      // Respuesta mala: reset de progreso, intervalo "ver mañana".
      // SM-2 PURO: ease_factor NO cambia en q<3.
      newRepetitions = 0;
      newIntervalDays = 1;
      newEaseFactor = raw.easeFactor;
    } else {
      if (raw.repetitions === 0) {
        newIntervalDays = 1;
      } else if (raw.repetitions === 1) {
        newIntervalDays = 6;
      } else {
        newIntervalDays = Math.round(raw.intervalDays * raw.easeFactor);
      }
      newRepetitions = raw.repetitions + 1;
      const efDelta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
      // Piso EF=1.3 (ADR-0002, mitigación "ease hell").
      newEaseFactor = Math.max(EF_FLOOR, raw.easeFactor + efDelta);
    }

    const nextDueAt = new Date(now.getTime() + newIntervalDays * MS_PER_DAY).toISOString();

    return ok({
      algorithm: 'sm2',
      version: 1,
      paramsHash: SM2_PARAMS_HASH,
      raw: {
        easeFactor: newEaseFactor,
        intervalDays: newIntervalDays,
        repetitions: newRepetitions,
      } satisfies Sm2Raw,
      nextDueAt,
    });
  }

  isDue(state: SchedulingState, now: Date): boolean {
    return state.nextDueAt !== null && new Date(state.nextDueAt).getTime() <= now.getTime();
  }

  serialize(state: SchedulingState): string {
    return JSON.stringify(state);
  }

  deserialize(serialized: string): Result<SchedulingState, SchedulerError> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch (e) {
      return err({
        kind: 'invalid_state',
        reason: e instanceof Error ? e.message : 'parse error',
      });
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('algorithm' in parsed) ||
      !('raw' in parsed)
    ) {
      return err({ kind: 'invalid_state', reason: 'missing required fields' });
    }
    const candidate = parsed as SchedulingState;
    if (candidate.algorithm !== 'sm2') {
      return err({
        kind: 'algorithm_mismatch',
        expected: 'sm2',
        got: candidate.algorithm,
      });
    }
    return ok(candidate);
  }

  // ICalibrableScheduler — SM-2 no calibra.
  async calibrate(
    _attempts: ReadonlyArray<Attempt>,
  ): Promise<Result<SchedulingParams, CalibrationError>> {
    return err({ kind: 'algorithm_not_calibrable' });
  }

  withParams(_params: SchedulingParams): IScheduler {
    // SM-2 no usa params dinámicos: la misma instancia es idempotente.
    return this;
  }
}
