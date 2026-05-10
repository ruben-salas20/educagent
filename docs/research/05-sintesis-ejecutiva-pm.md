# EducAgent — Síntesis Ejecutiva para Product Manager

## TL;DR (200 palabras)

EducAgent es un **CLI tutor inteligente** open-source para estudiantes técnicos autodidactas y universitarios con alta autonomía. Su tesis pedagógica: combatir la *fluency illusion* y la *sycophancy* que afectan a los LLM-tutors actuales, mediante **retrieval practice + scaffolding graduado + calibración metacognitiva**. Tiene 4 modos (Socrático, Arquitecto, Simulacro, Explorador) más un modo bootstrap implícito ("Tutor") cuando no hay material. Opera sobre 3 fuentes con jerarquía epistémica explícita: RAG > web > LLM general, con etiquetado por párrafo. El modelo del estudiante se construye sobre **Attempts inmutables** como átomo, con derivados recalculables (mastery, calibración, retención). 9 políticas operativas (P1-P9) ya están especificadas; 6 métricas pedagógicamente válidas reemplazan a streaks/XP/ranking (vetados explícitamente). Naturaleza: proyecto open-source, MVP de 6 meses, 1-2 colaboradores tempranos, sin GTM ni pricing. Stack: TypeScript + Ink + SQLite + LangChain/Vercel AI SDK. El PM debe entregar PRD final repositorio-ready cerrando 10 decisiones abiertas (5 modelo, 2 técnicas, 3 meta open-source) con defaults propuestos en este dossier. Constraints duros: 6 antipatrones vetados, caveats científicos honestos.

---

## 1. Contexto Ejecutivo

**EducAgent** es una CLI tutora inteligente diseñada para estudiantes técnicos autodidactas y universitarios con alta autonomía cognitiva. No es un chatbot educativo más: es un agente con **política pedagógica explícita**, fundada en literatura de psicología educativa con evidencia empírica replicada (testing effect, scaffolding, calibración metacognitiva, ZDP, lenguaje atribucional). El producto vive en la terminal por decisión filosófica — el CLI es coherente con el perfil anti-inmediatez del usuario primario y desincentiva la gamificación naive.

**Naturaleza del proyecto**: open-source con potencial de comunidad. NO es comercial pago, NO es startup con fondos. Sin GTM, sin pricing, sin métricas de conversión. Documentación y arquitectura limpia priorizadas para contribución externa. Sustentabilidad eventual via GitHub sponsors o donaciones; un enterprise tier queda fuera del horizonte de 6 meses. El PRD final será publicado como `docs/PRD.md` en repositorio público.

**Usuario primario**: estudiante técnico autodidacta o universitario, alta autonomía, comodidad en terminal, perfil "anti-inmediatez". Bilingüe ES/EN típico, trabaja con apuntes propios o material disponible online.

**Tesis pedagógica central**: el aprendizaje real ocurre con **retrieval practice + scaffolding graduado + calibración metacognitiva**. La debilidad central de los LLM-tutors actuales es producir *fluency illusion* y *sycophancy*. EducAgent ataca ambos: retrieval forzado al final de toda explicación, calibración pre/post-confidence con cierre auditado, disenso explícito con evidencia, lenguaje atribucional de Weiner (estrategia/proceso, NO capacidad innata).

**Por qué este producto y por qué ahora**: el cuadrante "alto rigor metacognitivo × alta autonomía" está vacante. Math Academy se acerca pero sacrifica autonomía con riel curricular. Khanmigo opera con socratismo poroso y delega aritmética al LLM (falla en `343-17`). Anki tiene SR pero cero modelo del estudiante consultable. Brilliant es problem-first pero sin SR ni persistencia. Cursor demostró que modos explícitos en CLI funcionan, pero sin política pedagógica. **El espacio "Cursor educativo con metacognición visible y transparencia epistémica" no existe.** SycEval 2025 reportó 58% de sycophancy promedio en LLMs — la barra está baja y la ventana de oportunidad está abierta.

---

## 2. Diferenciación Competitiva

### Cuadrante de posicionamiento (rigor metacognitivo × autonomía)

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

### 7 brechas explotables

