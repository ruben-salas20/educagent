# 01 · Estructura de carpetas

Árbol propuesto para `src/` con justificación carpeta por carpeta. Refleja arquitectura Hexagonal estricta donde `core/` y `policies/` no dependen de `adapters/` ni `cli/`.

---

## Árbol propuesto

```
educagent/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── .editorconfig
├── .nvmrc                          # 20.x
├── LICENSE                          # Apache-2.0
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── .github/
│   ├── workflows/                   # CI: lint + typecheck + test
│   └── ISSUE_TEMPLATE/
├── docs/
│   ├── PRD.md                       # ya existente, INMUTABLE
│   ├── research/                    # ya existente, INMUTABLE
│   ├── architecture/                # esta carpeta
│   └── adr/
│       └── ...                      # ADRs adicionales se agregan acá
│
├── src/
│   ├── core/                        # DOMINIO PURO — sin imports de adapters
│   │   ├── entities/
│   │   │   ├── Project.ts
│   │   │   ├── KnowledgeSource.ts
│   │   │   ├── Curriculum.ts
│   │   │   ├── CurriculumNode.ts
│   │   │   ├── Concept.ts
│   │   │   ├── Item.ts
│   │   │   ├── Attempt.ts           # value object inmutable
│   │   │   ├── MasteryState.ts
│   │   │   ├── MetacognitiveSignal.ts
│   │   │   ├── AffectiveLog.ts
│   │   │   ├── Session.ts
│   │   │   ├── SourceAttributionLog.ts
│   │   │   └── index.ts
│   │   ├── value-objects/
│   │   │   ├── Bloom.ts
│   │   │   ├── ConfidenceTier.ts
│   │   │   ├── ErrorType.ts
│   │   │   ├── Mode.ts              # socratic | architect | simulacro | explorer
│   │   │   ├── RetentionLevel.ts
│   │   │   ├── ScaffoldLevel.ts
│   │   │   └── Outcome.ts
│   │   ├── errors/
│   │   │   └── DomainError.ts       # jerarquía de errores de dominio
│   │   └── result/
│   │       └── Result.ts            # Result<T, E> — sin throw cross-layer
│   │
│   ├── policies/                    # P1-P9 como funciones puras
│   │   ├── p1-feedback.ts
│   │   ├── p2-scaffolding.ts
│   │   ├── p3-anti-sycophancy.ts
│   │   ├── p4-off-ramps.ts
│   │   ├── p5-metacog-capture.ts
│   │   ├── p6-tone.ts
│   │   ├── p7-calibration.ts
│   │   ├── p8-epistemic.ts
│   │   ├── p9-bootstrap.ts
│   │   └── index.ts
│   │
│   ├── ports/                       # INTERFACES — contratos del dominio hacia afuera
│   │   ├── persistence/
│   │   │   ├── IAttemptRepository.ts
│   │   │   ├── IMasteryStateRepository.ts
│   │   │   ├── IConceptRepository.ts
│   │   │   ├── ISessionRepository.ts
│   │   │   ├── IKnowledgeSourceRepository.ts
│   │   │   ├── IAffectiveLogRepository.ts
│   │   │   └── IUnitOfWork.ts       # transacciones
│   │   ├── inference/
│   │   │   ├── IScheduler.ts        # SM-2 → FSRS migración futura
│   │   │   ├── IMasteryEstimator.ts
│   │   │   └── IAffectiveInferencer.ts
│   │   ├── sources/
│   │   │   ├── ISourceProvider.ts   # RAG | web | LLM unificado
│   │   │   └── IRagIndex.ts         # subordinado, low-level
│   │   ├── llm/
│   │   │   ├── ILLMProvider.ts      # BYOK
│   │   │   └── ITokenizer.ts
│   │   ├── infra/
│   │   │   ├── IClock.ts            # inyectable para tests
│   │   │   ├── IRandom.ts           # determinismo en tests
│   │   │   ├── IFileSystem.ts
│   │   │   ├── ILogger.ts
│   │   │   └── IConfigStore.ts      # ~/.educagent/config.toml
│   │   └── index.ts
│   │
│   ├── adapters/                    # IMPLEMENTACIONES — dependen de ports
│   │   ├── persistence/
│   │   │   └── sqlite/
│   │   │       ├── SqliteAttemptRepository.ts
│   │   │       ├── SqliteMasteryStateRepository.ts
│   │   │       ├── ...
│   │   │       ├── SqliteUnitOfWork.ts
│   │   │       ├── migrations/
│   │   │       │   ├── 0001_initial.sql
│   │   │       │   ├── 0002_indexes.sql
│   │   │       │   └── README.md
│   │   │       ├── mappers/         # row ↔ entity
│   │   │       └── connection.ts
│   │   ├── llm/
│   │   │   ├── AnthropicLLMProvider.ts
│   │   │   ├── OpenAILLMProvider.ts
│   │   │   ├── OllamaLLMProvider.ts
│   │   │   ├── LmStudioLLMProvider.ts
│   │   │   ├── OpenRouterLLMProvider.ts
│   │   │   ├── GeminiLLMProvider.ts
│   │   │   └── providerFactory.ts
│   │   ├── sources/
│   │   │   ├── RagSourceProvider.ts        # consulta RAG local
│   │   │   ├── WebSourceProvider.ts        # web search (opt-in)
│   │   │   ├── LLMSourceProvider.ts        # fallback GK
│   │   │   └── CompositeSourceProvider.ts  # orquesta jerarquía RAG>Web>LLM
│   │   ├── rag/
│   │   │   ├── LocalRagIndex.ts            # sqlite-vss o similar
│   │   │   └── chunkers/
│   │   ├── inference/
│   │   │   ├── Sm2Scheduler.ts
│   │   │   ├── HeuristicMasteryEstimator.ts
│   │   │   └── ProxyAffectiveInferencer.ts # latencia + lexicon
│   │   ├── infra/
│   │   │   ├── SystemClock.ts
│   │   │   ├── NodeFileSystem.ts
│   │   │   ├── TomlConfigStore.ts
│   │   │   └── PinoLogger.ts
│   │   └── index.ts
│   │
│   ├── app/                         # CASOS DE USO (orquestación)
│   │   ├── use-cases/
│   │   │   ├── StartSession.ts
│   │   │   ├── SubmitAttempt.ts          # caso central
│   │   │   ├── SelectNextItem.ts         # aplica P7
│   │   │   ├── BootstrapCurriculum.ts    # aplica P9
│   │   │   ├── EmitAgentTurn.ts          # aplica P1, P3, P6, P8
│   │   │   ├── HandleOffRamp.ts          # aplica P4
│   │   │   ├── IngestKnowledgeSource.ts
│   │   │   ├── PurgePrivacy.ts
│   │   │   └── ExportProject.ts
│   │   ├── composition-root.ts           # wiring de adapters → ports
│   │   └── container.ts                  # DI manual (sin framework)
│   │
│   └── cli/                          # CAPA DE PRESENTACIÓN — Ink + Chalk
│       ├── bin.ts                    # entrypoint (#!/usr/bin/env node)
│       ├── commands/
│       │   ├── init.ts
│       │   ├── learn.ts              # comando principal
│       │   ├── privacy.ts            # /privacy show|set|export|purge
│       │   ├── config.ts
│       │   └── doctor.ts             # diagnóstico de setup
│       ├── components/               # Ink components
│       │   ├── AgentTurn.tsx
│       │   ├── ItemPrompt.tsx
│       │   ├── ScaffoldMenu.tsx
│       │   ├── SourceLabel.tsx       # render P8 etiquetas
│       │   ├── ModeIndicator.tsx     # 🧙‍♂️ 🗺️ ⏱️ ☕
│       │   └── MetricsPanel.tsx
│       ├── i18n/
│       │   ├── es.ts
│       │   ├── en.ts
│       │   └── index.ts              # agent_language vs material_language
│       └── theme.ts                  # chalk styles
│
└── tests/                            # espejo de src/
    ├── core/
    ├── policies/                     # ⭐ tests pedagógicos críticos
    ├── adapters/
    │   └── persistence/sqlite/
    ├── app/
    └── fixtures/
        ├── attempts.factory.ts
        ├── mastery.factory.ts
        ├── concepts.factory.ts
        └── llm-stub.ts
```

