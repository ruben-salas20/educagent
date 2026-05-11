// src/ports/llm/ILLMProvider.ts
// Port unificado BYOK para proveedores LLM.
// Ver docs/architecture/03-interfaces.md §ILLMProvider — D-A1: una sola interfaz,
// las diferencias entre providers se exponen vía capabilities().
//
// Contrato BYOK:
// - El provider NUNCA persiste claves fuera de ~/.educagent/config.toml (responsabilidad del caller).
// - El provider NO loguea contenido de prompts a archivos por default.
// - capabilities() es síncrono y barato; complete() es asíncrono.
// - completeStream() es opcional — se agregará cuando exista un caso de uso real.

import type { Result } from '../../core/result/Result.js';

export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LLMCompletionOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly tools?: ReadonlyArray<{ name: string; description: string; schema: object }>;
  /** Si el adapter soporta cacheo (Anthropic prompt caching, etc.), aplica. */
  readonly cacheable?: boolean;
}

export interface LLMCompletion {
  readonly text: string;
  readonly finishReason: 'stop' | 'length' | 'tool_call' | 'content_filter' | 'error';
  readonly toolCalls?: ReadonlyArray<{ name: string; args: unknown }>;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cachedTokens?: number;
  };
}

export interface ProviderCapabilities {
  readonly name: string; // 'anthropic' | 'openai' | ...
  readonly contextWindowTokens: number;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsPromptCaching: boolean;
  readonly supportsJsonMode: boolean;
  readonly maxOutputTokens: number;
  /** true para Ollama/LM Studio (privacy implication). */
  readonly isLocal: boolean;
}

export type LLMError =
  | { kind: 'auth'; message: string }
  | { kind: 'rate_limit'; retryAfterMs?: number }
  | { kind: 'context_overflow'; tokensRequired: number; max: number }
  | { kind: 'network'; cause: string }
  | { kind: 'provider'; status: number; message: string }
  | { kind: 'invalid_response'; reason: string };

export interface ILLMProvider {
  capabilities(): ProviderCapabilities;

  complete(
    messages: ReadonlyArray<LLMMessage>,
    opts?: LLMCompletionOptions,
  ): Promise<Result<LLMCompletion, LLMError>>;
}
