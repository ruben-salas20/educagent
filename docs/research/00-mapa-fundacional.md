# Mapa Fundacional Psicopedagógico — EducAgent

**Fase**: Investigación fundacional, Paso 0
**Naturaleza**: Documento de arranque que somete el PRD original al contraste con literatura de psicología educativa. Detecta dónde el PRD acierta por intuición y dónde se apoya en supuestos no examinados.

---

## Nota previa sobre la naturaleza de este documento

Este mapa NO valida el PRD original — lo somete a contraste con literatura. Donde el PRD acierta por intuición, lo nombro y lo refuerzo con teoría. Donde se apoya en supuestos no examinados, lo señalo. La psicología educativa tiene su propia crisis de replicación (estilos de aprendizaje, por ejemplo, está empíricamente refutado pese a su popularidad — ver Pashler et al., 2008), así que distingo lo que es consenso fuerte de lo que es prometedor pero discutido.

---

## Eje 1 — Marcos pedagógicos detrás de los 4 Modos

### 🧙‍♂️ Socrático (Strict)

**Teoría que lo respalda.** Mayéutica socrática como tradición filosófica, pero el sustento moderno viene de tres líneas: (1) la **Zona de Desarrollo Próximo** de Vygotsky (1978), donde el aprendizaje ocurre en la brecha entre lo que el sujeto puede hacer solo y lo que puede hacer con guía; (2) el **elaborative interrogation** y **self-explanation** (Chi et al., 1994; Dunlosky et al., 2013) — pedirle al estudiante que explique "por qué" produce ganancias de retención y transferencia robustas; (3) la **generation effect** (Slamecka & Graf, 1978): generar la respuesta uno mismo deja huella de memoria más fuerte que leerla.

**Evidencia.** El meta-análisis de Dunlosky et al. (2013, *Psychological Science in the Public Interest*) clasifica self-explanation y elaborative interrogation como técnicas de utilidad **moderada-alta** con evidencia consistente en STEM.

**Riesgo psicopedagógico.** "Strict" implica no avanzar hasta que el usuario explique. Si la pregunta cae fuera de la ZDP del estudiante, el resultado no es aprendizaje — es **indefensión aprendida** (Seligman, 1975) y erosión de auto-eficacia (Bandura, 1997). Un CLI sin lectura rica de afecto puede convertirse en una pared.

**Lo que falta en el PRD.** El **mecanismo de calibración de ZDP**. ¿Cómo decide el agente que la siguiente pregunta está "un paso más allá" y no "tres pasos más allá"? Falta también el **derecho a rendirse productivamente**: el modo debería permitir al usuario pedir un andamio sin estigma. No es "Socrático Strict", es "Socrático con escalada controlada".

### 🗺️ Arquitecto (Planning)

**Teoría que lo respalda.** **Autorregulación del aprendizaje** (Zimmerman, 2002) — la fase de *forethought* es predictora robusta del rendimiento. **Goal-setting theory** (Locke & Latham, 2002): metas específicas y desafiantes superan a metas vagas. **Chunking** (Miller, 1956; Gobet et al., 2001) para descomponer temarios complejos.

**Riesgo psicopedagógico.** **Ilusión de productividad**: armar el plan se siente como progreso sin serlo (Kornell & Bjork, 2008). El estudiante puede pasar horas optimizando el Kanban en lugar de estudiar. Segundo riesgo: **externalización excesiva de la metacognición**. Si el agente planifica todo, el usuario no desarrolla la habilidad de planificar.

**Lo que falta.** El modo debería incluir **metas de aprendizaje vs. metas de desempeño** (Dweck, 1986). Un roadmap orientado a "terminar el temario" es meta de desempeño; uno orientado a "ser capaz de explicar X" es meta de aprendizaje. Las segundas correlacionan con persistencia y profundidad.

### ⏱️ Simulacro (Exam)

**Teoría que lo respalda.** **Testing effect / retrieval practice** (Roediger & Karpicke, 2006). **Desirable difficulties** (Bjork & Bjork, 2011).

**Evidencia.** De los hallazgos más replicados en psicología cognitiva educativa. Karpicke & Blunt (2011, *Science*) mostraron que practicar recuperación supera al concept mapping para aprendizaje significativo.

**Riesgo psicopedagógico.** **Test anxiety** (Zeidner, 1998) — los simulacros sin feedback formativo o con framing punitivo activan ansiedad evaluativa. Segundo riesgo: **specificity of practice** — si el formato del simulacro no se parece a la evaluación real, hay poca transferencia.

