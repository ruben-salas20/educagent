# 03 · Abstracciones core (interfaces TS)

Las 4 interfaces principales del dominio. Todas usan `Result<T, E>` para errores cross-layer (no throws). Los esqueletos son mínimos — la implementación real va en `src/adapters/`.

> Las interfaces incluyen ajustes derivados del [spike SM-2 vs FSRS](./adr/ADR-0002-sm2-mvp-fsrs-future.md): `ICalibrableScheduler` y `paramsHash` en `SchedulingState`. Ambos se declaran desde MVP aunque SM-2 no los necesite, para evitar breaking change cuando llegue FSRS (Mes 5).

---

## Tipos comunes

```ts
// src/core/result/Result.ts
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

```ts
// src/core/value-objects/Mode.ts
export type Mode = 'socratic' | 'architect' | 'simulacro' | 'explorer';
```

```ts
// src/core/value-objects/ConfidenceTier.ts
export type ConfidenceTier = 'primary' | 'secondary' | 'tertiary';
```

---

## `IScheduler` — SM-2 con migración futura a FSRS

> **Nota sobre `ICalibrableScheduler`**: declaramos la extensión `ICalibrableScheduler` desde el MVP aunque SM-2 no calibra. Razón: cuando llegue FSRS (Mes 5), no introduce un breaking change — los consumidores que ya manejan `IScheduler` siguen funcionando, y los que necesitan calibración (job de re-derivación) usan `ICalibrableScheduler`.

> **Por qué `paramsHash`**: cuando FSRS recalibre params (Mes 5), todos los `SchedulingState` con `paramsHash` viejo deben re-derivarse desde Attempts. Sin el hash, no hay forma de saber qué state está stale. Para SM-2 el hash es constante (mismo algoritmo, mismos defaults).

```ts
// src/ports/inference/IScheduler.ts
import type { Result } from '../../core/result/Result';
import type { Attempt } from '../../core/entities/Attempt';

/**
 * Estado de scheduling. Opaque por diseño: SM-2 tiene 4 campos,
 * FSRS tiene 7+. El consumidor NUNCA toca estos campos directamente.
 */
export interface SchedulingState {
  readonly algorithm: 'sm2' | 'fsrs';
  readonly version: number;          // permite migración serializada
  readonly paramsHash: string;       // detecta state stale post-recalibración (FSRS)
  readonly raw: Readonly<Record<string, number | string>>;
  readonly nextDueAt: string | null; // ISO 8601 — único campo público garantizado
}

export type SchedulerError =
  | { kind: 'invalid_state'; reason: string }
  | { kind: 'algorithm_mismatch'; expected: string; got: string };

/**
 * Contrato:
 * - `next` es DETERMINÍSTICO: mismo (state, attempt, now) => mismo resultado.
 * - NO side effects, NO I/O.
 * - El scheduler es agnóstico al MasteryEstimator: solo procesa outcome.
 * - `serialize/deserialize` deben ser inversas estrictas.
 */
export interface IScheduler {
  initial(): SchedulingState;

  next(
    state: SchedulingState,
    attempt: Pick<Attempt, 'outcome' | 'submittedAt' | 'scaffoldLevelReached'>,
    now: Date
  ): Result<SchedulingState, SchedulerError>;

  isDue(state: SchedulingState, now: Date): boolean;

  serialize(state: SchedulingState): string;
  deserialize(serialized: string): Result<SchedulingState, SchedulerError>;
}
```

### Extensión calibrable (FSRS-ready)

```ts
// src/ports/inference/IScheduler.ts (extensión)

/**
 * Parámetros calibrables del scheduler. Para SM-2 es vacío; para FSRS son los 17 weights.
 */
export type SchedulingParams = Readonly<Record<string, number | string>>;

export type CalibrationError =
  | { kind: 'insufficient_attempts'; needed: number; got: number }
  | { kind: 'optimization_failed'; reason: string }
  | { kind: 'algorithm_not_calibrable' };

