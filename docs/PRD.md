# EducAgent — Product Requirements Document (PRD)

> Documento canónico del proyecto. Vive en el repositorio público y es el primer documento que lee cualquier colaborador potencial.
>
> **Versión**: v1.1 (PRD final, repositorio-ready)
> **Estado**: vigente · 10 decisiones cerradas por el dueño del proyecto (ver sección 13).
> **Documento previo**: `docs/EducAgent_PRD_MVP.md` (intuición pedagógica original; queda como referencia histórica).
> **Corpus de investigación**: `docs/research/` (00 a 05).

---

## 1. Resumen Ejecutivo

EducAgent es un **CLI tutor inteligente open-source** para estudiantes técnicos autodidactas y universitarios con alta autonomía cognitiva. No es un chatbot educativo más: es un agente con **política pedagógica explícita**, fundada en literatura de psicología educativa con evidencia empírica replicada — testing effect, scaffolding graduado, calibración metacognitiva, ZDP, lenguaje atribucional de Weiner.

Su tesis pedagógica central es atacar las dos debilidades estructurales de los LLM-tutors actuales: la **fluency illusion** (el estudiante cree entender porque la explicación fluye) y la **sycophancy** (validación complaciente que destruye señal pedagógica; SycEval 2025 reportó 58% de sycophancy promedio en LLMs). Lo hace mediante retrieval forzado al final de toda explicación prolongada, calibración pre/post-confidence con cierre auditado, disenso explícito con evidencia, y feedback al proceso/estrategia (nunca a capacidad innata).

EducAgent opera con **4 modos** explícitos (🧙‍♂️ Socrático, 🗺️ Arquitecto, ⏱️ Simulacro, ☕ Explorador) más un modo bootstrap implícito (Tutor) cuando no hay material. Trabaja sobre **3 fuentes con jerarquía epistémica explícita** — RAG > web > LLM general — con etiquetado por párrafo. El modelo del estudiante se construye sobre **Attempts inmutables** como átomo, con derivados recalculables (mastery, calibración, retención).

**9 políticas operativas (P1-P9)** definen el comportamiento. **6 métricas pedagógicamente válidas** reemplazan a streaks/XP/ranking, explícitamente vetados. Stack: TypeScript + Ink + SQLite + Vercel AI SDK (multi-provider) con tooling determinista para cómputo y código. **BYOK (Bring Your Own Keys)**: el agente no hostea modelos ni proxy-ea llamadas; el usuario configura sus propios providers (Claude, OpenAI, Ollama local, LM Studio, OpenRouter, Google AI Studio).

**Naturaleza del proyecto**: open-source con potencial de comunidad. Sin GTM, sin pricing, sin métricas de conversión. Horizonte de 6 meses: MVP enfocado (Socrático + Explorador + Tutor) más 1-2 colaboradores externos para validación.

---

## 2. Visión y Tesis Pedagógica

### 2.1 Qué es EducAgent

Un agente de IA en terminal que actúa como **tutor con identidad pedagógica explícita**, no como un asistente conversacional genérico. Opera sobre material que el usuario provee (PDFs, Markdown, código), construye un modelo evolutivo de su aprendizaje, y conduce sesiones bajo modos que tienen reglas distintas para feedback, scaffolding y selección de ítems.

### 2.2 Para quién

Estudiante técnico autodidacta o universitario con **alta autonomía cognitiva**, comodidad en terminal, perfil "anti-inmediatez". Bilingüe ES/EN típico. Trabaja con apuntes propios o material disponible online. Quiere aprender, no entretenerse.

### 2.3 Por qué existe

El cuadrante "alto rigor metacognitivo × alta autonomía" está vacante en el mercado:

- **Math Academy** se acerca al rigor metacognitivo pero sacrifica autonomía con un riel curricular cerrado.
- **Khanmigo** opera con socratismo poroso (preguntas que se rinden a la primera presión) y delega aritmética al LLM (falla en `343-17`).
- **Anki** tiene SR sólido pero cero modelo del estudiante consultable.
- **Brilliant** es problem-first pero sin SR ni persistencia.
- **Cursor** demostró que los modos explícitos en CLI funcionan, pero sin política pedagógica.

**El espacio "Cursor educativo con metacognición visible y transparencia epistémica" no existe.** EducAgent ocupa ese espacio.

### 2.4 Tesis pedagógica central

El aprendizaje real ocurre con **retrieval practice + scaffolding graduado + calibración metacognitiva**. La debilidad central de los LLM-tutors actuales es producir *fluency illusion* y *sycophancy*.

EducAgent ataca ambos:

- **Retrieval forzado** al final de toda explicación prolongada (P4 off-ramps).
- **Calibración pre/post-confidence** con cierre auditado (P5).
- **Disenso explícito** con evidencia (P3): el agente nunca cede a insistencia con evidencia.
- **Lenguaje atribucional de Weiner** (P6): feedback al proceso/estrategia, NUNCA a capacidad innata.

---

## 3. Naturaleza del Proyecto

### 3.1 Open-source, no comercial

EducAgent es un proyecto **open-source con potencial de comunidad**, no una startup ni un producto comercial pago. No hay pricing, no hay GTM, no hay métricas de conversión. Sin tier enterprise ni paywall en el horizonte de 6 meses. Una eventual sustentabilidad podría apoyarse en GitHub sponsors o donaciones, pero queda fuera del scope actual.

### 3.2 Licencia

**Apache 2.0** (decisión cerrada — ver D-M-OS1 en sección 13).

Razones:
- Permissividad similar a MIT, suficiente para fomentar adopción y contribución.
- Cláusula explícita de patentes (cubre al proyecto y a colaboradores).
- Atribución requerida.
- Estándar en proyectos serios con vocación de comunidad.

Alternativas evaluadas:
- **MIT**: máxima simplicidad, pero sin protección contra fork comercial cerrado.
- **AGPL**: copyleft fuerte, obliga publicar modificaciones incluso en SaaS. Protege contra apropiación, pero **espanta colaboradores corporativos** y reduce adopción.

### 3.3 Filosofía de diseño

- **Concepts > code**: las decisiones psicopedagógicas tienen prioridad sobre cualquier choice técnica. Si una optimización rompe una política pedagógica, no se hace.
- **Local-first y privacy-first**: el default es `strict` para datos afectivos. El producto funciona 100% sin red.
- **CLI como anti-inmediatez**: el medio terminal es coherente con el perfil del usuario y desincentiva la gamificación naive.
- **Hexagonal + testeable + contribuible**: las políticas operativas son funciones puras con casos derivados de las tablas decisionales P1-P9. Toda decisión psicopedagógica que parezca extraña a un dev sin contexto se documenta en un ADR.
- **i18n día cero**: el idioma del agente y el del material son ortogonales (`material_language` ≠ `agent_language`).

---

## 4. Usuario Primario

### 4.1 Perfil

| Dimensión | Descripción |
|---|---|
| Nivel | Estudiante universitario (grado/posgrado) o autodidacta técnico (programación, matemática, ingeniería). |
| Autonomía | Alta. Decide qué estudiar, cuándo y cómo. No quiere un riel curricular cerrado. |
| Hábitos | Comodidad con terminal, git, editores tipo Vim/VSCode, configuración por archivo. |
| Idioma | Bilingüe ES/EN típico. Material en cualquiera de los dos. |
| Material de estudio | Apuntes propios (PDF, Markdown, notas), papers, código fuente, libros digitales. |
| Anti-patrón | Detesta gamificación naive (streaks, XP, badges). Le molesta el "¡excelente pregunta!". |

### 4.2 Contexto de uso

Sesiones de estudio individuales, típicamente 30-90 minutos, en su entorno habitual de trabajo (terminal abierto junto al editor). Antes de un parcial, durante un proyecto técnico, o como parte de su rutina de aprendizaje continuo. NO es uso casual ni de "matar tiempo".

### 4.3 Necesidades

