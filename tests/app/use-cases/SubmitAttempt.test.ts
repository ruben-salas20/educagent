// tests/app/use-cases/SubmitAttempt.test.ts
// Tests del use case central: SubmitAttempt.
// Usa repos in-memory + FakeClock — sin SQLite real, sin LLM, sin mocks pesados.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  submitAttempt,
  type SubmitAttemptInput,
  type SubmitAttemptDependencies,
} from '../../../src/app/use-cases/SubmitAttempt.js';
import { Sm2Scheduler } from '../../../src/adapters/inference/Sm2Scheduler.js';
import type { Attempt } from '../../../src/core/entities/Attempt.js';
import type { MasteryState } from '../../../src/core/entities/MasteryState.js';
import type { Outcome } from '../../../src/core/value-objects/Outcome.js';
import type { ErrorType } from '../../../src/core/value-objects/ErrorType.js';
import type { Mode } from '../../../src/core/value-objects/Mode.js';
import type { IAttemptRepository } from '../../../src/ports/persistence/IAttemptRepository.js';
import type {
  IMasteryStateRepository,
  MasteryStateRepositoryError,
} from '../../../src/ports/persistence/IMasteryStateRepository.js';
import type { IClock } from '../../../src/ports/infra/IClock.js';
import type { Result } from '../../../src/core/result/Result.js';
import { ok, err } from '../../../src/core/result/Result.js';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class InMemoryAttemptRepository implements IAttemptRepository {
  private readonly attempts = new Map<string, Attempt>();
  public failNextSave = false;

  async save(attempt: Attempt) {
    if (this.failNextSave) {
      this.failNextSave = false;
      return err({ kind: 'storage_error' as const, cause: 'forced failure' });
    }
    if (this.attempts.has(attempt.id)) {
      return err({ kind: 'duplicate_id' as const, attemptId: attempt.id });
    }
    this.attempts.set(attempt.id, attempt);
    return ok(undefined);
  }

  async findById(id: string) {
    const a = this.attempts.get(id);
    if (!a) return err({ kind: 'not_found' as const, attemptId: id });
    return ok(a);
  }

  async findBySessionId(sessionId: string) {
    const list = [...this.attempts.values()].filter((a) => a.sessionId === sessionId);
    list.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return ok(list as ReadonlyArray<Attempt>);
  }

  size(): number {
    return this.attempts.size;
  }
}

class InMemoryMasteryStateRepository implements IMasteryStateRepository {
  private readonly states = new Map<string, MasteryState>();
  public failNextSave = false;

  async findByConceptId(
    conceptId: string,
  ): Promise<Result<MasteryState, MasteryStateRepositoryError>> {
    const s = this.states.get(conceptId);
    if (!s) return err({ kind: 'not_found', conceptId });
    return ok(s);
  }

  async save(state: MasteryState): Promise<Result<void, MasteryStateRepositoryError>> {
    if (this.failNextSave) {
      this.failNextSave = false;
      return err({ kind: 'storage_error', cause: 'forced failure' });
    }
    this.states.set(state.conceptId, state);
    return ok(undefined);
  }

  /** Helper para tests: agregar estado pre-existente */
  seed(state: MasteryState): void {
    this.states.set(state.conceptId, state);
  }

  get(conceptId: string): MasteryState | undefined {
    return this.states.get(conceptId);
  }
}

class FakeClock implements IClock {
  constructor(private fixed: Date = new Date('2026-05-10T17:00:00Z')) {}
  now(): Date {
    return this.fixed;
  }
  advance(ms: number): void {
    this.fixed = new Date(this.fixed.getTime() + ms);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: overrides.id ?? 'att-1',
    projectId: 'proj-1',
    sessionId: 'sess-1',
    itemId: 'item-concept-1',
    mode: 'socratic' as Mode,
    startedAt: '2026-05-10T16:59:00Z',
    submittedAt: '2026-05-10T17:00:00Z',
    latencyMs: 60000,
    responseText: 'mi respuesta',
    outcome: 'correct' as Outcome,
    scaffoldLevelReached: 0,
    scaffoldRequestedBy: null,
    errorType: null,
    preConfidence: null,
    postConfidence: null,
    retryCount: 0,
    affectiveSnapshot: {},
    ...overrides,
  };
}

