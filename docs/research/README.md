# Investigación Psicopedagógica — EducAgent

Este directorio contiene el corpus de investigación que sustenta el diseño de EducAgent. Los documentos se produjeron en una fase de investigación fundacional **previa al PRD final** y son la base sobre la que el PRD se escribe.

## Orden de lectura

| # | Documento | Propósito | Audiencia |
|---|---|---|---|
| 05 | [Síntesis Ejecutiva](./05-sintesis-ejecutiva-pm.md) | **Documento maestro**. Punto de entrada. TL;DR + 10 secciones. | Cualquier nuevo colaborador, PM, product owner |
| 00 | [Mapa Fundacional Psicopedagógico](./00-mapa-fundacional.md) | 3 ejes (marcos pedagógicos por modo, modelo del estudiante, diseño de interacción) + 5 tensiones detectadas + recomendación de arranque | Quien necesita justificación teórica de las decisiones |
| 01 | [Políticas Operativas](./01-politicas-operativas.md) | 7 políticas implementables con tablas decisionales: feedback, scaffolding, anti-sycophancy, off-ramps, captura metacognitiva, tono, calibración | Implementadores, PM |
| 02 | [Amendment — Fuentes Múltiples](./02-amendment-fuentes.md) | P8 Transparencia Epistémica + P9 Bootstrap Curriculum + deltas a P1-P7 | Quien diseñe la capa de orquestación de fuentes |
| 03 | [Modelo del Estudiante](./03-modelo-estudiante.md) | 12 entidades, señales, metacognición, privacidad 3 niveles, 6 métricas válidas, casos de borde | Arquitectos, schema designers, ingeniería |
| 04 | [Benchmark Competidores](./04-benchmark-competidores.md) | Análisis psicopedagógico de Anki, Khanmigo, Duolingo, Math Academy, Brilliant, Cursor + cuadrante + brechas + antipatrones | PM, product strategy |

## Cómo usar este corpus

- **Si vas a escribir/modificar el PRD**: lee 05 (Síntesis) entero, después consultá 00–04 según necesites profundidad.
- **Si vas a implementar políticas**: lee 01 + 02. Las celdas de las matrices son tu guion.
- **Si vas a tocar el schema de datos**: lee 03 entero. La regla de oro (Attempts inmutables, derivados recalculables) es ley.
- **Si dudás sobre un trade-off de UX/producto**: el corpus probablemente ya lo contestó. Buscá antes de inventar.

## Reglas no negociables que atraviesan todo

1. **Anti-sycophancy operativa** (P3): el agente nunca cede a insistencia con evidencia.
2. **Transparencia epistémica** (P8): toda afirmación lleva etiqueta de fuente por párrafo.
3. **Lenguaje atribucional Weiner** (P6): feedback al proceso/estrategia, nunca a capacidad innata.
4. **Attempts inmutables**: nunca se editan; los derivados se recalculan.
5. **Privacidad strict por default**: el affective log se colapsa a agregados al cerrar sesión.
6. **6 antipatrones vetados**: streaks, XP, ranking, LLM haciendo cómputo, recognition disfrazada de recall, socratismo poroso, engagement-as-proxy.

## Caveats científicos honestos

- **Estilos de aprendizaje** (VAK): refutados (Pashler 2008). NO usar.
- **Growth mindset**: replicación débil (Sisk 2018). Reemplazado por componente atribucional de Weiner.
- **Pomodoro**: base folclórica. Out of scope MVP.
- Marcadores `[heurística operativa]` y `[REQUIERE VALIDACIÓN POST-MVP]` son ley — no las borres ni las omitas en el PRD.

---

*Investigación dirigida por orquestador, ejecutada por agente Psicólogo + agente de benchmarking. Decisiones cerradas con el dueño del proyecto.*
