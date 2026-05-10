# 04 · Setup Vitest + tests P1-P9

`vitest.config.ts` mínimo + estructura de tests + 9 tests pin (uno por política). Estos 9 tests son el **patrón a replicar** — el resto se completa al implementar cada política.

---

## `vitest.config.ts`

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,                  // explicit imports
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: false, isolate: true }
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/cli/**',                // UI: se testea con Ink testing aparte
        'src/**/index.ts',
        'src/adapters/llm/**'        // se mockea con stubs
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75
      }
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 5000
  }
});
```

---

## Convenciones de tests

| Aspecto | Convención |
|---|---|
| **Naming** | `<archivo>.test.ts` para unidad, `<archivo>.integration.test.ts` para integración con SQLite real (en memoria) |
| **Patrón** | AAA estricto (Arrange / Act / Assert) con comentarios `// arrange` / `// act` / `// assert` cuando el test es >20 líneas |
| **Fixtures** | `tests/fixtures/*.factory.ts` — factories tipadas con defaults sobreescribibles: `makeAttempt({ outcome: 'incorrect' })` |
| **Stubs** | `tests/fixtures/llm-stub.ts` retorna `ILLMProvider` programable: `stub.onCompleteReturn(text)` |
| **No mocks de DB en unit** | Las políticas son puras, no necesitan DB. Solo `Sqlite*Repository` se testea contra `:memory:` |
| **Determinismo** | `IClock` y `IRandom` siempre inyectados. Tests usan `FakeClock(new Date('2026-05-10T10:00:00Z'))` |
| **Idioma del test name** | Español. `it('descarta respuesta sycophantic con "excelente pregunta"', ...)` |

---

## Tests por política — 9 ejemplos pin

Uno representativo por política. El resto se completa al implementar cada política.

### P1 — Feedback Formativo

```ts
// tests/policies/p1-feedback.test.ts
import { describe, it, expect } from 'vitest';
import { decideFeedback } from '../../src/policies/p1-feedback';

describe('P1 — Feedback formativo', () => {
  it('en modo Socrático con error conceptual, NO emite la definición correcta', () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'conceptual',
      attemptText: 'la derivada de x^2 es x',
      conceptName: 'derivada de polinomios',
      sourceTier: 'primary'
    });

    expect(decision.kind).toBe('socratic_probe');
    expect(decision.scaffoldLevelOffered).toBe(0);
    expect(decision.text).toMatch(/¿podés definir.+con tus palabras\?/i);
    expect(decision.text).not.toContain('2x');     // no revela la respuesta
    expect(decision.prohibited).toContain('give_correct_definition');
  });

  it('en modo Explorador con error conceptual, corrige el hecho con cita RAG', () => {
    const decision = decideFeedback({
      mode: 'explorer',
      errorType: 'conceptual',
      attemptText: 'la derivada de x^2 es x',
      conceptName: 'derivada de polinomios',
      sourceTier: 'primary',
      ragCitation: { source: 'calculus.pdf', page: 42 }
    });

    expect(decision.kind).toBe('direct_correction');
    expect(decision.text).toContain('[RAG: calculus.pdf, p.42]');
    expect(decision.text).toMatch(/2x/);          // sí revela la corrección
  });
});
```

### P2 — Scaffolding

```ts
// tests/policies/p2-scaffolding.test.ts
describe('P2 — Escalada y fading de andamios', () => {
  it('tras 2 retries sin progreso en Socrático, sube 1 nivel con anuncio', () => {
    const decision = decideScaffold({
      mode: 'socratic',
      currentLevel: 0,
      retriesWithoutProgress: 2,
      userRequestedHelp: false
    });

    expect(decision.newLevel).toBe(1);
    expect(decision.announce).toBe(true);
    expect(decision.text).toMatch(/algo más concreto/i);
  });

  it('en Simulacro NUNCA escala scaffolds, los difiere a debrief', () => {
    const decision = decideScaffold({
      mode: 'simulacro',
      currentLevel: 0,
      retriesWithoutProgress: 5,
      userRequestedHelp: true
    });

    expect(decision.newLevel).toBe(0);
    expect(decision.deferTo).toBe('post_simulacro_debrief');
  });
});
```

### P3 — Anti-Sycophancy (regex bilingüe)

