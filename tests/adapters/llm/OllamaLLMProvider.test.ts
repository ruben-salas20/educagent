// tests/adapters/llm/OllamaLLMProvider.test.ts
// Tests del segundo LLM adapter (Ollama local). Sin HTTP real — DI con fetch mock.

import { describe, it, expect, vi } from 'vitest';
import { OllamaLLMProvider } from '../../../src/adapters/llm/OllamaLLMProvider.js';

function makeMockFetch(response: { status: number; body: unknown }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.status === 200 ? 'OK' : 'Error',
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  } as Response) as unknown as typeof fetch;
}

function makeMockFetchThatThrows(error: Error): typeof fetch {
  return vi.fn().mockRejectedValue(error) as unknown as typeof fetch;
}

function happyBody(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gemma4:latest',
    message: { role: 'assistant', content: 'Una variable es un contenedor.' },
    done: true,
    done_reason: 'stop',
    eval_count: 15,
    prompt_eval_count: 80,
    ...overrides,
  };
}

describe('OllamaLLMProvider', () => {
  describe('capabilities()', () => {
    it('retorna el shape correcto para Ollama', () => {
      const provider = new OllamaLLMProvider({
        model: 'gemma4:latest',
        fetchFn: makeMockFetch({ status: 200, body: {} }),
      });
      const caps = provider.capabilities();
      expect(caps.name).toBe('ollama');
      expect(caps.isLocal).toBe(true); // crítico para privacy
      expect(caps.supportsJsonMode).toBe(true);
      expect(caps.supportsTools).toBe(false); // MVP
      expect(caps.supportsPromptCaching).toBe(false);
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.contextWindowTokens).toBe(8192);
      expect(caps.maxOutputTokens).toBe(4096);
    });
  });

  describe('complete() happy path', () => {
    it('retorna LLMCompletion con texto + usage mapeado', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'gemma4:latest', fetchFn });
      const result = await provider.complete([
        { role: 'user', content: '¿Qué es una variable?' },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.text).toContain('variable');
      expect(result.value.finishReason).toBe('stop');
      expect(result.value.usage.outputTokens).toBe(15);
      expect(result.value.usage.inputTokens).toBe(80);
    });

    it('eval_count/prompt_eval_count ausentes → 0', async () => {
      const fetchFn = makeMockFetch({
        status: 200,
        body: {
          message: { role: 'assistant', content: 'x' },
          done: true,
          done_reason: 'stop',
        },
      });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.usage.inputTokens).toBe(0);
      expect(result.value.usage.outputTokens).toBe(0);
    });
  });

  describe('complete() request shape', () => {
    it('POST body incluye stream:false y model', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'qwen2.5:7b', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }]);
      const call = (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
      const requestBody = JSON.parse((call[1] as { body: string }).body);
      expect(requestBody.model).toBe('qwen2.5:7b');
      expect(requestBody.stream).toBe(false);
      expect(requestBody.messages).toHaveLength(1);
    });

    it('jsonMode true activa format:"json"', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'json please' }], {
        jsonMode: true,
      });
      const requestBody = JSON.parse(
        (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]
          ? ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body
          : '{}',
      );
      expect(requestBody.format).toBe('json');
    });

    it('jsonMode false/undefined NO incluye format', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }]);
      const requestBody = JSON.parse(
        ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body,
      );
      expect(requestBody.format).toBeUndefined();
    });

    it('temperature + maxTokens pasados en options', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }], {
        temperature: 0.0,
        maxTokens: 200,
      });
      const body = JSON.parse(
        ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body,
      );
      expect(body.options.temperature).toBe(0.0);
      expect(body.options.num_predict).toBe(200);
    });

    it('stopSequences pasadas en options.stop', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }], {
        stopSequences: ['STOP', 'END'],
      });
      const body = JSON.parse(
        ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body,
      );
      expect(body.options.stop).toEqual(['STOP', 'END']);
    });

    it('sin opts → no incluye options', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }]);
      const body = JSON.parse(
        ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body,
      );
      expect(body.options).toBeUndefined();
    });

    it('preserva el role system en messages (Ollama lo soporta nativo)', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([
        { role: 'system', content: 'Sos un tutor.' },
        { role: 'user', content: 'hi' },
      ]);
      const body = JSON.parse(
        ((fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as { body: string }).body,
      );
      expect(body.messages).toEqual([
        { role: 'system', content: 'Sos un tutor.' },
        { role: 'user', content: 'hi' },
      ]);
    });
  });

  describe('complete() finishReason mapping', () => {
    it('done_reason=stop → finishReason=stop', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody({ done_reason: 'stop' }) });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('stop');
    });

    it('done_reason=length → finishReason=length', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody({ done_reason: 'length' }) });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('length');
    });

    it('done_reason undefined → finishReason=stop (default)', async () => {
      const fetchFn = makeMockFetch({
        status: 200,
        body: {
          message: { role: 'assistant', content: 'x' },
          done: true,
        },
      });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.finishReason).toBe('stop');
    });
  });

  describe('complete() error mapping', () => {
    it('ECONNREFUSED → kind=network con hint sobre Ollama', async () => {
      const fetchFn = makeMockFetchThatThrows(
        new Error('fetch failed: connect ECONNREFUSED'),
      );
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('network');
      if (result.error.kind !== 'network') return;
      expect(result.error.cause).toContain('Ollama corriendo');
    });

    it('404 → kind=provider con hint sobre `ollama pull`', async () => {
      const fetchFn = makeMockFetch({
        status: 404,
        body: { error: 'model not found' },
      });
      const provider = new OllamaLLMProvider({ model: 'unknown:latest', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('provider');
      if (result.error.kind !== 'provider') return;
      expect(result.error.status).toBe(404);
      expect(result.error.message).toContain('ollama pull');
    });

    it('500 → kind=provider con status 500', async () => {
      const fetchFn = makeMockFetch({
        status: 500,
        body: { error: 'internal' },
      });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('provider');
      if (result.error.kind !== 'provider') return;
      expect(result.error.status).toBe(500);
    });

    it('Response sin message.content → invalid_response', async () => {
      const fetchFn = makeMockFetch({
        status: 200,
        body: { done: true }, // sin message
      });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('invalid_response');
    });

    it('timeout abort → kind=network con mensaje de timeout', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      const fetchFn = makeMockFetchThatThrows(abortError);
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn, timeoutMs: 100 });
      const result = await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('network');
      if (result.error.kind !== 'network') return;
      expect(result.error.cause).toContain('Timeout');
    });
  });

  describe('complete() URL building', () => {
    it('default baseUrl es http://localhost:11434', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({ model: 'm', fetchFn });
      await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(
        (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
      ).toBe('http://localhost:11434/api/chat');
    });

    it('baseUrl custom override', async () => {
      const fetchFn = makeMockFetch({ status: 200, body: happyBody() });
      const provider = new OllamaLLMProvider({
        model: 'm',
        baseUrl: 'http://192.168.1.50:11434',
        fetchFn,
      });
      await provider.complete([{ role: 'user', content: 'hi' }]);
      expect(
        (fetchFn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0],
      ).toBe('http://192.168.1.50:11434/api/chat');
    });
  });
});
