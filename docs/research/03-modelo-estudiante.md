# Modelo del Estudiante — EducAgent

**Fase**: Investigación operativa, Paso 2
**Destino**: insumo directo al PRD
**Naturaleza**: especificación semántica (no schema), puente entre psicología educativa y arquitectura de datos
**Versión**: 1.0

---

## 0. Marco conceptual: qué es y qué no es este modelo

El Modelo del Estudiante (MdE) en EducAgent es la **representación operativa de lo que el sistema cree saber sobre el aprendiz en un momento dado**. No es un perfil de personalidad ni un test psicométrico. Es un *open learner model* (Bull & Kay, 2007): inspeccionable por el usuario, falsable, evolutivo.

Tres principios que atraviesan todo el documento:

1. **El modelo es una hipótesis, no una verdad**. Cada inferencia (mastery, afecto, ZDP) debe poder revisarse cuando llega evidencia contraria. El sistema no "sabe" que el usuario domina X — *infiere* dominio bajo una ventana de evidencia con incertidumbre cuantificada.
2. **La granularidad de captura precede a la granularidad de inferencia**. Capturamos atómico (cada attempt, cada latencia) y agregamos para inferir. Lo contrario (capturar agregado) destruye información irrecuperable.
3. **Privacidad no es config tardía**. El nivel de retención del usuario atraviesa el modelo desde el día 0: define qué se persiste, qué se olvida, qué se anonimiza. No se *agrega* al final.

Limitación honesta: el MdE de un MVP en CLI no puede capturar tono de voz, expresión facial, ni interacción longitudinal multi-año. Sus inferencias afectivas y metacognitivas son **proxies textuales con error sistemático conocido** [REQUIERE VALIDACIÓN POST-MVP con telemetría real].

---

## 1. Entidades del modelo

12 entidades núcleo. Cada una se describe con propósito pedagógico, atributos clave (semánticos, no SQL), relaciones y ciclo de vida.

### 1.1 Project / Studio Space

**Propósito**: contenedor de un dominio de estudio coherente. Aísla configuración, fuentes, idioma y curriculum. Un usuario puede tener N proyectos.

**Atributos clave**:
- `id`, `name`, `domain` (auto-detectado o declarado)
- `language_override`: idioma forzado del agente, independiente del material
- `source_config`: qué fuentes están habilitadas (RAG ✓, Web según opt-in, LLM ✓), prioridades, override manual
- `granularity_default`: `section` | `document` | `atomic_concept`
- `exam_anchor`: referencia opcional a pauta/parcial/rúbrica subida por el usuario
- `bootstrap_mode`: bool — true si NO había material previo
- `retention_level`: `strict` | `standard` | `full` — política de afecto cross-session
- `created_at`, `last_active_at`

**Ciclo de vida**: nace al `init`. Se archiva tras >180 días sin actividad (preserva métricas agregadas, purga affective log según retention level). Se elimina solo por acción explícita del usuario.

### 1.2 Knowledge Source

**Propósito**: cada fuente que alimenta al agente. Implementa P8 (etiqueta por párrafo) y la jerarquía RAG > Web > LLM.

**Atributos clave**:
- `id`, `project_id`
- `kind`: `rag_document` | `web_result` | `llm_generated`
- `confidence_tier`: `primary` (RAG curado) | `secondary` (web verificada) | `tertiary` (LLM)
- `provenance`: para RAG → archivo + sección; para Web → URL + fecha; para LLM → modelo + prompt hash
- `freshness_at`: cuándo se ingirió/recuperó
- `validity_status`: `active` | `superseded` | `refuted` | `expired`
- `chunk_index` (para RAG): permite citar al párrafo

**Ciclo de vida**: se marca `superseded` si el usuario sube versión nueva. `refuted` si una fuente de tier mayor contradice. Web sources tienen TTL configurable [heurística operativa: 30 días default]; tras vencer pasan a `expired`.

### 1.3 Curriculum

