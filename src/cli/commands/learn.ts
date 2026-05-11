// src/cli/commands/learn.ts
// Comando `educagent learn` — walking skeleton MVP one-shot.
//
// Flow:
//   1. Leer ANTHROPIC_API_KEY del env (BYOK). Sin key, abort con hint claro —
//      el espíritu del producto es "agente que entiende", NO heurísticas placebo.
//   2. Construir AnthropicLLMProvider y bootstrappear container con el LLM.
//   3. Seed mínimo idempotente (project/concept/item/session) para satisfacer FKs.
//   4. Render LearnFlow → usuario responde la pregunta hardcoded.
//   5. analyzeAttempt() invoca al LLM para clasificar outcome + errorType.
//   6. submitAttempt() persiste el Attempt + actualiza MasteryState + P1 feedback.
//   7. Render del feedbackDecision (o "Registrado." si no hay).
//
// TODO loop: hoy es ONE-SHOT. El learn real va a tener loop con SelectNextItem,
// múltiples concepts, manejo de fatigue, off-ramps, etc.

import React from 'react';
import { render } from 'ink';
import { TomlConfigStore } from '../../adapters/infra/TomlConfigStore.js';
import { AnthropicLLMProvider } from '../../adapters/llm/AnthropicLLMProvider.js';
import { bootstrap } from '../../app/bootstrap.js';
import { analyzeAttempt } from '../../app/use-cases/AnalyzeAttempt.js';
import { submitAttempt } from '../../app/use-cases/SubmitAttempt.js';
import { LearnFlow, type LearnFlowSubmitResult } from '../components/LearnFlow.js';
import type { AppContainer } from '../../app/composition-root.js';
import type { Attempt } from '../../core/entities/Attempt.js';

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

// Default fijo a un modelo dated (estable, no se mueve solo). El usuario puede
// override con ANTHROPIC_MODEL si quiere experimentar con otro alias/versión.
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

/**
 * Entry point del comando `educagent learn`.
 * @returns exit code (0 ok, 1 fallo de bootstrap o falta de API key)
 */
export async function runLearn(): Promise<number> {
  // 1. BYOK: leer API key del environment. Sin key, no arrancamos.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('Error: no se encontró ANTHROPIC_API_KEY en el environment.');
    console.error('');
    console.error('EducAgent es BYOK (Bring Your Own Key): necesitás tu propia');
    console.error('clave de Anthropic para que el agente analice tus respuestas.');
    console.error('');
    console.error('Configurala así:');
    console.error('  PowerShell:  $env:ANTHROPIC_API_KEY = "tu-key"');
    console.error('  Bash:        export ANTHROPIC_API_KEY="tu-key"');
    console.error('');
    console.error('Para que persista, agregala a tu PowerShell profile / .bashrc.');
    console.error('');
    console.error('Modelo opcional via ANTHROPIC_MODEL (default: ' + DEFAULT_MODEL + ').');
    return 1;
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const llm = new AnthropicLLMProvider({ apiKey, model });

  // 2. Bootstrap del container con el LLM inyectado.
  const store = new TomlConfigStore();
  const bootResult = await bootstrap(store, { llm });

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

  const handleSubmit = async (
    responseText: string,
  ): Promise<LearnFlowSubmitResult> => {
    // Defensa: en runLearn siempre inyectamos un LLM, pero el container.llm
    // puede ser null si alguien llama buildContainer sin pasarlo. Mantenemos
    // el check explícito para que el contrato sea claro.
    if (!container.llm) {
      return { ok: false, error: 'LLM no disponible.' };
    }

    // 3. Analyze: el LLM clasifica outcome + errorType.
    const analysis = await analyzeAttempt(
      {
        itemPrompt: SEED_ITEM_PROMPT,
        responseText,
        mode: 'socratic',
        conceptName: SEED_CONCEPT_NAME,
      },
      { llm: container.llm },
    );

    if (!analysis.ok) {
      return {
        ok: false,
        error: `Análisis fallido: ${analysis.error.kind}`,
      };
    }

    const { outcome, errorType } = analysis.value;

    // 4. Submit: persistir Attempt + actualizar MasteryState + decidir feedback.
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
      outcome, // ← LLM-detected
      scaffoldLevelReached: 0,
      scaffoldRequestedBy: null,
      errorType, // ← LLM-detected
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
    const feedbackText = result.value.feedbackDecision?.text ?? 'Registrado.';
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