1. Un tutor que **no le mienta sobre lo que sabe**: que distinga entre "fluiste leyendo" y "podés explicarlo bajo presión".
2. Un tutor que **discrepe cuando corresponde**: que no valide su error solo porque insiste.
3. Un tutor que **respete su autonomía**: que pregunte, no imponga; que muestre fuentes, no las oculte.
4. Un sistema **inspeccionable**: que pueda ver `/student show` y entender qué cree el agente sobre él.
5. **Privacidad real**: que sus datos afectivos no salgan de su máquina por default.

---

## 5. Posicionamiento Competitivo

### 5.1 Cuadrante (rigor metacognitivo × autonomía)

```
                       Alto rigor metacognitivo
                              ▲
                              │
         Math Academy ●       │       ◎ EducAgent (target)
                              │
   Anki ●                     │
   ─────────────────────────  ┼  ─────────────────────────►
                              │                  Alta autonomía
   Duolingo ●     Khanmigo ●  │
                  Brilliant ● │   Cursor ● (no educativo,
                              │            referencia UX)
                              ▼
                       Bajo rigor metacognitivo
```

### 5.2 Diferenciadores (7 brechas explotables)

| # | Brecha | Cómo se posiciona EducAgent |
|---|---|---|
| 1 | Transparencia epistémica RAG/LLM/web | Etiqueta por párrafo `[RAG: doc, p.X]` / `[GK]` / `[web: dominio · fecha]`. |
| 2 | Calibración metacognitiva auditada | Pre/post-confidence visible; calibration score como métrica primaria. |
| 3 | Anti-sycophancy operativa | Lista negra regex ES+EN sobre output pre-emisión; disenso firme con evidencia. |
| 4 | Modelo del estudiante consultable | `/student show` revela mastery, gaps, calibración — no caja negra. |
| 5 | Productive failure estructurado | Scaffold de 5 niveles con criterios de bajada y fading explícito. |
| 6 | Lenguaje atribucional Weiner | Feedback al proceso/estrategia; nunca a capacidad. |
| 7 | CLI como anti-inmediatez | Fricción germane preservada deliberadamente. |

### 5.3 Antipatrones VETADOS (constraints duros)

Estos seis comportamientos están **explícitamente prohibidos** en EducAgent. No son una opinión: son la línea roja del producto.

1. **Streaks, hearts, XP, ranking** (estilo Duolingo) — erosionan motivación intrínseca (Deci & Ryan).
2. **LLM haciendo cómputo aritmético o ejecutando código** (estilo Khanmigo en `343-17`) — se delega siempre a tools deterministas.
3. **Recognition disfrazada de recall** (estilo Anki mal usado) — solo recall genuino cuenta.
4. **Socratismo poroso** (estilo Khanmigo) — preguntas que se rinden a la primera presión del usuario.
5. **Engagement-as-proxy** — tiempo en app NO es métrica positiva.
6. **Sycophancy** ("¡excelente pregunta!", "¡qué buena observación!") — destruye señal pedagógica.

---

## 6. Modos del Agente

EducAgent opera bajo **4 modos explícitos** + un **modo bootstrap implícito**. El modo se elige por comando (`/mode socratic`, etc.) o por propuesta del agente con confirmación del usuario. Las únicas transiciones automáticas sin confirmación son los off-ramps forzados de P4.

### 6.1 Tabla resumen de modos

| Modo | Propósito pedagógico | Mecanismos clave | Riesgo si se aplica mal | Off-ramp (P4) |
|---|---|---|---|---|
| 🧙‍♂️ **Socrático** | Construcción de comprensión por preguntas | Escalada lenta de scaffold (P2), disenso firme (P3), captura metacognitiva (P5) | "Strict sin escalada" → indefensión aprendida; viola ZDP | Si scaffold nivel 4 sin éxito → ofrece worked example. |
| 🗺️ **Arquitecto** | Planificación, diseño, descomposición | Productive failure (Kapur), andamiaje al planeamiento | Generar plan completo atrofia metacognición de planificar | Si usuario acepta pasivamente → sondea o fuerza plan con errores deliberados. |
| ⏱️ **Simulacro** | Evaluación auténtica bajo restricción | Ítems curados (P7), feedback diferido al cierre (P1) | Cascada de errores sin pausa → desánimo | Cascada de N≥3 errores → pausa, ofrece volver a Socrático. |
| ☕ **Explorador** | Apertura, mapeo, conexiones | Lectura exploratoria con etiqueta de fuente (P8) | **Fluency illusion** sin retrieval forzado | >1500 tokens / ≥3 conceptos nuevos → fuerza retrieval (3 preguntas). |

> **El modo más peligroso es el Explorador**, no el Socrático. Genera fluency illusion porque la información fluye sin demanda cognitiva. Por eso el rediseño obligatorio: acoplar mini-tests automáticos al final de toda exploración prolongada.

### 6.2 Modo bootstrap implícito ("Tutor") — P9

Cuando `sources = none` (el usuario llega sin material), el agente activa el flujo **Tutor ANTES** de Socrático:

1. **5 preguntas diagnósticas en turnos separados** (no formulario único): qué querés aprender, qué sabés ya, dónde lo querés aplicar, fecha objetivo si la hay, criterio de éxito.
2. **Propuesta de currículum**: nodos bien formados — `id`, `objetivo verificable y observable` (NO "entender X"), `dependencias`, `duración rango`, `criterio de cierre`.
3. **Anti-atrofia**: el plan incluye 2-3 huecos `[?? — vos decidís]` y un nodo comodín del usuario, para que la planificación no quede 100% delegada al agente.
4. **Co-construcción por turnos**: cada nodo se acepta, modifica o rechaza explícitamente.
5. Cuando el currículum está aceptado → habilita Socrático sobre cada nodo.

### 6.3 Mapa de transiciones de modo

```
                  ┌─────────────────────────────────┐
                  │                                 │
                  ▼                                 │
         ┌──────────────┐                  ┌────────────────┐
         │   Tutor /    │ ─── nodos ───►  │   Socrático    │ ◄──┐
         │  Bootstrap   │                  │   (default)    │    │
         └──────────────┘                  └────────────────┘    │
                                                  │              │
                                          permitida              │
                                                  ▼              │
                                          ┌────────────────┐     │
                                          │   Explorador   │ ────┘
                                          │  (off-ramp P4) │
                                          └────────────────┘
                                                  │
                              forzada por umbrales│
                                                  ▼
                                          ┌────────────────┐
                                          │   Simulacro    │
                                          │ (cascada→pausa)│
                                          └────────────────┘
                                                  │
                                          permitida con
                                          productive failure
                                                  ▼
                                          ┌────────────────┐
                                          │   Arquitecto   │
                                          └────────────────┘
```

**Regla de transición**: el agente **propone**, el usuario **confirma**. Excepción: off-ramps forzados de P4.

**Mapeo nodo → modo (P9)**: nodo conceptual → Socrático · diseño → Arquitecto · práctica → Simulacro · mapeo → Explorador.

### 6.4 Mecanismos detallados por modo

#### 🧙‍♂️ Socrático
- Escalada de scaffold lenta (mínimo 2 turnos antes de subir nivel).
- Nivel máximo automático: 2. Niveles 3-5 solo bajo pedido explícito.
- Disenso firme con evidencia RAG. Humilde si la evidencia viene solo de LLM.
- Pre-confidence pedida solo en ítems de revisión SM-2, NO en cada turno.

#### 🗺️ Arquitecto
- Escalada media (1-2 turnos antes de subir nivel).
- Nivel máximo automático: 3.
- Si usuario pide plan completo sin haber intentado: ofrece, marca `agent-generated`.
- Si 3 planes consecutivos aceptados sin cuestionamiento: introduce 2 nodos mal a propósito (productive failure).

#### ⏱️ Simulacro
- Sin escalada de scaffold durante el test.
- Feedback diferido al debrief.
- Cascada de errores (≥3 consecutivos, distinto concepto, error conceptual o procedimental) → pausa con propuesta de switch a Explorador.
- Pre-confidence opcional al inicio.

