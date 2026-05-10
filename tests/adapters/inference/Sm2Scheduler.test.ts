// tests/adapters/inference/Sm2Scheduler.test.ts
import { describe, it, expect } from 'vitest';
import { Sm2Scheduler } from '../../../src/adapters/inference/Sm2Scheduler.js';
import type { SchedulingState } from '../../../src/ports/inference/IScheduler.js';
import type { Attempt } from '../../../src/core/entities/Attempt.js';

function makeAttempt(
  overrides: Partial<Pick<Attempt, 'outcome' | 'submittedAt' | 'scaffoldLevelReached'>>,
): Pick<Attempt, 'outcome' | 'submittedAt' | 'scaffoldLevelReached'> {
  return {
    outcome: 'correct',
    submittedAt: '2026-05-10T00:00:00.000Z',
    scaffoldLevelReached: 0,
    ...overrides,
  };
}

function getRaw(state: SchedulingState): {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
} {
  return state.raw as unknown as {
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
  };
}

const NOW = new Date('2026-05-10T00:00:00.000Z');
const MS_PER_DAY = 86_400_000;

describe('Sm2Scheduler.initial', () => {
  it('retorna state inicial con defaults SM-2', () => {
    const s = new Sm2Scheduler().initial();
    expect(s.algorithm).toBe('sm2');
    expect(s.paramsHash).toBe('sm2-default-v1');
    expect(s.nextDueAt).toBeNull();
    const raw = getRaw(s);
    expect(raw.easeFactor).toBe(2.5);
    expect(raw.intervalDays).toBe(0);
    expect(raw.repetitions).toBe(0);
  });
});

