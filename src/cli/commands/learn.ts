// src/cli/commands/learn.ts
// Comando `educagent learn` — walking skeleton MVP one-shot.
//
// Flow:
//   1. Factory selector: EDUCAGENT_LLM_PROVIDER (default: ollama).
//      - 'ollama' → OllamaLLMProvider (local, no requiere API key).
//      - 'anthropic' → AnthropicLLMProvider (requiere ANTHROPIC_API_KEY).
//   2. Bootstrappear container con el LLM inyectado.
//   3. Seed mínimo idempotente (project/concept/item/session) para FKs.
//   4. Render LearnFlow → usuario responde la pregunta hardcoded.
//   5. analyzeAttempt() invoca al LLM para clasificar outcome + errorType.
//   6. submitAttempt() persiste Attempt + actualiza MasteryState + P1 feedback.
//   7. Render del feedbackDecision (o "Registrado." si no hay).

import React from 'react';
import { render } from 'ink';
import { TomlConfigStore } from '../../adapters/infra/TomlConfigStore.js';
import { AnthropicLLMProvider } from '../../adapters/llm/AnthropicLLMProvider.js';
import { OllamaLLMProvider } from '../../adapters/llm/OllamaLLMProvider.js';
import { bootstrap } from '../../app/bootstrap.js';
import { analyzeAttempt } from '../../app/use-cases/AnalyzeAttempt.js';
import { submitAttempt } from '../../app/use-cases/SubmitAttempt.js';
import { LearnFlow, type LearnFlowSubmitResult } from '../components/LearnFlow.js';
import type { AppContainer } from '../../app/composition-root.js';
import type { Attempt } from '../../core/entities/Attempt.js';
import type { ILLMProvider } from '../../ports/llm/ILLMProvider.js';

// IDs hardcoded para el seed mínimo del MVP.
const SEED_PROJECT_ID = 'prj_default';
const SEED_CONCEPT_ID = 'concept_variable';
const SEED_ITEM_ID = SEED_CONCEPT_ID;
const SEED_SESSION_ID = 'sess_mvp_default';

const SEED_ITEM_PROMPT =
  '¿Qué es una variable en programación? Definila con tus palabras.';
const SEED_CONCEPT_NAME = 'Variable en programación';
const ASSUMED_LATENCY_MS = 30_000;

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
const DEFAULT_OLLAMA_MODEL = 'gemma4:latest';
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

type ProviderBuildResult =
  | { ok: true; provider: ILLMProvider }
  | { ok: false; error: string };

/**
 * Factory selector. Lee env vars y devuelve el LLMProvider configurado.
 * Default: Ollama (local-first, sin API key requerida).
 */
function buildLLMProvider(): ProviderBuildResult {
  const choice = (process.env.EDUCAGENT_LLM_PROVIDER ?? 'ollama').toLowerCase();

  if (choice === 'ollama') {
    const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
    const baseUrl = process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;
    return {
      ok: true,
      provider: new OllamaLLMProvider({ model, baseUrl }),
    };
  }

  if (choice === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return {
        ok: false,
        error: [
          'EDUCAGENT_LLM_PROVIDER=anthropic pero no se encontró ANTHROPIC_API_KEY.',
          '',
          'Configurala así:',
          '  PowerShell:  $env:ANTHROPIC_API_KEY = "tu-key"',
          '  Bash:        export ANTHROPIC_API_KEY="tu-key"',
          '',
          `Modelo opcional via ANTHROPIC_MODEL (default: ${DEFAULT_ANTHROPIC_MODEL}).`,
        ].join('\n'),
      };
    }
    const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    return {
      ok: true,
      provider: new AnthropicLLMProvider({ apiKey, model }),
    };
  }

  return {
    ok: false,
    error: `EDUCAGENT_LLM_PROVIDER='${choice}' no es válido. Opciones: ollama, anthropic.`,
  };
}

/**
 * Entry point del comando `educagent learn`.
 * @returns exit code (0 ok, 1 fallo de bootstrap o configuración inválida)
 */
export async function runLearn(): Promise<number> {
  // 1. Factory: armar el LLMProvider según env vars.
  const providerResult = buildLLMProvider();
  if (!providerResult.ok) {
    console.error('Error:', providerResult.error);
    return 1;
  }
  const llm = providerResult.provider;

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
    if (!container.llm) {
      return { ok: false, error: 'LLM no disponible.' };
    }

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
      errorType,
      preConfidence: null,
      postConfidence: null,
      retryCount: 0,
      affectiveSnapshot: {},
    };

    const result = await submitAttempt(
      {
        attempt,
        conceptName: SEED_CONCEPT_NAME,
        sourceTier: 'tertiary',
      },
      container,
    );

    if (!result.ok) {
      return { ok: false, error: JSON.stringify(result.error) };
    }

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
