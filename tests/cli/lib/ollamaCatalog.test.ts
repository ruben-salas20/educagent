// tests/cli/lib/ollamaCatalog.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  fetchOllamaCatalog,
  formatBytes,
} from '../../../src/cli/lib/ollamaCatalog.js';

/**
 * Helper para construir un Response mock minimal con body JSON.
 */
function makeResponse(status: number, body: unknown, statusText = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('fetchOllamaCatalog', () => {
  it('happy path: parsea 3 modelos del response', async () => {
    const fetchFn = vi.fn(async () =>
      makeResponse(200, {
        models: [
          { name: 'gemma2:9b', size: 9_500_000_000, modified_at: '2026-05-01T10:00:00Z' },
          { name: 'qwen2.5:7b', size: 4_700_000_000, modified_at: '2026-05-02T10:00:00Z' },
          { name: 'llama3:8b', size: 4_600_000_000, modified_at: '2026-05-03T10:00:00Z' },
        ],
      }),
    );
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value[0]).toEqual({
      name: 'gemma2:9b',
      sizeBytes: 9_500_000_000,
      modifiedAt: '2026-05-01T10:00:00Z',
    });
  });

  it('usa baseUrl por default cuando no se pasa', async () => {
    const fetchFn = vi.fn(async () => makeResponse(200, { models: [{ name: 'x', size: 1, modified_at: 'now' }] }));
    await fetchOllamaCatalog({ fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://localhost:11434/api/tags',
      expect.any(Object),
    );
  });

  it('empty_catalog cuando models array está vacío', async () => {
    const fetchFn = vi.fn(async () => makeResponse(200, { models: [] }));
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty_catalog');
    if (result.error.kind !== 'empty_catalog') return;
    expect(result.error.url).toBe('http://localhost:11434/api/tags');
  });

  it('not_running cuando fetch rechaza (ECONNREFUSED)', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    });
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_running');
    if (result.error.kind !== 'not_running') return;
    expect(result.error.cause).toContain('ECONNREFUSED');
  });

  it('not_running cuando fetch es abortado por timeout', async () => {
    const fetchFn = vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    });
    const result = await fetchOllamaCatalog({ fetchFn, timeoutMs: 10 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_running');
  });

  it('unexpected_response cuando status es 500', async () => {
    const fetchFn = vi.fn(async () => makeResponse(500, {}, 'Internal Server Error'));
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('unexpected_response');
    if (result.error.kind !== 'unexpected_response') return;
    expect(result.error.status).toBe(500);
  });

  it('unexpected_response cuando body no tiene field "models"', async () => {
    const fetchFn = vi.fn(async () => makeResponse(200, { foo: 'bar' }));
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('unexpected_response');
  });

  it('unexpected_response cuando body no es JSON parseable', async () => {
    const fetchFn = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => {
            throw new Error('Unexpected token');
          },
        }) as unknown as Response,
    );
    const result = await fetchOllamaCatalog({ fetchFn });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('unexpected_response');
    if (result.error.kind !== 'unexpected_response') return;
    expect(result.error.cause).toContain('JSON');
  });
});

describe('formatBytes', () => {
  it('formatea valores >= 1 GB con 1 decimal', () => {
    expect(formatBytes(9_600_000_000)).toBe('8.9 GB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('formatea valores < 1 GB en MB sin decimales', () => {
    expect(formatBytes(768 * 1024 ** 2)).toBe('768 MB');
    expect(formatBytes(50 * 1024 ** 2)).toBe('50 MB');
  });
});
