// src/adapters/llm/OllamaLLMProvider.ts
// Segundo adapter ILLMProvider — Ollama local via fetch directo (sin SDK).
//
// Rationale: Ollama es la opción local-first / privacy-first. Default del CLI.
// API endpoint: POST {baseUrl}/api/chat con body { model, messages, stream:false, options?, format? }.
// Response: { model, message: { role, content }, done, done_reason?, eval_count?, prompt_eval_count? }.
//
// No streaming en MVP (la interfaz no lo expone todavía).
// No tool calling en MVP.
// format:"json" se activa cuando opts.jsonMode === true.

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

export interface OllamaLLMProviderConfig {
  /** Nombre del modelo Ollama (ej: 'gemma4:latest', 'qwen2.5:7b'). */
  readonly model: string;
  /** URL base. Default 'http://localhost:11434'. */
  readonly baseUrl?: string;
  /** DI para tests. Default global fetch. */
  readonly fetchFn?: typeof fetch;
  /** Timeout en ms para cada request. Default 120_000 (2 min — modelos grandes en CPU son lentos). */
  readonly timeoutMs?: number;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream: false;
  options?: {
    temperature?: number;
    num_predict?: number;
    stop?: string[];
  };
  format?: 'json';
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
  done_reason?: string;
  eval_count?: number; // output tokens
  prompt_eval_count?: number; // input tokens
  total_duration?: number;
}

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_CONTEXT_WINDOW = 8192;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export class OllamaLLMProvider implements ILLMProvider {
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: OllamaLLMProviderConfig) {
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = config.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  capabilities(): ProviderCapabilities {
    return {
      name: 'ollama',
      // Default conservador. Modelos como gemma4 pueden tener más, pero sin
      // inspeccionar el modelo no sabemos. 8192 alcanza para nuestro AnalyzeAttempt.
      contextWindowTokens: DEFAULT_CONTEXT_WINDOW,
      supportsTools: false, // MVP: no tool calling
      supportsStreaming: true, // Ollama soporta, pero nuestra interfaz no lo expone
      supportsPromptCaching: false, // Ollama no tiene cache de prompts a la Anthropic
      supportsJsonMode: true, // format: "json"
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS, // configurable via num_predict
      isLocal: true, // CRÍTICO: privacy implication
    };
  }

  async complete(
    messages: ReadonlyArray<LLMMessage>,
    opts: LLMCompletionOptions = {},
  ): Promise<Result<LLMCompletion, LLMError>> {
    const url = `${this.baseUrl}/api/chat`;
    const body: OllamaChatRequest = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    };

    // Build options object solo si algún campo está seteado.
    const options: Record<string, unknown> = {};
    if (opts.temperature !== undefined) options.temperature = opts.temperature;
    if (opts.maxTokens !== undefined) options.num_predict = opts.maxTokens;
    if (opts.stopSequences && opts.stopSequences.length > 0) {
      options.stop = [...opts.stopSequences];
    }
    if (Object.keys(options).length > 0) {
      body.options = options as OllamaChatRequest['options'];
    }

    if (opts.jsonMode === true) {
      body.format = 'json';
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeoutHandle);
      // Network errors típicos: ECONNREFUSED (Ollama no corriendo), abort por timeout, etc.
      const message = e instanceof Error ? e.message : String(e);
      const isAbort = e instanceof Error && e.name === 'AbortError';
      return err({
        kind: 'network',
        cause: isAbort
          ? `Timeout tras ${this.timeoutMs}ms`
          : `${message} (¿Ollama corriendo en ${this.baseUrl}?)`,
      });
    }

    clearTimeout(timeoutHandle);

    if (!response.ok) {
      // Status no-2xx. 404 = modelo no descargado en Ollama.
      const text = await response.text().catch(() => '');
      if (response.status === 404) {
        return err({
          kind: 'provider',
          status: 404,
          message: `Modelo '${this.model}' no está descargado. Corré: ollama pull ${this.model}`,
        });
      }
      return err({
        kind: 'provider',
        status: response.status,
        message: text || response.statusText,
      });
    }

    let data: OllamaChatResponse;
    try {
      data = (await response.json()) as OllamaChatResponse;
    } catch (e) {
      return err({
        kind: 'invalid_response',
        reason: `Response no es JSON: ${e instanceof Error ? e.message : String(e)}`,
      });
    }

    if (!data.message || typeof data.message.content !== 'string') {
      return err({
        kind: 'invalid_response',
        reason: 'Response no tiene message.content',
      });
    }

    return ok({
      text: data.message.content,
      finishReason: mapDoneReason(data.done_reason),
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
    });
  }
}

function mapDoneReason(reason?: string): LLMCompletion['finishReason'] {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    default:
      // 'unload', 'load', errores, etc. — Ollama no tiene 'tool_call' ni 'content_filter'.
      return 'stop';
  }
}