| # | Brecha | Posicionamiento de producto |
|---|--------|------------------------------|
| 1 | Transparencia epistémica RAG/LLM/web | Etiqueta por párrafo `[RAG: doc, p.X]` / `[GK]` / `[web: dominio · fecha]` |
| 2 | Calibración metacognitiva auditada | Pre/post-confidence visible, calibration score como métrica primera |
| 3 | Anti-sycophancy operativa | Lista negra regex ES+EN, disenso firme con evidencia |
| 4 | Modelo del estudiante consultable | `/student show` revela mastery, gaps — no caja negra |
| 5 | Productive failure estructurado | Scaffold 5 niveles con criterios de bajada y fading |
| 6 | Lenguaje atribucional Weiner | Feedback al proceso/estrategia, nunca a capacidad |
| 7 | CLI como anti-inmediatez | Fricción germane preservada deliberadamente |

### 6 antipatrones VETADOS (constraints duros)

1. **Streaks, hearts, XP, ranking** (Duolingo) — erosionan motivación intrínseca (Deci/Ryan).
2. **LLM haciendo cómputo** (Khanmigo en `343-17`) — delegar a tools deterministas.
3. **Recognition disfrazada de recall** (Anki mal usado) — solo recall genuino cuenta.
4. **Socratismo poroso** (Khanmigo) — preguntas que se rinden a la primera presión.
5. **Engagement-as-proxy** — tiempo en app NO es métrica positiva.
6. **Sycophancy** ("¡excelente pregunta!") — destruye señal pedagógica.

### 5 riesgos críticos

1. **Hábito sin gamification**: cómo retener sin streaks ni XP — apoyarse en señal pedagógica visible y revisión just-in-time.
2. **Calibración del knowledge graph a corpus agnóstico**: Math Academy lo tiene cerrado; EducAgent opera sobre material arbitrario — riesgo de inferencia ruidosa.
3. **Cold start**: usuario sin material requiere bootstrap diagnóstico decente (P9).
4. **Accuracy en cómputo/código**: tooling determinista desde día uno (sympy, sandbox, type-checkers).
5. **Cognitive load del propio agente**: etiquetas de fuente + scaffolding + calibración suman información — el diseño CLI debe respirar.

---

## 3. Marco Pedagógico Operativo (9 Políticas)

### P1 · Feedback Formativo  *(constraint duro)*

Matriz error × modo → respuesta. 5 tipos de error (conceptual / procedimental / transferencia / incompleto / no-sé) × 4 modos = 20 celdas con `dice`/`pregunta`/`scaffold`/`prohibido`. **Delta por fuente**: feedback firme contra evidencia RAG/web; humilde contra LLM puro.
*Ejemplo*: error conceptual en Socrático → no se corrige; se devuelve pregunta que apunta al supuesto erróneo.

### P2 · Escalada y Retirada de Andamios  *(constraint duro)*

5 niveles: pista conceptual → procedimental → worked example → completion problem → solución. Criterios de bajada, fading explícito, "rendición productiva sin estigma". Velocidad distinta por modo (Socrático lento, Simulacro inexistente).
*Ejemplo*: tras 3 errores consecutivos en mismo nivel → bajar; tras 2 aciertos → ofrecer N+1.

### P3 · Anti-Sycophancy y Disenso Explícito  *(constraint duro)*

Lista negra regex ES+EN: `excelente pregunta!`, `great question!`, `qué buena observación`. Lista permitida: descriptiva no valorativa. Disenso explícito en error de hecho, error de razonamiento, insistencia infundada. **El agente NUNCA cede a insistencia con evidencia** (Sharma 2023, SycEval 2025). **Delta por fuente**: disenso firme con evidencia RAG/web; humildad explícita cuando viene solo de LLM.

### P4 · Off-Ramps entre Modos  *(constraint duro)*

Explorador FUERZA retrieval cuando >1500 tokens, ≥3 conceptos nuevos. Simulacro pausa al detectar cascada de errores. Arquitecto cede planificación con productive failure (Kapur).
*Ejemplo*: usuario 20 min en Explorador → al cruzar umbral, agente fuerza 3 ítems de retrieval antes de seguir.

### P5 · Captura Metacognitiva  *(default configurable)*