---

## Regla de dependencia

```
cli ──▶ app ──▶ core (entities, policies)
                  ▲
                  │
adapters ─────────┘  (implementan ports definidos en core/ports)

ports ─▶ core (importan tipos del dominio)
```

**Cumple hexagonal estricto**: `core/` y `policies/` **no importan nada** de `adapters/`, `cli/` o librerías externas (salvo `zod` para parsing defensivo en bordes del dominio si se decide usar). Linter rule en CI: `eslint-plugin-boundaries` o equivalente para enforced compile-time.

---

## Justificación de decisiones

- **`policies/` como carpeta hermana de `core/entities/`**: las políticas son **lógica de dominio especializada**, no servicios de aplicación. Vivir en `app/` las acoplaría a casos de uso. Como funciones puras (`policy(input) → decision`), son testeables sin orquestación. Esto refleja el principio §0.1 de [00-overview.md](./00-overview.md).

- **`app/use-cases/` como capa explícita**: no es Clean Architecture estricta (no hay `interactor` + `presenter` + `controller`), pero sí hay separación entre orquestación (`app/`) y dominio (`core/`). Trade-off: menos boilerplate, suficiente para un MVP CLI single-user.

- **`adapters/persistence/sqlite/` con `mappers/` explícitos**: sin ORM, los mappers row↔entity son código que no quiero esparcido. Centralizarlo facilita migraciones.

- **`cli/` separada de `app/`**: Ink se cambia mañana por una web UI sin tocar `app/`. Decisión barata.

- **`composition-root.ts`**: wiring manual de dependencias. NO usamos `inversify` ni `tsyringe`. Para un MVP con ~15 adapters el costo cognitivo de un container DI no se justifica. Una función `buildContainer(config): AppContainer` es suficiente y rastreable.

- **Tests espejo**: convención de mantenimiento. Si existe `src/policies/p3-anti-sycophancy.ts`, existe `tests/policies/p3-anti-sycophancy.test.ts`.

---

## Trade-off declarado: ¿clean architecture estricta?

Considerada y descartada. Clean estricta exige `request/response` DTOs por caso de uso, `presenter` aparte del controller, y `entity gateways`. Para un CLI single-user, eso es ceremonia que no compra nada: no hay UI múltiple, no hay equipo grande, no hay testing de presenters separados. Lo que importa — **dominio testeable e independiente de infra** — lo logramos con hexagonal + use cases. Si post-MVP aparece una UI web o un daemon, se reconsidera.

Ver discusión completa de alternativas en [ADR-0001-hexagonal.md](./adr/ADR-0001-hexagonal.md).
