# Benchmark Crítico de Competidores — EducAgent

**Fase**: Investigación operativa, Paso 3
**Naturaleza**: Análisis psicopedagógico de 6 competidores. NO un análisis de features — un análisis de qué política pedagógica implementan, dónde aciertan y dónde fallan, y qué tomar/evitar para EducAgent.

---

## Cuadrante de posicionamiento (rigor metacognitivo × autonomía)

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

**El cuadrante "alto rigor metacognitivo × alta autonomía" está vacante.** Math Academy es el competidor más cercano, pero sacrifica autonomía con su riel curricular cerrado.

---

## Análisis por competidor

### 1. Anki

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | Spaced repetition (SM-2 clásico, ahora FSRS post-2024). Behaviorista: refuerzo intermitente sobre tarjetas creadas por el usuario. |
| **Mecanismos clave** | Forced retrieval; intervalos adaptativos; ease factor; lapses → reset. |
| **Aciertos psicopedagógicos** | El testing effect en estado puro. La curva de olvido (Ebbinghaus 1885) operacionalizada con éxito. FSRS resuelve el "ease hell" del SM-2. |
| **Fallas psicopedagógicas** | (1) **Recognition disfrazada de recall** cuando el usuario crea tarjetas mal diseñadas (front=palabra, back=definición sin contexto). (2) Cero modelo del estudiante consultable: el usuario no sabe qué sabe ni qué no. (3) Calibración metacognitiva ausente — no pregunta confianza pre-respuesta. |
| **Lección para EducAgent** | **Tomar**: SR como núcleo (SM-2 con abstracción para FSRS). **Evitar**: dejar la calidad de los ítems al usuario sin asistencia. **Diferenciar**: modelo del estudiante visible y consultable. |

### 2. Khan Academy + Khanmigo

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | Mastery learning (Bloom 1968) en Khan clásico. Khanmigo (LLM tutor) agregado en 2023-2024 sin política pedagógica explícita. |
| **Mecanismos clave** | Khan clásico: prerrequisitos forzados, dominio antes de avanzar, ítems calibrados. Khanmigo: chat socrático superficial. |
| **Aciertos** | Khan clásico tiene mastery learning bien hecho. Knowledge graph robusto en matemática K-12. |
| **Fallas** | (1) **Khanmigo falla en aritmética básica**: reportes documentados de errores en operaciones tipo `343-17`. **NO se autocorrige**. (2) **Socratismo poroso**: Khanmigo cede ante presión del usuario (sycophancy alta). (3) Mezcla LLM con cómputo sin tools deterministas. |
| **Lección para EducAgent** | **Tomar**: knowledge graph con prerrequisitos. **Evitar**: delegar cómputo al LLM. **Vetar**: socratismo que cede a presión. |

### 3. Duolingo

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | Behaviorismo + gamification + spaced repetition (Birdbrain, half-life regression). Duolingo Max añade GPT-4 como tutor. |
| **Mecanismos clave** | Streaks, hearts, leaderboards, XP, ligas. SR adaptativa por palabra. Notificaciones agresivas. |
| **Aciertos** | (1) Birdbrain: SR aplicada bien. (2) Spike de ítems variados por dimensión lingüística. |
| **Fallas** | (1) **Gamification tóxica**: streaks erosionan motivación intrínseca (Deci & Ryan, 1999); hearts castigan error que es señal de aprendizaje. (2) **Engagement-as-proxy**: tiempo en app medido como métrica positiva — incentivo perverso. (3) Calibración metacognitiva ausente. (4) Duolingo Max heredó sycophancy del LLM. |
| **Lección para EducAgent** | **Vetar todo**: streaks, XP, hearts, ranking. **Reemplazar** con métricas pedagógicamente válidas: calibración, scaffolding trajectory, ZDP-time. |

### 4. Math Academy

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | Considerado *gold standard* en la comunidad. Mastery learning + spaced practice + interleaving + cognitive load theory + dificultad adaptativa. |
| **Mecanismos clave** | Knowledge graph cerrado y curado. Diagnostic placement. Ítems calibrados con IRT. Spaced practice mezclada con material nuevo. |
| **Aciertos** | (1) Cognitive load gestionada. (2) Mastery learning ortodoxo. (3) Interleaving sistemático. (4) Calidad de ítems alta (humano-curados). |
| **Fallas** | (1) **No tematiza calibración** — no pregunta confianza pre-respuesta, no muestra calibration score al usuario. (2) **No cita autores/teorías** — la pedagogía es implícita. (3) **Riel curricular cerrado** — sacrifica autonomía. (4) Solo matemáticas. |
| **Lección para EducAgent** | **Tomar**: rigor pedagógico, mastery learning, interleaving. **Diferenciar**: hacer la metacognición VISIBLE y trazable. **Evitar**: riel cerrado — mantener autonomía con bootstrap configurable. |

### 5. Brilliant.org

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | Problem-based learning (PBL) at scale. Active learning. |
| **Mecanismos clave** | Problemas interactivos progresivos. Visualizaciones. Sin lectura pasiva — el usuario actúa. |
| **Aciertos** | (1) Problem-first design coherente con generation effect. (2) Reduce fluency illusion porque demanda acción. (3) Calidad visual alta. |
| **Fallas** | (1) **Sin spaced repetition** — el conocimiento adquirido decae sin sistema de revisión. (2) **Sin modelo del estudiante persistente** — no recuerda qué cuesta a quién. (3) Calibración metacognitiva ausente. (4) Knowledge graph cerrado y curado. |
| **Lección para EducAgent** | **Combinar problem-first + SR + modelo persistente**. Esa combinación es la **vacante real** que EducAgent puede ocupar. |

### 6. Cursor (referencia UX, NO educativo)