describe('Sm2Scheduler.next — outcome correct (q=5)', () => {
  it('primer review (repetitions=0): intervalDays=1, repetitions=1', () => {
    const sch = new Sm2Scheduler();
    const r = sch.next(sch.initial(), makeAttempt({ outcome: 'correct' }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const raw = getRaw(r.value);
    expect(raw.intervalDays).toBe(1);
    expect(raw.repetitions).toBe(1);
    expect(raw.easeFactor).toBeCloseTo(2.6, 5); // 2.5 + 0.1
    expect(r.value.nextDueAt).toBe(new Date(NOW.getTime() + 1 * MS_PER_DAY).toISOString());
  });

  it('segundo review (repetitions=1): intervalDays=6, repetitions=2', () => {
    const sch = new Sm2Scheduler();
    const s1 = sch.next(sch.initial(), makeAttempt({ outcome: 'correct' }), NOW);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    const s2 = sch.next(s1.value, makeAttempt({ outcome: 'correct' }), NOW);
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    const raw = getRaw(s2.value);
    expect(raw.intervalDays).toBe(6);
    expect(raw.repetitions).toBe(2);
  });

  it('tercer review (repetitions=2, ease~2.7, interval=6): intervalDays=round(6*ease)', () => {
    const sch = new Sm2Scheduler();
    let s = sch.initial();
    for (let i = 0; i < 3; i++) {
      const r = sch.next(s, makeAttempt({ outcome: 'correct' }), NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value;
    }
    const raw = getRaw(s);
    expect(raw.repetitions).toBe(3);
    // Después de 3 correct con q=5: ease = 2.5+0.1+0.1+0.1 = 2.8.
    // Tercer review usa interval previo (6) * ease previo (2.7) = 16.2 → round = 16.
    expect(raw.easeFactor).toBeCloseTo(2.8, 5);
    expect(raw.intervalDays).toBe(16);
  });
});

describe('Sm2Scheduler.next — outcome incorrect (q=2)', () => {
  it('resetea repetitions y intervalDays=1, NO cambia easeFactor (SM-2 puro)', () => {
    const sch = new Sm2Scheduler();
    // Avanzamos 2 correctas para tener state con ease=2.7, reps=2, interval=6.
    let s = sch.initial();
    for (let i = 0; i < 2; i++) {
      const r = sch.next(s, makeAttempt({ outcome: 'correct' }), NOW);
      if (!r.ok) throw new Error('setup failed');
      s = r.value;
    }
    const efBefore = getRaw(s).easeFactor;

    const r = sch.next(s, makeAttempt({ outcome: 'incorrect' }), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const raw = getRaw(r.value);
    expect(raw.repetitions).toBe(0);
    expect(raw.intervalDays).toBe(1);
    expect(raw.easeFactor).toBe(efBefore); // SM-2 puro
  });
});

describe('Sm2Scheduler — piso EF=1.3 (ADR-0002 mitigación ease hell)', () => {
  it('múltiples partial consecutivos no bajan EF por debajo de 1.3', () => {
    const sch = new Sm2Scheduler();
    let s = sch.initial();
    // partial -> q=3 -> efDelta = 0.1 - 2*(0.08+2*0.02) = 0.1 - 2*0.12 = -0.14
    // Iteramos 30 veces para forzar saturación al piso.
    for (let i = 0; i < 30; i++) {
      const r = sch.next(s, makeAttempt({ outcome: 'partial' }), NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      s = r.value;
      expect(getRaw(s).easeFactor).toBeGreaterThanOrEqual(1.3);
    }
    expect(getRaw(s).easeFactor).toBe(1.3);
  });
});

describe('Sm2Scheduler — algorithm_mismatch', () => {
  it('next() con state.algorithm distinto a sm2 retorna error', () => {
    const sch = new Sm2Scheduler();
    const fsrsState: SchedulingState = {
      algorithm: 'fsrs',
      version: 1,
      paramsHash: 'fsrs-test',
      raw: {},
      nextDueAt: null,
    };
    const r = sch.next(fsrsState, makeAttempt({}), NOW);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe('algorithm_mismatch');
  });
});

describe('Sm2Scheduler.serialize / deserialize', () => {
  it('son inversas estrictas', () => {
    const sch = new Sm2Scheduler();
    const s = sch.initial();
    const json = sch.serialize(s);
    const r = sch.deserialize(json);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual(s);
  });

  it('deserialize rechaza JSON inválido', () => {
    const r = new Sm2Scheduler().deserialize('not json');
    expect(r.ok).toBe(false);
  });

  it('deserialize rechaza algorithm distinto a sm2', () => {
    const serialized = JSON.stringify({
      algorithm: 'fsrs',
      version: 1,
      paramsHash: 'x',
      raw: {},
      nextDueAt: null,
    });
    const r = new Sm2Scheduler().deserialize(serialized);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe('algorithm_mismatch');
  });
});

describe('Sm2Scheduler.isDue', () => {
  it('retorna false si nextDueAt es null', () => {
    const sch = new Sm2Scheduler();
    expect(sch.isDue(sch.initial(), NOW)).toBe(false);
  });

  it('retorna true si nextDueAt <= now', () => {
    const sch = new Sm2Scheduler();
    const r = sch.next(sch.initial(), makeAttempt({ outcome: 'correct' }), NOW);
    if (!r.ok) throw new Error('setup');
    const later = new Date(NOW.getTime() + 2 * MS_PER_DAY);
    expect(sch.isDue(r.value, later)).toBe(true);
  });

  it('retorna false si nextDueAt > now', () => {
    const sch = new Sm2Scheduler();
    const r = sch.next(sch.initial(), makeAttempt({ outcome: 'correct' }), NOW);
    if (!r.ok) throw new Error('setup');
    expect(sch.isDue(r.value, NOW)).toBe(false);
  });
});

describe('Sm2Scheduler.calibrate / withParams', () => {
  it('calibrate retorna algorithm_not_calibrable', async () => {
    const r = await new Sm2Scheduler().calibrate([]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe('algorithm_not_calibrable');
  });

  it('withParams retorna una instancia IScheduler usable', () => {
    const sch = new Sm2Scheduler();
    const next = sch.withParams({});
    expect(next.initial().algorithm).toBe('sm2');
  });
});
