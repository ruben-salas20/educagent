// tests/app/use-cases/SubmitAttempt.integration.test.ts
// Integration test FULL-STACK del use case SubmitAttempt.
//
// Diferencia con SubmitAttempt.test.ts (unit):
// - Acá usamos buildContainer() con SQLite real `:memory:` — los 4 adapters
//   reales coordinan en una sola call.
// - Validamos el round-trip: persist Attempt → load MasteryState → scheduler.next()
//   → persist MasteryState, todo contra schema real con triggers + FKs activos.
// - Es el primer end-to-end real del proyecto.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildContainer,
  type AppContainer,
} from '../../../src/app/composition-root.js';
import { submitAttempt } from '../../../src/app/use-cases/SubmitAttempt.js';
import type { Attempt } from '../../../src/core/entities/Attempt.js';

const PROJECT_ID = 'prj_test';
const SESSION_ID = 'sess_test';
const CONCEPT_ID = 'concept_test';
// itemId = CONCEPT_ID por el TODO en SubmitAttempt (mapping 1:1 hasta que exista
// item repository). Mantener este invariante hasta que cambie ese TODO.
const ITEM_ID = CONCEPT_ID;

function seedFixtures(container: AppContainer): void {
  const now = '2026-05-10T00:00:00.000Z';
  container.db
    .prepare(
      `INSERT INTO projects (id, name, created_at, last_active_at) VALUES (?, ?, ?, ?)`,
    )
    .run(PROJECT_ID, 'Test Project', now, now);
  container.db
    .prepare(
      `INSERT INTO concepts (id, project_id, name, granularity, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(CONCEPT_ID, PROJECT_ID, 'Test Concept', 'atomic', now);
  container.db
    .prepare(
      `INSERT INTO sessions (id, project_id, started_at) VALUES (?, ?, ?)`,
    )
    .run(SESSION_ID, PROJECT_ID, now);
  container.db
    .prepare(
      `INSERT INTO items (id, project_id, prompt_text, origin, bloom_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ITEM_ID, PROJECT_ID, '¿Qué es X?', 'rag_curated', 'recall', now, now);
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: `att_${Math.random().toString(36).slice(2)}`,
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    itemId: ITEM_ID,
    mode: 'socratic',
    startedAt: '2026-05-10T10:00:00.000Z',
    submittedAt: '2026-05-10T10:00:30.000Z',
    latencyMs: 30_000,
    responseText: 'test response',
    outcome: 'correct',
    scaffoldLevelReached: 0,
    scaffoldRequestedBy: null,
    errorType: null,
    preConfidence: 70,
    postConfidence: 80,
    retryCount: 0,
    affectiveSnapshot: {},
    ...overrides,
  };
}