/**
 * Contrato:
 * - Schedulers calibrables (FSRS) implementan esta extensión.
 * - SM-2 puede implementarla retornando `{ kind: 'algorithm_not_calibrable' }` en `calibrate`.
 * - Declaramos esta interfaz desde el MVP para evitar breaking change cuando llegue FSRS (Mes 5).
 */
export interface ICalibrableScheduler extends IScheduler {
  /**
   * Re-calibra parámetros del scheduler con un dataset de attempts del usuario.
   * SM-2 retorna `algorithm_not_calibrable`; FSRS optimiza weights.
   */
  calibrate(
    attempts: ReadonlyArray<Attempt>
  ): Promise<Result<SchedulingParams, CalibrationError>>;

  /**
   * Retorna una nueva instancia del scheduler con los params dados.
   * Uso típico: tras `calibrate()`, usar el resultado para crear el nuevo scheduler.
   */
  withParams(params: SchedulingParams): IScheduler;
}
```

### Esqueleto de implementación SM-2

```ts
// src/adapters/inference/Sm2Scheduler.ts
import { IScheduler, SchedulingState, SchedulerError } from '../../ports/inference/IScheduler';
import { Result, ok, err } from '../../core/result/Result';

interface Sm2Raw extends Record<string, number | string> {
  easeFactor: number;     // default 2.5, piso 1.3
  intervalDays: number;
  repetitions: number;
}

export class Sm2Scheduler implements IScheduler {
  private static readonly PARAMS_HASH = 'sm2-default-v1';

  initial(): SchedulingState {
    return {
      algorithm: 'sm2',
      version: 1,
      paramsHash: Sm2Scheduler.PARAMS_HASH,
      raw: { easeFactor: 2.5, intervalDays: 0, repetitions: 0 } satisfies Sm2Raw,
      nextDueAt: null
    };
  }

  next(state, attempt, now): Result<SchedulingState, SchedulerError> {
    if (state.algorithm !== 'sm2') {
      return err({ kind: 'algorithm_mismatch', expected: 'sm2', got: state.algorithm });
    }
    // TODO: aplicar fórmula SM-2 clásica. Mapear outcome → quality factor q ∈ [0..5]:
    //   correct + scaffold=0  => q=5
    //   correct + scaffold>0  => q=4 - scaffold (clamp 1..4)
    //   partial               => q=3
    //   incorrect             => q=2
    //   skipped               => q=1
    //   gave_up               => q=0
    // ... cálculo ease/interval/repetitions con piso EF >= 1.3 ...
    return ok(/* nuevo state */);
  }

  isDue(state, now) {
    return state.nextDueAt !== null && new Date(state.nextDueAt) <= now;
  }

  serialize(state) { return JSON.stringify(state); }
  deserialize(s)  { /* parseo seguro con zod o similar */ return ok(/* state */); }
}
```

---

## `IMasteryEstimator`

```ts
// src/ports/inference/IMasteryEstimator.ts
import type { Result } from '../../core/result/Result';
import type { Attempt } from '../../core/entities/Attempt';
import type { MasteryState } from '../../core/entities/MasteryState';

export type MasteryEstimatorError =
  | { kind: 'insufficient_evidence'; needed: number; got: number }
  | { kind: 'inconsistent_attempts'; reason: string };

/**
 * Contrato:
 * - PURO: no toca DB ni LLM. Recibe attempts ya cargados y retorna el nuevo state.
 * - El consumidor decide cuántos attempts pasar (ventana de recencia configurable).
 * - `confidence(state)` retorna [0,1]; 0 = sin evidencia, 1 = altísima certeza.
 *   En MVP heurístico: f(n_attempts, recency, consistency_of_outcomes).
 */
export interface IMasteryEstimator {
  estimate(
    conceptId: string,
    attempts: ReadonlyArray<Attempt>,
    previous: MasteryState | null,
    now: Date
  ): Result<MasteryState, MasteryEstimatorError>;