#### ☕ Explorador
- Escalada rápida (intra-turno si hay confusión).
- Nivel máximo automático: 5.
- **Off-ramp forzado** a retrieval cuando se cumple al menos uno:
  - >1500 tokens emitidos por el agente desde último retrieval.
  - ≥3 conceptos nuevos introducidos.
  - >20 minutos sin retrieval.
  - Usuario dice "ya entendí" / "claro" 2+ veces sin output propio.
  - Usuario solicita resumen del agente (red flag de fluency illusion).

---

## 7. Marco Pedagógico Operativo (9 Políticas)

Las políticas operativas son **comportamiento del producto**, no recomendaciones. Se implementan como funciones puras testeables, derivadas de tablas decisionales explícitas. El detalle completo (matrices error × modo, listas de regex, templates) vive en `docs/research/01-politicas-operativas.md` y `docs/research/02-amendment-fuentes.md`.

### 7.1 Constraints duros vs defaults configurables

| Política | Tipo | Razón |
|---|---|---|
| P1 Feedback formativo | Duro | Matriz error × modo es identidad pedagógica del producto. |
| P2 Escalada/retirada de andamios | Duro | ZDP no es opcional. |
| P3 Anti-sycophancy + disenso | Duro | Identidad central del producto. |
| P4 Off-ramps entre modos | Duro | Combaten fluency illusion estructuralmente. |
| P5 Captura metacognitiva | Configurable | Cadencia y forma se ajustan al usuario. |
| P6 Tono Weiner | Duro | Política persona-level. |
| P7 Calibración 85% / selección de ítem | Configurable | Umbrales son `[heurística operativa]`. |
| P8 Transparencia epistémica | Duro | No negociable post-amendment. |
| P9 Bootstrap de currículum | Configurable | Solo activa si no hay material. |

### 7.2 P1 — Feedback Formativo (Hattie & Timperley, 2007)

Matriz de 5 tipos de error × 4 modos = 20 celdas, cada una con `Dice / Pregunta / Scaffold / Prohibido`.

**Tipos de error**: (a) conceptual, (b) procedimental, (c) transferencia, (d) incompleta, (e) "no sé".

**Delta por fuente (P8)**: feedback firme contra evidencia RAG/web; humilde cuando viene solo del LLM.

*Ejemplo*: error conceptual en Socrático → no se corrige; se devuelve pregunta apuntando al supuesto erróneo.

### 7.3 P2 — Escalada y Retirada de Andamios

5 niveles de scaffold:

| Nivel | Nombre | Contenido |
|---|---|---|
| 1 | Pista conceptual | Nombra el constructo relevante. Sin procedimiento. |
| 2 | Pista procedimental | Nombra el primer paso. Sin ejecutarlo. |
| 3 | Worked example | Resuelve un problema *análogo pero distinto*. |
| 4 | Completion problem | Resuelve N-1 pasos, pide el último (Sweller et al., 2011). |
| 5 | Solución completa | Resuelve íntegro + explica. |

**Criterios de bajada** (subir el andamio): pedido explícito, 2 retries sin progreso, latencia >3× mediana sin output, lenguaje afectivo negativo, 3er retry → salta a nivel 4.

**Criterios de fading** (retirada): N=3 aciertos consecutivos sin pedir andamio → próximo ítem empieza un nivel más exigente. Calibración alta-y-acierto refuerza fading; baja-y-acierto **NO** retira (sospecha de suerte).

**Rendición productiva**: comando `/help` muestra menú explícito de niveles 1-5. NO se loguea como fracaso, se loguea como `scaffold-requested`. El agente NUNCA dice "te rendiste".

### 7.4 P3 — Anti-Sycophancy y Disenso Explícito

**Lista negra regex ES+EN** sobre output pre-emisión: `excelente pregunta`, `great question`, `me encanta cómo`, `i love how`, `tenés toda la razón` (sin justificación), `you're absolutely right` (sin justificación), entre otros. Si match → re-genera output.

**Lista permitida** (descriptiva no valorativa): "Identificaste correctamente X.", "El razonamiento hasta acá es válido.", "Lo resolviste."

**Regla de oro**: el reconocimiento siempre es **descriptivo** (qué hizo), nunca **valorativo** (qué tan bueno es).

**Disenso explícito** ante:
- **Error de hecho** (verificable contra RAG): "Eso no es exacto. Según [fuente], [hecho correcto]."
- **Error de razonamiento**: reductio guiada — "Si X implica Y, ¿qué pasa con Z?"
- **Insistencia infundada**: escalada en 3 turnos. T1 indirecta, T2 directa, T3 muestra fuente y cierra el bucle.

**Constraint crítico**: el agente **NUNCA cede a insistencia con evidencia** (Sharma 2023, SycEval 2025). Excepción legítima: si el usuario aporta una fuente nueva, el agente actualiza racionalmente y verifica.

**Delta por fuente (P8)**: disenso firme con evidencia RAG/web; humildad explícita si la evidencia viene solo del LLM.

### 7.5 P4 — Off-Ramps entre Modos

Disparadores forzados ya descritos en §6.4.

**Forma del off-ramp**: NO interrupción brusca.
> "Antes de seguir — quiero chequear que esto te quedó. 2 preguntas rápidas."

El usuario **puede declinar**, pero el sistema loguea el opt-out. Si declina 3 veces consecutivas → flag a la próxima sesión.

### 7.6 P5 — Captura Metacognitiva

| Momento | Pregunta | Frecuencia |
|---|---|---|
| Pre-tarea | "Confianza 0-100 de que esto te sale bien." | Solo en Simulacro y revisiones SM-2. |
| Durante tarea | "¿Te trabás en el concepto, el procedimiento, o conectarlo?" | Solo si latencia >3× mediana, máx 1 vez por ítem. |
| Post-tarea | "Habías predicho X. ¿Algo te sorprendió?" | Solo si gap > 30 puntos. |
| Cierre de sesión | "¿Qué se te quedó claro? ¿Qué quedó turbio?" | Cada sesión, opcional. |

**Regla anti-fatiga**: máximo **2 prompts metacognitivos por hora** de sesión.

**Delta por fuente (P8)**: agente puede preguntar "¿de dónde sacaste eso — del material, de algo que te dije, o de tu intuición?".

### 7.7 P6 — Tono y Lenguaje Atribucional (Weiner, 1985)

7 atributos de persona: sobrio · preciso · paciente con el proceso, impaciente con el atajo · honesto sobre incertidumbre · no-paternalista · atento al silencio · bilingüe-mirror.

**Tabla atribucional**: fomentar atribuciones *internas + controlables + inestables* (esfuerzo, estrategia, tiempo). Evitar *internas + estables + incontrolables* ("no soy bueno en mate").

| Caso | Recomendado | Evitar |
|---|---|---|
| Acierto | "Lo resolviste. La estrategia de descomposición funcionó acá." | "Sos muy inteligente." |
| Error | "Esa estrategia no aplica para este caso." | "Te confundiste" sin más. |
| Esfuerzo sin acierto | "Trabajaste con esto 20 min. La estrategia tiene un agujero en X." | "Buen intento" (vacío). |
| Abandono | "Cerraste sin terminar. Lo dejo en pendiente." | "No te rindas" (paternalista). |

**Reglas de SILENCIO**: tras respuesta correcta y completa, máximo 1 línea de reconocimiento. Si el usuario pidió pensar, output literalmente vacío. No hay "¿tiene sentido?" como filler.

### 7.8 P7 — Calibración de Dificultad y Selección de Ítem

**Regla 85%** (Wilson et al. 2019):
- `current_accuracy > 0.92` → próximo ítem +1 dificultad.
- `current_accuracy < 0.75` → próximo ítem -1 dificultad.
- Banda 0.75-0.92 → mantiene nivel.

**Política de selección** (prioridad descendente):
1. Repaso SM-2 con `due_date <= now`.
2. Conceptos débiles (≥2 errores recientes consecutivos).
3. Concepto nuevo si accuracy >0.85 y no hay due/weak.
4. Profundización del concepto activo más reciente.

**Detección fuera-de-ZDP**: ≥3 errores consecutivos en el mismo ítem, latencia >5× mediana, scaffold 4 sin éxito, "no sé" tras scaffold 3, lenguaje afectivo negativo + 2 errores. Acción: pausa, marca "needs prerequisites", busca pre-requisitos en el grafo, propone bajar.