```ts
// tests/policies/p3-anti-sycophancy.test.ts
import { describe, it, expect } from 'vitest';
import { detectSycophancy, sanitizeOutput, handleInsistence } from '../../src/policies/p3-anti-sycophancy';

describe('P3 — Anti-sycophancy regex bilingüe', () => {
  const sycophantic_es = [
    '¡Excelente pregunta! Veamos...',
    'Qué buena observación tuviste.',
    'Tenés toda la razón, no me había dado cuenta.',
    'Sos muy inteligente para haber pensado en eso.',
    'Perfecto, eso es exactamente.'
  ];

  const sycophantic_en = [
    'Great question! Let me explain...',
    "You're absolutely right.",
    "I love how you think about this.",
    "Brilliant! Amazing insight."
  ];

  const acceptable_recognition = [
    'Identificaste correctamente la variable independiente.',
    'You identified the bug correctly.',
    'Esa parte está. Falta el manejo del caso vacío.',
    'Tu hipótesis es plausible. Verifiquémosla.'
  ];

  it.each(sycophantic_es)('detecta sycophancy en ES: "%s"', (txt) => {
    expect(detectSycophancy(txt).hit).toBe(true);
  });

  it.each(sycophantic_en)('detecta sycophancy en EN: "%s"', (txt) => {
    expect(detectSycophancy(txt).hit).toBe(true);
  });

  it.each(acceptable_recognition)('NO marca reconocimiento legítimo: "%s"', (txt) => {
    expect(detectSycophancy(txt).hit).toBe(false);
  });

  it('sanitizeOutput remueve frases de la lista negra pero preserva contenido', () => {
    const dirty = 'Excelente pregunta. La derivada de x^2 es 2x.';
    const clean = sanitizeOutput(dirty);
    expect(clean).not.toMatch(/excelente pregunta/i);
    expect(clean).toContain('2x');
  });

  it('bajo presión del usuario insistiendo, NO cede si hay evidencia RAG', () => {
    const decision = handleInsistence({
      userTurn: 'no, estás equivocado, es x',
      agentEvidence: { tier: 'primary', source: 'calculus.pdf' },
      insistenceCount: 3
    });
    expect(decision.cedes).toBe(false);
    expect(decision.text).toMatch(/cita.+fuente/i);
  });
});
```

### P4 — Off-Ramps (disparador retrieval forzado)

```ts
// tests/policies/p4-off-ramps.test.ts
describe('P4 — Off-ramp forzado Explorador → retrieval', () => {
  it('dispara retrieval forzado cuando agente emitió >1500 tokens sin retrieval', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 1501,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 5,
      fluencyIllusionFlags: []
    });

    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('token_budget_exceeded');
    expect(decision.text).toMatch(/2 preguntas rápidas/i);
  });

  it('dispara retrieval forzado al detectar "ya entendí" 2+ veces sin output del usuario', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 800,
      newConceptsIntroduced: 2,
      minutesSinceLastRetrieval: 10,
      fluencyIllusionFlags: ['ya_entendi', 'ya_entendi']
    });

    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('fluency_illusion_detected');
  });

  it('NO dispara si el modo es Socrático (off-ramp es específico de Explorador)', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'socratic',
      tokensSinceLastRetrieval: 3000,
      newConceptsIntroduced: 5,
      minutesSinceLastRetrieval: 30,
      fluencyIllusionFlags: ['ya_entendi']
    });
    expect(decision.trigger).toBe(false);
  });
});
```

### P5 — Captura metacognitiva

```ts
// tests/policies/p5-metacog-capture.test.ts
describe('P5 — Captura metacognitiva', () => {
  it('pide pre-confidence en Simulacro, NO en Socrático', () => {
    expect(shouldAskPreConfidence({ mode: 'simulacro' }).ask).toBe(true);
    expect(shouldAskPreConfidence({ mode: 'socratic' }).ask).toBe(false);
  });

  it('respeta el límite de 2 prompts metacog por hora', () => {
    const state = { promptsThisHour: 2, lastPromptMinutesAgo: 15 };
    expect(shouldAskMidTaskProbe(state).ask).toBe(false);
  });
});
```

### P6 — Tono y atribución (Weiner)

```ts
// tests/policies/p6-tone.test.ts
describe('P6 — Lenguaje atribucional Weiner', () => {
  it('frente a acierto, atribuye a estrategia (controlable+inestable), no a inteligencia', () => {
    const phrase = buildAttribution({
      outcome: 'correct',
      effortMinutes: 3,
      strategy: 'descomposición',
      language: 'es'
    });
    expect(phrase.text).toMatch(/estrategia.+funcionó/i);
    expect(phrase.text).not.toMatch(/inteligente/i);
  });

  it('frente a error, atribuye a estrategia inaplicable, no a capacidad', () => {
    const phrase = buildAttribution({
      outcome: 'incorrect',
      effortMinutes: 8,
      strategy: 'memorización',
      language: 'es'
    });
    expect(phrase.text).toMatch(/esa estrategia no aplica/i);
    expect(phrase.text).not.toMatch(/no sos bueno/i);
  });
});

// Nota: `buildAttribution` retorna `AttributionResult` con campos `{ text, attributedTo, language }`.
// El campo `attributedTo` permite auditoría del lenguaje atribucional Weiner — útil para que P5
// (captura metacognitiva) razone sobre cómo el agente está hablando con el usuario.
```

### P7 — Calibración 85% y selección

