// src/ports/inference/IScheduler.ts
// IScheduler — SM-2 con migración futura a FSRS.
// Ver docs/architecture/03-interfaces.md §IScheduler.
//
// Los tipos de estado (SchedulingState, SchedulerError, etc.) viven en core/
// porque MasteryState los necesita y core no puede importar de ports.
// Acá los re-exportamos para que adapters y app no tengan que conocer esa decisión.

import type { Result } from '../../core/result/Result.js';
import type { Attempt } from '../../core/entities/Attempt.js';
import type {
  SchedulingState,
  SchedulerError,
  SchedulingParams,
  CalibrationError,
} from '../../core/value-objects/SchedulingState.js';

export type {
  SchedulingState,
  SchedulerError,
  SchedulingParams,
  CalibrationError,
} from '../../core/value-objects/SchedulingState.js';

/**
 * Contrato:
 *  - `next` es DETERMINÍSTICO: mismo (state, attempt, now) => mismo resultado.
 *  - NO side effects, NO I/O.
 *  - El scheduler es agnóstico al MasteryEstimator: solo procesa outcome.
 *  - `serialize/deserialize` deben ser inversas estrictas.
 */
export interface IScheduler {
  initial(): SchedulingState;

  next(
    state: SchedulingState,
    attempt: Pick<Attempt, 'outcome' | 'submittedAt' | 'scaffoldLevelReached'>,
    now: Date,
  ): Result<SchedulingState, SchedulerError>;

  isDue(state: SchedulingState, now: Date): boolean;

  serialize(state: SchedulingState): string;
  deserialize(serialized: string): Result<SchedulingState, SchedulerError>;
}

/**
 * Contrato:
 *  - Schedulers calibrables (FSRS) implementan esta extensión.
 *  - SM-2 puede implementarla retornando `{ kind: 'algorithm_not_calibrable' }` en `calibrate`.
 *  - Declaramos esta interfaz desde el MVP para evitar breaking change cuando llegue FSRS (Mes 5).
 */
export interface ICalibrableScheduler extends IScheduler {
  /**
   * Re-calibra parámetros del scheduler con un dataset de attempts del usuario.
   * SM-2 retorna `algorithm_not_calibrable`; FSRS optimiza weights.
   */
  calibrate(
    attempts: ReadonlyArray<Attempt>,
  ): Promise<Result<SchedulingParams, CalibrationError>>;

  /**
   * Retorna una nueva instancia del scheduler con los params dados.
   * Uso típico: tras `calibrate()`, usar el resultado para crear el nuevo scheduler.
   */
  withParams(params: SchedulingParams): IScheduler;
}