  confidence(state: MasteryState): number; // [0,1]
}
```

### Esqueleto de implementación heurística

```ts
// src/adapters/inference/HeuristicMasteryEstimator.ts
export class HeuristicMasteryEstimator implements IMasteryEstimator {
  constructor(private readonly scheduler: IScheduler) {}

  estimate(conceptId, attempts, previous, now) {
    // 1. accuracy_window: últimas N=5, peso por recencia exponencial
    // 2. scaffold trajectory: media móvil de scaffold_level_reached
    // 3. SM-2 update via this.scheduler.next(...)
    // 4. confidence = clamp(0, n_attempts/10 * consistency, 1)
    // 5. mastery_label derivado de accuracy_window + confidence + decay
    // TODO
  }

  confidence(state) {
    // basado en n_attempts efectivos + dispersión del accuracy_window
    // TODO
    return 0;
  }
}
// [REQUIERE VALIDACIÓN POST-MVP]: la fórmula heurística vs BKT/IRT
```

---

## `ILLMProvider` — BYOK unificado

> **D-A1 ratificada**: interfaz unificada con `capabilities()`, NO interfaces específicas por feature. Razón: agregar el 7º provider no toca use cases. Las diferencias se exponen como features opcionales de `capabilities()`, no como contratos distintos.

```ts
// src/ports/llm/ILLMProvider.ts
import type { Result } from '../../core/result/Result';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: readonly string[];
  tools?: ReadonlyArray<{ name: string; description: string; schema: object }>;
  /** Si el adapter soporta cacheo (Anthropic prompt caching, etc.), aplica */
  cacheable?: boolean;
}

export interface LLMCompletion {
  text: string;
  finishReason: 'stop' | 'length' | 'tool_call' | 'content_filter' | 'error';
  toolCalls?: ReadonlyArray<{ name: string; args: unknown }>;
  usage: { inputTokens: number; outputTokens: number; cachedTokens?: number };
}

export interface ProviderCapabilities {
  readonly name: string;                 // 'anthropic' | 'openai' | ...
  readonly contextWindowTokens: number;
  readonly supportsTools: boolean;
  readonly supportsStreaming: boolean;
  readonly supportsPromptCaching: boolean;
  readonly supportsJsonMode: boolean;
  readonly maxOutputTokens: number;
  readonly isLocal: boolean;             // true para Ollama/LM Studio (privacy implication)
}

export type LLMError =
  | { kind: 'auth'; message: string }            // BYOK: clave inválida o ausente
  | { kind: 'rate_limit'; retryAfterMs?: number }
  | { kind: 'context_overflow'; tokensRequired: number; max: number }
  | { kind: 'network'; cause: string }
  | { kind: 'provider'; status: number; message: string }
  | { kind: 'invalid_response'; reason: string };

/**
 * Contrato BYOK:
 * - El provider NUNCA persiste claves fuera de ~/.educagent/config.toml.
 * - El provider NO loguea contenido de prompts a archivos por default.
 * - capabilities() es síncrono y barato; complete() es asíncrono.
 * - completeStream() es opcional (chequear via capabilities.supportsStreaming).
 */
export interface ILLMProvider {
  capabilities(): ProviderCapabilities;

  complete(
    messages: ReadonlyArray<LLMMessage>,
    opts?: LLMCompletionOptions
  ): Promise<Result<LLMCompletion, LLMError>>;