function makeDeps(overrides: Partial<SubmitAttemptDependencies> = {}): {
  deps: SubmitAttemptDependencies;
  attempts: InMemoryAttemptRepository;
  masteryStates: InMemoryMasteryStateRepository;
  clock: FakeClock;
} {
  const attempts = new InMemoryAttemptRepository();
  const masteryStates = new InMemoryMasteryStateRepository();
  const clock = new FakeClock();
  const deps: SubmitAttemptDependencies = {
    attempts,
    masteryStates,
    scheduler: new Sm2Scheduler(),
    clock,
    ...overrides,
  };
  return { deps, attempts, masteryStates, clock };
}

function makeInput(overrides: Partial<SubmitAttemptInput> = {}): SubmitAttemptInput {
  return {
    attempt: makeAttempt(),
    conceptName: 'derivada de polinomios',
    sourceTier: 'primary',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubmitAttempt use case', () => {
  let ctx: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    ctx = makeDeps();
  });

  it('happy path correct first time: persiste attempt + crea MasteryState learning + feedback null', async () => {
    const result = await submitAttempt(makeInput(), ctx.deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(ctx.attempts.size()).toBe(1);
    expect(result.value.masteryStateUpdated.masteryLabel).toBe('learning');
    expect(result.value.masteryStateUpdated.accuracyWindow).toHaveLength(1);
    expect(result.value.feedbackDecision).toBeNull();
  });

  it('first incorrect attempt: persiste + MasteryState + feedback socratic_probe', async () => {
    const input = makeInput({
      attempt: makeAttempt({
        outcome: 'incorrect',
        errorType: 'conceptual' as ErrorType,
      }),
    });
    const result = await submitAttempt(input, ctx.deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feedbackDecision).not.toBeNull();
    expect(result.value.feedbackDecision?.kind).toBe('socratic_probe');
  });

  it('update existing MasteryState: 3 prev correct + 1 new correct => mastered', async () => {
    // Seed un estado con 3 evaluaciones correct previas.
    const seeded: MasteryState = {
      conceptId: 'item-concept-1',
      schedulingState: new Sm2Scheduler().initial(),
      accuracyWindow: [
        { outcome: 'correct', weight: 1.0, at: '2026-05-09T10:00:00Z' },
        { outcome: 'correct', weight: 1.0, at: '2026-05-09T11:00:00Z' },
        { outcome: 'correct', weight: 1.0, at: '2026-05-09T12:00:00Z' },
      ],
      scaffoldTrajectory: [],
      bloomCoverage: [],
      confidenceInterval: 0,
      masteryLabel: 'practicing',
      lastReviewAt: '2026-05-09T12:00:00Z',
      updatedAt: '2026-05-09T12:00:00Z',
    };
    ctx.masteryStates.seed(seeded);

    const result = await submitAttempt(makeInput(), ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.masteryStateUpdated.accuracyWindow).toHaveLength(4);
    expect(result.value.masteryStateUpdated.masteryLabel).toBe('mastered');
  });

  it('accuracyWindow se trunca a últimos 10 entries tras 12 submits', async () => {
    for (let i = 0; i < 12; i++) {
      const input = makeInput({
        attempt: makeAttempt({ id: `att-${i}`, outcome: 'correct' }),
      });
      const result = await submitAttempt(input, ctx.deps);
      expect(result.ok).toBe(true);
    }
    const state = ctx.masteryStates.get('item-concept-1');
    expect(state).toBeDefined();
    expect(state!.accuracyWindow).toHaveLength(10);
  });

  it('outcome skipped NO agrega entrada a accuracyWindow', async () => {
    const input = makeInput({
      attempt: makeAttempt({ outcome: 'skipped' }),
    });
    const result = await submitAttempt(input, ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.masteryStateUpdated.accuracyWindow).toHaveLength(0);
  });

  it('scheduler propagation: tras correct, nextDueAt no es null', async () => {
    const result = await submitAttempt(makeInput(), ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.masteryStateUpdated.schedulingState.nextDueAt).not.toBeNull();
  });

  it('error: attempts.save falla => attempt_persist_failed y no toca MasteryState', async () => {
    ctx.attempts.failNextSave = true;
    const result = await submitAttempt(makeInput(), ctx.deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('attempt_persist_failed');
    expect(ctx.masteryStates.get('item-concept-1')).toBeUndefined();
  });

  it('error: masteryStates.save falla => mastery_persist_failed pero attempt YA persistido', async () => {
    ctx.masteryStates.failNextSave = true;
    const result = await submitAttempt(makeInput(), ctx.deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('mastery_persist_failed');
    // Regla de oro: Attempts inmutables, no retroceden.
    expect(ctx.attempts.size()).toBe(1);
  });

  it('modo Simulacro con error: feedbackDecision.kind = simulacro_silent', async () => {
    const input = makeInput({
      attempt: makeAttempt({
        mode: 'simulacro' as Mode,
        outcome: 'incorrect',
        errorType: 'conceptual' as ErrorType,
      }),
    });
    const result = await submitAttempt(input, ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feedbackDecision?.kind).toBe('simulacro_silent');
  });

  it('modo Explorador con error conceptual + RAG citation: text contiene [RAG: ...]', async () => {
    const input = makeInput({
      attempt: makeAttempt({
        mode: 'explorer' as Mode,
        outcome: 'incorrect',
        errorType: 'conceptual' as ErrorType,
      }),
      ragCitation: { source: 'calculus.pdf', page: 42 },
    });
    const result = await submitAttempt(input, ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feedbackDecision?.text).toContain('[RAG: calculus.pdf, p.42]');
  });

  it('scaffoldTrajectory se trunca a 20 entries tras 22 submits', async () => {
    for (let i = 0; i < 22; i++) {
      const input = makeInput({
        attempt: makeAttempt({
          id: `att-${i}`,
          outcome: 'skipped', // no agrega a accuracy window pero sí a scaffold trajectory
          scaffoldLevelReached: 2,
        }),
      });
      await submitAttempt(input, ctx.deps);
    }
    const state = ctx.masteryStates.get('item-concept-1');
    expect(state!.scaffoldTrajectory).toHaveLength(20);
  });

  it('lastReviewAt y updatedAt reflejan el clock inyectado', async () => {
    const result = await submitAttempt(makeInput(), ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.masteryStateUpdated.lastReviewAt).toBe(
      '2026-05-10T17:00:00.000Z',
    );
    expect(result.value.masteryStateUpdated.updatedAt).toBe(
      '2026-05-10T17:00:00.000Z',
    );
  });

  it('attempt correct sin errorType: feedbackDecision = null (no hay feedback)', async () => {
    const input = makeInput({
      attempt: makeAttempt({ outcome: 'correct', errorType: null }),
    });
    const result = await submitAttempt(input, ctx.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feedbackDecision).toBeNull();
  });

  it('mastery_label transition: 2 attempts => learning, 3 attempts con accuracy <0.85 => practicing', async () => {
    // 2 correct → learning
    await submitAttempt(
      makeInput({ attempt: makeAttempt({ id: 'a1', outcome: 'correct' }) }),
      ctx.deps,
    );
    await submitAttempt(
      makeInput({ attempt: makeAttempt({ id: 'a2', outcome: 'correct' }) }),
      ctx.deps,
    );
    let state = ctx.masteryStates.get('item-concept-1')!;
    expect(state.masteryLabel).toBe('learning');

    // 3er attempt incorrect → accuracy media = 2/3 ≈ 0.67 < 0.85 → practicing
    await submitAttempt(
      makeInput({ attempt: makeAttempt({ id: 'a3', outcome: 'incorrect' }) }),
      ctx.deps,
    );
    state = ctx.masteryStates.get('item-concept-1')!;
    expect(state.accuracyWindow).toHaveLength(3);
    expect(state.masteryLabel).toBe('practicing');
  });
});