**Allocación default de sesión**: 40% repaso SM-2, 30% material nuevo, 30% profundización. Override por modo y por `/exam-in Nd`.

**Delta por fuente (P8)**: pools separados — RAG-curado regla 85% directa; LLM-generated 90% + ítem marcado "auto-generado, posible error".

### 7.9 P8 — Transparencia Epistémica (constraint duro, post-amendment)

Cada respuesta del agente etiqueta su fuente **por párrafo**:

- `[RAG: archivo, p.X]` — corpus local del usuario.
- `[web: dominio · fecha]` — resultado de búsqueda web (solo si opt-in).
- `[GK]` — general knowledge del LLM, sin verificación.
- `[RAG+GK]` — mezcla, dominante RAG.

**Jerarquía pedagógica**: RAG > web > LLM. El agente nunca contradice RAG en silencio; presenta el conflicto sin resolverlo unilateralmente. Si una afirmación previa marcada `[GK]` es luego refutada por RAG ingerido, el agente proactivamente lo reconoce (caso 5.4 del modelo).

**Visibilidad** (D-M5, decisión cerrada — sección 13): **discreto siempre** — etiqueta por párrafo en color tenue, comando `/sources verbose|compact|off` para ajustar.

### 7.10 P9 — Bootstrap de Currículum (configurable, post-amendment)

Activa cuando `sources = none` al `educagent init`. Flujo descrito en §6.2.

---

## 8. Modelo del Estudiante

El modelo del estudiante es la **representación operativa de lo que el sistema cree saber sobre el aprendiz** en un momento dado. Es un *open learner model* (Bull & Kay 2007): inspeccionable por el usuario, falsable, evolutivo.

### 8.1 Tres principios atravesando todo

1. **El modelo es una hipótesis, no verdad.** Cada inferencia es revisable cuando llega evidencia contraria.
2. **Granularidad de captura > granularidad de inferencia.** Capturamos atómico (cada attempt, cada latencia) y agregamos para inferir.
3. **Privacidad atravesada desde día cero.** El nivel de retención define qué se persiste, qué se olvida, qué se anonimiza.

### 8.2 Las 12 entidades

| # | Entidad | Propósito | Atributos clave |
|---|---|---|---|
| 1 | Project / Studio Space | Contenedor de proyecto | `language`, `sources`, `granularity_default`, `exam_anchor`, `retention_level` |
| 2 | Knowledge Source | Fuente tipada con jerarquía | `kind` (rag/web/llm), `confidence_tier`, `freshness_at`, `validity_status` |
| 3 | Curriculum | Árbol de nodos | `nodes` con prerequisites, `bloom_target`, `status`, `risk_flags` |
| 4 | Concept | Granularidad híbrida | `parent_concept_id`, `bloom_levels_seen` |
| 5 | Item / Practice Unit | Pregunta o ejercicio | `origin` (rag_curated/bank_curated/llm_improvised), `pool_membership` |
| 6 | **Attempt** ⭐ | **Átomo inmutable** | `outcome`, `scaffold_level_reached`, `error_type`, `pre_confidence`, `post_confidence`, `retry_count` |
| 7 | MasteryState | Vector multidim con incertidumbre | SM-2, `accuracy_window`, `scaffold_trajectory`, `bloom_coverage`, `confidence_interval` |
| 8 | MetacognitiveSignal | Calibración pre/post | `pre_confidence`, `post_confidence`, `calibration_gap`, JoL, FoK |
| 9 | Affective Log | Proxies textuales | `confidence_of_inference`, `retention_tier` heredado |
| 10 | Session | Línea de tiempo | `mode_timeline`, `exit_reasons`, `fatigue_indicator`, `off_ramps_triggered` |
| 11 | Source-Attribution Log | Trazabilidad de claims | Operacionaliza P8 |
| 12 | Item Bank Pool | Vista filtrada | Filtros por origin/quality/concept |

### 8.3 Attempt como átomo inmutable — decisión arquitectónica fuerte

Toda inferencia derivada (mastery, calibración, retención, scaffold trajectory) **se recalcula desde Attempts**. Los Attempts NUNCA se editan ni borran (excepto purga explícita por privacidad). Son hechos pasados.

Esto habilita:
- Cambio de modelo de inferencia sin reescribir historia (heurística → BKT → IRT post-MVP).
- Auditoría completa.
- Export/import sin pérdida.
- Reproducibilidad de métricas.

**Regla de oro**: Attempts inmutables; derivados recalculables; nada huérfano. Si se purgan Attempts, todos los derivados se invalidan o recalculan.

### 8.4 Las 17 señales del estudiante

Mapeadas en tres categorías:
- **Explícitas** (lo que dice): outcome, scaffold-request, "no sé", pre/post-confidence, mode-switch, source-trust signal.
- **Implícitas** (latencia, retries, lenguaje afectivo, longitud de respuesta, abandono).
- **Derivadas** (tipo de error, calibración, fading-readiness, out-of-ZDP, fatiga intra-sesión).

**Regla operacional clave**: ninguna señal implícita por sí sola dispara intervención. Solo **convergencia multi-señal sostenida** activa al agente.

### 8.5 Estado metacognitivo (Flavell / Zimmerman)

Tres componentes operacionalizados:

- **Conocimiento** → `pre_confidence` agregada por concepto y sesión.
- **Monitoreo** → `calibration_score = 1 - mean(|calibration_gap|)`, con sub-índices `overconfidence_index` y `underconfidence_index`.
- **Control** → eventos: mode-switch, scaffold-request bien-temporizado, vuelta voluntaria a la fuente, auto-pausa.

**Score agregado** (0-100): 40% calibration_score + 30% control_events normalizados + 30% conocimiento.

Umbrales y acciones:

| Umbral | Acción del agente |
|---|---|
| Calibration <0.4 sostenido (sobreconfianza) | Inserta más prompts pre-confidence; usa worked examples antes de practice. |
| Calibration <0.4 sostenido (subconfianza) | Refuerzo atribucional Weiner: "tu respuesta fue correcta. ¿Qué estrategia usaste?" |
| Score control bajo + frustración | Sugiere modo Arquitecto o pausa explícita. |
| Score control alto + accuracy estable | *Fading metacognitivo*: reduce prompts. |

### 8.6 Las 6 métricas de salud (visibles, pedagógicamente válidas)

| # | Métrica | Cálculo | Valor pedagógico |
|---|---|---|---|
| 1 | **Calibración metacognitiva** | `1 - media(|pre_confidence - outcome|)` últimos 30 días | Aprender a saber qué se sabe. |
| 2 | **Cobertura currículum / RAG** | % nodos `mastered`+`practicing`; % chunks con ≥1 attempt | NO sumadas — dimensiones distintas. |
| 3 | **Retention rate por concepto** | Curva de decay personal vs SM-2 esperada | El olvido es información, no fracaso. |
| 4 | **Distribución de errores por tipo** | Agregación de `error_type` últimos 30 días | Los errores tienen estructura. |
| 5 | **Trayectoria de scaffolding** | Serie temporal de `scaffold_level_reached` promedio | Independencia creciente — el progreso REAL. |
| 6 | **Tiempo en zona ZDP** | % de attempts con accuracy en banda 70-90% | *Desirable difficulty* (Bjork). |

### 8.7 Las 4 métricas EXPLÍCITAMENTE EXCLUIDAS (vanity, no mostrar)

1. ❌ Streak diario (gamificación tóxica que premia presencia, no aprendizaje).
2. ❌ Puntos / XP totales.
3. ❌ Ranking comparativo (incentivo extrínseco perjudicial; Deci & Ryan).
4. ❌ Tiempo total de estudio como métrica positiva (premia inputs, no outputs).

### 8.8 Casos de borde críticos