| Aspecto | Análisis |
|---|---|
| **Política pedagógica** | NINGUNA. Es asistente de código. Lo incluimos como **referencia de UX en CLI/IDE**. |
| **Mecanismos clave** | Modos explícitos (chat, edit, agent). Cita archivos del proyecto. Composer agentic. |
| **Aciertos UX** | (1) Modos explícitos funcionan como abstracción cognitiva. (2) Cita archivos como source-attribution implícita. (3) Privacy-friendly defaults. |
| **Fallas (no es producto educativo)** | Sycophancy alta. No tiene política pedagógica. |
| **Lección para EducAgent** | **Tomar**: modos explícitos + source-attribution como UX. **El espacio "Cursor educativo con metacognición" no existe.** Esa es la oportunidad. |

---

## 7 brechas reales del mercado (explotables)

| # | Brecha | Justificación pedagógica |
|---|---|---|
| 1 | **Transparencia epistémica** RAG/LLM/Web | Ningún competidor etiqueta fuentes por afirmación. Khanmigo y Duolingo Max producen LLM-output sin distinguir. |
| 2 | **Calibración metacognitiva auditada** | Ningún competidor pregunta pre-confidence ni muestra calibration score. Math Academy lo gestiona internamente sin exponer. |
| 3 | **Anti-sycophancy operativa** | SycEval 2025: 58% sycophancy promedio en LLMs. Khanmigo y Duolingo Max heredan el problema. |
| 4 | **Modelo del estudiante consultable** | Ninguno expone el modelo. Anki tiene "stats" pero no mastery por concepto narrado. |
| 5 | **Productive failure estructurado** | Brilliant lo intuye pero sin scaffolding graduado ni fading. Math Academy es lineal-progresivo sin failure deliberado. |
| 6 | **Lenguaje atribucional Weiner** | Todos validan al usuario en términos de capacidad ("¡buen trabajo!"). Ninguno habla de estrategia. |
| 7 | **CLI como anti-inmediatez** | Cursor demostró que funciona, pero sin política pedagógica. EducAgent ocupa ese espacio en educación. |

---

## 6 antipatrones VETADOS explícitamente

1. **Streaks / hearts / XP / ranking** (Duolingo) — erosionan motivación intrínseca.
2. **LLM haciendo cómputo** (Khanmigo en `343-17`) — tooling determinista obligatorio.
3. **Recognition disfrazada de recall** (Anki mal usado) — solo recall genuino.
4. **Socratismo poroso** (Khanmigo) — preguntas que se rinden a la primera presión.
5. **Engagement-as-proxy** (Duolingo) — tiempo en app NO es métrica positiva.
6. **Sycophancy** ("¡excelente pregunta!") — destruye señal pedagógica.

---

## 5 riesgos críticos a no subestimar

1. **Hábito sin gamification**: Duolingo lo logró con XP. EducAgent lo rechaza pero **no propone reemplazo**. Riesgo real. Mitigación: revisión just-in-time SM-2 + métricas pedagógicas visibles que generan satisfacción intrínseca (ver el progreso real).
2. **Calibración del knowledge graph a corpus agnóstico**: Math Academy tiene currículum cerrado y bien calibrado. EducAgent opera sobre material arbitrario — riesgo de inferencia ruidosa. Mitigación: granularidad híbrida + atomización a pedido.
3. **Cold start**: usuario sin material requiere bootstrap diagnóstico decente (P9). Validar con usuarios reales en validación M4.
4. **Accuracy en cómputo/código**: tooling determinista desde día uno. NO hay shortcut.
5. **Cognitive load del propio agente**: etiquetas de fuente + scaffolding + calibración suman información. El diseño CLI debe respirar — color tenue, expansión on-demand.

---

## Hallazgos no obvios para el PM

1. **Khanmigo falla en aritmética básica** (`343-17`) y NO se autocorrige — argumento decisivo para delegar cómputo a tools deterministas desde día uno del PRD.
2. **Math Academy hace cognitive load + mastery + interleaving correctamente PERO no tematiza calibración ni cita autores** — EducAgent puede diferenciar haciendo visible la metacognición.
3. **SycEval 2025: 58% sycophancy promedio en LLMs** → la política anti-sycophancy de EducAgent no es decorativa, es un **diferenciador medible** que se puede testear y reportar.
4. **FSRS (Anki post-2024) ya resolvió "ease hell" del SM-2** → vale spike técnico FSRS vs SM-2 antes de comprometer scope.
5. **Brilliant tiene problem-first pero sin SR ni modelo del estudiante** → combinar problem-first + SR + modelo persistente es **vacante real, no marketing**.
6. **Cursor demuestra que modos explícitos en CLI funcionan como UX, pero no tiene política pedagógica** → espacio enorme para un "Cursor educativo".

---

## Profundización pendiente

1. **Spike FSRS vs SM-2** con dataset sintético antes de Mes 3.
2. **Definición de tooling determinista**: priorizar por dominio del primer usuario (sandbox JS/TS más probable).
3. **Detección runtime de sycophancy y fluency illusion** — diseño operativo, no solo prompts.
4. **Productos adyacentes** que podrían sumar al mapa: Quizlet AI, Replit edu, ChatGPT Edu — si el PM detecta que aplican al usuario primario.

---

**Fuentes consultadas** (con fecha de acceso): documentación oficial de cada producto + análisis externos + papers académicos (SycEval 2025, Roediger & Karpicke 2006, Wilson 2019, Deci & Ryan 1999). Las afirmaciones técnicas sobre algoritmos están verificadas; los reportes de "fallos" (Khanmigo en aritmética, sycophancy de Duolingo Max) provienen de análisis públicos verificables. **Nota de honestidad**: el ecosistema cambia rápido — algunas afirmaciones pueden requerir actualización en 6-12 meses.
