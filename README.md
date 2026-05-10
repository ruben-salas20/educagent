# EducAgent

> CLI tutor inteligente con política pedagógica explícita, base psicopedagógica y transparencia epistémica. No es un chatbot educativo más.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg)](#estado-actual)
[![Docs: ES](https://img.shields.io/badge/docs-español-brightgreen.svg)](docs/PRD.md)

---

## Estado actual

**EducAgent está en fase de diseño y arquitectura. Aún NO hay binario instalable, ni código publicado en este repositorio.** Lo que sí existe:

- **PRD canónico v1.1** completo, con 10 decisiones cerradas y caveats científicos explícitos: [`docs/PRD.md`](docs/PRD.md).
- **Corpus de investigación psicopedagógica** (5 documentos): [`docs/research/`](docs/research/).
- **Licencia Apache 2.0**: [`LICENSE`](LICENSE).
- **Código de conducta** (Contributor Covenant 2.1): [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

**Qué se puede hacer hoy**: leer el PRD, entender la tesis pedagógica, abrir issues con feedback crítico, proponer alternativas con argumentación. Cuando llegue el código, esa discusión previa va a ser parte del producto.

---

## Qué es EducAgent

EducAgent es un agente de IA en terminal que actúa como **tutor con identidad pedagógica explícita**, no como un asistente conversacional genérico. Opera sobre material que el usuario provee (PDFs, Markdown, código), construye un modelo evolutivo de su aprendizaje, y conduce sesiones bajo modos con reglas distintas para feedback, scaffolding y selección de ítems.

Está pensado para el cuadrante **"alto rigor metacognitivo × alta autonomía"**: estudiante técnico autodidacta o universitario, cómodo en terminal, perfil anti-inmediatez, bilingüe ES/EN típico.

Opera con **4 modos explícitos** más un modo bootstrap implícito:

| Modo | Propósito |
|---|---|
| 🧙‍♂️ **Socrático** | Construcción de comprensión por preguntas, con escalada lenta de scaffold y disenso firme. |
| 🗺️ **Arquitecto** | Planificación, diseño y descomposición con productive failure (Kapur). |
| ⏱️ **Simulacro** | Evaluación auténtica bajo restricción, feedback diferido al cierre. |
| ☕ **Explorador** | Apertura, mapeo, conexiones — con retrieval forzado para combatir fluency illusion. |
| **Tutor (bootstrap)** | Co-construcción de currículum cuando no hay material, vía 5 preguntas diagnósticas. |

---

## Filosofía

Lo que **NO somos**: no somos Duolingo (sin streaks, sin XP, sin ranking), no somos Khanmigo (no socratismo poroso ni LLM haciendo aritmética), no somos Anki puro (no recognition disfrazada de recall). Combatimos la **fluency illusion** y la **sycophancy** con retrieval forzado al final de toda explicación prolongada, scaffolding graduado con criterios explícitos de bajada y fading, calibración metacognitiva pre/post-confidence visible, y disenso explícito con evidencia. El feedback siempre va al proceso o la estrategia, nunca a la capacidad innata.

---

## Características distintivas

- **Transparencia epistémica**: cada párrafo de la respuesta etiqueta su fuente — `[RAG: archivo, p.X]`, `[web: dominio · fecha]`, `[GK]` (general knowledge sin verificación), `[RAG+GK]`. Jerarquía explícita: RAG > web > LLM.
- **Anti-sycophancy operativa**: lista negra de regex bilingüe ES+EN sobre el output **antes de imprimir**. Si hay match, se regenera.
- **Modelo del estudiante consultable**: `/student show` revela mastery, calibración, gaps, trayectoria de scaffolding. No es caja negra.
- **Privacidad strict por default**: las señales afectivas se colapsan a agregados anónimos al cerrar sesión. Sin red en MVP. Telemetría: opt-in y sin endpoint remoto.
- **BYOK (Bring Your Own Keys)**: el agente no hostea modelos ni proxy-ea llamadas. Vos conectás tu Claude / OpenAI / Gemini / OpenRouter / Ollama / LM Studio. Routing por modo configurable.
- **Métricas pedagógicamente válidas**: calibración, ZDP-time, retention curve, distribución de errores, trayectoria de scaffolding, cobertura. Sin streaks, XP ni ranking — explícitamente vetados.
- **Local-first con SQLite**: el producto funciona 100% sin red. Tus datos nunca salen de tu máquina por default.

---

## Stack técnico

TypeScript + **Ink** (TUI tipo React para terminal) + **SQLite** (persistencia local) + **Vercel AI SDK** (orquestación multi-provider, buen match con BYOK) + **Chalk** (styling). Scheduler de spaced repetition: **SM-2** con interfaz `IScheduler` para evaluar migración a FSRS post-MVP.

Defaults técnicos del entorno (propuestos como sensatos, ratificables):

- **Node**: 20+ LTS.
- **Package manager**: `pnpm`.
- **Versionado**: SemVer 2.0.

---

## Roadmap (6 meses)

| Fase | Cuándo | Qué |
|---|---|---|
| **MVP** | M1-M3 | Socrático + Explorador + Tutor bootstrap, RAG local, modelo del estudiante mínimo (Attempts inmutables + MasteryState básico), políticas P1-P9 en versión MVP, BYOK con ≥2 providers en CI. |
| **Validación** | M4 | Onboarding de 2-3 colaboradores externos (no beta pública), exportación manual de logs, validación de heurísticas marcadas `[REQUIERE VALIDACIÓN POST-MVP]`. |
| **Iteración** | M5-M6 | Spike y decisión FSRS, segundo modo (Arquitecto o Simulacro según demanda real), primer release público v0.1.0. |

Detalle completo y fuera-de-scope explícito en [`docs/PRD.md`](docs/PRD.md), sección 12.

---

## Cómo seguir el proyecto ahora (pre-código)

1. **Leé el PRD** ([`docs/PRD.md`](docs/PRD.md)) — es el documento canónico, ~8500 palabras, con 10 decisiones cerradas. No hay roadmap secreto.
2. **Mirá el corpus de investigación** ([`docs/research/`](docs/research/)) — la tesis pedagógica está fundada en literatura empírica replicada, no en intuición.
3. **Abrí un issue** con feedback, dudas, propuestas de implementación, casos de uso reales que el PRD no cubre, o evidencia que contradiga alguna heurística.
4. **Cuando haya código**, los caminos para contribuir están en [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Quick install (próximamente)

> Esta sección es **placeholder**. No funciona todavía — el binario aún no existe.

```bash
# Instalación (cuando el primer release v0.1.0 esté publicado)
pnpm install -g educagent

# Inicio en un directorio con material de estudio
cd ~/estudios/mi-curso
educagent init

# Sin material → activa flujo Tutor bootstrap (P9)
educagent init --no-sources

# Sesiones
educagent learn        # modo Socrático (default)
educagent explore      # modo Explorador

# Comandos in-session
/mode socratic|explorer|tutor
/student show          # vista del modelo del estudiante
/sources [verbose|compact|off]
/privacy show|set|export|purge
/help                  # menú de niveles 1-5 de scaffold
/quit
```

---

## Documentación

- **PRD canónico v1.1**: [`docs/PRD.md`](docs/PRD.md)
- **Corpus de investigación** (mapa fundacional, políticas operativas, fuentes, modelo del estudiante, benchmark, síntesis ejecutiva): [`docs/research/`](docs/research/)
- **Cómo contribuir**: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **Código de conducta**: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- **Licencia**: [`LICENSE`](LICENSE)

---

## Licencia

[Apache 2.0](LICENSE). Permissividad similar a MIT, con cláusula explícita de patentes y atribución requerida. Razonamiento completo en el PRD §3.2 y D-M-OS1.

---

## Notas de honestidad

Las heurísticas operativas del agente (umbrales de off-ramp, cadencia de prompts metacognitivos, criterios de fading) están marcadas explícitamente en el PRD como `[heurística operativa]` y `[REQUIERE VALIDACIÓN POST-MVP]`. No se ocultan detrás de marketing. La validación M4 con 2-3 colaboradores externos es exactamente eso: un experimento controlado para refinar esas heurísticas con datos reales, no un lanzamiento.

Las decisiones psicopedagógicas que pueden parecer extrañas a un dev sin contexto (por qué Attempts son inmutables, por qué no hay streaks, por qué el LLM nunca hace aritmética) van a estar documentadas en ADRs cuando llegue el código.

> README en inglés: TODO post-MVP.
