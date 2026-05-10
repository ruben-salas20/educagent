# ADR-0001: Arquitectura Hexagonal (Ports & Adapters)

## Status
Accepted — 2026-05-10

## Context

EducAgent es un CLI tutor pedagógico que debe satisfacer simultáneamente:

1. **BYOK obligatorio** sobre 6 proveedores LLM heterogéneos (Anthropic, OpenAI,
   Ollama, LM Studio, OpenRouter, Gemini). El usuario elige y cambia.
2. **9 políticas operativas (P1-P9)** que son lógica pedagógica densa, testeable
   en aislamiento. Esas políticas deben sobrevivir a cualquier cambio de
   proveedor, de DB, o de UI.
3. **3 fuentes de información** (RAG / Web / LLM) con jerarquía pedagógica P8
   que debe poder evolucionar sin tocar callsites.
4. **Schema SQLite mutable**: SM-2 puede migrar a FSRS, MasteryEstimator
   heurístico puede migrar a BKT/IRT. Las decisiones de algoritmo son `[REQUIERE
   VALIDACIÓN POST-MVP]`.
5. **Proyecto open-source con colaboradores M4**: la curva de entrada debe ser
   moderada, no exigir conocimiento profundo de un framework DI o de un
   meta-arquitectura abstracta.
6. El dueño del proyecto declara explícitamente en su CLAUDE.md global la
   preferencia por **Clean / Hexagonal / Screaming Architecture** como base.

Constraint negativo: ningún antipatrón del PRD (streaks, recognition disfrazada
de recall, LLM-haciendo-cómputo, etc.) puede estar habilitado por la
arquitectura. La arquitectura debe hacer que el camino correcto sea el camino
fácil.

## Decision

Adoptamos **Arquitectura Hexagonal (Ports & Adapters)** con la siguiente
estructura de capas:

- **`core/`** — entidades del dominio + value objects + errores. Cero
  dependencias externas (salvo `zod` para parsing defensivo en bordes).
- **`policies/`** — P1-P9 como funciones puras. Carpeta hermana de `core/`
  porque son lógica de dominio especializada.
- **`ports/`** — interfaces TypeScript (`IScheduler`, `IMasteryEstimator`,
  `ILLMProvider`, `ISourceProvider`, repos, `IClock`, etc.).
- **`adapters/`** — implementaciones concretas (SQLite, Anthropic SDK, RAG
  local, etc.) que dependen de `ports/` pero a las que `core/` y `policies/`
  jamás importan.
- **`app/`** — casos de uso (orquestación) + composition root.
- **`cli/`** — Ink + Chalk. Capa de presentación reemplazable.

La regla de dependencia se enforced con `eslint-plugin-boundaries` en CI: una
violación rompe el build.

## Alternativas consideradas

### A. 3-tier MVC tradicional (controller / service / repository)

Descartado. Los "services" tienden a convertirse en bolsas de procedimientos
acoplados a la DB. P1-P9 quedarían diluidas entre services genéricos, perdiendo
su naturaleza de **políticas pedagógicas inspeccionables**. Además, MVC no
ofrece un modelo claro para alternar entre 6 providers LLM sin if-cascadas.

### B. Modular monolith con feature folders (`features/feedback/`, `features/mastery/`)

Descartado para MVP, considerado para post-MVP. Atractivo por proximidad
cognitiva del código relacionado, pero acopla dominio + persistencia +
presentación en una misma carpeta. Las **políticas pedagógicas son
transversales a features** (P3 corre en cada turno del agente, no en un
feature aislado). Forzaría una capa "shared" que terminaría siendo el dominio
disfrazado. Si EducAgent crece a 10+ contextos delimitados, se reconsidera.

### C. Clean Architecture estricta (Uncle Bob)

Descartado por sobre-ingeniería para MVP single-user. Exige `RequestModel` /
`ResponseModel` por caso de uso, `Presenter` separado del controller,
`Entity Gateway` separado de `Repository`. La ganancia (testabilidad,
intercambio de UI) la tenemos con hexagonal + use cases sin ese costo de
ceremonia. **No es que Clean esté mal — es que paga su precio en proyectos con
múltiples UIs o múltiples equipos. EducAgent MVP no es ninguno de esos.**

### D. Event-driven / CQRS

Descartado para MVP. SQLite local + un solo agente CLI no justifica la
complejidad de un bus de eventos ni la separación read/write. Sin embargo,
hay una **semilla event-driven implícita**: `Attempt` es un evento inmutable,
y todo derivado (`MasteryState`, agregados) es un *projection*. Esto deja la
puerta abierta a CQRS post-MVP sin reescribir nada — solo agregando una capa
de proyecciones explícitas.

## Consequences

### Lo que ganamos

- **Testabilidad pedagógica directa**: P1-P9 se testean con Vitest sin levantar
  LLM ni DB. Esto es CRÍTICO porque las políticas son el corazón del producto.
- **BYOK trivial**: agregar un 7º provider es crear un archivo en
  `adapters/llm/`. Cero cambios en use cases.
- **Migración SM-2 → FSRS sin rewrites**: el contrato `IScheduler` lo permite.
- **Adapters de fuentes intercambiables**: el día que se quiera meter Perplexity
  como `WebSourceProvider`, se reemplaza el adapter.
- **Lectura del código guiada por la lectura del PRD**: alguien que leyó el PRD
  encuentra `policies/p7-calibration.ts` y sabe qué esperar.

### Lo que pagamos

- **Más archivos, más boilerplate**: cada port tiene su interface separada.
  Para 4 entidades simples, MVC sería más corto.
- **Curva de entrada para colaboradores no familiarizados**: alguien que viene
  de Express/Next.js tradicional necesita asimilar la regla de dependencia.
  Mitigación: CONTRIBUTING.md con un diagrama y un walkthrough de "cómo agregar
  un nuevo adapter".
- **DI manual en `composition-root.ts`**: si el grafo de dependencias crece a
  50+ nodos, va a doler. Mitigación: se considera entonces (no antes)
  `tsyringe` o factories tipadas.
- **Discrepancia con MVPs típicos en npm**: algunos colaboradores van a
  cuestionar el over-engineering. Hay que poder defenderlo con los puntos de
  "lo que ganamos".

### Lo que NO resuelve esta decisión

- Cómo modelar errores cross-layer (`Result<T,E>` vs throw) — se decidió
  `Result<T,E>` en el blueprint, podría merecer ADR aparte si surge debate.
- Estrategia de migraciones SQL — ADR aparte si crece complejidad.
- Política de caching del LLM provider (Anthropic prompt caching) — decisión
  del adapter, no de la arquitectura.

## Referencias

- PRD v1.1, sección §10 (decisiones cerradas).
- `docs/research/03-modelo-estudiante.md` §5.6 (regla de oro: Attempts inmutables,
  derivados recalculables — encaja naturalmente con hexagonal + projections).
- CLAUDE.md global del dueño del proyecto: "Clean/Hexagonal/Screaming
  Architecture, container-presentational pattern".
- Cockburn, A. (2005). *Hexagonal Architecture*.