**Propósito**: árbol de objetivos verificables con dependencias. Existe siempre que haya bootstrap, y opcionalmente sobre material existente.

**Atributos del nodo**:
- `id`, `objective`: enunciado verificable y observable ("el estudiante puede derivar la regla de la cadena en composiciones de 2 niveles")
- `prerequisites`: lista de node_ids
- `bloom_target`: recall/understand/apply/analyze/evaluate/create
- `status`: `locked` | `available` | `in_progress` | `mastered` | `decayed`
- `risk_flags`: cobertura débil de fuentes, alta tasa de error, generado vía LLM sin RAG
- `linked_concept_ids`: relación con §1.4

**Ciclo de vida**: en bootstrap, nace antes que los conceptos. Mutable: se re-evalúa cuando entra material nuevo (§5).

### 1.4 Concept

**Propósito**: unidad mínima sobre la que se rastrea mastery. Su tamaño depende de `granularity_default`.

**Atributos**:
- `granularity`: `section` | `document` | `atomic` — granularidad de ESTE concepto
- `parent_concept_id`: nullable — soporta jerarquía cuando el usuario "atomiza"
- `source_anchors`: links a Knowledge Sources que lo definen
- `bloom_levels_seen`: qué niveles de Bloom se han ejercitado

**Ciclo de vida**: puede *partirse* (atomización a pedido) generando hijos y migrando estado (§5.1). Nunca se borra automáticamente.

### 1.5 Item / Practice Unit

**Propósito**: pregunta, reto o problema concreto. Unidad ejercitable.

**Atributos**:
- `concept_ids`: lista (un ítem puede tocar varios conceptos)
- `origin`: `rag_curated` | `bank_curated` | `llm_improvised`
- `mode_affinity`: `[socratic, architect, simulacro, explorer]`
- `bloom_level`: recall | recognition | application | transfer | analysis
- `expected_difficulty`: estimación inicial [0,1] [heurística operativa]
- `observed_difficulty`: actualizado vía IRT-lite o tasa de error empírica [REQUIERE VALIDACIÓN POST-MVP]
- `scaffold_levels_available`: qué niveles 1-5 tiene pre-escritos vs generados on-demand
- `expected_error_taxonomy`: errores típicos pre-modelados (alimenta P1)
- `validity_status`: `active` | `under_review` | `retired`
- `pool_membership`: para Simulacro/SM-2 (banco curado)

**Ciclo de vida**:
- **Curados** (banco): persisten. Se calibran con cada attempt.
- **Improvisados** (Socrático/Explorador): efímeros. *Promovibles* al banco si el usuario los marca útiles.
- Se retiran si su fuente cae a `refuted`/`expired`.

### 1.6 Attempt ⭐ (átomo inmutable)

**Propósito**: el átomo de evidencia. Cada intento del usuario sobre un ítem. NUNCA se borra (excepto purga explícita).

**Atributos**:
- `started_at`, `submitted_at`, `latency_ms`
- `response_text`: texto del usuario
- `outcome`: `correct` | `partial` | `incorrect` | `skipped` | `gave_up`
- `scaffold_level_reached`: 0 (sin ayuda) → 5 (solución revelada)
- `scaffold_requested_by`: `user` | `agent_offered`
- `error_type`: conceptual / procedural / notational / careless / off-topic / partial-correct
- `pre_confidence` y `post_confidence`: nivel auto-reportado
- `retry_count`: cuántas veces el usuario reformuló antes de submit
- `affective_proxies`: snapshot de §1.9 ligado al attempt

**Ciclo de vida**: inmutable tras submit. Solo se purga por retention policy o eliminación de proyecto.

### 1.7 Mastery State (por concepto)

**Propósito**: hipótesis actual del sistema sobre dominio del usuario. NO es un score puntual: es un vector multidimensional con incertidumbre.

