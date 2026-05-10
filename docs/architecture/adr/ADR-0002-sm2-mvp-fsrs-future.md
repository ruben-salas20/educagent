# ADR-0002: Scheduler de Spaced Repetition — SM-2 en MVP, FSRS upgrade Mes 5

## Status
Accepted — 2026-05-10

## Context

El PRD v1.1 §10 / §11 dejó marcada la decisión **D-T1**: *"SM-2 en MVP con interfaz `IScheduler` + spike FSRS pre-Mes-3 para evaluar migración en Mes 5"*.

El spike se ejecutó (engram: `spike/sm2-vs-fsrs`) con weighted scoring sobre 8 criterios (madurez, calidad de scheduling, complejidad TS, datos requeridos para calibrar, fit con Attempts inmutables, soporte de comunidad, performance, migración). Resultado:

- **SM-2: 4.30**
- **FSRS: 3.95**
- **Leitner: 3.65**

Esta ADR captura el resultado y las decisiones derivadas.

## Decision

### Algoritmo en MVP

**SM-2** (Wozniak, 1990) con dos protecciones explícitas codificadas desde el día uno:

1. **Piso `EF >= 1.3`** para mitigar el "ease hell" clásico de SM-2 (ítems con ease factor que decae sin recovery, generando bucles viciosos de revisión).
2. **Comando `unbury`** que el usuario puede invocar manualmente sobre conceptos identificados como "en bucle vicioso" según telemetría local (ver telemetría más abajo).

### Algoritmo de upgrade

**FSRS** (Free Spaced Repetition Scheduler, Jarrett Ye 2023+, default en Anki desde v23.10) como upgrade en **Mes 5**, **opt-in del usuario**, gated por:

- **≥200 reviews** del usuario (umbral `[heurística operativa]` validable post-MVP).
- **≥60 días** de uso del proyecto.

Por debajo de ese umbral, los defaults poblacionales de FSRS (sesgados a usuarios Anki — predominantemente medicina e idiomas) no superan a SM-2 en sin calibración personal.

### Implementación de FSRS

- Librería: **`ts-fsrs`** (open-spaced-repetition, MIT, Node ≥20). Implementación canónica TS del algoritmo.
- Optimizer (recalibración personal de los 17 weights): requiere **`@open-spaced-repetition/binding`** (Rust bindings). **Decisión diferida a Mes 5** — antes del MVP no se compromete dependencia Rust.

### Algoritmo descartado

**Leitner**: descartado. La granularidad binaria (sabe / no sabe) pierde información que sería necesaria en migración futura a FSRS. Para qué arrancar con un sistema que penaliza el upgrade.

### Interfaz de ports

Declaramos **`ICalibrableScheduler extends IScheduler`** y **`paramsHash` en `SchedulingState`** desde el MVP, aunque SM-2 no calibra. Esto evita un breaking change cuando llegue FSRS. Detalle en [03-interfaces.md](../03-interfaces.md).

### Rating del Attempt

Vinculado a la decisión **D-S1**: el `outcome` del Attempt es **5-valued automático** (`correct | partial | incorrect | skipped | gave_up`), deducido por el agente desde respuesta + `scaffold_level_reached`. NO se pide rating explícito al usuario (estilo Anki: Again/Hard/Good/Easy).

El mapeo a quality factor para SM-2 se implementa en `policies/p7-calibration.ts`:

| outcome | scaffold_level_reached | quality factor `q` |
|---|---|---|
| `correct` | 0 | 5 |
| `correct` | 1-4 | `4 - scaffold_level` (clamp 1..4) |
| `partial` | cualquiera | 3 |
| `incorrect` | cualquiera | 2 |
| `skipped` | cualquiera | 1 |
| `gave_up` | cualquiera | 0 |

Compatible con FSRS post-MVP: el algoritmo FSRS también acepta inputs de calidad multinivel.

## Alternatives Considered

### A. FSRS desde el día 1

