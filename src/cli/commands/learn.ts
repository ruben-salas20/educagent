// src/cli/commands/learn.ts
// Comando `educagent learn` — walking skeleton MVP one-shot.
//
// Flow:
//   1. Leer config.toml. Si no existe → hint a correr `educagent init`.
//   2. Factory selector: lee `llm.provider` + `llm.model` del config.
//      Env vars (OLLAMA_MODEL, ANTHROPIC_MODEL, OLLAMA_URL, EDUCAGENT_LLM_PROVIDER)
//      mantienen prioridad como override de power-user (documentadas en help).
//      Si provider='none' → hint a re-correr `educagent init` y exit 1.
//   3. Bootstrappear container con el LLM inyectado.
//   4. Seed mínimo idempotente (project/concept/item/session) para FKs.
//   5. Render LearnFlow → usuario responde la pregunta hardcoded.
//   6. analyzeAttempt() invoca al LLM para clasificar outcome + errorType.
//   7. submitAttempt() persiste Attempt + actualiza MasteryState + P1 feedback.
//   8. Render del feedbackDecision (o "Registrado." si no hay).

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
import type { UserConfig } from '../../ports/infra/IConfigStore.js';

// IDs hardcoded para el seed mínimo del MVP.
const SEED_PROJECT_ID = 'prj_default';
const SEED_CONCEPT_ID = 'concept_variable';
const SEED_ITEM_ID = SEED_CONCEPT_ID;
const SEED_SESSION_ID = 'sess_mvp_default';

const SEED_ITEM_PROMPT =
  '¿Qué es una variable en programación? Definila con tus palabras.';
const SEED_CONCEPT_NAME = 'Variable en programación';
const ASSUMED_LATENCY_MS = 30_000;

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

type ProviderBuildResult =
  | { ok: true; provider: ILLMProvider }
  | { ok: false; error: string };

/**
 * Factory selector basado en config + env overrides.
 *
 * Reglas:
 * - `EDUCAGENT_LLM_PROVIDER` env override > config.llm.provider.
 * - `OLLAMA_MODEL` env override > config.llm.model (cuando provider=ollama).
 * - `ANTHROPIC_MODEL` env override > config.llm.model (cuando provider=anthropic).
 * - `OLLAMA_URL` env override > config.llm.ollamaUrl > DEFAULT_OLLAMA_URL.
 * - `ANTHROPIC_API_KEY` SIEMPRE viene del env (NUNCA del config — decisión de seguridad).
 * - provider='none' → bloqueamos `learn` con hint a re-correr `init`.
 */
function buildLLMProvider(userConfig: UserConfig): ProviderBuildResult {
  const llmConfig = userConfig.llm;
  const providerOverride = process.env.EDUCAGENT_LLM_PROVIDER?.toLowerCase();
  const provider = providerOverride ?? llmConfig.provider;

  if (provider === 'none') {
    return {
      ok: false,
      error: [
        'Sin LLM configurado. EducAgent necesita un LLM para analizar tus respuestas.',
        '',
        'Corré `educagent init` y elegí Ollama (local) o Anthropic (remoto).',
      ].join('\n'),
    };
  }

  if (provider === 'ollama') {
    const model = process.env.OLLAMA_MODEL ?? llmConfig.model;
    if (!model || model.trim() === '') {
      return {
        ok: false,
        error: 'Provider Ollama configurado pero sin modelo. Corré `educagent init` de nuevo.',
      };
    }
    const baseUrl = process.env.OLLAMA_URL ?? llmConfig.ollamaUrl ?? DEFAULT_OLLAMA_URL;
    return {
      ok: true,
      provider: new OllamaLLMProvider({ model, baseUrl }),
    };
  }

  if (provider === 'anthropic') {
    const model = process.env.ANTHROPIC_MODEL ?? llmConfig.model;
    if (!model || model.trim() === '') {
      return {
        ok: false,
        error: 'Provider Anthropic configurado pero sin modelo. Corré `educagent init` de nuevo.',
      };
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      return {
        ok: false,
        error: [
          'Provider Anthropic configurado, pero no se encontró ANTHROPIC_API_KEY en el environment.',
          '',
          'Configurala así:',
          '  PowerShell:  $env:ANTHROPIC_API_KEY = "sk-ant-..."',
          '  Bash:        export ANTHROPIC_API_KEY="sk-ant-..."',
          '',
          'Por seguridad, las API keys SIEMPRE viven en el env, NUNCA en el config.toml.',
        ].join('\n'),
      };
    }
    return {
      ok: true,
      provider: new AnthropicLLMProvider({ apiKey, model }),
    };
  }

  return { ok: false, error: `Provider desconocido en config: '${provider}'.` };
}

/**
 * Entry point del comando `educagent learn`.
 * @returns exit code (0 ok, 1 fallo de bootstrap o configuración inválida)
 */
export async function runLearn(): Promise<number> {
  // 1. Leer config — necesitamos saber qué provider eligió el usuario.
  const store = new TomlConfigStore();
  const configResult = await store.read();
  if (!configResult.ok) {
    if (configResult.error.kind === 'not_found') {
      console.error('No se encontró el config de EducAgent.');
      console.error('Corré `educagent init` primero para configurar tu instalación.');
      return 1;
    }
    console.error('Error al leer el config:', JSON.stringify(configResult.error));
    return 1;
  }
  const userConfig = configResult.value;

  // 2. Factory: armar el LLMProvider según config + env overrides.
  const providerResult = buildLLMProvider(userConfig);
  if (!providerResult.ok) {
    console.error('Error:', providerResult.error);
    return 1;
  }
  const llm = providerResult.provider;

  // 3. Bootstrap del container con el LLM inyectado.
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

    const llmCapabilities = container.llm.capabilities();
    const analyzeStart = Date.now();
    const analysis = await analyzeAttempt(
      {
        itemPrompt: SEED_ITEM_PROMPT,
        responseText,
        mode: 'socratic',
        conceptName: SEED_CONCEPT_NAME,
      },
      { llm: container.llm },
    );
    const analyzeLatencyMs = Date.now() - analyzeStart;

    if (!analysis.ok) {
      return {
        ok: false,
        error: `Análisis fallido (${analysis.error.kind} tras ${analyzeLatencyMs}ms): ${
          'cause' in analysis.error
            ? typeof analysis.error.cause === 'string'
              ? analysis.error.cause
              : JSON.stringify(analysis.error.cause)
            : ''
        }`,
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
    return {
      ok: true,
      feedbackText,
      analysis: {
        outcome,
        errorType,
        latencyMs: analyzeLatencyMs,
        providerName: llmCapabilities.name,
        model: llmCapabilities.name === 'ollama'
          ? (process.env.OLLAMA_MODEL ?? userConfig.llm.model ?? 'unknown')
          : (process.env.ANTHROPIC_MODEL ?? userConfig.llm.model ?? 'unknown'),
      },
    };
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