**Atributos**:
- **Componente SM-2**: `ease_factor`, `interval_days`, `repetitions`, `due_date`. Abstracción permite migrar a FSRS sin tocar consumidores.
- **Accuracy window**: tasa de aciertos en últimas N attempts (N=5 default), peso por recencia.
- **Scaffold trajectory**: serie temporal del `scaffold_level_reached` promedio. Indica independencia creciente.
- **Bloom coverage**: qué niveles se han demostrado.
- **Confidence interval**: incertidumbre del estado (alta cuando hay pocas attempts).
- **Mastery_label**: derivado — `not_started` | `learning` | `practicing` | `mastered` | `mastered_decaying` | `needs_review`
- **Last_review_at**, `next_due_at`

**Ciclo de vida**: nace en primer attempt. Se actualiza tras cada attempt. Decae si pasa el `due_date` sin review. Nunca se "completa" definitivamente.

**Trade-off**: un score escalar único es legible pero pobre. El vector multidimensional es rico pero requiere visualización cuidadosa. Solución: persistir vector, exponer al usuario una versión sintetizada (§6).

### 1.8 Metacognitive Signal

**Propósito**: operacionaliza el monitoreo de la autorregulación. Captura predicciones del usuario sobre su propio rendimiento y la realidad.

**Atributos**:
- `signal_kind`: `pre_confidence` | `post_confidence` | `judgment_of_learning` | `feeling_of_knowing` | `strategy_choice`
- `predicted_value`: lo que el usuario reportó
- `actual_value`: outcome real
- `calibration_gap`: signed diff (positivo = sobreconfianza; negativo = subconfianza)
- `prompted_by`: `agent_question` | `user_initiated`

[Heurística operativa: pre-confidence cada 3-4 ítems en Socrático, no en cada uno.]

### 1.9 Affective Log

**Propósito**: rastrea proxies textuales de estado afectivo (frustración, fatiga, confusión, flujo).

**Atributos**:
- `latency_anomaly`: desviación de la latencia respecto a baseline personal
- `length_anomaly`: respuestas muy cortas o muy largas vs baseline
- `retry_burst`: ráfaga de reformulaciones sin submit
- `affective_lexicon_hits`: tokens que sugieren estado, categorizados por valencia y arousal
- `abandon_signal`: usuario cerró sesión post-error sin reintentar
- `inferred_state`: `engaged` | `flow` | `frustrated` | `confused` | `bored` | `fatigued` | `unknown`
- `confidence_of_inference`: [0,1] — el sistema marca su propia incertidumbre
- `retention_tier`: hereda de Project

**Limitación honesta**: la detección afectiva por proxies textuales tiene **precisión modesta** (~60-70% en literatura de affective computing en CLI). El sistema NUNCA debe actuar con alta certeza sobre una sola señal. Solo dispara intervenciones cuando hay convergencia multi-señal sostenida.

### 1.10 Session

**Propósito**: agrupa actividad temporal contigua. Permite analizar fatiga, transiciones de modo, off-ramps.

**Atributos**:
- `mode_timeline`: lista de `(mode, entered_at, exited_at, exit_reason)`
- `attempts_count`, `concepts_touched`
- `fatigue_indicator`: derivado de latencia creciente + accuracy decreciente
- `off_ramps_triggered`: lista de eventos donde el agente sugirió pausa, cambio de modo o cierre
- `summary_for_user`: texto generado al cierre

**Ciclo de vida**: cierra por inactividad (>30min default), cierre explícito, o crash recovery.

### 1.11 Source-Attribution Log

**Propósito**: operacionaliza P8. Cada afirmación sustantiva del agente lleva trazabilidad. Doble propósito: auditoría + entrenar al usuario en rastreo de fuentes.

**Atributos**:
- `claim_text`: la afirmación
- `source_kind`: `rag` | `web` | `llm` | `mixed`
- `source_refs`: lista de Knowledge Source IDs
- `confidence_tier`: heredado de fuente
- `user_visible_label`: cómo se le mostró al usuario