| # | Caso | Resolución |
|---|---|---|
| 1 | Cambio de granularidad mid-proyecto | Padre se preserva; hijos heredan prior bayesiano débil; Attempts del padre quedan ligados al padre. |
| 2 | Material nuevo a mitad de bootstrap | Re-evalúa `risk_flags`; NO agrega nodos automáticamente; sugiere. |
| 3 | Source invalidado | Items pasan a `under_review`; intenta re-anclar; Attempts históricos NO se invalidan. |
| 4 | LLM-generated refutado por RAG | Agente reconoce error previo proactivamente — momento metacognitivo de oro. |
| 5 | Inactividad 30+ días | Sesión diagnóstica suave; no castigo SM-2 acumulado de golpe. |
| 6 | Regla de oro | Attempts inmutables; derivados recalculables; nada huérfano. |

---

## 9. Privacidad y Datos

### 9.1 Tres niveles de retención (default `strict`)

| Nivel | Comportamiento |
|---|---|
| **Strict** (default) | Affective Log se colapsa a agregados anonimizados al cerrar sesión. Mensaje al usuario: *"Tus señales emocionales se usan solo durante esta sesión y luego se descartan. Conservamos métricas anónimas para mostrarte tendencias."* |
| **Standard** | Cross-session con TTL de 90 días default (configurable 30-180). Permite consultas tipo "muéstrame los momentos de frustración del último mes". |
| **Full** | Opt-in explícito, sin TTL automático. Histórico completo accesible. |

### 9.2 Datos siempre preservados (todos los niveles)

- Mastery aggregates por concepto.
- Calibration scores agregados.
- Curriculum coverage.
- Retention curves (decay).
- Source-Attribution Log (auditoría es ortogonal al affective log).

### 9.3 Comandos `/privacy`

```bash
/privacy show              # ver qué se está guardando ahora
/privacy set strict|standard|full
/privacy export            # exportar todo (JSON)
/privacy purge affect      # borrar afecto sin perder mastery
/privacy purge project     # borrar proyecto entero
```

### 9.4 Política de telemetría

**Decisión cerrada (D-M-OS2, sección 13)**: opt-in explícito en primer arranque, **cero red en MVP**. Sin telemetría, el producto es **100% funcional**. El detalle de eventos vive en `docs/TELEMETRY.md` (a crear).

**Qué se mediría (opt-in)**: distribución de modos (anonimizada), tasa de off-ramps P4, calibración promedio (sin contenido), errores y crashes.

**Qué NO se mide nunca**: contenido del material, contenido de attempts, prompts ni respuestas, datos personales.

**Endpoint MVP**: **ninguno**. Logs locales solamente, exportables manualmente. Validación M4: los 2-3 colaboradores exportan logs y los pasan manualmente al dueño del proyecto. Cualquier endpoint remoto se decide post-validación con los datos reales en mano.

---

## 10. Stack Tecnológico

| Capa | Elección | Razón |
|---|---|---|
| Lenguaje | **TypeScript** | Robustez, refactor seguro, ecosistema. |
| TUI | **Ink** (React para terminal) | Componentes interactivos, estética pulida. |
| Persistencia local | **SQLite** | Local-first, embebido, sin servidor. |
| Orquestación LLM | **Vercel AI SDK** | Madurez, abstracción multi-provider, buen match con BYOK (cubre Anthropic, OpenAI, Ollama, OpenRouter, Google). |
| Styling | **Chalk** | Estándar, sin dependencias pesadas. |
| Tooling determinista (cómputo) MVP | **Aritmética propia** + **sandbox JS/TS genérico** (Node VM o Deno) | NO delegar aritmética al LLM. Caso decisivo: Khanmigo falla en `343-17`. Cobertura mínima sin asumir dominio del usuario. |
| Tooling determinista (cómputo) post-MVP | `sympy` via Pyodide, `math.js`, type-checkers nativos | Se agregan según demanda real de los colaboradores en M4. |
| Scheduler SR | **SM-2** con interfaz `IScheduler` para FSRS futuro | SM-2 maduro y simple; spike FSRS pre-Mes-3, decisión de migración en Mes 5. |
| LLM provider | **BYOK (Bring Your Own Keys)** — multi-provider via Vercel AI SDK | El agente NO hostea modelos, NO proxy-ea, NO subsidia API costs. Ver §10.2. |

### 10.1 Tooling determinista — constraint duro

NO delegar aritmética ni ejecución de código al LLM. Argumento decisivo: Khanmigo falla en `343-17` por delegar la operación al modelo de lenguaje en lugar de a una calculadora.

**Decisión de scope (D-T2, cerrada — sección 13)**: el dominio académico del primer colaborador todavía NO está definido, por lo que el MVP NO prioriza por dominio. Arranca con cobertura mínima y agrega tools según demanda real observada en M4.

| Fase | Dominio | Tool determinista |
|---|---|---|
| **MVP** | Aritmética / cálculo básico | Calculadora propia (evita el fallo de Khanmigo) |
| **MVP** | Ejecución de código genérica | Sandbox JS/TS (Node VM o Deno) |
| Post-MVP (según demanda M4) | Matemática simbólica | `sympy` via Pyodide o `math.js` |
| Post-MVP (según demanda M4) | Validación de tipos | `tsc`, type-checkers nativos |
| Post-MVP (según demanda M4) | Tests del usuario | Runner del lenguaje correspondiente |

### 10.2 Modelo LLM — BYOK (Bring Your Own Keys)

**Decisión cerrada (D-M-OS3, sección 13)**: EducAgent **NO hostea modelos, NO proxy-ea llamadas, NO subsidia API costs**. El usuario trae sus propias keys o endpoints. Patrón estándar OpenCode / Aider / Cline / Continue.dev / Cursor.

**Providers soportados** (detección y conexión nativa):

| Provider | Tipo | Requiere |
|---|---|---|
| **Anthropic Claude API** | Cloud | Anthropic API key |
| **OpenAI API** | Cloud | OpenAI API key |
| **Google AI Studio (Gemini)** | Cloud | Gemini API key (free-tier disponible) |
| **OpenRouter** | Cloud (gateway multi-modelo) | OpenRouter key (free-tier disponible) |
| **Ollama** | Local | Endpoint local (sin key) |
| **LM Studio** | Local | Endpoint local (sin key) |

**Lo que el agente hace**:

1. **Detecta y conecta** con providers configurados via `~/.educagent/config.toml` (no hardcoded).
2. **Detecta capacidades** de cada modelo: context window, tool support, prompt caching de Anthropic, streaming, etc.
3. **Routing por modo configurable**: el usuario puede asignar diferentes modelos a diferentes modos (ej: Claude Sonnet en Socrático para disenso firme, Llama local en Explorador para exploración barata).
4. **Provee perfiles preset** que el usuario importa y ajusta (no son hardcoded — son sugerencias editables).
5. **Onboarding sugiere alternativas free-tier** (Gemini free, Groq free, OpenRouter free models) para usuarios nuevos sin key paga.

**Implicancia arquitectónica**: capa de abstracción `ILLMProvider` con adapters por provider. Vercel AI SDK ya cubre la mayor parte del set.

**Tests de identidad pedagógica**: los tests de P3 (anti-sycophancy) y P4 (off-ramps) deben pasar contra al menos un modelo local y un modelo cloud durante CI, para garantizar que la política no depende de un único provider.

**Implicancia para M4**: cada colaborador trae sus propias keys. Cero costo cloud para el dueño del proyecto durante validación.

---

## 11. Decisiones Técnicas Clave

### 11.1 Scheduler SR: SM-2 con abstracción para FSRS

**MVP: SM-2** por madurez y simplicidad. Se diseña una interfaz `IScheduler` para migrar a FSRS post-MVP sin tocar consumidores.

```ts
interface IScheduler {
  scheduleNext(state: MasteryState, attempt: Attempt): SchedulerOutput
  nextDueDate(state: MasteryState): Date
}
```

**Honestidad explícita**: FSRS (Anki post-2024) es estado del arte y resuelve el problema de "ease hell" de SM-2. Recomendación: spike pre-Mes-3 para evaluar migración en Mes 5. **NO se promociona "scheduler propietario"** — SM-2 y FSRS son públicos y se acreditan como tales.

### 11.2 Detección runtime de sycophancy y fluency illusion

P3 y P4 requieren **detección operativa runtime**, no solo prompts:

- **Sycophancy** (P3): regex-list ES+EN sobre output del agente **antes de imprimir**. Si match → bloqueo + reintento. Métrica logueada.
- **Fluency illusion** (P4): contadores de tokens emitidos sin retrieval, conceptos nuevos introducidos, tiempo desde último retrieval. Trigger automático cuando se cruzan umbrales.

Ambos sistemas son `[heurística operativa]` — los umbrales se refinan con datos reales `[REQUIERE VALIDACIÓN POST-MVP]`.

### 11.3 Modelo de incertidumbre del MasteryState

**MVP**: heurística simple — `accuracy_window + SM-2 stability` con intervalo de confianza naive. Se diseña `IMasteryEstimator` para reemplazar a BKT (Bayesian Knowledge Tracing) o IRT-lite post-MVP.

**Razón**: BKT/IRT requieren calibración con dataset previo del que no disponemos. La heurística es honesta y mejorable.

### 11.4 Arquitectura hexagonal y testabilidad

- **Hexagonal**: dominios puros (políticas, scheduler, modelo del estudiante) aislados de adapters (LLM, DB, TUI). Permite reemplazo de proveedor LLM y testing sin red.
- **Políticas como funciones puras**: P1-P9 implementadas con casos de prueba derivados de las tablas decisionales del corpus de investigación.
- **ADRs** para decisiones psicopedagógicas que parezcan extrañas a un dev sin contexto (ejemplo: por qué no hay streaks, por qué Attempts son inmutables).

---

## 12. Roadmap 6 Meses

### 12.1 Fase 1 — MVP (Meses 1-3)

**Modos incluidos**: 🧙‍♂️ Socrático + ☕ Explorador + bootstrap Tutor (P9).

**Componentes**:
- Ingesta RAG local: PDF, Markdown, texto plano.
- Modelo del estudiante mínimo: **Attempts inmutables + MasteryState básico (SM-2 + accuracy_window) + privacidad strict default**.
- Métricas core visibles: calibración, ZDP-time, scaffolding trajectory.
- Políticas P1-P9 en versión MVP, con umbrales marcados `[heurística operativa]`.
- Tooling determinista mínimo: aritmética propia + sandbox JS/TS genérico (sympy / type-checkers diferidos a post-MVP según demanda real — D-T2).
- Capa BYOK con al menos 2 providers funcionales en CI (uno local, uno cloud) — ver §10.2.
- CLI con etiqueta de fuente por párrafo (P8) y modo discreto.
- Comandos: `/privacy`, `/student show`, `/sources`, `/items review`, `/exam-in Nd`, `/help`, `/mode <name>`.

**Excluido del MVP**: Modo Arquitecto, Modo Simulacro, FSRS, web search profunda (solo flag opt-in), integración Notion, detección de afecto sofisticada, multi-usuario.

### 12.2 Fase 2 — Validación (Mes 4)

- Onboarding de **2-3 colaboradores externos** (no beta pública).
- Recolección de feedback estructurado.
- Datos reales para validar heurísticas marcadas `[REQUIERE VALIDACIÓN POST-MVP]`.
- Telemetría: cero red. Colaboradores exportan logs locales manualmente y los pasan al dueño del proyecto (ver D-M-OS2).
- Cada colaborador trae sus propias keys (BYOK) — cero costo cloud para el proyecto.

### 12.3 Fase 3 — Iteración (Meses 5-6)

- Incorporación de feedback de M4.
- **Spike FSRS** y decisión sobre migración SM-2 → FSRS.
- Selección del siguiente modo a desarrollar (🗺️ Arquitecto o ⏱️ Simulacro) según demanda real observada.
- Robustecimiento del modelo del estudiante (BKT vs heurística).
- Hitos de comunidad: `LICENSE` (Apache 2.0) publicado, README público pulido, CONTRIBUTING.md, **primer release público v0.1.0**.

### 12.4 Explícitamente FUERA del horizonte 6 meses

- Notion / cualquier integración cloud externa.
- Beta pública.
- Modos Arquitecto y Simulacro completos (uno solo, según decisión M5-M6).
- Web search profunda (solo flag opt-in en MVP).
- Implementación FSRS (spike + decisión solamente).
- Detección de afecto multimodal (voz, video).
- Multi-usuario / sync cloud.
- Tier enterprise / pricing.
- Pomodoro y técnicas de timing folclóricas (ver caveats, anexo C).

### 12.5 Comandos CLI del MVP

```bash
# Inicio y configuración
educagent init [path]              # crea proyecto en directorio actual o path
educagent init --no-sources        # fuerza flujo bootstrap Tutor (P9)

# Sesiones
educagent learn                    # entra en modo Socrático (default)
educagent explore                  # entra en modo Explorador
educagent                          # alias de `educagent learn`

# Comandos in-session
/mode socratic|explorer|tutor      # cambio de modo (propuesta + confirm)
/help                              # menú de niveles 1-5 de scaffold (P2)
/student show                      # vista del modelo del estudiante
/sources [verbose|compact|off]     # visibilidad de Source-Attribution
/items review                      # promoción manual de ítems improvisados (D1)
/exam-in 5d                        # override de allocación pre-examen (P7)
/privacy show|set|export|purge     # gestión de privacidad
/quit                              # cierre de sesión con resumen
```

### 12.6 Flujos de usuario clave del MVP

#### Primer arranque con material existente

```
$ cd ~/estudios/ml-curso
$ educagent init
[EducAgent] Detecté 3 archivos: notes.md, paper-attention.pdf, README.md.
            Idioma del material: ES + EN mezclado.
            ¿Cuál es el idioma del agente? [es/en/auto] auto
            Privacidad: strict (default). Cambiala con /privacy set.
[EducAgent] Listo. Tenés 1 proyecto: ml-curso.
            Empezamos con Socrático sobre el primer concepto detectado: "Self-attention".
            ¿Listo? [Y/n] Y

[Socratic] Antes de meter fórmulas — ¿qué problema resuelve self-attention que las RNN
           hacen mal?
           [RAG: paper-attention.pdf, p.2]
> _
```

#### Primer arranque sin material (bootstrap Tutor)

```
$ educagent init
[EducAgent] No detecté material en este directorio.
            Activo modo Tutor: te hago 5 preguntas, armamos un currículum juntos.
            ¿Empezamos? [Y/n] Y

[Tutor 1/5] ¿Qué querés aprender? Sé específico — no "matemática", sino "derivadas en R^n".
> _
```

#### Sesión Socrática típica con disenso

```
[Socratic] Resolvé: ¿cuál es la derivada de f(x) = x · ln(x)?
> 1
[Socratic] Eso no es exacto. Según [RAG: calculo-1.pdf, p.45], necesitás regla del producto
           porque hay dos funciones de x multiplicándose. Tu respuesta saldría si f fuera ln(x)
           solo. ¿Querés revisar la regla del producto antes de reintentar, o lo intentás
           directo? [revisar/reintentar]
> reintentar
[Socratic] Dale.
> ln(x) + 1
[Socratic] Lo resolviste. Aplicaste regla del producto correctamente: derivada del primer
           factor por el segundo, más el primero por la derivada del segundo. Próximo ítem?
           [Y/n]
```

#### Off-ramp forzado en Explorador

```
[Explorer] (después de ~1500 tokens explicando backpropagation)
           Antes de seguir — quiero chequear que esto te quedó. 2 preguntas rápidas.
           [aceptar/posponer]
> aceptar
[Explorer] 1/2 — En tus palabras: ¿qué hace la derivada en cada paso del backward pass?
> _
```

#### Vista del modelo del estudiante

```
$ /student show
== ml-curso · 14 días activo ==
Conceptos:                12   (mastered: 3 · practicing: 5 · learning: 4)
Calibración (30d):        72/100   (↑ +12 vs hace 14d)
Tiempo en ZDP (7d):       68%
Independencia scaffold:   nivel 2.1 promedio (era 3.4 al inicio)
Errores por tipo (30d):   conceptual 35% · procedimental 42% · transferencia 23%
Retention curve:          /sources verbose para ver por concepto
Privacidad:               strict
```

---

## 13. Decisiones Cerradas (10)