```ts
// tests/policies/p7-calibration.test.ts
describe('P7 — Calibración 85% y selección de próximo ítem', () => {
  it('con accuracy > 0.92 en window de 10, sube dificultad', () => {
    const window = Array(10).fill('correct').slice(0, 10);  // 1.0 accuracy
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(+1);
  });

  it('con accuracy < 0.75, baja dificultad', () => {
    const window = ['correct','correct','incorrect','incorrect','incorrect',
                    'correct','incorrect','correct','incorrect','correct']; // 0.5
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(-1);
  });

  it('prioriza repaso SM-2 sobre material nuevo cuando hay ítems vencidos', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [{ conceptId: 'c1', overdueDays: 3 }],
      weakItems: [],
      candidatesNew: [{ conceptId: 'c5' }],
      accuracyWindow: Array(10).fill('correct')
    });
    expect(next.priority).toBe(1);
    expect(next.reason).toBe('sm2_overdue');
    expect(next.conceptId).toBe('c1');
  });

  it('en modo Simulacro, 100% items SM-2 (no nuevo material)', () => {
    const next = selectNextItem({
      mode: 'simulacro',
      dueItems: [],
      candidatesNew: [{ conceptId: 'c5' }],
      accuracyWindow: Array(10).fill('correct')
    });
    expect(next.conceptId).not.toBe('c5');
  });
});
```

### P8 — Transparencia epistémica

```ts
// tests/policies/p8-epistemic.test.ts
describe('P8 — Etiquetado por párrafo', () => {
  it('etiqueta [RAG: doc, p.X] cuando todo el párrafo viene de RAG', () => {
    const paragraph = labelParagraph({
      text: 'La derivada de x^2 es 2x.',
      sources: [{ kind: 'rag', provenance: { file: 'calc.pdf', page: 42 } }]
    });
    expect(paragraph.label).toBe('[RAG: calc.pdf, p.42]');
  });

  it('etiqueta [RAG+GK] cuando hay mezcla, "una pizca de GK contamina"', () => {
    const paragraph = labelParagraph({
      text: 'La derivada de x^2 es 2x, lo cual es útil en optimización.',
      sources: [
        { kind: 'rag', provenance: { file: 'calc.pdf', page: 42 } },
        { kind: 'llm', provenance: { model: 'claude-3.5' } }
      ]
    });
    expect(paragraph.label).toBe('[RAG+GK]');
  });

  it('frente a disenso RAG vs LLM, NO contradice silenciosamente al RAG', () => {
    const decision = resolveDissent({
      ragSays: 'X',
      llmSays: 'Y',
      webEnabled: false
    });
    expect(decision.action).toBe('present_conflict_explicitly');
    expect(decision.text).toMatch(/tu material dice X.+conocimiento general.+Y/i);
  });
});
```

### P9 — Bootstrap

```ts
// tests/policies/p9-bootstrap.test.ts
describe('P9 — Bootstrap de curriculum', () => {
  it('hace 5 preguntas diagnósticas en turnos separados, no formulario', () => {
    const flow = startBootstrapFlow();
    expect(flow.questions).toHaveLength(5);
    expect(flow.deliveryMode).toBe('sequential_turns');
    expect(flow.questions[0]).toMatch(/qué querés poder hacer/i);
  });

  it('un nodo crítico exige RAG progresivo, rehúsa avanzar solo con GK', () => {
    const node = {
      objective: 'calcular dosis de medicamento X',
      bloomTarget: 'apply',
      domain: 'medicine',
      sources: []
    };
    const decision = canProceedWithNode(node);
    expect(decision.canProceed).toBe(false);
    expect(decision.requires).toBe('rag_or_web');
  });

  it('entrega plan con 2-3 huecos deliberados, no completo', () => {
    const plan = generateCurriculumDraft({
      objective: 'aprender derivadas',
      level: 'beginner',
      timespan: '2 weeks'
    });
    const holes = plan.nodes.filter(n => n.userToFill === true);
    expect(holes.length).toBeGreaterThanOrEqual(2);
    expect(holes.length).toBeLessThanOrEqual(3);
  });
});
```

---

## Fixture pattern (ejemplo)

```ts
// tests/fixtures/attempts.factory.ts
import type { Attempt } from '../../src/core/entities/Attempt';

export const makeAttempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  id: `att_${Math.random().toString(36).slice(2)}`,
  projectId: 'prj_test',
  sessionId: 'sess_test',
  itemId: 'item_test',
  mode: 'socratic',
  startedAt: '2026-05-10T10:00:00Z',
  submittedAt: '2026-05-10T10:00:30Z',
  latencyMs: 30_000,
  responseText: 'respuesta',
  outcome: 'correct',
  scaffoldLevelReached: 0,
  scaffoldRequestedBy: null,
  errorType: null,
  preConfidence: 70,
  postConfidence: 80,
  retryCount: 0,
  affectiveSnapshot: {},
  ...overrides
});
```
