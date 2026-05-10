// src/adapters/persistence/sqlite/mappers/AttemptMapper.ts
// Mapper row ↔ entity para Attempt.
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE attempts".

import type { Attempt, ErrorType } from '../../../../core/entities/Attempt.js';
import type { Mode } from '../../../../core/value-objects/Mode.js';
import type { Outcome } from '../../../../core/value-objects/Outcome.js';

/**
 * Row schema de la tabla `attempts` tal como viene de better-sqlite3.
 * Campos JSON-as-TEXT vienen como string crudo.
 */
export interface AttemptRow {
  id: string;
  project_id: string;
  session_id: string;
  item_id: string;
  mode: string;
  started_at: string;
  submitted_at: string;
  latency_ms: number;
  response_text: string;
  outcome: string;
  scaffold_level_reached: number;
  scaffold_requested_by: string | null;
  error_type: string | null;
  pre_confidence: number | null;
  post_confidence: number | null;
  retry_count: number;
  affective_snapshot_json: string;
}

export function rowToAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    itemId: row.item_id,
    mode: row.mode as Mode,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    latencyMs: row.latency_ms,
    responseText: row.response_text,
    outcome: row.outcome as Outcome,
    scaffoldLevelReached: row.scaffold_level_reached,
    scaffoldRequestedBy: row.scaffold_requested_by as 'user' | 'agent_offered' | null,
    errorType: row.error_type as ErrorType | null,
    preConfidence: row.pre_confidence,
    postConfidence: row.post_confidence,
    retryCount: row.retry_count,
    affectiveSnapshot: JSON.parse(row.affective_snapshot_json) as Readonly<
      Record<string, unknown>
    >,
  };
}

export function attemptToRow(a: Attempt): AttemptRow {
  return {
    id: a.id,
    project_id: a.projectId,
    session_id: a.sessionId,
    item_id: a.itemId,
    mode: a.mode,
    started_at: a.startedAt,
    submitted_at: a.submittedAt,
    latency_ms: a.latencyMs,
    response_text: a.responseText,
    outcome: a.outcome,
    scaffold_level_reached: a.scaffoldLevelReached,
    scaffold_requested_by: a.scaffoldRequestedBy,
    error_type: a.errorType,
    pre_confidence: a.preConfidence,
    post_confidence: a.postConfidence,
    retry_count: a.retryCount,
    affective_snapshot_json: JSON.stringify(a.affectiveSnapshot),
  };
}