**Ciclo de vida**: persiste mientras persista la sesión. Crítico no purgarse en modo `strict` — la auditoría de fuentes es ortogonal al affective log.

### 1.12 Item Bank Pool (entidad lógica)

**Propósito**: agrupar ítems curados elegibles para Simulacro y SM-2. Vista filtrada sobre Items por `origin ∈ {rag_curated, bank_curated}` y `validity_status = active`.

---

## 2. Señales del estudiante (17 señales)

Tabla maestra: señal × tipo × cuándo × interpretación × consecuencia.

| Señal | Tipo | Cuándo | Interpretación | Consecuencia downstream |
|---|---|---|---|---|
| **Outcome del attempt** | Explícita | Submit | Correcto/parcial/incorrecto | Update MasteryState, SM-2 review |
| **Latencia** | Implícita | Per-attempt | Anomalía vs baseline personal | ↑↑ con error → confusión; ↑↑ con acierto → esfuerzo productivo (ZDP) |
| **Scaffold-request explícito** | Explícita | Cualquier momento | Usuario pide ayuda | Sube scaffold_level; señal positiva de monitoreo activo |
| **"No sé" / abandono** | Explícita | Pre o intra-attempt | Admite no saber | Outcome=skipped, NO penaliza ease_factor agresivamente |
| **Retries (reformulación sin submit)** | Implícita | Pre-submit | Búsqueda activa o frustración | 1-2: pensamiento productivo; >3: frustración → off-ramp blando |
| **Longitud de respuesta** | Implícita | Submit | Anomalía vs baseline | Muy corta + incorrecta: desengagement; muy larga + parcial: pensamiento confuso |
| **Lenguaje afectivo** | Implícita | Cualquier turno | Lexicon de valencia/arousal | Multi-hit + sostenido → ajusta `inferred_state` |
| **Pre-confidence** | Explícita | Pre-attempt | Predicción del usuario | Calcula `calibration_gap` post-outcome |
| **Post-confidence** | Explícita | Post-feedback | Auto-evaluación | Compara con pre-confidence (cambio = monitoreo activo) |
| **Tipo de error** | Derivada | Post-submit | Clasificación | Conceptual → más material; procedural → más práctica |
| **Mode-switch** | Explícita | Comando | Cambio de modo | Captura intención metacognitiva (control) |
| **Calibración (pre vs actual)** | Derivada | Post-attempt | Sobre/subconfianza | Sobreconf. sistemática → más metaprompts |
| **Fading-readiness** | Derivada | Cada N attempts | Ratio de scaffold decreciente con accuracy estable | Permite reducir scaffolds |
| **Out-of-ZDP** | Derivada | Continuo | Accuracy fuera de banda 70-90% | Ajustar dificultad |
| **Fatiga intra-sesión** | Derivada | Continuo | Latencia ↑ + accuracy ↓ | Trigger off-ramp explícito |
| **Abandono post-error** | Implícita | Cierre de sesión | Cerró tras incorrecta | Sumar a Affective Log; NO asumir frustración |
| **Source-trust signal** | Explícita | Usuario cuestiona afirmación | Pide fuente | Trigger para mostrar attribution |

**Diferencia operacional clave**: ninguna señal *implícita* dispara intervención por sí sola. Solo *convergencia multi-señal sostenida*.

---

## 3. Estado metacognitivo

Operacionalización de los 3 componentes (Flavell, 1979; Zimmerman, 2002):

### 3.1 Conocimiento metacognitivo (¿qué cree saber?)

**Operacionalización**: `pre_confidence` agregada por concepto y por sesión.

**Cálculo**:
- Por concepto: media móvil de pre-confidences en últimas K interacciones.
- Por sesión: distribución de pre-confidences.
- Por proyecto: cobertura — % de conceptos con autoevaluación reciente.

### 3.2 Monitoreo (¿detecta sus errores?)

**Operacionalización**: `calibration_gap = pre_confidence − actual_outcome`.

