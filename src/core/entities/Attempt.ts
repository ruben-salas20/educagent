// src/core/entities/Attempt.ts
// Attempt — value object INMUTABLE (D-S1: append-only).
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE attempts".
//
// outcome es 5-valued automático (D-S1): el agente lo deduce desde respuesta +
// scaffold_level_reached, NO se pide rating explícito al usuario.

import type { Mode } from '../value-objects/Mode.js';
import type { Outcome } from '../value-objects/Outcome.js';

/**
 * Taxonomía de error observada. Coincide con el CHECK constraint de attempts.error_type.
 */
export type ErrorType =
  | 'conceptual'
  | 'procedural'
  | 'notational'
  | 'careless'
  | 'off-topic'
  | 'partial-correct';

export interface Attempt {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string;
  readonly itemId: string;
  readonly mode: Mode;
  readonly startedAt: string; // ISO 8601 UTC
  readonly submittedAt: string; // ISO 8601 UTC
  readonly latencyMs: number; // >= 0 (CHECK)
  readonly responseText: string;
  readonly outcome: Outcome;
  readonly scaffoldLevelReached: number; // 0..5 (CHECK)
  readonly scaffoldRequestedBy: 'user' | 'agent_offered' | null;
  readonly errorType: ErrorType | null;
  readonly preConfidence: number | null; // 0..100
  readonly postConfidence: number | null; // 0..100
  readonly retryCount: number;
  readonly affectiveSnapshot: Readonly<Record<string, unknown>>;
}