  completeStream?(
    messages: ReadonlyArray<LLMMessage>,
    opts?: LLMCompletionOptions
  ): AsyncIterable<Result<{ deltaText: string } | LLMCompletion, LLMError>>;
}
```

### Esqueleto de implementación Anthropic

```ts
// src/adapters/llm/AnthropicLLMProvider.ts
export class AnthropicLLMProvider implements ILLMProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  capabilities() {
    return {
      name: 'anthropic',
      contextWindowTokens: 200_000,
      supportsTools: true,
      supportsStreaming: true,
      supportsPromptCaching: true,
      supportsJsonMode: false,
      maxOutputTokens: 8192,
      isLocal: false
    };
  }

  async complete(messages, opts) {
    // TODO: implementar contra @anthropic-ai/sdk, mapear errores a LLMError discriminated union
  }
}
```

---

## `ISourceProvider` — operacionaliza P8

Decisión clave: **una interfaz, tres adapters, un orquestador `CompositeSourceProvider`**. El use case nunca habla con `RagSourceProvider` directamente — habla con `ISourceProvider`, y la jerarquía RAG>Web>LLM la resuelve el composite. Si el día de mañana se invierte la jerarquía o se agrega una 4ta fuente, los use cases no cambian.

```ts
// src/ports/sources/ISourceProvider.ts
import type { Result } from '../../core/result/Result';
import type { ConfidenceTier } from '../../core/value-objects/ConfidenceTier';

export interface SourceQuery {
  prompt: string;
  projectId: string;
  /** Limite duro de tokens devueltos por todas las fuentes combinadas */
  maxTokens?: number;
  /** Si true, fuerza incluir LLM aunque RAG haya respondido. Usado para disenso P8 */
  includeLLMArbiter?: boolean;
  /** Si web está habilitada en el proyecto, esto la fuerza ON/OFF en esta query */
  webOverride?: 'enable' | 'disable' | 'project_default';
}

export interface SourceResult {
  content: string;
  sourceKind: 'rag' | 'web' | 'llm';
  confidenceTier: ConfidenceTier;
  /** Provenance — varía por kind: para RAG {sourceId, chunkIndex}; para web {url, fetchedAt}; para LLM {model, promptHash} */
  provenance: Readonly<Record<string, string | number>>;
  /** ID del Knowledge Source si fue persistido. null si es generación efímera. */
  knowledgeSourceId: string | null;
  /** Label listo para mostrar al usuario, ej "[RAG: book.pdf, p.12]" o "[GK]" */
  userVisibleLabel: string;
  /** Score interno de relevancia/confianza [0,1] (no se muestra al usuario) */
  relevance: number;
}

export type SourceProviderError =
  | { kind: 'web_disabled' }
  | { kind: 'no_rag_index' }
  | { kind: 'llm_unavailable'; cause: string }
  | { kind: 'all_sources_failed'; details: string };

/**
 * Contrato:
 * - Devuelve resultados ORDENADOS por jerarquía P8: RAG primero, web después, LLM último.
 * - Si RAG y LLM disienten significativamente, ambos vienen en el array
 *   (decisión de presentación es del use case EmitAgentTurn).
 * - El provider NO emite texto al usuario, NO etiqueta — solo provee data + labels precomputados.
 */
export interface ISourceProvider {
  query(q: SourceQuery): Promise<Result<ReadonlyArray<SourceResult>, SourceProviderError>>;
}
```

### Esqueleto del composite

```ts
// src/adapters/sources/CompositeSourceProvider.ts
export class CompositeSourceProvider implements ISourceProvider {
  constructor(
    private readonly rag: RagSourceProvider,
    private readonly web: WebSourceProvider,
    private readonly llm: LLMSourceProvider,
    private readonly projectConfig: IProjectConfigReader
  ) {}

  async query(q): Promise<Result<ReadonlyArray<SourceResult>, SourceProviderError>> {
    // 1. Try RAG. Si hay hits con relevance > 0.X, son tier=primary.
    // 2. Si RAG hits insuficientes (< 3 chunks) AND project.web_enabled AND q.webOverride != 'disable',
    //    consultar web. Tier=secondary.
    // 3. Si q.includeLLMArbiter OR (no hits anteriores), consultar LLM. Tier=tertiary.
    // 4. Devolver array ordenado por jerarquía P8.
    // TODO
  }
}
```