**Score agregado por concepto**:
- `calibration_score = 1 − media(|calibration_gap|)` sobre últimas N interacciones.
- Rango [0,1]: 1 = perfectamente calibrado; <0.5 = mal calibrado.

**Sub-clasificación**:
- `overconfidence_index`: media de gaps positivos.
- `underconfidence_index`: media de gaps negativos.

### 3.3 Control (¿ajusta estrategia?)

**Operacionalización**: eventos de adaptación.
- Cambio de modo iniciado por el usuario.
- Scaffold-request bien-temporizado.
- Vuelta voluntaria al material fuente.
- Auto-pausa antes de fatiga.

### 3.4 Score metacognitivo agregado y umbrales

Score por concepto (0-100):
- 40% calibration_score
- 30% control_events normalizados
- 30% conocimiento (cobertura de auto-evaluación)

[Heurística operativa: pesos ajustables, validar con datos reales post-MVP.]

**Umbrales de acción**:

| Umbral | Acción del agente |
|---|---|
| Calibration < 0.4 sostenido (sobreconf.) | Inserta más prompts pre-confidence; usa worked examples antes de practice |
| Calibration < 0.4 sostenido (subconf.) | Refuerzo atribucional Weiner: "tu respuesta fue correcta. ¿Qué estrategia usaste?" |
| Score control bajo + frustración detectada | Sugiere modo Arquitecto o pausa explícita |
| Score control alto + accuracy estable | Reduce prompts metacognitivos — *fading metacognitivo* |
| Calibration_score ↑ tendencia | Feedback explícito: "tu calibración mejoró 30% este mes" |

---

## 4. Privacidad y retención

3 niveles. **El usuario elige al crear el proyecto**, puede cambiar después con consecuencias explícitas.

### 4.1 Strict (default)

| Se persiste | NO se persiste |
|---|---|
| Attempts (outcome, latencia, scaffold reached, error_type) | Affective Log detallado cross-session |
| MasteryState | Affective lexicon hits específicos |
| MetacognitiveSignal (calibración) | Inferred state granular fuera de la sesión activa |
| Session summary (alto nivel) | |
| Source-Attribution Log | |
| Agregados afectivos anonimizados (% sesiones con frustración detectada, fatiga promedio) | |

**Mensaje al usuario**: "Tus señales emocionales se usan solo durante esta sesión y luego se descartan. Conservamos métricas anónimas para mostrarte tendencias."

### 4.2 Standard

Igual que strict, **más**:
- Affective Log persiste cross-session con TTL (90 días default, configurable 30-180).
- El usuario puede pedir "muéstrame los momentos de frustración del último mes".

### 4.3 Full (opt-in explícito)

Igual que standard, **más**:
- Sin TTL automático.
- Histórico completo accesible.

### 4.4 Métricas siempre preservadas (todos los niveles)

Anónimas-por-construcción y críticas para el modelo:
- Mastery aggregates por concepto.
- Calibration scores agregados.
- Curriculum coverage.
- Retention curves (decay).

### 4.5 Visibilidad y control

```
/privacy show               # ver qué se está guardando ahora
/privacy set strict|standard|full
/privacy export             # exportar todo
/privacy purge affect       # borrar afecto sin perder mastery
/privacy purge project      # borrar proyecto entero
```

**Trade-off**: strict por default es pedagógicamente subóptimo (perdemos longitudinal) pero éticamente correcto y construye confianza.

---

## 5. Casos de borde y reglas de coherencia

### 5.1 Cambio de granularidad mid-proyecto

Usuario marca "Cap.3 — Derivadas" para atomizar.

1. Concept-padre se preserva con `granularity=section`.
2. Se generan Concept-hijos con `parent_concept_id` apuntando al padre.
3. **MasteryState del padre NO se copia mecánicamente**. Hijos arrancan con accuracy_window vacía pero `expected_difficulty` heredada como prior bayesiano débil.
4. Attempts históricos del padre quedan ligados al padre.
5. Items existentes se re-mapean si el LLM puede asociarlos a hijo específico; si no, quedan ligados al padre.