Todas las decisiones de esta sección están **cerradas por el dueño del proyecto**. Cerrar la decisión NO elimina la incertidumbre empírica: las heurísticas siguen marcadas `[heurística operativa]` y `[REQUIERE VALIDACIÓN POST-MVP]` donde corresponde.

Dos decisiones cambiaron sustancialmente respecto al default que llevaba el PRD v1.0: **D-M-OS3** (LLM provider — pasa a BYOK) y **D-T2** (tooling determinista — se desprioritiza por dominio).

### Del modelo del estudiante

#### D-M1 · Promoción de ítems improvisados al banco curado — ✅ CERRADA

**Resolución**: **manual con asistencia**. El agente sugiere candidatos con score de calidad; el usuario decide. Disponible vía comando `/items review` periódico **y** promoción inline al final de cada sesión (ambos flujos coexisten — el usuario elige).

#### D-M2 · Frecuencia y forma del prompt metacognitivo pre-confidence — ✅ CERRADA

**Resolución**: **escala 1-5**, cadencia adaptativa (cada 3-5 ítems), máximo **2 prompts/hora** (P5). Off-switch **granular** vía `/metacog off` (por sesión o proyecto).

#### D-M3 · Modelo de incertidumbre del MasteryState — ✅ CERRADA

**Resolución**: **heurística simple con abstracción**. MVP: `accuracy_window + SM-2 stability` con intervalo de confianza naive. Interfaz `IMasteryEstimator` lista para reemplazo por BKT / IRT-lite post-MVP cuando haya dataset propio. La incertidumbre del MVP es aproximada y se acepta como tal — mejora con datos reales.

#### D-M4 · Política de olvido benevolente tras inactividad larga — ✅ CERRADA

**Resolución**: tras 30+ días de inactividad → **sesión diagnóstica suave automática**. Repaso de 3-5 ítems de mastery alta para "calibrar dónde estás". **NO castigo SM-2 acumulado**. Recalcula `stability` con curva de decay. Alineado con Weiner (P6).

#### D-M5 · Visibilidad del Source-Attribution por default — ✅ CERRADA

**Resolución**: **discreto siempre** — etiqueta por párrafo en color tenue. Comando `/sources verbose|compact|off` para ajustar.

### Decisiones técnicas

#### D-T1 · SM-2 vs FSRS — ✅ CERRADA

**Resolución**: **SM-2 en MVP** con interfaz `IScheduler`. **Spike técnico de FSRS pre-Mes-3** con datos sintéticos. **Decisión de migración SM-2 → FSRS en Mes 5** con datos reales de los colaboradores.

#### D-T2 · Tooling determinista para cómputo — ✅ CERRADA (cambio respecto al default v1.0)

**Resolución**: el dominio académico del primer usuario **AÚN NO ESTÁ DEFINIDO**. Por lo tanto el MVP arranca con **aritmética propia + sandbox JS/TS genérico** (cobertura mínima, agnóstica al dominio). `sympy`, type-checkers y runners específicos se agregan **según demanda real** observada en M4. **NO se prioriza por dominio en MVP**.

**Cambio respecto al default v1.0**: el default original priorizaba sandbox JS/TS asumiendo perfil JS/TS del primer usuario. Esa asunción se retira hasta tener evidencia.

### Meta-decisiones del proyecto open-source

#### D-M-OS1 · Licencia — ✅ CERRADA

**Resolución**: **Apache 2.0**. Permissividad similar a MIT con cláusula explícita de patentes y atribución requerida. Estándar en proyectos serios con vocación de comunidad.

#### D-M-OS2 · Telemetría opcional — ✅ CERRADA

**Resolución**: **opt-in explícito**, **sin endpoint en MVP**, **cero red**. Logs locales exportables manualmente. Producto 100% funcional sin telemetría. Validación M4: los colaboradores exportan logs y los pasan manualmente al dueño del proyecto. Cualquier endpoint remoto se decide post-validación con datos reales en mano.

#### D-M-OS3 · Modelo LLM por default — ✅ CERRADA (cambio importante: BYOK)

**Resolución**: **BYOK (Bring Your Own Keys)**. EducAgent **NO hostea modelos, NO proxy-ea llamadas, NO subsidia API costs**. El usuario trae sus propias keys o endpoints. Patrón estándar OpenCode / Aider / Cline / Continue.dev / Cursor.

**Lo que el agente hace**:

1. **Detecta y conecta** con providers configurados por el usuario: Anthropic Claude, OpenAI, Ollama local, LM Studio local, OpenRouter, Google AI Studio (Gemini).
2. **Detecta capacidades** de cada modelo (context window, tool support, prompt caching de Anthropic, streaming).
3. **Routing por modo configurable**: el usuario puede asignar diferentes modelos a diferentes modos (ej: Claude Sonnet en Socrático, Llama local en Explorador).
4. **Provee perfiles preset** que el usuario importa y ajusta.
5. **Onboarding sugiere alternativas free-tier** (Gemini free, Groq free, OpenRouter free models) para usuarios nuevos sin key paga.

**Implicancias arquitectónicas**:
- Capa `ILLMProvider` con adapters por provider.
- Vercel AI SDK cubre la mayoría — buen match con el stack.
- Configuración via `~/.educagent/config.toml` (NO hardcoded).
- Tests P3 / P4 corren contra al menos 1 modelo local + 1 cloud en CI.

**Implicancia para validación M4**: cada colaborador trae sus propias keys → **cero costo cloud para el dueño del proyecto**.

**Cambio respecto al default v1.0**: el default original era "configurable con 3 perfiles documentados" (local-first / cloud-balanced / cloud-premium) sugiriendo hardware Ollama o presupuesto cloud. Pasamos a un modelo BYOK explícito sin perfiles hardcoded — los presets son sugerencias editables, no defaults forzados.

---

## 14. Métricas de Éxito del MVP (Validación M4)

> **Nota crítica**: estas NO son métricas de retención de producto comercial. Son **métricas pedagógicas** que validan que las heurísticas del agente funcionan. El MVP es un experimento controlado con 2-3 colaboradores, no un lanzamiento.

### 14.1 Métricas pedagógicas que se validan

| # | Métrica | Criterio de éxito | Cómo se mide |
|---|---|---|---|
| 1 | Calibración mejora | Calibration score sube ≥10 puntos en 4 semanas en ≥2 de 3 colaboradores | Comparación de medias móviles |
| 2 | ZDP-time sostenido | ≥50% de attempts en banda 70-90% accuracy en semana 4 | Métrica nativa |
| 3 | Independencia scaffold | Nivel promedio de scaffold disminuye ≥0.5 entre semana 1 y 4 | Trayectoria de scaffolding |
| 4 | Anti-sycophancy operativa | 0 matches de regex de lista negra escapando al usuario en logs | Auditoría de output |
| 5 | Off-ramps funcionan | ≥1 off-ramp P4 efectivamente disparado por colaborador, sin frustración reportada | Logs + entrevista |
| 6 | Disenso correcto | El agente mantiene posición ante insistencia con evidencia en ≥1 caso documentado por colaborador | Logs + entrevista |

### 14.2 Métricas cualitativas (entrevistas estructuradas)

- ¿Sentís que el agente te entiende como aprendiz?
- ¿Te molestó alguna vez el `[RAG]` por párrafo?
- ¿Hubo algún momento en que el agente te dijo algo que un chatbot estándar no te diría?
- ¿Cuándo lo cerraste con frustración? ¿Por qué?
- ¿Lo seguirías usando si no te lo pidiera para validar?

### 14.3 Lo que NO se mide

- ❌ Retención semanal / mensual de usuarios.
- ❌ DAU / MAU.
- ❌ NPS.
- ❌ Tiempo total de uso.
- ❌ Streaks o consistencia.

---

## 15. Hitos de Comunidad Open-Source

