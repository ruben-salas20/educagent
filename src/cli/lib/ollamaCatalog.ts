// src/cli/lib/ollamaCatalog.ts
// Pure function que consulta Ollama /api/tags y retorna lista de modelos
// descargados localmente. Aislado del componente Ink para testeabilidad
// (inyectamos `fetchFn` en los tests sin tener que mockear globalThis).
//
// Rationale: no contamina el OllamaLLMProvider (que es un adapter ILLMProvider
// puro de chat completion). Este módulo vive en cli/lib porque es UI-glue:
// solo lo usa el flow de `init` para listar opciones al usuario.

import type { Result } from '../../core/result/Result.js';
import { ok, err } from '../../core/result/Result.js';

export interface OllamaModelInfo {
  /** ej: 'gemma4:latest', 'qwen2.5:7b'. */
  readonly name: string;
  /** Tamaño en bytes — útil para mostrar al usuario antes de elegir. */
  readonly sizeBytes: number;
  /** ISO timestamp del último uso / descarga. */
  readonly modifiedAt: string;
}

export type OllamaCatalogError =
  | { kind: 'not_running'; url: string; cause: string }
  | { kind: 'empty_catalog'; url: string }
  | { kind: 'unexpected_response'; url: string; status?: number; cause: string };

export interface FetchOllamaCatalogOptions {
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 5000;

interface OllamaTagsResponseBody {
  models?: Array<{ name: string; size: number; modified_at: string }>;
}

/**
 * Lista modelos descargados en Ollama. Retorna error claro y discriminado si:
 * - Ollama no corre (network / refused / timeout) → kind: 'not_running'.
 * - No hay modelos descargados → kind: 'empty_catalog'.
 * - El daemon responde algo raro → kind: 'unexpected_response'.
 */
export async function fetchOllamaCatalog(
  options: FetchOllamaCatalogOptions = {},
): Promise<Result<ReadonlyArray<OllamaModelInfo>, OllamaCatalogError>> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  const url = `${baseUrl}/api/tags`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(url, { signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    return err({
      kind: 'not_running',
      url,
      cause: e instanceof Error ? e.message : String(e),
    });
  }
  clearTimeout(timer);

  if (!response.ok) {
    return err({
      kind: 'unexpected_response',
      url,
      status: response.status,
      cause: `${response.status} ${response.statusText}`,
    });
  }

  let body: OllamaTagsResponseBody;
  try {
    body = (await response.json()) as OllamaTagsResponseBody;
  } catch (e) {
    return err({
      kind: 'unexpected_response',
      url,
      status: response.status,
      cause: `response no es JSON: ${e instanceof Error ? e.message : String(e)}`,
    });
  }

  if (!Array.isArray(body.models)) {
    return err({
      kind: 'unexpected_response',
      url,
      status: response.status,
      cause: 'body sin field "models"',
    });
  }

  if (body.models.length === 0) {
    return err({ kind: 'empty_catalog', url });
  }

  return ok(
    body.models.map((m) => ({
      name: m.name,
      sizeBytes: m.size,
      modifiedAt: m.modified_at,
    })),
  );
}

/**
 * Formato amigable de tamaño en bytes. Ej: 9.6 GB, 768 MB.
 * - >= 1 GB → "X.X GB"
 * - sino   → "X MB"
 */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(0)} MB`;
}