Descartado. Sin calibración personal del usuario, los defaults poblacionales de FSRS no superan a SM-2 en usuarios sin volumen previo. Además fuerza dependencia opcional a Rust bindings desde MVP, complicando setup para colaboradores M4. Aplazar FSRS a Mes 5 permite arrancar con cero fricción y migrar cuando los datos justifiquen el switch.

### B. Leitner como MVP simple

Descartado. Más simple que SM-2, pero la granularidad binaria genera pérdida de información en migración a FSRS. SM-2 es solo marginalmente más complejo (~50 LoC en TS) y preserva la información que FSRS necesita.

### C. SM-2 sin FSRS planificado

Descartado. FSRS es estado del arte post-2024 y resuelve gotchas conocidos de SM-2 ("ease hell", calibración personal). Dejar la puerta abierta a la migración es trivial vía la interfaz `IScheduler` opaca + `ICalibrableScheduler`. No hacerlo sería tirar valor.

### D. Scheduler propietario / heurística simple

Descartado. SM-2 y FSRS son algoritmos públicos, documentados, con implementaciones de referencia. Inventar uno nuevo agrega riesgo sin upside conocido.

## Consequences

### Lo que ganamos

- **Cero calibración para arrancar**: el agente funciona desde el primer attempt sin esperar a que el usuario acumule reviews.
- **Implementación liviana**: SM-2 son ~50 LoC en TS. Sin dependencia Rust en MVP.
- **Migración lossless**: los `Attempts` inmutables son exactamente el input que el optimizador FSRS necesita. Migrar SM-2 → FSRS es **re-derivar** los `SchedulingState` desde los Attempts existentes — sin pérdida de información histórica. La regla de oro del Modelo del Estudiante (Attempts inmutables, todo se deriva) hace que esto sea elegante.
- **Sin breaking change planificado**: la interfaz `ICalibrableScheduler` está desde el MVP, los consumidores que necesiten calibración (job de re-derivación Mes 5) la encuentran lista.

### Lo que pagamos

- **SM-2 puede caer en "ease hell"**: ítems con `EF` que decae sin recovery generan bucles. Mitigación codificada desde MVP: piso `EF >= 1.3` + comando `unbury`.
- **Rating 5-valued automático puede no captar matices**: un usuario que self-rate "Hard" en Anki puede transmitir info que la deducción automática pierde. Mitigación: la deducción usa señales objetivas (latencia, retries, scaffold) que en muchos casos son más confiables que self-report. Validable post-MVP comparando outcomes deducidos vs. realidad observada.
- **Telemetría local opt-in en M4**: para detectar "ease hell" en colaboradores reales y refinar mitigaciones, los logs locales (sin endpoint) capturan trayectoria de `EF` por concepto. Opt-in coherente con M-OS2.

### Lo que NO resuelve

- **Momento exacto de migración a FSRS**: el umbral propuesto (≥200 reviews + ≥60 días) es `[heurística operativa, REQUIERE VALIDACIÓN POST-MVP]`. Se ajusta con datos reales de M4.
- **Compromiso con Rust bindings**: la dependencia `@open-spaced-repetition/binding` se evalúa en Mes 5. Si bloquea adopción (windows builds, etc.), se considera fallback a JS-only optimizer (más lento pero portable).
- **Cómo recalibrar masivamente sin downtime**: el job de re-derivación post-FSRS-migration debe iterar sobre todos los `MasteryState` y recalcular desde Attempts. Es un cron del usuario, no en línea.

## References

- PRD v1.1 §10 (decisión D-T1).
- Spike `spike/sm2-vs-fsrs` (engram, 2026-05-10).
- Wozniak, P. A. (1990). *Optimization of repetition spacing in the practice of learning*. SuperMemo.
- Ye, J. (2023). *Free Spaced Repetition Scheduler — A Modern Spaced Repetition Algorithm*.
- Anki / FSRS docs: https://github.com/open-spaced-repetition/fsrs4anki
- `ts-fsrs`: https://github.com/open-spaced-repetition/ts-fsrs (MIT, Node ≥20).
- ADR-0001 (este blueprint) — la interfaz `IScheduler` que habilita esta migración.