**Lo que falta.** El PRD habla de "quizzes y retos" pero no especifica: (1) **espaciado** entre intentos; (2) **feedback inmediato vs. demorado**; (3) **dificultad adaptativa**: ítems con tasa de éxito ~85% maximizan aprendizaje (Wilson et al., 2019, "85% rule").

### ☕ Explorador (Brainstorming)

**Teoría que lo respalda.** Apoyos posibles: **curiosity-driven learning** (Kang et al., 2009); **cognitive load reduction** para conceptos en su fase de adquisición inicial; **dual coding** (Paivio, 1971; Mayer, 2001).

**Riesgo psicopedagógico.** Es el modo MÁS PELIGROSO del set, contraintuitivamente. Genera **fluency illusion** (Bjork & Bjork, 2011): leer una explicación clara hace sentir que uno entendió, sin que haya retención real. Es el modo donde el efecto "sycophancy" del LLM más daño hace.

**Lo que falta.** Este modo necesita **off-ramps obligatorias hacia retrieval**: tras N explicaciones, el agente debería forzar (o sugerir fuerte) un mini-test sobre lo discutido.

---

## Eje 2 — Modelo del estudiante: qué debe "saber" el agente

### Motivación: Self-Determination Theory aplicada a CLI

Deci & Ryan (1985, 2000) postulan tres necesidades psicológicas básicas: **autonomía, competencia, relación**.

| Necesidad | Cómo se cubre en CLI sin presencia social |
|---|---|
| Autonomía | Selección de modo por sesión. Permitir override. Evitar imposición de roadmap. |
| Competencia | Feedback que muestre progreso real (no inflación). Aciertos en zona ~85%. |
| Relación | Sin presencia social, no hay vínculo afectivo. Sustituto: **persona consistente del agente**. |

La motivación **intrínseca** del usuario primario ya es alta — el riesgo no es activarla sino **no destruirla** con sobre-control. La literatura muestra que recompensas extrínsecas mal aplicadas erosionan motivación intrínseca preexistente (Deci, Koestner & Ryan, 1999). Implicación: cuidado con gamificación naive.

### Carga cognitiva (Sweller, 1988)

- **Intrínseca**: complejidad del material. No reducible, sólo secuenciable.
- **Extraña**: ruido del diseño. Eliminable.
- **Pertinente / germane**: esfuerzo de construir esquemas. Cultivable.

Implicaciones:
- El UX "hacker minimalista" del PRD reduce carga extraña. Bien.
- El modo Socrático aumenta carga germane (deseable) pero puede inflar intrínseca si no chunkea.
- El RAG sobre apuntes propios baja carga intrínseca por **familiaridad de contexto** (Kalyuga, 2007).

### Metacognición (Flavell, 1979; Zimmerman, 2002)

Tres componentes a capturar:
1. **Conocimiento metacognitivo**: ¿qué cree el usuario que sabe?
2. **Monitoreo**: ¿detecta el usuario sus propios errores?
3. **Control**: ¿ajusta su estrategia?

Señales que el agente DEBERÍA capturar (y que el PRD no menciona):
- **Calibración**: confianza declarada vs. acierto real.
- **Tiempo entre lectura y quiz**: proxy de espaciado autoimpuesto.
- **Re-consultas**: si el usuario vuelve a preguntar lo mismo, hay falla de retención.

### Repetición espaciada: SM-2 vs. FSRS vs. Leitner

| Algoritmo | Pros | Contras para EducAgent |
|---|---|---|
| **Leitner** | Simple, transparente | Rígido; no se adapta a curva individual |
| **SM-2** (Anki) | Ampliamente probado | Heurístico, no probabilístico |
| **FSRS** (~2022) | Adaptativo real | Más complejo; requiere más datos |

**Recomendación MVP**: arrancar con **SM-2** por madurez, dejando una abstracción que permita migrar a FSRS.

### Detección de frustración sin cámara ni voz

Proxies textuales/temporales válidos según D'Mello & Graesser (2012):
- Latencia anormalmente larga.
- Respuestas cada vez más cortas o monosilábicas.
- Lenguaje afectivo explícito.
- Patrones de retry: misma pregunta reformulada 3+ veces.
- Abandono de sesión post-error.

**Honestidad**: precisión limitada. Estrategia: ante señales ambiguas, ofrecer opciones, no decidir por el usuario.

### Mindset y atribución (Dweck, 2006; Weiner, 1985)

**Caveat**: la teoría de growth mindset tuvo problemas de replicación recientes (Sisk et al., 2018). Pero el componente **atribucional** (Weiner) es más robusto: atribuir fallos a causas **internas, controlables y modificables** (esfuerzo, estrategia) sostiene persistencia; atribuirlos a causas **internas estables** (capacidad) erosiona auto-eficacia.

