// src/core/value-objects/QualityFactor.ts
// Mapping outcome + scaffold_level_reached → SM-2 quality factor q ∈ [0..5].
// Definido en ADR-0002 §Decision (Rating del Attempt).
//
// Vive en core/ (no en policies/) porque tanto el adapter Sm2Scheduler como
// la policy p7-calibration lo consumen, y eslint-plugin-boundaries prohíbe
// que adapters/ importe desde policies/.

import type { Outcome } from './Outcome.js';

export type QualityFactor = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Mapea outcome + scaffold_level a quality factor SM-2 q∈[0..5].
 *
 * | outcome      | scaffold_level | q                                    |
 * | correct      | 0              | 5                                    |
 * | correct      | 1-4            | 4 - scaffold_level (clamp 1..4)      |
 * | partial      | cualquiera     | 3                                    |
 * | incorrect    | cualquiera     | 2                                    |
 * | skipped      | cualquiera     | 1                                    |
 * | gave_up      | cualquiera     | 0                                    |
 *
 * El schema garantiza scaffold_level_reached ∈ [0..5] vía CHECK constraint;
 * acá clampeamos defensivamente para no romper invariantes si llega un valor
 * fuera de rango por bug aguas arriba.
 */
export function outcomeToQualityFactor(
  outcome: Outcome,
  scaffoldLevelReached: number,
): QualityFactor {
  switch (outcome) {
    case 'correct': {
      if (scaffoldLevelReached <= 0) return 5;
      // 4 - scaffold_level, clampeado a [1..4].
      const candidate = 4 - scaffoldLevelReached;
      if (candidate < 1) return 1;
      if (candidate > 4) return 4;
      return candidate as QualityFactor;
    }
    case 'partial':
      return 3;
    case 'incorrect':
      return 2;
    case 'skipped':
      return 1;
    case 'gave_up':
      return 0;
  }
}