4 momentos (pre / durante / post / cierre). Anti-fatiga: máx 2 prompts/hora. Inferencia automática desde latencia, lenguaje afectivo, retries. **Delta por fuente**: pregunta "¿de dónde sacaste eso — del material, de algo que te dije yo, o de tu intuición?"

### P6 · Tono y Lenguaje Atribucional (Weiner)  *(constraint duro)*

7 atributos persona: "paciente con proceso, impaciente con atajo". Tabla atribucional ES+EN. Reglas de SILENCIO (suprimir filler).
*Ejemplo*: NO "sos bueno en esto"; SÍ "tu estrategia de descomposición funcionó — aplicaste invariantes antes de calcular".

### P7 · Calibración de Dificultad y Selección de Ítem  *(default configurable)*

Regla 85% (Wilson 2019). Algoritmo de selección: SM-2 due > weak concepts > new > deepening. Detección fuera-de-ZDP: 3 errores | latencia 5× | scaffold 4 sin éxito. **Delta por fuente**: pools separados (RAG-curado: 85% directo; LLM-generated: 90% + ítem marcado "auto-generado, posible error").

### P8 · Transparencia Epistémica  *(constraint duro)*  ← amendment

Cada respuesta etiqueta su fuente **por párrafo**: `[RAG: doc, p.X]` / `[web: dominio · fecha]` / `[GK]` / `[RAG+GK]`. Jerarquía pedagógica RAG > web > LLM. Disenso entre fuentes: nunca contradecir RAG en silencio; presentar conflicto sin resolver unilateralmente.

### P9 · Bootstrap de Curriculum  *(default configurable)*  ← amendment

Cuando NO hay material, activa flujo "Tutor": 5 preguntas diagnósticas en turnos separados (no formulario), genera curriculum con nodos bien formados (id, objetivo verificable y observable — NO "entender X", dependencias, duración rango, criterio de cierre). Anti-atrofia: plan con 2-3 huecos `[?? — vos decidís]`, 1 nodo comodín del usuario. Co-construcción por turnos.

### Constraints duros vs defaults configurables

| Política | Tipo | Razón |
|----------|------|-------|
| P1 Feedback | Duro | Matriz error × modo es identidad pedagógica |
| P2 Andamios | Duro | ZDP no es opcional |
| P3 Anti-sycophancy | Duro | Identidad central del producto |
| P4 Off-ramps | Duro | Combaten fluency illusion estructuralmente |
| P5 Captura metacog | Configurable | Cadencia y forma se ajustan al usuario |
| P6 Tono Weiner | Duro | Política persona-level |
| P7 Calibración 85% | Configurable | Umbrales son `[heurística operativa]` |
| P8 Transparencia | Duro | No negociable post-amendment |
| P9 Bootstrap | Configurable | Solo activa si no hay material |

### Caveats científicos honestos (NO negociables)

