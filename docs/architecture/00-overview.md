# 00 · Overview — Principios y decisiones tomadas

**Versión**: 0.1 (blueprint pre-MVP)
**Status**: aprobado — base sobre la que arranca implementación
**Audiencia**: futuros colaboradores M4, dueño del proyecto, agentes implementadores

> Este documento es un **blueprint**, no una especificación cerrada. Las interfaces, el schema y la estructura de carpetas son propuestas justificadas. Lo que está marcado `[REQUIERE VALIDACIÓN POST-MVP]` o `[heurística operativa]` debe revisarse con datos reales.

---

## Principios rectores

Cinco principios que atraviesan todas las decisiones del blueprint. Si una decisión los viola, está mal — no al revés.

1. **Dominio puro al centro**. Las políticas P1-P9 son funciones puras sin side effects, sin I/O, sin LLM, sin DB. Esto NO es purismo — es la única forma de testear las políticas con Vitest sin mocks pesados y sin que un cambio de proveedor LLM rompa los tests pedagógicos.
2. **Attempts son inmutables, todo lo demás se deriva**. Es la "regla de oro" del Modelo del Estudiante (`docs/research/03-modelo-estudiante.md` §5.6). El schema lo enforced, el adapter lo enforced, y el dominio asume que `MasteryState` puede recalcularse desde `Attempts` en cualquier momento. Si esto se viola, la auditoría pedagógica se rompe.
3. **BYOK es estructural, no feature**. `ILLMProvider` es un puerto del primer día. NO existe un "modo default con clave del proyecto" — el agente sin clave configurada NO arranca un proyecto, da error explícito con instrucciones de configuración.
4. **Las 3 fuentes (RAG/Web/LLM) son un puerto, no tres puertos**. `ISourceProvider` unifica la jerarquía pedagógica P8. Cualquier afirmación del agente pasa por este puerto y sale con `confidence_tier` etiquetado.
5. **Privacy strict por default, computable por construcción**. El nivel de retención no es un flag que se chequea al final — es un parámetro del adapter de persistencia que decide qué se serializa y qué se colapsa en agregado.

---

## Regla de dependencia (flechas)

```
cli ──▶ app ──▶ core (entities, policies)
                  ▲
                  │
adapters ─────────┘  (implementan ports definidos en core/ports)

ports ─▶ core (importan tipos del dominio)
```

**Hexagonal estricto**: `core/` y `policies/` **no importan nada** de `adapters/`, `cli/` o librerías externas (salvo `zod` para parsing en bordes del dominio si se decide usar). Linter rule en CI: `eslint-plugin-boundaries` o equivalente para enforcement compile-time.

---

## Decisiones tomadas tras revisión

Cuatro decisiones se cerraron tras revisión del dueño del proyecto. Quedan ratificadas en el blueprint.

### D-A1 · `ILLMProvider` unificado con `capabilities()`

✅ **Cerrada**: una sola interfaz `ILLMProvider`, no interfaces específicas por feature (`IToolCallingLLM`, `IStreamingLLM`, etc).

- **Razón**: agregar el 7º provider no toca use cases.
- **Costo aceptado**: los consumidores pueden necesitar ramificaciones del tipo `if (!provider.capabilities().supportsTools) { fallback }`. Las diferencias se exponen como features opcionales de `capabilities()`, no como contratos distintos.
- **Implementación**: ver [03-interfaces.md §3.4](./03-interfaces.md).

### D-A2 · `observed_difficulty` on-demand con cache

✅ **Cerrada**: el `observed_difficulty` de cada `Item` se recalcula **on-demand** en `SelectNextItem`, persistido como cache en columna del item.

- **Razón**: `SubmitAttempt` queda barato (write atomic + fire-and-forget para mastery). El cómputo costoso ocurre cuando ya estamos en momento costoso (selección).
- **Trade-off**: si la heurística de cache se invalida (ej. tras N attempts nuevos), hay un recálculo. Aceptable para MVP.
- **Implementación**: ver [02-schema-sqlite.md §2.2 (items.observed_difficulty)](./02-schema-sqlite.md) y la lógica en `SelectNextItem` use case.

### D-A3 · Privacy strict by design para `AffectiveLog`

✅ **Cerrada**: en modo `retention_level = 'strict'` (default), el detalle del `AffectiveLog` vive **solo en RAM** durante la sesión. Al cierre se persiste solo el agregado anonimizado en `affective_aggregates`.

- **Razón**: coherencia con el principio §0.5 (privacy strict computable por construcción). El detalle nunca toca disco en strict.
- **Costo aceptado**: si el proceso crashea mid-sesión, perdemos toda la inferencia afectiva de esa sesión. Trade-off aceptado por el dueño.
- **Modos `standard` y `full`**: persisten detalle (con TTL en standard, sin TTL en full) — pero requieren opt-in explícito del usuario.
- **Implementación**: el adapter `SqliteAffectiveLogRepository` decide qué persistir según `retention_level` del proyecto. Ver [02-schema-sqlite.md §2.2 (affective_logs / affective_aggregates)](./02-schema-sqlite.md).

### D-S1 · Rating del `Attempt` 5-valued automático

✅ **Cerrada**: el `outcome` del `Attempt` es **5-valued automático** (`correct | partial | incorrect | skipped | gave_up`), deducido por el agente desde la respuesta del usuario + `scaffold_level_reached`. NO se pide rating explícito al usuario (estilo Anki: Again/Hard/Good/Easy).

- **Razón**: encaja con anti-fatiga P5 (máx 2 prompts metacog/hora) y con espíritu del producto (no interrumpir flujo Socrático/Simulacro). La deducción automática suele ser más precisa que self-rating cuando ya tenemos latencia, retries y scaffold level.
- **Mapping a quality factor para SM-2**: `outcome → q ∈ [0..5]` calculado en `policies/p7-calibration.ts`. Compatible con FSRS post-MVP (decisión D-T1, ver [ADR-0002](./adr/ADR-0002-sm2-mvp-fsrs-future.md)).
- **Implementación**: ver [02-schema-sqlite.md §2.2 (attempts.outcome CHECK)](./02-schema-sqlite.md).
