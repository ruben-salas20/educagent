# Contribuir a EducAgent

Gracias por considerar contribuir. Antes de cualquier cosa: si pensás aportar algo más allá de un typo, **leé el PRD canónico** ([`docs/PRD.md`](docs/PRD.md)) — es la fuente de verdad del proyecto, ~8500 palabras, con 10 decisiones cerradas y caveats científicos explícitos. Sin esa lectura, las propuestas suelen chocar contra constraints duros que ya están resueltos.

Este proyecto está en **fase de diseño** (pre-MVP). Aún no hay código. La forma de contribuir más útil hoy es **conceptual**, no técnica.

---

## Lo que NO es negociable

Esta sección está al inicio a propósito. Si una propuesta viola algo de acá, no entra — sin importar cuán bien implementada esté.

### Los 6 antipatrones vetados

Constraints duros del producto, no opiniones (PRD §5.3):

1. **Streaks, hearts, XP, ranking** estilo Duolingo — erosionan motivación intrínseca (Deci & Ryan).
2. **LLM haciendo cómputo aritmético o ejecutando código** — se delega siempre a tools deterministas. Caso de referencia: Khanmigo fallando en `343-17`.
3. **Recognition disfrazada de recall** — solo recall genuino cuenta.
4. **Socratismo poroso** — preguntas que se rinden ante la primera presión del usuario.
5. **Engagement-as-proxy** — tiempo en app NO es métrica positiva.
6. **Sycophancy** ("¡excelente pregunta!", "¡qué buena observación!") — destruye señal pedagógica. Hay regex de bloqueo bilingüe ES+EN sobre el output pre-emisión.

### Caveats científicos no negociables

Del PRD, Anexo C:

- **VAK (estilos de aprendizaje visual/auditivo/kinestésico): REFUTADO** (Pashler et al. 2008). No usar, no tests de estilo, no segmentación. Si alguien propone agregarlo, la respuesta es: revisar la evidencia.
- **Growth mindset**: replicación débil (Sisk et al. 2018). Reemplazado por el componente atribucional de **Weiner (1985)** — atribuciones internas, controlables, inestables (esfuerzo, estrategia), no frases motivacionales vacías.
- **Pomodoro y técnicas de timing rígido**: base folclórica, **out of scope MVP**. Si emerge demanda en M4, se evalúa sin promesas pseudocientíficas.

Una PR que viole cualquiera de estos puntos no entra.

### Regla de Attempts inmutables

Los `Attempt` son el átomo del modelo del estudiante. **Nunca se editan ni se borran** (excepto purga explícita por privacidad). Toda inferencia derivada (mastery, calibración, retención, scaffold trajectory) se recalcula desde Attempts. Si necesitás invalidar evidencia, recalculás derivados — no tocás los Attempts. Detalle en PRD §8.3.

### Privacidad strict por default

El default es `strict` (señales afectivas se colapsan a agregados anónimos al cerrar sesión). No se degrada el default. No se exfiltra. No se agrega telemetría sin opt-in explícito. **Cero red en MVP** (D-M-OS2). Cualquier PR que introduzca llamadas remotas implícitas se rechaza.

---

## Tipos de contribución

### Más útil ahora (pre-código)

- **Feedback al PRD**: contraargumentos con evidencia, casos de borde no contemplados, ambigüedades en las políticas operativas.
- **Propuestas de implementación**: cómo implementarías una política concreta (ej: estructura de la regex anti-sycophancy, máquina de estados de los off-ramps de P4, esquema SQLite para Attempts inmutables).
- **Casos de uso reales** que el PRD no cubre — situaciones de estudio concretas donde alguno de los 4 modos no encaja, o donde un constraint duro genera fricción legítima.
- **Dudas que mejoran la documentación**: si algo no se entendió, probablemente esté mal escrito.

### Cuando haya código

- Bug reports con repro mínima.
- Fixes con tests.
- Refactors con justificación arquitectónica (hexagonal: dominios puros separados de adapters).
- Nuevas políticas operativas validadas con literatura — no intuición.

### Lo que NO buscamos

- Features tipo gamification (streaks, XP, leaderboards, "achievements", confetti).
- Integraciones que rompan el modelo BYOK (ej: hostear un proxy de LLM, subsidiar API costs, hardcodear un provider como default).
- "Mejoras de UX" que metan vanity metrics (DAU, MAU, tiempo total, NPS in-app).
- Renombrar `[GK]` por algo "más amigable" — la transparencia epistémica es no-negociable (P8).