describe('SubmitAttempt — integration full-stack contra SQLite :memory:', () => {
  let container: AppContainer;

  beforeEach(() => {
    container = buildContainer({ sqliteFilename: ':memory:' });
    seedFixtures(container);
  });

  afterEach(() => {
    container.db.close();
  });

  it('happy path: persiste Attempt + crea MasteryState + retorna outcome', async () => {
    const attempt = makeAttempt();
    const result = await submitAttempt(
      { attempt, conceptName: 'Test Concept', sourceTier: 'primary' },
      container,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // (a) Attempt persistido y recuperable.
    const findResult = await container.attempts.findById(attempt.id);
    expect(findResult.ok).toBe(true);
    if (!findResult.ok) return;
    expect(findResult.value).toEqual(attempt);

    // (b) MasteryState creado contra el concepto correcto.
    const masteryResult = await container.masteryStates.findByConceptId(CONCEPT_ID);
    expect(masteryResult.ok).toBe(true);
    if (!masteryResult.ok) return;
    expect(masteryResult.value.masteryLabel).toBe('learning'); // 1 attempt evaluativo
    expect(masteryResult.value.accuracyWindow).toHaveLength(1);

    // (c) Scheduler avanzó: nextDueAt poblado.
    expect(masteryResult.value.schedulingState.nextDueAt).not.toBeNull();

    // (d) Correct sin errorType → feedback null.
    expect(result.value.feedbackDecision).toBeNull();
  });

  it('attempts sucesivos sobre el mismo concept: scheduler evoluciona repetitions', async () => {
    const a1 = makeAttempt({ outcome: 'correct' });
    const r1 = await submitAttempt(
      { attempt: a1, conceptName: 'C', sourceTier: 'primary' },
      container,
    );
    expect(r1.ok).toBe(true);

    const a2 = makeAttempt({ outcome: 'correct' });
    const r2 = await submitAttempt(
      { attempt: a2, conceptName: 'C', sourceTier: 'primary' },
      container,
    );
    expect(r2.ok).toBe(true);

    const mastery = await container.masteryStates.findByConceptId(CONCEPT_ID);
    expect(mastery.ok).toBe(true);
    if (!mastery.ok) return;

    // SM-2: tras 2 correct, repetitions debe ser >= 2.
    const raw = mastery.value.schedulingState.raw as { repetitions: number };
    expect(raw.repetitions).toBeGreaterThanOrEqual(2);

    // Y los 2 attempts persistieron en orden.
    const session = await container.attempts.findBySessionId(SESSION_ID);
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    expect(session.value).toHaveLength(2);
  });

  it('attempt con error genera FeedbackDecision (P1) y persiste igual', async () => {
    const attempt = makeAttempt({ outcome: 'incorrect', errorType: 'conceptual' });
    const result = await submitAttempt(
      { attempt, conceptName: 'Test Concept', sourceTier: 'primary' },
      container,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feedbackDecision).not.toBeNull();
    expect(result.value.feedbackDecision?.kind).toBe('socratic_probe');

    // El attempt incorrect TAMBIÉN persistió (regla de oro: inmutable, no retrocede).
    const found = await container.attempts.findById(attempt.id);
    expect(found.ok).toBe(true);
  });

  it('coordinación de 4 adapters: una sola call dispara persist+load+next+persist', async () => {
    // Snapshot pre-call: ninguna fila en attempts/mastery_states.
    const preAttempts = container.db
      .prepare(`SELECT count(*) as c FROM attempts`)
      .get() as { c: number };
    const preMastery = container.db
      .prepare(`SELECT count(*) as c FROM mastery_states`)
      .get() as { c: number };
    expect(preAttempts.c).toBe(0);
    expect(preMastery.c).toBe(0);

    const result = await submitAttempt(
      {
        attempt: makeAttempt(),
        conceptName: 'Test Concept',
        sourceTier: 'primary',
      },
      container,
    );
    expect(result.ok).toBe(true);

    // Post-call: ambas tablas tienen exactamente 1 fila — confirma que el use
    // case orquestó los 4 ports en una sola operación.
    const postAttempts = container.db
      .prepare(`SELECT count(*) as c FROM attempts`)
      .get() as { c: number };
    const postMastery = container.db
      .prepare(`SELECT count(*) as c FROM mastery_states`)
      .get() as { c: number };
    expect(postAttempts.c).toBe(1);
    expect(postMastery.c).toBe(1);
  });

  it('trigger SQL aborta UPDATE directo sobre attempts (append-only enforcement)', async () => {
    const attempt = makeAttempt();
    const r = await submitAttempt(
      { attempt, conceptName: 'C', sourceTier: 'primary' },
      container,
    );
    expect(r.ok).toBe(true);

    expect(() => {
      container.db
        .prepare(`UPDATE attempts SET outcome = 'incorrect' WHERE id = ?`)
        .run(attempt.id);
    }).toThrow(/immutable|updates not allowed/i);
  });

  it('session_id inexistente → attempt_persist_failed (FK violation mapeado)', async () => {
    const attempt = makeAttempt({ sessionId: 'sess_no_exist' });
    const result = await submitAttempt(
      { attempt, conceptName: 'C', sourceTier: 'primary' },
      container,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('attempt_persist_failed');

    // Y NO se creó MasteryState — la regla "Attempt primero" se cumplió.
    const masteryRow = container.db
      .prepare(`SELECT count(*) as c FROM mastery_states`)
      .get() as { c: number };
    expect(masteryRow.c).toBe(0);
  });

  it('3 correct seguidos: masteryLabel transiciona a mastered', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await submitAttempt(
        {
          attempt: makeAttempt({ outcome: 'correct' }),
          conceptName: 'Test Concept',
          sourceTier: 'primary',
        },
        container,
      );
      expect(r.ok).toBe(true);
    }
    const mastery = await container.masteryStates.findByConceptId(CONCEPT_ID);
    expect(mastery.ok).toBe(true);
    if (!mastery.ok) return;
    expect(mastery.value.accuracyWindow).toHaveLength(3);
    expect(mastery.value.masteryLabel).toBe('mastered');
  });
});
