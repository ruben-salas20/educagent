// src/cli/commands/learn.ts
// Comando `educagent learn` — walking skeleton MVP one-shot.
//
// Flow:
//   1. Bootstrap (config + container).
//   2. Seed mínimo idempotente (project/concept/item/session) para satisfacer FKs.
//   3. Render LearnFlow → usuario responde la pregunta hardcoded.
//   4. submitAttempt() persiste el Attempt + actualiza MasteryState.
//   5. Render del feedbackDecision (o "Bien hecho." si no hay).
//
// TODO LLM: outcome y errorType se deciden hoy por heurística trivial
// (texto vacío → skipped, texto cualquiera → correct). Cuando llegue el adapter
// de LLM, esta heurística se reemplaza por detección semántica real.
//
// TODO loop: hoy es ONE-SHOT. El learn real va a tener loop con SelectNextItem,
// múltiples concepts, manejo de fatigue, off-ramps, etc.

import React from 'react';
import { render } from 'ink';
import { TomlConfigStore } from '../../adapters/infra/TomlConfigStore.js';
import { bootstrap } from '../../app/bootstrap.js';
import { submitAttempt } from '../../app/use-cases/SubmitAttempt.js';
import { LearnFlow, type LearnFlowSubmitResult } from '../components/LearnFlow.js';
import type { AppContainer } from '../../app/composition-root.js';
import type { Attempt } from '../../core/entities/Attempt.js';
import type { Outcome } from '../../core/value-objects/Outcome.js';

// IDs hardcoded para el seed mínimo del MVP. Cuando agreguemos repos de Project/
// Concept/Item/Session, este seed va a estar en su use case propio
// (ej: IngestKnowledgeSource o CreateProject).
const SEED_PROJECT_ID = 'prj_default';
const SEED_CONCEPT_ID = 'concept_variable';
// IMPORTANTE: item.id === concept.id. SubmitAttempt asume itemId === conceptId
// (ver TODO en SubmitAttempt.ts L198-200) hasta que exista item→concept lookup.
const SEED_ITEM_ID = SEED_CONCEPT_ID;
const SEED_SESSION_ID = 'sess_mvp_default';

const SEED_ITEM_PROMPT =
  '¿Qué es una variable en programación? Definila con tus palabras.';
const SEED_CONCEPT_NAME = 'Variable en programación';
const ASSUMED_LATENCY_MS = 30_000;

/**
 * Entry point del comando `educagent learn`.
 * @returns exit code (0 ok, 1 fallo de bootstrap)
 */
export async function runLearn(): Promise<number> {
  const store = new TomlConfigStore();
  const bootResult = await bootstrap(store);

  if (!bootResult.ok) {
    if (bootResult.error.kind === 'config_missing') {
      console.error(bootResult.error.hint);
      return 1;
    }
    console.error('Error al arrancar:', JSON.stringify(bootResult.error));
    return 1;
  }

  const container = bootResult.value;
  ensureSeed(container);

  const handleSubmit = async (responseText: string): Promise<LearnFlowSubmitResult> => {
    // TODO LLM: outcome y errorType deberían ser detectados por el LLM, no heurística.
    const outcome: Outcome = responseText.trim().length === 0 ? 'skipped' : 'correct';
    const now = Date.now();
    const attempt: Attempt = {
      id: `att_${now}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: SEED_PROJECT_ID,
      sessionId: SEED_SESSION_ID,
      itemId: SEED_ITEM_ID,
      mode: 'socratic',
      startedAt: new Date(now - ASSUMED_LATENCY_MS).toISOString(),
      submittedAt: new Date(now).toISOString(),
      latencyMs: ASSUMED_LATENCY_MS,
      responseText,
      outcome,
      scaffoldLevelReached: 0,
      scaffoldRequestedBy: null,
      errorType: null, // TODO LLM: detectar errorType
      preConfidence: null,
      postConfidence: null,
      retryCount: 0,
      affectiveSnapshot: {},
    };

    const result = await submitAttempt(
      {
        attempt,
        conceptName: SEED_CONCEPT_NAME,
        sourceTier: 'tertiary', // sin RAG activo todavía
      },
      container,
    );

    if (!result.ok) {
      return { ok: false, error: JSON.stringify(result.error) };
    }

    // feedbackDecision === null cuando no hay errorType → caso 'correct' sin feedback.
    const feedbackText = result.value.feedbackDecision?.text ?? 'Bien hecho.';
    return { ok: true, feedbackText };
  };

  try {
    const { waitUntilExit } = render(
      React.createElement(LearnFlow, {
        promptText: SEED_ITEM_PROMPT,
        onSubmit: handleSubmit,
      }),
    );
    await waitUntilExit();
  } catch (e) {
    console.error('learn finalizó con error:', e instanceof Error ? e.message : String(e));
    container.db.close();
    return 1;
  }

  container.db.close();
  return 0;
}

/**
 * Seed mínimo idempotente. Crea 1 project, 1 concept, 1 item y 1 session
 * hardcoded si no existen. Suficiente para que el FK de `attempts` no falle.
 *
 * INSERT OR IGNORE hace que re-correr `learn` sea barato y seguro.
 */
function ensureSeed(container: AppContainer): void {
  const now = new Date().toISOString();
  const insertProject = container.db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, created_at, last_active_at)
     VALUES (?, ?, ?, ?)`,
  );
  const insertConcept = container.db.prepare(
    `INSERT OR IGNORE INTO concepts (id, project_id, name, granularity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertItem = container.db.prepare(
    `INSERT OR IGNORE INTO items
       (id, project_id, prompt_text, origin, bloom_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSession = container.db.prepare(
    `INSERT OR IGNORE INTO sessions (id, project_id, started_at) VALUES (?, ?, ?)`,
  );

  insertProject.run(SEED_PROJECT_ID, 'Proyecto MVP', now, now);
  insertConcept.run(SEED_CONCEPT_ID, SEED_PROJECT_ID, SEED_CONCEPT_NAME, 'atomic', now);
  insertItem.run(
    SEED_ITEM_ID,
    SEED_PROJECT_ID,
    SEED_ITEM_PROMPT,
    'rag_curated',
    'recall',
    now,
    now,
  );
  insertSession.run(SEED_SESSION_ID, SEED_PROJECT_ID, now);
}