---

## Cómo proponer un cambio

1. **Issue primero.** Antes de cualquier PR, abrí un issue con:
   - **Contexto**: qué estabas haciendo, qué leíste del PRD.
   - **Problema observable**: qué no funciona, qué falta, qué contradice algo.
   - **Propuesta**: tu hipótesis de solución, con tradeoffs si los ves.
2. **Discusión en el issue** antes de la PR. Si el cambio toca una política P1-P9 o una decisión cerrada (sección 13 del PRD), la conversación va a pedir referencias a los caveats `[heurística operativa]` o `[REQUIERE VALIDACIÓN POST-MVP]` con datos.
3. **PR enfocada**: un cambio por PR. PRs gigantes que mezclan refactor + feature + fix se piden separar.
4. **Tests pasando** (cuando haya código). Toda PR que toque P1-P9 debe traer tests derivados de las tablas decisionales del PRD.
5. **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Sin atribuciones automáticas de IA.

---

## Setup local (WIP — placeholder hasta que haya código)

> Esta sección no funciona todavía. Defaults sensatos propuestos, ratificables al momento del primer commit de código.

```bash
git clone https://github.com/ruben-salas20/educagent.git
cd educagent
pnpm install         # default sensato propuesto
pnpm dev             # TUI en modo desarrollo
pnpm test            # Vitest (propuesto)
pnpm lint            # ESLint + Prettier (propuesto, ratificable)
```

Requisitos: **Node 20+ LTS**, **pnpm**.

---

## Estándares de código (cuando haya código)

- **Hexagonal**: dominios puros (políticas P1-P9, scheduler, modelo del estudiante) aislados de adapters (LLM, DB, TUI). Reemplazar un proveedor LLM no debe tocar el dominio.
- **Políticas como funciones puras testeables**: las 9 políticas P1-P9 son funciones puras. Toda PR que las toque debe traer tests derivados de las tablas decisionales del PRD (matriz error × modo de P1, niveles 1-5 de scaffold de P2, regex bilingüe de P3, umbrales de off-ramp de P4, etc.).
- **i18n día cero**: `material_language` y `agent_language` son ortogonales. No hardcodear idioma del agente al del material.
- **ADRs** para decisiones psicopedagógicas que parezcan extrañas sin contexto (ej: por qué Attempts inmutables, por qué no hay streaks, por qué el LLM nunca hace aritmética).
- **TypeScript estricto**, sin `any` salvo justificación.

---

## Decisiones cerradas vs decisiones abiertas

El PRD v1.1 tiene **10 decisiones cerradas** por el dueño del proyecto (PRD §13):

- D-M1 a D-M5 (modelo del estudiante).
- D-T1, D-T2 (técnicas: SM-2, tooling determinista).
- D-M-OS1, D-M-OS2, D-M-OS3 (open source: licencia, telemetría, BYOK).

**Cerrar la decisión NO elimina la incertidumbre empírica.** Las heurísticas siguen marcadas `[heurística operativa]` y `[REQUIERE VALIDACIÓN POST-MVP]` donde corresponde. Cualquier propuesta de cambio sobre una decisión cerrada requiere:

1. Apuntar al caveat correspondiente en el PRD.
2. Aportar evidencia (literatura, datos, caso reproducible).
3. Argumentar el tradeoff explícitamente.

Sin esos tres elementos, la propuesta se redirige a un issue de discusión.

---

## Cómo escribir una buena issue / PR description

Template breve:

```
**Contexto**
[Qué leíste del PRD; qué sección o política tocás.]

**Problema o propuesta**
[Qué observaste o qué proponés, en una o dos oraciones.]

**Evidencia / razonamiento**
[Literatura, caso reproducible, log, captura de pantalla.]

**Tradeoffs**
[Qué cedés a cambio; qué constraints respeta y cuáles tensiona.]

**Tests / verificación** (PRs)
[Cómo se valida que el cambio no rompe P1-P9.]
```

---

## Código de conducta

Este proyecto adhiere al [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). Reportes de comportamiento inaceptable a rubend.salasp@uqvirtual.edu.co.

---

## Reconocimiento de colaboradores

Default propuesto, ratificable: especificación [all-contributors](https://allcontributors.org/) con bot de GitHub para reconocer aportes más allá del código (docs, ideas, revisiones, feedback). Se confirma cuando haya el primer colaborador externo.
