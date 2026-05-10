// src/core/entities/MasteryState.ts
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE mastery_states".
//
// Importa SchedulingState desde core/value-objects/ (no desde ports/) para respetar
// la regla de boundaries: core → core únicamente.

import type { Bloom } from '../value-objects/Bloom.js';
import type { SchedulingState } from '../value-objects/SchedulingState.js';

export type MasteryLabel =
  | 'not_started'
  | 'learning'
  | 'practicing'
  | 'mastered'
  | 'mastered_decaying'
  | 'needs_review';

export interface AccuracyWindowEntry {
  readonly outcome: 'correct' | 'partial' | 'incorrect';
  readonly weight: number;
  readonly at: string; // ISO 8601 UTC
}

export interface ScaffoldTrajectoryPoint {
  readonly at: string; // ISO 8601 UTC
  readonly avgLevel: number;
}

export interface MasteryState {
  readonly conceptId: string;
  readonly schedulingState: SchedulingState;
  readonly accuracyWindow: ReadonlyArray<AccuracyWindowEntry>;
  readonly scaffoldTrajectory: ReadonlyArray<ScaffoldTrajectoryPoint>;
  readonly bloomCoverage: ReadonlyArray<Bloom>;
  readonly confidenceInterval: number; // 0..1
  readonly masteryLabel: MasteryLabel;
  readonly lastReviewAt: string | null;
  readonly updatedAt: string; // ISO 8601 UTC
}
