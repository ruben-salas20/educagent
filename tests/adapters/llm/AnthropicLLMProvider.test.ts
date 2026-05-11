// tests/adapters/llm/AnthropicLLMProvider.test.ts
// Tests del primer LLM adapter (Anthropic). Sin HTTP real — usamos DI con cliente mockeado.

import { describe, it, expect, vi } from 'vitest';
import Anthropic, {
  APIConnectionError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import { AnthropicLLMProvider } from '../../../src/adapters/llm/AnthropicLLMProvider.js';

const MODEL = 'claude-sonnet-4-5-20250929';

type CreateFn = ReturnType<typeof vi.fn>;

function makeMockClient(response: unknown): { client: Anthropic; create: CreateFn } {
  const create = vi.fn().mockResolvedValue(response);
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

function makeMockClientThatThrows(error: unknown): { client: Anthropic; create: CreateFn } {
  const create = vi.fn().mockRejectedValue(error);
  const client = { messages: { create } } as unknown as Anthropic;
  return { client, create };
}

function happyResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content: [{ type: 'text', text: 'Una variable es un contenedor de datos.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 12 },
    ...overrides,
  };
}

describe('AnthropicLLMProvider', () => {
  describe('capabilities()', () => {
    it('retorna el shape correcto para Anthropic', () => {
      const { client } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'test', model: MODEL, client });
      const caps = provider.capabilities();

      expect(caps.name).toBe('anthropic');
      expect(caps.contextWindowTokens).toBe(200_000);
      expect(caps.supportsTools).toBe(true);
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsPromptCaching).toBe(true);
      expect(caps.supportsJsonMode).toBe(false);
      expect(caps.maxOutputTokens).toBe(8192);
      expect(caps.isLocal).toBe(false);
    });
  });

  describe('complete() happy path', () => {
    it('retorna LLMCompletion con texto concatenado', async () => {
      const { client } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'test', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: '¿Qué es una variable?' }]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text).toContain('variable');
      expect(result.value.finishReason).toBe('stop');
      expect(result.value.usage.inputTokens).toBe(50);
      expect(result.value.usage.outputTokens).toBe(12);
      expect(result.value.toolCalls).toBeUndefined();
    });

    it('concatena múltiples bloques de tipo text', async () => {
      const { client } = makeMockClient(
        happyResponse({
          content: [
            { type: 'text', text: 'Parte 1. ' },
            { type: 'text', text: 'Parte 2.' },
          ],
        }),
      );
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text).toBe('Parte 1. Parte 2.');
    });

    it('mapea cached tokens cuando vienen en usage', async () => {
      const { client } = makeMockClient(
        happyResponse({
          usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100 },
        }),
      );
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.usage.cachedTokens).toBe(100);
    });
  });

  describe('complete() request shape', () => {
    it('separa el system message del array de messages', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      await provider.complete([
        { role: 'system', content: 'Sos un tutor socrático.' },
        { role: 'user', content: '¿Qué es X?' },
      ]);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Sos un tutor socrático.',
          messages: [{ role: 'user', content: '¿Qué es X?' }],
        }),
      );
    });

    it('concatena múltiples system messages con doble newline', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      await provider.complete([
        { role: 'system', content: 'Regla 1.' },
        { role: 'system', content: 'Regla 2.' },
        { role: 'user', content: 'hi' },
      ]);

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ system: 'Regla 1.\n\nRegla 2.' }),
      );
    });

    it('usa max_tokens default cuando no se especifica', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      await provider.complete([{ role: 'user', content: 'hi' }]);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 8192 }));
    });

    it('pasa max_tokens, temperature y stop_sequences cuando se especifican', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      await provider.complete([{ role: 'user', content: 'hi' }], {
        maxTokens: 1024,
        temperature: 0.3,
        stopSequences: ['END', '###'],
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1024,
          temperature: 0.3,
          stop_sequences: ['END', '###'],
        }),
      );
    });

    it('mapea tools al formato Anthropic (name/description/input_schema)', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const schema = { type: 'object', properties: { location: { type: 'string' } } };
      await provider.complete([{ role: 'user', content: 'hi' }], {
        tools: [{ name: 'get_weather', description: 'Get weather', schema }],
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [{ name: 'get_weather', description: 'Get weather', input_schema: schema }],
        }),
      );
    });

    it('omite system cuando no hay system messages', async () => {
      const { client, create } = makeMockClient(happyResponse());
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      await provider.complete([{ role: 'user', content: 'hi' }]);

      const arg = create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(arg.system).toBeUndefined();
    });
  });

  describe('complete() stop_reason mapping', () => {
    it('end_turn → stop', async () => {
      const { client } = makeMockClient(happyResponse({ stop_reason: 'end_turn' }));
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('stop');
    });

    it('max_tokens → length', async () => {
      const { client } = makeMockClient(happyResponse({ stop_reason: 'max_tokens' }));
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('length');
    });

    it('stop_sequence → stop', async () => {
      const { client } = makeMockClient(happyResponse({ stop_reason: 'stop_sequence' }));
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('stop');
    });

    it('tool_use → tool_call y expone toolCalls', async () => {
      const { client } = makeMockClient(
        happyResponse({
          content: [
            { type: 'text', text: 'Voy a usar una tool.' },
            {
              type: 'tool_use',
              id: 'toolu_01',
              name: 'get_weather',
              input: { location: 'SF' },
            },
          ],
          stop_reason: 'tool_use',
        }),
      );
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });
      const result = await provider.complete([{ role: 'user', content: 'weather?' }]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('tool_call');
      expect(result.value.toolCalls).toEqual([{ name: 'get_weather', args: { location: 'SF' } }]);
    });
  });

  describe('complete() error mapping', () => {
    it('AuthenticationError → kind=auth', async () => {
      const error = new AuthenticationError(
        401,
        { error: { type: 'authentication_error', message: 'Invalid API key' } },
        'Invalid API key',
        new Headers(),
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'bad', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('auth');
      if (result.error.kind === 'auth') {
        expect(result.error.message).toContain('Invalid');
      }
    });

    it('RateLimitError → kind=rate_limit con retryAfterMs si retry-after está en headers', async () => {
      // Construimos headers con get() para simular Headers nativo.
      const headers = new Headers({ 'retry-after': '30' });
      const error = new RateLimitError(
        429,
        { error: { type: 'rate_limit_error', message: 'rate limited' } },
        'rate limited',
        headers,
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('rate_limit');
      if (result.error.kind === 'rate_limit') {
        expect(result.error.retryAfterMs).toBe(30_000);
      }
    });

    it('RateLimitError sin headers → kind=rate_limit sin retryAfterMs', async () => {
      const error = new RateLimitError(
        429,
        { error: { type: 'rate_limit_error', message: 'rate limited' } },
        'rate limited',
        new Headers(),
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('rate_limit');
      if (result.error.kind === 'rate_limit') {
        expect(result.error.retryAfterMs).toBeUndefined();
      }
    });

    it('BadRequestError con mensaje de context length → kind=context_overflow', async () => {
      const error = new BadRequestError(
        400,
        { error: { type: 'invalid_request_error', message: 'prompt is too long: exceeds context window' } },
        'prompt is too long: exceeds context window',
        new Headers(),
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('context_overflow');
    });

    it('BadRequestError genérico → kind=provider', async () => {
      const error = new BadRequestError(
        400,
        { error: { type: 'invalid_request_error', message: 'unsupported parameter foo' } },
        'unsupported parameter foo',
        new Headers(),
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('provider');
      if (result.error.kind === 'provider') {
        expect(result.error.status).toBe(400);
      }
    });

    it('APIConnectionError → kind=network', async () => {
      const error = new APIConnectionError({ message: 'connection refused' });
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('network');
      if (result.error.kind === 'network') {
        expect(result.error.cause).toContain('connection');
      }
    });

    it('APIError genérico (5xx) → kind=provider con status', async () => {
      const error = new InternalServerError(
        500,
        { error: { type: 'api_error', message: 'upstream failure' } },
        'upstream failure',
        new Headers(),
      );
      const { client } = makeMockClientThatThrows(error);
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('provider');
      if (result.error.kind === 'provider') {
        expect(result.error.status).toBe(500);
      }
    });

    it('Error genérico no-Anthropic → kind=invalid_response', async () => {
      const { client } = makeMockClientThatThrows(new Error('boom'));
      const provider = new AnthropicLLMProvider({ apiKey: 'k', model: MODEL, client });

      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('invalid_response');
      if (result.error.kind === 'invalid_response') {
        expect(result.error.reason).toBe('boom');
      }
    });
  });
});
