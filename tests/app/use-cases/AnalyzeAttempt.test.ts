// tests/app/use-cases/AnalyzeAttempt.test.ts
// Tests unit del use case AnalyzeAttempt. Usamos un mock ILLMProvider (sin
// dependencias de red) para validar el contrato de parseo + manejo de errores.

import { describe, it, expect, vi } from 'vitest';
import { analyzeAttempt } from '../../../src/app/use-cases/AnalyzeAttempt.js';
import type {
  ILLMProvider,
  LLMCompletion,
  LLMError,
} from '../../../src/ports/llm/ILLMProvider.js';
import { ok, err, type Result } from '../../../src/core/result/Result.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function completionWith(text: string): LLMCompletion {
  return {
    text,
    finishReason: 'stop',
    usage: { inputTokens: 100, outputTokens: 20 },
  };
}

function makeMockLLM(
  result: Result<LLMCompletion, LLMError>,
): ILLMProvider {
  return {
    capabilities: () => ({
      name: 'mock',
      contextWindowTokens: 200_000,
      supportsTools: false,
      supportsStreaming: false,
      supportsPromptCaching: false,
      supportsJsonMode: false,
      maxOutputTokens: 8192,
      isLocal: false,
    }),
    complete: vi.fn().mockResolvedValue(result),
  };
}

const baseInput = {
  itemPrompt: '¿Qué es una variable en programación?',
  responseText: 'Es un contenedor de datos.',
  mode: 'socratic' as const,
  conceptName: 'Variable',
};

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('analyzeAttempt — happy paths', () => {
  it('parsea outcome=correct con errorType=null', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"correct","errorType":null}')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('correct');
    expect(result.value.errorType).toBeNull();
  });

  it('parsea outcome=incorrect con errorType=conceptual', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"incorrect","errorType":"conceptual"}')),
    );
    const result = await analyzeAttempt(
      { ...baseInput, responseText: 'Una variable es una función.' },
      { llm },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('incorrect');
    expect(result.value.errorType).toBe('conceptual');
  });

  it('parsea outcome=partial con errorType=partial-correct', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"partial","errorType":"partial-correct"}')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('partial');
    expect(result.value.errorType).toBe('partial-correct');
  });

  it('parsea outcome=skipped cuando responseText vacío', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"skipped","errorType":null}')),
    );
    const result = await analyzeAttempt(
      { ...baseInput, responseText: '' },
      { llm },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('skipped');
    expect(result.value.errorType).toBeNull();
  });

  it('parsea outcome=gave_up con errorType=null', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"gave_up","errorType":null}')),
    );
    const result = await analyzeAttempt(
      { ...baseInput, responseText: 'me rindo' },
      { llm },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('gave_up');
  });

  it('tolera JSON envuelto en markdown fences (```json ... ```)', async () => {
    const llm = makeMockLLM(
      ok(completionWith('```json\n{"outcome":"correct","errorType":null}\n```')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('correct');
  });

  it('tolera fences sin lenguaje (``` ... ```)', async () => {
    const llm = makeMockLLM(
      ok(completionWith('```\n{"outcome":"correct","errorType":null}\n```')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outcome).toBe('correct');
  });

  it('tolera whitespace antes y después del JSON', async () => {
    const llm = makeMockLLM(
      ok(completionWith('   \n  {"outcome":"correct","errorType":null}  \n  ')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
  });

  it('acepta errorType ausente (no la clave) interpretándolo como null', async () => {
    const llm = makeMockLLM(ok(completionWith('{"outcome":"correct"}')));
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.errorType).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('analyzeAttempt — error paths', () => {
  it('LLM error (rate_limit) → llm_failed', async () => {
    const llm = makeMockLLM(
      err<LLMError>({ kind: 'rate_limit', retryAfterMs: 5000 }),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('llm_failed');
    if (result.error.kind !== 'llm_failed') return;
    expect(result.error.cause.kind).toBe('rate_limit');
  });

  it('LLM error (auth) → llm_failed', async () => {
    const llm = makeMockLLM(
      err<LLMError>({ kind: 'auth', message: 'invalid api key' }),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('llm_failed');
  });

  it('JSON malformado → response_parse_failed con rawText preservado', async () => {
    const llm = makeMockLLM(ok(completionWith('esto no es JSON')));
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('response_parse_failed');
    if (result.error.kind !== 'response_parse_failed') return;
    expect(result.error.rawText).toBe('esto no es JSON');
  });

  it('respuesta JSON que no es objeto (array) → response_parse_failed', async () => {
    const llm = makeMockLLM(ok(completionWith('["correct", null]')));
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('response_parse_failed');
  });

  it('outcome inválido → response_invalid_enum', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"unknown_value","errorType":null}')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('response_invalid_enum');
    if (result.error.kind !== 'response_invalid_enum') return;
    expect(result.error.cause).toContain('outcome');
  });

  it('outcome faltante → response_invalid_enum', async () => {
    const llm = makeMockLLM(ok(completionWith('{"errorType":null}')));
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('response_invalid_enum');
  });

  it('errorType inválido → response_invalid_enum', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"incorrect","errorType":"weird-type"}')),
    );
    const result = await analyzeAttempt(baseInput, { llm });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('response_invalid_enum');
    if (result.error.kind !== 'response_invalid_enum') return;
    expect(result.error.cause).toContain('errorType');
  });
});

// ---------------------------------------------------------------------------
// Wiring de parámetros del LLM
// ---------------------------------------------------------------------------

describe('analyzeAttempt — LLM call wiring', () => {
  it('pasa temperature=0 y maxTokens=200 al LLM', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"correct","errorType":null}')),
    );
    await analyzeAttempt(baseInput, { llm });
    expect(llm.complete).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ temperature: 0.0, maxTokens: 200 }),
    );
  });

  it('envía un system message + un user message', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"correct","errorType":null}')),
    );
    await analyzeAttempt(baseInput, { llm });
    const firstCall = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = firstCall[0] as ReadonlyArray<{ role: string; content: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('el system prompt incluye el modo activo y el concepto', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"correct","errorType":null}')),
    );
    await analyzeAttempt(
      { ...baseInput, mode: 'simulacro', conceptName: 'Recursión' },
      { llm },
    );
    const firstCall = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = firstCall[0] as ReadonlyArray<{ role: string; content: string }>;
    expect(messages[0].content).toContain('simulacro');
    expect(messages[0].content).toContain('Recursión');
  });

  it('el user message incluye prompt y responseText', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"correct","errorType":null}')),
    );
    await analyzeAttempt(baseInput, { llm });
    const firstCall = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = firstCall[0] as ReadonlyArray<{ role: string; content: string }>;
    expect(messages[1].content).toContain(baseInput.itemPrompt);
    expect(messages[1].content).toContain(baseInput.responseText);
  });

  it('marca responseText vacío como <vacía> en el user message', async () => {
    const llm = makeMockLLM(
      ok(completionWith('{"outcome":"skipped","errorType":null}')),
    );
    await analyzeAttempt({ ...baseInput, responseText: '   ' }, { llm });
    const firstCall = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const messages = firstCall[0] as ReadonlyArray<{ role: string; content: string }>;
    expect(messages[1].content).toContain('<vacía>');
  });
});
