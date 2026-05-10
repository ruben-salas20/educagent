# Arquitectura — EducAgent

Blueprint arquitectónico inicial del proyecto. Diseño Hexagonal (Ports & Adapters) con dominio puro al centro y todas las dependencias externas (LLM, SQLite, RAG, web, FS) abstractas en puertos.

> **Estado**: pre-MVP. El código aún no existe — esta carpeta es la especificación que la implementación debe seguir.

## Orden de lectura

| # | Documento | Propósito |
|---|---|---|
| 0 | [00-overview.md](./00-overview.md) | Principios rectores + regla de dependencia + decisiones tomadas tras revisión |
| 1 | [01-folder-structure.md](./01-folder-structure.md) | Árbol `src/` propuesto con justificación carpeta por carpeta |
| 2 | [02-schema-sqlite.md](./02-schema-sqlite.md) | DDL completo de las 12 entidades del Modelo del Estudiante + casos especiales |
| 3 | [03-interfaces.md](./03-interfaces.md) | 4 abstracciones core (`IScheduler` con `ICalibrableScheduler`, `IMasteryEstimator`, `ILLMProvider`, `ISourceProvider`) |
| 4 | [04-testing-setup.md](./04-testing-setup.md) | `vitest.config.ts` + 9 tests pin (uno por política P1-P9) |

## ADRs

| ADR | Decisión | Status |
|---|---|---|
| [ADR-0001-hexagonal.md](./adr/ADR-0001-hexagonal.md) | Arquitectura Hexagonal (Ports & Adapters) | Accepted |
| [ADR-0002-sm2-mvp-fsrs-future.md](./adr/ADR-0002-sm2-mvp-fsrs-future.md) | Scheduler SR: SM-2 en MVP, FSRS upgrade Mes 5 | Accepted |

## Cómo usar este blueprint

- **Si vas a implementar una feature**: leé `00-overview.md` para los principios. Después la sección de la entidad/política que tocás en `02-schema-sqlite.md` o `03-interfaces.md`.
- **Si vas a agregar un nuevo `LLMProvider`**: leé `03-interfaces.md` §3.4 y los adapters existentes en `src/adapters/llm/`.
- **Si vas a tocar una política P1-P9**: leé `04-testing-setup.md` §5.3 — los tests son tu guion.
- **Si dudás de una decisión arquitectónica**: chequeá los ADRs antes de proponer cambio.

## Reglas no negociables (atraviesan todo)

1. **Dominio puro al centro**. `core/` y `policies/` no importan nada de `adapters/` ni `cli/`. Enforced por linter en CI.
2. **`Attempts` son inmutables**. Trigger SQL + check en adapter (defense in depth). Derivados se recalculan.
3. **BYOK estructural**. El agente nunca hostea modelos ni proxy-ea claves.
4. **Privacy strict por default, computable por construcción**. El detalle del `AffectiveLog` en strict vive solo en RAM.
5. **Etiqueta de fuente por párrafo** (P8). `[RAG: doc, p.X]` / `[web: dominio · fecha]` / `[GK]` / `[RAG+GK]`.