| Evitar | Preferir |
|---|---|
| "Sos bueno en esto" | "Tu estrategia para X funcionó" |
| "Esto es difícil para vos" | "Esta estrategia no está rindiendo, probemos otra" |
| "Bien hecho" (vacío) | "Identificaste el caso borde — eso es lo que pedía el problema" |

---

## Eje 3 — Diseño de la interacción pedagógica en CLI

### Scaffolding y fading (Wood, Bruner & Ross, 1976)

Niveles para EducAgent:
1. Pista conceptual ("pensá en qué estructura de datos garantiza acceso O(1)")
2. Pista procedimental ("descomponé el problema en X e Y")
3. Ejemplo análogo resuelto (worked example — Sweller & Cooper, 1985)
4. Solución parcial con huecos (completion problem — van Merriënboer, 1990)
5. Solución completa con explicación

**Fading**: el agente debería trackear en qué nivel terminó resolviéndose un problema y empezar el siguiente un nivel más arriba.

### Feedback formativo (Hattie & Timperley, 2007)

Tres preguntas que todo feedback debe responder:
- **Feed-up**: ¿hacia dónde voy?
- **Feed-back**: ¿cómo voy?
- **Feed-forward**: ¿qué sigue?

Tras un error, el agente NO debería:
- Dar la respuesta correcta inmediatamente.
- Decir solo "incorrecto".
- Validar el intento si fue erróneo.

### Error productivo (Kapur, 2008, 2016)

Dejar a estudiantes luchar con problemas mal estructurados ANTES de la instrucción explícita produce mejor transferencia, **siempre que** haya consolidación posterior. Implicación para el modo Socrático: el usuario debe poder fallar repetidamente sin rescate, pero la sesión debe cerrarse con **consolidación explícita** ("repasemos qué aprendiste de esto").

### Tono, persona y sycophancy

El riesgo más grave en LLMs educativos es la validación complaciente. Principios:
- **Persona consistente**: directa, exigente, respetuosa.
- **Silencio como herramienta**: el agente puede no responder, esperar, devolver pregunta.
- **Disenso explícito**: cuando el usuario está equivocado, decirlo claramente.

### Ritmo y gestión del tiempo

Pomodoro tiene base más folclórica que empírica. **Recomendación**: el agente NO debería gestionar tiempo activamente en MVP. Es out-of-scope.

---

## Tensiones reales entre PRD y psicología educativa

1. **"Socrático Strict" vs. ZDP calibrada.** El strict sin escalada de andamios viola Vygotsky.
2. **"Eliminación de fricción" UX vs. desirable difficulties (Bjork).** Distinguir fricción **extraña** (UI confusa) vs. fricción **germane** (esfuerzo cognitivo).
3. **Notion/Kanban externo vs. metacognición interna.** Si el agente planifica todo, atrofia la habilidad.
4. **Modo Explorador vs. fluency illusion.** Sin off-ramps a retrieval, este modo es contraproducente.
5. **"Historial de dificultad" vs. scheduling probabilístico real.** Sin algoritmo serio (SM-2 mínimo), la repetición espaciada es decorativa.

---

## Recomendación de arranque para Fase 1

> **Retrieval practice con scaffolding graduado y calibración metacognitiva, integrado en el modo Socrático.**

Justificación:

1. **Mayor ROI empírico**: testing effect y self-explanation están entre las técnicas con evidencia más sólida (Dunlosky et al., 2013).
2. **Encaja con el perfil del usuario**: el estudiante técnico autónomo, anti-inmediatez, valora el esfuerzo. Retrieval practice es exactamente "esfuerzo deseable".
3. **Cubre la debilidad central de los LLMs educativos**: la fluency illusion. Un agente que fuerza recuperación antes que explicación se diferencia estructuralmente del "ChatGPT que explica todo".
4. **Es la base para todo lo demás**: sin este núcleo, el resto flota.

Lo que NO recomiendo construir primero: gestión de tiempo, gamificación, detección de afecto sofisticada, integración Notion.

---

## Caminos abiertos para profundizar

- **Calibración de ZDP en CLI**: cómo opera el agente "subir/bajar dificultad" sin lectura de afecto rica.
- **Diseño del estado metacognitivo persistente**: qué se guarda, cómo se muestra al usuario.
- **Política de feedback**: tabla decisional de "ante error tipo X en modo Y, hacer Z". Requiere prototipo.
- **Algoritmo de scheduling**: SM-2 vs. FSRS con dataset propio.
- **Estudio del efecto sycophancy específico en LLMs educativos**: literatura emergente.
- **Cultura y autorregulación**: el perfil rioplatense/hispanohablante puede tener patrones de auto-eficacia distintos a los muestras anglosajonas dominantes.