- **Estilos de aprendizaje (VAK)**: refutados (Pashler 2008). NO usar.
- **Growth mindset**: problemas de replicación (Sisk 2018). Reemplazado por componente atribucional de Weiner (1985).
- **Pomodoro**: base folclórica. Out of scope MVP.
- **Detección de afecto**: solo proxies textuales/temporales (D'Mello & Graesser 2012). Ante ambigüedad, ofrecer opciones, no decidir.

---

## 4. Modelo del Estudiante — Resumen Arquitectónico

3 principios atravesando todo:
1. **El modelo es una hipótesis, no verdad.** Cada inferencia es revisable.
2. **Granularidad de captura > granularidad de inferencia.**
3. **Privacidad es constraint atravesado desde día 0.**

### 12 entidades núcleo

| # | Entidad | Propósito | Atributos clave |
|---|---------|-----------|-----------------|
| 1 | Project / Studio Space | Contenedor de proyecto | language, sources, granularity, exam_anchor, retention_level |
| 2 | Knowledge Source | Fuente tipada | kind (rag/web/llm), confidence_tier, freshness, validity |
| 3 | Curriculum | Árbol de nodos | nodes con prerequisitos, bloom_target, status, risk_flags |
| 4 | Concept | Granularidad híbrida | parent_concept_id, bloom_levels_seen |
| 5 | Item / Practice Unit | Pregunta/ejercicio | origin (rag_curated/bank_curated/llm_improvised), pool_membership |
| 6 | **Attempt** ⭐ | **Átomo inmutable** | outcome, scaffold_level_reached, error_type, pre/post_confidence, retry_count |
| 7 | MasteryState | Vector multidim con incertidumbre | SM-2, accuracy_window, scaffold_trajectory, bloom_coverage, confidence_interval |
| 8 | MetacognitiveSignal | Calibración pre/post | pre/post_confidence, calibration_gap, JoL, FoK |
| 9 | Affective Log | Proxies textuales | confidence_of_inference, retention_tier configurable |
| 10 | Session | Línea de tiempo | mode_timeline, exit_reasons, fatigue_indicator, off_ramps_triggered |
| 11 | Source-Attribution Log | Trazabilidad de claims | operacionaliza P8 |
| 12 | Item Bank Pool | Vista filtrada | filtros por origin/quality/concept |

### Attempt como átomo inmutable — decisión arquitectónica fuerte

Toda inferencia derivada (mastery, calibración, retención, scaffolding trajectory) **se recalcula desde Attempts**. NUNCA se editan ni borran — son hechos pasados. Esto habilita: (a) cambio de modelo de inferencia sin reescribir historia (BKT → IRT post-MVP), (b) auditoría completa, (c) export/import sin pérdida, (d) reproducibilidad de métricas. **Regla de oro**: Attempts inmutables; derivados recalculables; nada huérfano.

### Señales del estudiante (resumen de 17)

Mapeadas como: explícitas (lo que dice) / implícitas (latencia, retries, lenguaje afectivo) / derivadas (calibración, scaffold trajectory, fatigue). **Regla operacional clave**: ninguna señal implícita por sí sola dispara intervención — solo **convergencia multi-señal sostenida**.

### Estado metacognitivo (Flavell/Zimmerman operacionalizado)

3 componentes:
- **Conocimiento** → `pre_confidence` agregada.
- **Monitoreo** → `calibration_score = 1 - mean(|gap|)`, sub-índices over/underconfidence.
- **Control** → eventos: mode-switch, scaffold-request, vuelta a fuente.
- **Score agregado**: 40% calibration + 30% control + 30% conocimiento.
- Umbrales con acciones del agente (subconfianza sostenida → refuerzo atribucional Weiner P6).

### Privacidad — 3 niveles  *(default strict)*

| Nivel | Comportamiento |
|-------|----------------|
| **Strict** (default) | Affective log se colapsa a agregados anonimizados al cerrar sesión |
| **Standard** | Cross-session con TTL 90 días default |
| **Full** | Opt-in explícito, sin TTL |

Métricas pedagógicas (mastery, calibration, retention curves) **siempre** se preservan. Comandos: `/privacy show|set|export|purge affect|purge project`.

### 6 métricas de salud (visibles, pedagógicamente válidas)

1. **Calibración metacognitiva** (predicho vs real)
2. **Cobertura curriculum / RAG** (NO sumadas — dimensiones distintas)
3. **Retention rate** por concepto (curva de decay personal vs SM-2 esperada)
4. **Distribución de errores** por tipo
5. **Trayectoria de scaffolding** (independencia creciente — el progreso REAL del aprendizaje)
6. **Tiempo en zona ZDP** (banda 70-90%)

### EXPLÍCITAMENTE EXCLUIDAS (vanity metrics, NO mostrar)

- Streak diario · Puntos / XP · Ranking comparativo · Tiempo total como métrica positiva.

### 6 casos de borde críticos

1. Cambio de granularidad mid-proyecto → padre se preserva, hijos heredan prior bayesiano débil.
2. Material nuevo a mitad de bootstrap → re-evalúa risk_flags, NO agrega nodos automáticamente.
3. Source invalidado → items pasan a `under_review`, intenta re-anclar.
4. LLM-generated refutado por RAG → agente reconoce error previo (momento metacognitivo de oro).
5. Inactividad 30+ días → sesión diagnóstica suave.
6. **Regla de oro**: Attempts inmutables; derivados recalculables; nada huérfano.

---

## 5. Modos del Agente

| Modo | Propósito pedagógico | Mecanismos clave | Riesgo si se aplica mal | Off-ramps (P4) |
|------|----------------------|------------------|--------------------------|-----------------|
| 🧙‍♂️ **Socrático** | Construcción de comprensión por preguntas | P2 escalada lenta, P3 disenso firme, P5 captura metacog | "Strict sin escalada" → indefensión aprendida (viola ZDP) | Si scaffold 4 sin éxito → ofrece worked example |
| 🗺️ **Arquitecto** | Planificación, diseño, descomposición | P9 productive failure, andamiaje al planeamiento | Generar plan completo atrofia metacognición de planificar | Si usuario acepta pasivamente → sondea acepta o no cuestionó |
| ⏱️ **Simulacro** | Evaluación auténtica bajo restricción | P7 ítems curados, P1 feedback diferido al cierre | Cascada de errores sin pausa → desánimo | Cascada N errores → pausa, ofrece volver a Socrático |
| ☕ **Explorador** | Apertura, mapeo, conexiones | Lectura exploratoria con etiqueta de fuente (P8) | **Fluency illusion** sin retrieval forzado | >1500 tokens / ≥3 conceptos nuevos → fuerza retrieval |

**El modo más peligroso es el Explorador** (no el Socrático). Genera fluency illusion porque la información fluye sin demanda cognitiva. Rediseño obligatorio: acoplar mini-tests automáticos al final de toda exploración prolongada.

### Modo bootstrap implícito ("Tutor") — P9

Cuando `sources = none`, agente activa flujo **Tutor** ANTES de Socrático: 5 preguntas diagnósticas en turnos separados → propone curriculum → co-construcción por turnos → entonces habilita Socrático sobre cada nodo. **NO estaba en el PRD original**, debe documentarse.

### Mapa de transiciones

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

**Regla de transición**: agente PROPONE, usuario CONFIRMA. Excepción: off-ramps forzados de P4.

**Mapeo nodo → modo (P9)**: conceptual → Socrático · diseño → Arquitecto · práctica → Simulacro · mapeo → Explorador.

---

## 6. Stack y Decisiones Técnicas

### Stack del PRD original (mantenido)

- **TypeScript** + **Ink** (TUI) · **SQLite** (local-first) · **LangChain / Vercel AI SDK** · **Chalk**.

### Tooling determinista para cómputo y código  *(constraint duro)*

NO delegar aritmética ni ejecución de código al LLM. Argumento decisivo: Khanmigo falla en `343-17`.

| Dominio | Tool determinista candidato |
|---------|------------------------------|
| Matemática simbólica | `sympy` (Python via Pyodide) o `math.js` |
| Aritmética / cálculo | calculadora propia o nerdamer |
| Ejecución de código | sandbox (Pyodide, Node VM, Deno) |
| Validación de tipos | `tsc`, type-checkers nativos |
| Tests del usuario | runner del lenguaje correspondiente |

### Scheduler SR: SM-2 con abstracción

**MVP: SM-2** por madurez. Diseñar interfaz `IScheduler` para migrar a FSRS post-MVP. Notar honestamente: **FSRS (Anki post-2024) es estado del arte**, resuelve "ease hell" de SM-2; spike pre-MVP recomendado.

### Detección runtime de sycophancy y fluency illusion

P3 y P4 requieren **detección operativa runtime**, no solo prompts:
- **Sycophancy**: regex-list ES+EN sobre output del agente antes de imprimir, bloqueo + reintento, métrica logueada.
- **Fluency illusion**: contadores de tokens sin retrieval, conceptos nuevos introducidos, trigger automático.
- Ambos `[heurística operativa]` — refinar con datos reales `[REQUIERE VALIDACIÓN POST-MVP]`.

### Constraints arquitectónicos (open-source)

- **Hexagonal**: dominios puros aislados de adapters. Permite testabilidad y reemplazo de proveedor LLM.
- **Contribuible**: ADRs para decisiones psicopedagógicas que parezcan extrañas a un dev sin contexto.
- **Testeable**: políticas operativas como funciones puras. Casos de prueba derivados de tablas decisionales P1-P9.
- **i18n día 0**: `material_language` ≠ `agent_language`.

---

## 7. Roadmap de 6 Meses

### MVP (Meses 1-3) — Fase 1 robusta

**Modos**: 🧙‍♂️ Socrático + ☕ Explorador + bootstrap Tutor (P9).

**Componentes**:
- Ingesta RAG local (PDF, Markdown, texto plano).
- Modelo del estudiante mínimo: **Attempts inmutables + MasteryState básico (SM-2 + accuracy_window) + privacidad strict default**.
- Métricas core: calibración, ZDP-time, scaffolding trajectory.
- Políticas P1-P9 en versión MVP con umbrales `[heurística operativa]`.
- Tooling determinista mínimo: aritmética + sandbox JS/TS.
- CLI con etiqueta de fuente por párrafo (P8).
- Comandos: `/privacy`, `/student show`, `/sources`.

**Excluido del MVP**: Modo Arquitecto, Modo Simulacro, FSRS migration, web search profunda (solo flag opt-in con prompt P9), integración Notion, detección afecto sofisticada.

### Validación (Mes 4)

- Onboarding **2-3 colaboradores externos** (no beta pública).
- Recolección feedback estructurado.
- Datos reales para validar heurísticas `[REQUIERE VALIDACIÓN POST-MVP]`.
- Telemetría mínima opcional con consentimiento.

### Iteración (Meses 5-6)

- Incorporar feedback.
- **Spike FSRS** y decisión migración SM-2 → FSRS.
- Decidir siguiente modo: 🗺️ Arquitecto o ⏱️ Simulacro según demanda real.
- Robustecer modelo del estudiante (BKT vs heurística).
- Hitos comunidad: **licencia elegida** (M1), **README** público, **CONTRIBUTING.md**, **primer release público v0.1.0**.

### Explícitamente FUERA del horizonte 6 meses

Notion · Beta pública · Modos Arquitecto y Simulacro completos · Web search profunda · FSRS implementación · Detección afecto multimodal · Multi-usuario / sync cloud · Tier enterprise / pricing.

---

## 8. Decisiones Abiertas que el PM debe Cerrar con el Usuario

### Del Modelo del Estudiante

#### D1 · Promoción de ítems improvisados al banco curado
- **Default propuesto**: **manual con asistencia**. Usuario decide; agente sugiere candidatos con score de calidad.
- **Razón**: promoción automática contamina pool curado (P7); promoción manual pura genera fricción.
- **Ratificar**: ¿flujo `/items review` periódico, o promoción inline al final de cada sesión?

#### D2 · Frecuencia y forma del prompt metacognitivo pre-confidence
- **Default propuesto**: **escala 1-5**, cadencia adaptativa (cada 3-5 ítems, máx 2 prompts/hora P5). Off-switch granular.
- **Razón**: escala numérica es estándar JoL/FoK; cadencia adaptativa respeta carga cognitiva.
- **Ratificar**: ¿numérica o categórica ("seguro / dudoso / no sé")? ¿off-switch por sesión o proyecto?

#### D3 · Modelo de incertidumbre del MasteryState
- **Default propuesto**: **heurística simple con abstracción**. MVP usa `accuracy_window + SM-2 stability` con intervalo de confianza naive. Diseñar `IMasteryEstimator` para reemplazar a BKT/IRT-lite.
- **Razón**: BKT/IRT requieren calibración con dataset previo que no tenemos.
- **Ratificar**: ¿el usuario acepta que la "incertidumbre" en MVP sea aproximada y mejore con datos reales?

#### D4 · Política de olvido benevolente tras inactividad larga
- **Default propuesto**: tras 30+ días, **sesión diagnóstica suave**: agente saluda, propone repaso de 3-5 ítems de mastery alta para "calibrar dónde estás", NO castigo SM-2 acumulado de golpe. Recalcula stability con curva de decay.
- **Razón**: castigar inactividad rompe relación y motivación intrínseca; alineado con Weiner (P6).
- **Ratificar**: ¿control manual ("ya volví, hacé reset suave") o automático?

#### D5 · Visibilidad del Source-Attribution por default
- **Default propuesto**: **discreto siempre** — etiqueta por párrafo en color tenue, comando `/sources verbose|compact|off` para ajustar.
- **Razón**: P8 es duro (transparencia); P2 nos preocupa por carga cognitiva. Discreto resuelve ambos.
- **Ratificar**: ¿ver `[RAG]` siempre, o solo cuando hay mezcla / disenso?

### Del Benchmark — decisiones técnicas

#### T1 · SM-2 vs FSRS
- **Default propuesto**: **SM-2 en MVP con interfaz `IScheduler` + spike de FSRS pre-Mes-3** para evaluar migración en Mes 5.
- **Razón**: SM-2 sobradamente documentado y simple; FSRS superior pero migración sin datos propios es prematura.
- **Ratificar**: ¿preferencia explícita por arrancar directamente con FSRS asumiendo más complejidad inicial?

#### T2 · Tooling determinista para cómputo
- **Default propuesto** (priorizado):
  1. **Sandbox JS/TS** (Node VM o Deno) — primeros usuarios probables JS/TS.
  2. **Aritmética básica** — calculadora propia evita fallo Khanmigo.
  3. **`sympy` via Pyodide** — math simbólica si el usuario es de cálculo.
  4. **Type-checkers** — diferidos a Fase 2.
- **Ratificar**: ¿qué dominio académico real tiene el usuario primario en mes 1?

### Meta-decisiones del proyecto open-source (nuevas)

#### M1 · Licencia (MIT / Apache 2.0 / AGPL)
- **Default propuesto**: **Apache 2.0**.
- **MIT**: máxima simplicidad, NO protege contra fork comercial cerrado.
- **Apache 2.0** ✓: similar permissividad + cláusula de patentes + atribución requerida. Estándar en proyectos serios.
- **AGPL**: copyleft fuerte, obliga publicar modificaciones incluso en SaaS. Protege contra apropiación pero **espanta colaboradores corporativos**.
- **Razón del default**: el proyecto busca comunidad y adopción; Apache balancea protección con permissividad.
- **Ratificar**: ¿postura ideológica copyleft fuerte (AGPL), o priorizar adopción (MIT/Apache)?

#### M2 · Telemetría opcional con consentimiento
- **Default propuesto**: **opt-in explícito en primer arranque**, evento por evento documentado en `docs/TELEMETRY.md`. Sin telemetría, producto 100% funcional.
- **Qué se mediría** (opt-in): distribución de modos (anonimizada), tasa de off-ramps P4, calibración promedio (sin contenido), errores y crashes.
- **Qué NO se mide nunca**: contenido del material, contenido de attempts, prompts ni respuestas.
- **Endpoint**: ninguno en MVP (logs locales solamente, exportables manualmente para 2-3 colaboradores).
- **Ratificar**: ¿telemetría opt-in en MVP, o "cero red" hasta validación M4?

#### M3 · Modelo LLM por default
- **Default propuesto**: **configurable, 3 perfiles documentados**:
  - **Local first** (recomendado para usuario alta autonomía): Ollama con Llama 3.1 8B o Qwen 2.5 7B. Privacy total, costo cero.
  - **Cloud-balanced**: Claude Sonnet o GPT-4o-mini. Calidad alta, costo moderado.
  - **Cloud-premium**: Claude Opus o GPT-4o. Calidad máxima, costo alto.
- **Razón**: open-source + privacy strict default empuja a local-first como bandera filosófica; pero usuario técnico autodidacta puede no tener GPU adecuada.
- **Implicaciones**: tests P3 anti-sycophancy deben pasar contra los 3 perfiles.
- **Ratificar**: ¿hardware para Ollama? ¿Presupuesto cloud durante validación?

---

## 9. Anexo · Glosario y Referencias

### Glosario (15 términos)

| Término | Definición operativa |
|---------|----------------------|
| **ZDP** | Banda 70-90% de éxito (Vygotsky). |
| **Scaffolding** | Andamiaje cognitivo gradual; se da y retira (fading). |
| **Fluency illusion** | Estudiante cree entender porque la explicación fluye; sin retrieval, no aprendió. |
| **Sycophancy** | Validación complaciente que destruye señal pedagógica. SycEval 2025: 58% basal en LLMs. |
| **Retrieval practice** | Recuperación activa desde memoria; testing effect (Roediger & Karpicke 2006). |
| **Self-explanation** | Estudiante explica con sus palabras; alta evidencia (Chi, Dunlosky 2013). |
| **Desirable difficulties** | Dificultad germane que mejora aprendizaje (Bjork 2011). |
| **Calibración metacognitiva** | Coincidencia entre confianza predicha y desempeño real. |
| **JoL / FoK** | Judgment of Learning / Feeling of Knowing (Flavell). |
| **Productive failure** | Falla controlada antes de instrucción mejora aprendizaje (Kapur). |
| **Lenguaje atribucional** | Atribuir resultados a estrategia/proceso, no a capacidad (Weiner 1985). |
| **SM-2** | Algoritmo SR clásico (Wozniak/Anki). |
| **FSRS** | Scheduler SR moderno post-2024, supera SM-2. |
| **BKT / IRT** | Bayesian Knowledge Tracing / Item Response Theory. |
| **Bloom (taxonomía)** | Recordar / entender / aplicar / analizar / evaluar / crear. |

### Autores citados (con año)

Vygotsky 1978 (ZDP) · Roediger & Karpicke 2006 (testing effect) · Chi, Dunlosky et al. 2013 (self-explanation) · Bjork 2011 (desirable difficulties) · Weiner 1985 (atribucional) · Hattie & Timperley 2007 (feedback) · Wilson 2019 (regla 85%) · Pashler 2008 (refutación VAK) · Sisk 2018 (replicación growth mindset) · Deci & Ryan (motivación intrínseca) · D'Mello & Graesser 2012 (afecto) · Flavell (metacognición) · Zimmerman (autorregulación) · Kapur (productive failure) · Sharma 2023 (sycophancy LLMs) · SycEval 2025.

### Lecturas recomendadas para colaboradores nuevos

1. **"Make It Stick"** — Brown, Roediger, McDaniel.
2. **"How Learning Works"** — Ambrose et al.
3. Dunlosky et al. 2013 — "Improving Students' Learning".
4. Wilson et al. 2019 — "Eighty-Five Percent Rule".
5. SuperMemo / Anki docs (SM-2 y FSRS).
6. Sharma 2023 — "Towards Understanding Sycophancy in LLMs" (Anthropic).

### Inconsistencias detectadas

**Ninguna inconsistencia bloqueante** entre los 10 topics. Una observación menor: el primer cierre del Paso 1 había marcado "persistencia modelo afectivo" como "configurable por usuario" (intra-sesión + agregados); luego el Modelo del Estudiante la operacionalizó como **3 niveles** (strict/standard/full). El default strict es coherente y más conservador. **El PM debe usar 3 niveles como verdad final.**

---

## 10. Cierre y Handoff al PM

### Qué tiene el PM en sus manos

1. **Esta síntesis ejecutiva** (`docs/research/05-sintesis-ejecutiva-pm.md`).
2. **5 documentos de profundización** en `docs/research/`.
3. **PRD original** en `docs/EducAgent_PRD_MVP.md` como base estructural.

### Qué se espera del PM

Producir un **PRD final** estructurado, listo para repositorio público (`docs/PRD.md`):
- Documentar las 9 políticas operativas como comportamiento del producto.
- Definir las 12 entidades del modelo del estudiante con sus relaciones.
- Articular los 4 modos + bootstrap Tutor con mecanismos y off-ramps.
- Detallar roadmap de 6 meses (MVP / Validación / Iteración).
- **Cerrar las 10 decisiones abiertas** (5 modelo + 2 técnicas + 3 meta) con los defaults propuestos como punto de partida, sometidos a ratificación del usuario.
- Incluir `CONTRIBUTING.md` mínimo, sección de licencia (M1) y telemetría (M2).
- Escribir asumiendo lectores externos del repo público.

### Qué NO debe hacer el PM

- **NO re-discutir** decisiones cerradas (granularidad híbrida, generación híbrida por modo, override bilingüe, web search default off, etiqueta por párrafo, privacidad 3 niveles strict default, naturaleza open-source).
- **NO agregar features** no validadas (Pomodoro, gamificación, Notion en MVP, detección afecto multimodal).
- **NO ignorar caveats científicos**: nada de estilos de aprendizaje, growth mindset reemplazado por Weiner, métricas vanity vetadas.
- **NO marketear** "scheduler propietario" — SM-2 y FSRS son públicos.
- **NO romper** la regla de Attempts inmutables.

El handoff está completo. El PM puede empezar a escribir el PRD directamente.
