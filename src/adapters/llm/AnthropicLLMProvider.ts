// src/adapters/llm/AnthropicLLMProvider.ts
// Primer adapter ILLMProvider — Anthropic Claude via @anthropic-ai/sdk.
//
// API confirmada vía Context7 (SDK >=0.95):
// - client.messages.create({ model, system?, messages, max_tokens, temperature?, stop_sequences?, tools? })
// - response.content es Array<ContentBlock> con type 'text' | 'tool_use'
// - response.stop_reason ∈ 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use'
// - response.usage = { input_tokens, output_tokens, cache_creation_input_tokens?, cache_read_input_tokens? }
// - Errores tipados como classes: Anthropic.APIError (base), AuthenticationError, RateLimitError,
//   BadRequestError, APIConnectionError. Discriminados por instanceof.
//
// Modelo default sugerido: claude-sonnet-4-5-20250929 (el caller decide el ID exacto).
//
// BYOK: el caller pasa apiKey explícita. El provider NO lee env vars.
// DI: el constructor acepta un cliente inyectado para tests (evita HTTP mocking).

import Anthropic, {
  APIError,
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type {
  ILLMProvider,
  LLMCompletion,
  LLMCompletionOptions,
  LLMError,
  LLMMessage,
  ProviderCapabilities,
} from '../../ports/llm/ILLMProvider.js';
import type { Result } from '../../core/result/Result.js';
import { ok, err } from '../../core/result/Result.js';

export interface AnthropicLLMProviderConfig {
  readonly apiKey: string;
  readonly model: string;
  /** DI: tests inyectan un cliente mock. En prod, el provider crea uno con apiKey. */
  readonly client?: Anthropic;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

export class AnthropicLLMProvider implements ILLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: AnthropicLLMProviderConfig) {
    this.client = config.client ?? new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
  }

  capabilities(): ProviderCapabilities {
    return {
      name: 'anthropic',
      contextWindowTokens: 200_000,
      supportsTools: true,
      supportsStreaming: true,
      supportsPromptCaching: true,
      supportsJsonMode: false,
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      isLocal: false,
    };
  }

  async complete(
    messages: ReadonlyArray<LLMMessage>,
    opts?: LLMCompletionOptions,
  ): Promise<Result<LLMCompletion, LLMError>> {
    // 1. Separar el system message del resto.
    //    Anthropic recibe `system` como param top-level y `messages` solo user/assistant.
    //    Si hay múltiples system messages, los concatenamos con doble newline.
    const systemParts: string[] = [];
    const convo: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else {
        convo.push({ role: m.role, content: m.content });
      }
    }
    const system = systemParts.length > 0 ? systemParts.join('\n\n') : undefined;

    // 2. Construir el request.
    const request: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      messages: convo,
    };
    if (system !== undefined) request.system = system;
    if (opts?.temperature !== undefined) request.temperature = opts.temperature;
    if (opts?.stopSequences !== undefined && opts.stopSequences.length > 0) {
      request.stop_sequences = [...opts.stopSequences];
    }
    if (opts?.tools !== undefined && opts.tools.length > 0) {
      request.tools = opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.schema,
      }));
    }

    // 3. Llamar y mapear errores con instanceof (orden importa: clases concretas antes que APIError).
    try {
      // El cast es necesario porque construimos el request dinámicamente.
      const response = await this.client.messages.create(
        request as unknown as Parameters<Anthropic['messages']['create']>[0],
      );
      return ok(this.mapResponse(response));
    } catch (e: unknown) {
      return err(this.mapError(e));
    }
  }

  private mapResponse(
    response: Awaited<ReturnType<Anthropic['messages']['create']>>,
  ): LLMCompletion {
    // `response` puede ser Message o un Stream. En este adapter NO usamos streaming,
    // así que asumimos Message. Si por alguna razón viene un stream, mapError lo cubre
    // como invalid_response al hacer property access.
    const msg = response as Anthropic.Message;

    // Concatenar todos los bloques de texto.
    const textBlocks: string[] = [];
    const toolCalls: Array<{ name: string; args: unknown }> = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        textBlocks.push(block.text);
      } else if (block.type === 'tool_use') {
        toolCalls.push({ name: block.name, args: block.input });
      }
    }

    const finishReason = mapStopReason(msg.stop_reason);
    const completion: LLMCompletion = {
      text: textBlocks.join(''),
      finishReason,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      usage: {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        ...(msg.usage.cache_read_input_tokens != null
          ? { cachedTokens: msg.usage.cache_read_input_tokens }
          : {}),
      },
    };
    return completion;
  }

  private mapError(e: unknown): LLMError {
    // Order matters: chequear subclases antes que APIError.
    if (e instanceof AuthenticationError) {
      return { kind: 'auth', message: e.message };
    }
    if (e instanceof RateLimitError) {
      // Anthropic devuelve retry-after en headers (segundos).
      const retryAfter = extractRetryAfterMs(e);
      return retryAfter !== undefined
        ? { kind: 'rate_limit', retryAfterMs: retryAfter }
        : { kind: 'rate_limit' };
    }
    if (e instanceof BadRequestError) {
      // Heurística: si el mensaje menciona context length / tokens, mapeamos a context_overflow.
      const msg = e.message.toLowerCase();
      if (
        msg.includes('context') ||
        msg.includes('token') ||
        msg.includes('too long') ||
        msg.includes('max_tokens')
      ) {
        return { kind: 'context_overflow', tokensRequired: 0, max: 0 };
      }
      return { kind: 'provider', status: e.status ?? 400, message: e.message };
    }
    if (e instanceof APIConnectionError) {
      return { kind: 'network', cause: e.message };
    }
    if (e instanceof APIError) {
      return { kind: 'provider', status: e.status ?? 500, message: e.message };
    }
    if (e instanceof Error) {
      return { kind: 'invalid_response', reason: e.message };
    }
    return { kind: 'invalid_response', reason: 'unknown error' };
  }
}

function mapStopReason(
  stopReason: Anthropic.Message['stop_reason'],
): LLMCompletion['finishReason'] {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_call';
    case null:
    case undefined:
      return 'stop';
    default:
      // Cubre futuros valores (e.g. 'refusal', 'pause_turn') sin romper.
      return 'error';
  }
}

function extractRetryAfterMs(e: RateLimitError): number | undefined {
  // El SDK expone headers en e.headers (Headers | Record<string,string> según versión).
  const headers = (e as unknown as { headers?: unknown }).headers;
  if (!headers) return undefined;
  let value: string | null = null;
  if (typeof (headers as Headers).get === 'function') {
    value = (headers as Headers).get('retry-after');
  } else if (typeof headers === 'object') {
    const rec = headers as Record<string, string | string[] | undefined>;
    const raw = rec['retry-after'] ?? rec['Retry-After'];
    value = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  }
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}