**Justificación**: copiar mecánicamente da falsa precisión.

### 5.2 Material nuevo a mitad de bootstrap

1. Knowledge Source se ingiere. RAG se actualiza.
2. Curriculum se re-evalúa: nodos sin RAG ahora con anclaje → `risk_flags` bajan.
3. Contenido en RAG NO cubierto por curriculum: se sugieren nuevos nodos al usuario (NO se agregan automáticamente).
4. Items LLM-generated cuyo concepto ahora tiene RAG: se *re-validan* contra RAG.
5. MasteryState se preserva.

### 5.3 Knowledge Source invalidado

1. Source pasa a `expired` o `refuted`.
2. Items anclados exclusivamente: pasan a `under_review`.
3. Sistema intenta re-anclar a otra source válida.
4. Si no se logra y pertenece a banco persistente: notifica al usuario.
5. Attempts históricos NO se invalidan.

### 5.4 Reconciliación LLM-generated refutado por RAG

Ítem improvisado afirmaba X. Después se ingiere RAG que dice ¬X.

1. Source-Attribution Log permite detectar la afirmación previa.
2. Sistema flag automático cuando RAG ingerido contradice attribution log reciente (últimos 30 días).
3. **El agente proactivamente** muestra al usuario: *"Hace [N] días te dije X (vía LLM, sin verificar). Tu nuevo material dice ¬X. La fuente RAG es más confiable. Disculpás errores en mi razonamiento previo. ¿Repasamos?"*
4. **Momento metacognitivo de oro**: enseña que las fuentes pueden corregir generaciones, modela humildad epistémica.

### 5.5 Usuario inactivo 30+ días

1. MasteryState aplica curva de decay según SM-2.
2. Affective Log: según retention level, posiblemente purgado.
3. Al volver, sesión inicial es **diagnóstica suave**: review rápido de conceptos `mastered_decaying`.
4. **No se castiga al usuario**. Mensaje: *"Hace [N] días que no nos vemos. Algunos conceptos necesitan refresh natural. ¿Querés un repaso de 10min o seguimos con material nuevo?"*

### 5.6 Coherencia transversal: regla de oro

**Si una entidad es Attempt-derivada y se purga, las Attempts originales deben sobrevivir** (excepto purga explícita).

**Si Attempts se purgan, todos los derivados se recalculan o invalidan** — nunca quedan derivados huérfanos sin trazabilidad.

---

## 6. Métricas de salud del modelo (visibles al usuario)

Seis métricas pedagógicamente válidas. Ninguna es de vanidad.

### 6.1 Calibración metacognitiva

**Cálculo**: `1 − media móvil(|pre_confidence − outcome|)` últimos 30 días.

**Visualización**: gráfico simple "predicho vs real" + score 0-100. Texto narrativo: "Tu calibración mejoró 12 puntos en 2 semanas. Estás aprendiendo a saber qué sabés."

### 6.2 Cobertura del curriculum / RAG

**Cálculo**:
- Cobertura curriculum: % nodos en estado `mastered` o `practicing`.
- Cobertura RAG: % chunks con al menos 1 attempt asociado.

**Visualización**: dos barras separadas. NO sumar.

**Decisiones**: el agente sugiere "este capítulo no lo tocaste — ¿es opcional?".

### 6.3 Retention rate por concepto (curva de decay real)

**Cálculo**: para cada concepto con ≥3 reviews, accuracy en función de tiempo desde último review.

**Visualización**: curva por concepto, comparada con la esperada SM-2.

**Valor pedagógico**: el usuario VE su olvido. El olvido no es fracaso, es información.

### 6.4 Distribución de errores por tipo

**Cálculo**: agregación de `error_type` últimos 30 días.