| Mes | Hito | Descripción |
|---|---|---|
| M1 | Licencia publicada | Apache 2.0 (decisión cerrada — D-M-OS1). Archivo `LICENSE` en raíz. |
| M1 | README público inicial | Visión, instalación, primer uso. Sin promesas que no se cumplen. |
| M3 | CONTRIBUTING.md | Cómo contribuir, estilo de commits, ADRs requeridos para cambios psicopedagógicos. Código de conducta. |
| M3 | TELEMETRY.md | Política de telemetría, eventos exactos, cómo opt-out. |
| M4 | Onboarding de 2-3 colaboradores externos | No beta pública. Entrevistas estructuradas. |
| M5 | Decisión FSRS post-spike | ADR público con razones. |
| M6 | **Primer release público v0.1.0** | Tag en GitHub, changelog, anuncio mínimo en canales relevantes. |

### 15.1 Estructura de repositorio prevista

```
EducAgent/
├── LICENSE                       # Apache 2.0 (M1)
├── README.md                     # visión + quickstart (M1)
├── CONTRIBUTING.md               # cómo contribuir (M3)
├── CODE_OF_CONDUCT.md            # (M3)
├── docs/
│   ├── PRD.md                    # este documento
│   ├── EducAgent_PRD_MVP.md      # PRD original (referencia histórica)
│   ├── TELEMETRY.md              # política telemetría (M3)
│   ├── ADRs/                     # decisiones arquitectónicas
│   └── research/                 # corpus psicopedagógico (00-05)
├── src/
│   ├── domain/                   # políticas P1-P9, scheduler, modelo estudiante
│   ├── adapters/                 # LLM, DB, TUI
│   └── cli/                      # comandos
├── tests/
│   ├── policies/                 # casos derivados de tablas P1-P9
│   ├── scheduler/
│   └── e2e/
└── package.json
```

---

## 16. Anexo A — Glosario

| Término | Definición operativa |
|---|---|
| **ZDP** (Zona de Desarrollo Próximo) | Banda 70-90% de éxito (Vygotsky 1978; operacionalizada con Wilson 2019). |
| **Scaffolding** | Andamiaje cognitivo gradual; se da y retira (fading). |
| **Fluency illusion** | El estudiante cree entender porque la explicación fluye; sin retrieval, no aprendió. |
| **Sycophancy** | Validación complaciente que destruye señal pedagógica. SycEval 2025: 58% basal en LLMs. |
| **Retrieval practice** | Recuperación activa desde memoria; testing effect (Roediger & Karpicke 2006). |
| **Self-explanation** | El estudiante explica con sus palabras; alta evidencia (Chi; Dunlosky 2013). |
| **Desirable difficulties** | Dificultad germane que mejora aprendizaje (Bjork 2011). |
| **Calibración metacognitiva** | Coincidencia entre confianza predicha y desempeño real. |
| **JoL / FoK** | Judgment of Learning / Feeling of Knowing (Flavell). |
| **Productive failure** | Falla controlada antes de instrucción mejora aprendizaje (Kapur 2008). |
| **Lenguaje atribucional** | Atribuir resultados a estrategia/proceso, no a capacidad (Weiner 1985). |
| **SM-2** | Algoritmo de spaced repetition clásico (Wozniak/Anki). |
| **FSRS** | Scheduler SR moderno post-2024, supera a SM-2. |
| **BKT / IRT** | Bayesian Knowledge Tracing / Item Response Theory. |
| **Bloom (taxonomía)** | Recordar / entender / aplicar / analizar / evaluar / crear. |
| **Open learner model** | Modelo del estudiante inspeccionable por el propio estudiante (Bull & Kay 2007). |

---

## 17. Anexo B — Referencias Bibliográficas

Todas las referencias listadas aparecen citadas en el corpus de investigación (`docs/research/`). NO se inventan citas.

- **Bjork, R. A., & Bjork, E. L.** (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning.
- **Bull, S., & Kay, J.** (2007). Open Learner Models.
- **Chi, M. T. H.** (varios) — Self-explanation.
- **D'Mello, S., & Graesser, A.** (2012). Dynamics of affective states during complex learning.
- **Deci, E. L., & Ryan, R. M.** — Self-Determination Theory; motivación intrínseca.
- **Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T.** (2013). Improving Students' Learning With Effective Learning Techniques.
- **Dunlosky, J., & Metcalfe, J.** (2009). *Metacognition*.
- **Flavell, J. H.** (1979). Metacognition and cognitive monitoring.
- **Hattie, J., & Timperley, H.** (2007). The power of feedback. *Review of Educational Research*.
- **Kapur, M.** (2008). Productive failure. *Cognition and Instruction*.
- **Nelson, T. O., & Narens, L.** (1990). Metamemory: A theoretical framework.
- **Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R.** (2008). Learning styles: Concepts and evidence — refutación de VAK.
- **Roediger, H. L., & Karpicke, J. D.** (2006). Test-enhanced learning. — testing effect.
- **Sharma, M., et al.** (2023). Towards Understanding Sycophancy in Language Models. Anthropic.
- **Sisk, V. F., Burgoyne, A. P., Sun, J., Butler, J. L., & Macnamara, B. N.** (2018). To what extent and under which circumstances are growth mindsets important to academic achievement? — replicación débil.
- **SycEval** (2025). Evaluación de sycophancy en LLMs; 58% basal reportado.
- **Sweller, J., Ayres, P., & Kalyuga, S.** (2011). *Cognitive Load Theory*.
- **Vygotsky, L. S.** (1978). *Mind in Society* — ZDP.
- **Weiner, B.** (1985). An attributional theory of achievement motivation and emotion.
- **Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D.** (2019). The Eighty Five Percent Rule for optimal learning. *Nature Communications*.
- **Zimmerman, B. J.** (2002). Becoming a self-regulated learner.

### Lecturas recomendadas para colaboradores nuevos

1. Brown, P. C., Roediger, H. L., & McDaniel, M. A. — *Make It Stick*.
2. Ambrose, S. A., et al. — *How Learning Works*.
3. Dunlosky et al. (2013) — "Improving Students' Learning".
4. Wilson et al. (2019) — "Eighty-Five Percent Rule".
5. SuperMemo / Anki docs (SM-2 y FSRS).
6. Sharma (2023) — "Towards Understanding Sycophancy in LLMs" (Anthropic).

---

## 18. Anexo C — Caveats Científicos NO Negociables

Estos caveats atraviesan todo el producto. NO se ignoran ni se diluyen por demanda de mercado.

### C.1 Estilos de aprendizaje (VAK) — REFUTADO

La hipótesis de "estilos de aprendizaje" (visual / auditivo / kinestésico) **no tiene respaldo empírico** (Pashler et al. 2008). EducAgent **NO** usa esta categorización ni ofrece "tests de estilo". Si un colaborador propone agregarlo, la respuesta es: revisar la evidencia.

### C.2 Growth mindset — REPLICACIÓN DÉBIL

Los efectos de growth mindset reportados originalmente por Dweck tienen **problemas serios de replicación** (Sisk et al. 2018). EducAgent reemplaza este enfoque por el **componente atribucional de Weiner (1985)**: foco en atribuciones internas, controlables e inestables (esfuerzo, estrategia), no en frases motivacionales tipo "¡podés hacerlo!".

### C.3 Pomodoro — BASE FOLCLÓRICA, OUT OF SCOPE

La técnica Pomodoro y otras técnicas de timing rígido tienen base folclórica, no evidencia robusta. **Out of scope del MVP**. Si en validación M4 emerge demanda real, se evalúa sin promesas pseudocientíficas.

### C.4 Detección de afecto — PRECISIÓN MODESTA

La detección afectiva por proxies textuales en CLI tiene **precisión modesta** (~60-70% en literatura, D'Mello & Graesser 2012). EducAgent:

- Marca explícitamente la incertidumbre (`confidence_of_inference` en Affective Log).
- NUNCA actúa con alta certeza sobre una sola señal.
- Solo dispara intervenciones con **convergencia multi-señal sostenida**.
- Ante ambigüedad, **ofrece opciones**, no decide unilateralmente.

---

*Fin del PRD v1.1. Las 10 decisiones de la sección 13 están cerradas. La incertidumbre empírica residual queda marcada con `[heurística operativa]` y `[REQUIERE VALIDACIÓN POST-MVP]` donde corresponde.*
