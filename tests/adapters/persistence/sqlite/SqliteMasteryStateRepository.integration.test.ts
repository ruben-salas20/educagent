// tests/adapters/persistence/sqlite/SqliteMasteryStateRepository.integration.test.ts
// Integration tests con SQLite real en :memory:. Validan:
// - happy path save/findByConceptId
// - upsert: segundo save reemplaza al primero
// - not_found
// - FK violation cuando concept_id no existe
// - CHECK constraints (confidence_interval fuera de [0,1], mastery_label inválido)
// - round-trip de JSON complejos (schedulingState, accuracyWindow, scaffoldTrajectory)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openConnection } from '../../../../src/adapters/persistence/sqlite/connection.js';
import { applyMigrations } from '../../../../src/adapters/persistence/sqlite/migrations/runner.js';
import { SqliteMasteryStateRepository } from '../../../../src/adapters/persistence/sqlite/SqliteMasteryStateRepository.js';
import type { MasteryState } from '../../../../src/core/entities/MasteryState.js';
import type { SchedulingState } from '../../../../src/core/value-objects/SchedulingState.js';

const PROJECT_ID = 'proj-1';
const CONCEPT_ID = 'concept-1';
const NOW = '2026-05-10T00:00:00.000Z';

function seedFixtures(db: Database.Database): void {
  db.prepare(
    `INSERT INTO projects (id, name, created_at, last_active_at) VALUES (?, ?, ?, ?)`,
  ).run(PROJECT_ID, 'Test project', NOW, NOW);

  db.prepare(
    `INSERT INTO concepts (id, project_id, name, granularity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(CONCEPT_ID, PROJECT_ID, 'Polinomios', 'section', NOW);
}

function freshSchedulingState(overrides: Partial<SchedulingState> = {}): SchedulingState {
  return {
    algorithm: 'sm2',
    version: 1,
    paramsHash: 'sm2-default',
    raw: { easeFactor: 2.5, intervalDays: 0, repetitions: 0 },
    nextDueAt: null,
    ...overrides,
  };
}

function makeState(overrides: Partial<MasteryState> = {}): MasteryState {
  return {
    conceptId: CONCEPT_ID,
    schedulingState: freshSchedulingState(),
    accuracyWindow: [],
    scaffoldTrajectory: [],
    bloomCoverage: [],
    confidenceInterval: 0,
    masteryLabel: 'not_started',
    lastReviewAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

let db: Database.Database;
let repo: SqliteMasteryStateRepository;

beforeEach(() => {
  db = openConnection({ filename: ':memory:' });
  const r = applyMigrations(db);
  if (!r.ok) throw new Error(`migrations failed: ${JSON.stringify(r.error)}`);
  seedFixtures(db);
  repo = new SqliteMasteryStateRepository(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteMasteryStateRepository.save / findByConceptId', () => {
  it('persiste un MasteryState nuevo y lo recupera idéntico', async () => {
    const s = makeState();
    const saveR = await repo.save(s);
    expect(saveR.ok).toBe(true);

    const findR = await repo.findByConceptId(CONCEPT_ID);
    expect(findR.ok).toBe(true);
    if (!findR.ok) throw new Error('unreachable');
    expect(findR.value).toEqual(s);
  });

  it('findByConceptId de conceptId inexistente retorna not_found', async () => {
    const r = await repo.findByConceptId('concept-no-existe');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('not_found');
  });

  it('save sobre el mismo conceptId hace UPSERT (reemplaza al previo)', async () => {
    const s1 = makeState({
      confidenceInterval: 0.1,
      masteryLabel: 'learning',
      updatedAt: '2026-05-10T00:00:00.000Z',
    });
    const r1 = await repo.save(s1);
    expect(r1.ok).toBe(true);

    const s2 = makeState({
      confidenceInterval: 0.85,
      masteryLabel: 'mastered',
      bloomCoverage: ['recall', 'application'],
      lastReviewAt: '2026-05-15T00:00:00.000Z',
      updatedAt: '2026-05-15T00:00:00.000Z',
      schedulingState: freshSchedulingState({
        raw: { easeFactor: 2.6, intervalDays: 15, repetitions: 4 },
        nextDueAt: '2026-05-30T00:00:00.000Z',
      }),
    });
    const r2 = await repo.save(s2);
    expect(r2.ok).toBe(true);

    const find = await repo.findByConceptId(CONCEPT_ID);
    expect(find.ok).toBe(true);
    if (!find.ok) throw new Error('unreachable');
    expect(find.value).toEqual(s2);
    // Asegurar que NO conservó campos del s1 viejo
    expect(find.value.masteryLabel).toBe('mastered');
    expect(find.value.confidenceInterval).toBe(0.85);
  });
});

describe('SqliteMasteryStateRepository — denormalización SM-2 visible en SQL', () => {
  it('los campos SM-2 quedan en columnas físicas (queryable vía SQL crudo)', async () => {
    const sched = freshSchedulingState({
      raw: { easeFactor: 2.36, intervalDays: 6, repetitions: 2 },
      nextDueAt: '2026-05-16T00:00:00.000Z',
    });
    await repo.save(makeState({ schedulingState: sched }));

    const row = db
      .prepare(
        `SELECT ease_factor, interval_days, repetitions, next_due_at
         FROM mastery_states WHERE concept_id = ?`,
      )
      .get(CONCEPT_ID) as {
      ease_factor: number;
      interval_days: number;
      repetitions: number;
      next_due_at: string;
    };
    expect(row.ease_factor).toBe(2.36);
    expect(row.interval_days).toBe(6);
    expect(row.repetitions).toBe(2);
    expect(row.next_due_at).toBe('2026-05-16T00:00:00.000Z');
  });
});

describe('SqliteMasteryStateRepository — constraint enforcement', () => {
  it('save con conceptId inexistente en concepts retorna foreign_key_violation', async () => {
    const r = await repo.save(makeState({ conceptId: 'concept-fantasma' }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('foreign_key_violation');
  });

  it('save con confidence_interval fuera de [0,1] viola CHECK → storage_error', async () => {
    const r = await repo.save(makeState({ confidenceInterval: 1.5 }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('storage_error');
    if (r.error.kind !== 'storage_error') throw new Error('unreachable');
    expect(r.error.cause.toLowerCase()).toContain('check constraint');
  });

  it('save con mastery_label inválido viola CHECK → storage_error', async () => {
    const r = await repo.save(
      // forzamos el cast porque el type lo prohíbe a nivel TS, pero el runtime debe defenderse
      makeState({ masteryLabel: 'invalid_label' as unknown as MasteryState['masteryLabel'] }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('storage_error');
    if (r.error.kind !== 'storage_error') throw new Error('unreachable');
    expect(r.error.cause.toLowerCase()).toContain('check constraint');
  });
});

describe('SqliteMasteryStateRepository — JSON round-trip', () => {
  it('schedulingState completo sobrevive serialize → deserialize', async () => {
    const sched: SchedulingState = {
      algorithm: 'sm2',
      version: 1,
      paramsHash: 'sm2-v1-abc123',
      raw: { easeFactor: 2.18, intervalDays: 6, repetitions: 3 },
      nextDueAt: '2026-05-20T12:30:00.000Z',
    };
    await repo.save(makeState({ schedulingState: sched }));

    const r = await repo.findByConceptId(CONCEPT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.schedulingState).toEqual(sched);
  });

  it('accuracyWindow con 5 entries sobrevive round-trip', async () => {
    const aw = [
      { outcome: 'correct' as const, weight: 1.0, at: '2026-05-10T10:00:00.000Z' },
      { outcome: 'partial' as const, weight: 0.5, at: '2026-05-11T10:00:00.000Z' },
      { outcome: 'incorrect' as const, weight: 0.0, at: '2026-05-12T10:00:00.000Z' },
      { outcome: 'correct' as const, weight: 1.0, at: '2026-05-13T10:00:00.000Z' },
      { outcome: 'correct' as const, weight: 1.0, at: '2026-05-14T10:00:00.000Z' },
    ];
    await repo.save(makeState({ accuracyWindow: aw }));

    const r = await repo.findByConceptId(CONCEPT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.accuracyWindow).toEqual(aw);
  });

  it('scaffoldTrajectory con 3 points sobrevive round-trip', async () => {
    const traj = [
      { at: '2026-05-10T10:00:00.000Z', avgLevel: 0 },
      { at: '2026-05-11T10:00:00.000Z', avgLevel: 1.5 },
      { at: '2026-05-12T10:00:00.000Z', avgLevel: 2.0 },
    ];
    await repo.save(makeState({ scaffoldTrajectory: traj }));

    const r = await repo.findByConceptId(CONCEPT_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.scaffoldTrajectory).toEqual(traj);
  });
});