**Visualización**: pie/bar simple — conceptual, procedural, notacional, careless.

**Valor pedagógico**: enseña que sus errores tienen estructura.

### 6.5 Trayectoria de scaffolding (independencia)

**Cálculo**: serie temporal de `scaffold_level_reached` promedio por sesión, por concepto.

**Visualización**: sparkline simple. *"Empezaste pidiendo nivel 3 de pista. Hoy resolvés con nivel 1. Estás aprendiendo a aprender."*

**Valor pedagógico**: el progreso REAL del aprendizaje. Hace visible la autonomía creciente.

### 6.6 Tiempo en zona ZDP

**Cálculo**: % de attempts con accuracy en banda 70-90% (Wilson 85%).

**Visualización**: barra horizontal con 3 zonas. *"Pasaste 68% del tiempo en zona productiva esta semana".*

**Valor pedagógico**: enseña *desirable difficulty* (Bjork). Demasiado fácil NO es ideal.

### EXPLÍCITAMENTE EXCLUIDAS (vanity metrics)

- ❌ Streak diario (gamificación tóxica que premia presencia, no aprendizaje).
- ❌ Puntos / XP totales.
- ❌ Ranking comparativo (incentivo extrínseco perjudicial; Deci & Ryan).
- ❌ Tiempo total de estudio como métrica positiva (premia inputs, no outputs).

---

## 7. Decisiones abiertas (gate antes de Síntesis)

### D1. Promoción de ítems improvisados al banco curado

¿Cuándo un ítem LLM-generated en Socrático/Explorador "asciende" al banco persistente?
- (a) Solo si usuario lo marca explícitamente útil.
- (b) Heurística automática + confirmación silenciosa.
- (c) Nunca — improvisado es siempre efímero.

### D2. Frecuencia y forma del prompt metacognitivo (pre-confidence)

¿Cada cuántos attempts pedimos `pre_confidence`? ¿Escala (3 / 5 niveles / 0-100)?

[Heurística operativa propuesta: 5 niveles, cada 3-4 attempts en Socrático, opcional al inicio de Simulacro, off-switch para usuarios avanzados.]

### D3. Modelo de incertidumbre del MasteryState

- (a) Heurística simple (accuracy window + N attempts → confidence).
- (b) Bayesian Knowledge Tracing clásico.
- (c) IRT-lite con dificultad/discriminación per-item.

Para MVP creo (a) suficiente, abstracción del MasteryState debe permitir migrar a (b) o (c).

### D4. Políticas de "olvido benevolente" tras inactividad larga

Tras 30/60/90 días:
- ¿Curriculum status se "pausa" o sigue decayendo agresivamente?
- ¿Se notifica al usuario antes de "degradar" mastery visible?
- ¿Hay un "modo regreso" diagnóstico distinto del normal?

### D5. Visibilidad del Source-Attribution al usuario por default

¿Mostramos source labels en CADA turno (saturación) o solo cuando el usuario pregunta o cuando el agente baja a tier `tertiary`?

Propuesta: indicador discreto siempre visible (icono/letra), expansión on-demand.

---

## Resumen ejecutivo del modelo

EducAgent persiste 12 entidades cuyo átomo es **Attempt**. Sobre Attempts se infieren MasteryState (vector con incertidumbre, no escalar), MetacognitiveSignal (calibración) y AffectiveLog (proxies textuales con confianza explícita). La privacidad es constraint atravesado: el default `strict` colapsa afecto a agregados anonimizados. Las métricas visibles al usuario son **pedagógicamente válidas** (calibración, ZDP-time, scaffolding-independence) y excluyen explícitamente vanity metrics. Los casos de borde se resuelven con la regla de oro: Attempts inmutables; derivados recalculables; nada huérfano.

El modelo es deliberadamente **modesto en sus inferencias** y **explícito en su incertidumbre**. Es un *open learner model*: el usuario puede inspeccionarlo, corregirlo, exportarlo, borrarlo.
