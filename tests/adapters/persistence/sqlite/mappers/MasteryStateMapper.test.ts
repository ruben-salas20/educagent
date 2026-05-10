// tests/adapters/persistence/sqlite/mappers/MasteryStateMapper.test.ts
// Unit tests del mapper row ↔ MasteryState. Sin DB: solo data shape.

import { describe, it, expect } from 'vitest';
import {
  masteryStateToRow,
  rowToMasteryState,
  type MasteryStateRow,
} from '../../../../../src/adapters/persistence/sqlite/mappers/MasteryStateMapper.js';
import type { MasteryState } from '../../../../../src/core/entities/MasteryState.js';
import type { SchedulingState } from '../../../../../src/core/value-objects/SchedulingState.js';

const CONCEPT_ID = 'concept-1';
const NOW = '2026-05-10T00:00:00.000Z';

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

function makeMasteryState(overrides: Partial<MasteryState> = {}): MasteryState {
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

describe('masteryStateToRow — denormalización SM-2', () => {
  it('state nuevo (defaults SM-2) produce row con defaults coherentes', () => {
    const row = masteryStateToRow(makeMasteryState());
    expect(row.ease_factor).toBe(2.5);
    expect(row.interval_days).toBe(0);
    expect(row.repetitions).toBe(0);
    expect(row.next_due_at).toBeNull();
    expect(row.confidence_interval).toBe(0);
    expect(row.mastery_label).toBe('not_started');
    expect(row.last_review_at).toBeNull();
    expect(row.updated_at).toBe(NOW);
  });

  it('state post-SM-2 update refleja easeFactor/interval/repetitions desde raw', () => {
    const sched = freshSchedulingState({
      raw: { easeFactor: 2.36, intervalDays: 6, repetitions: 2 },
      nextDueAt: '2026-05-16T00:00:00.000Z',
    });
    const row = masteryStateToRow(makeMasteryState({ schedulingState: sched }));
    expect(row.ease_factor).toBe(2.36);
    expect(row.interval_days).toBe(6);
    expect(row.repetitions).toBe(2);
    expect(row.next_due_at).toBe('2026-05-16T00:00:00.000Z');
  });

  it('cuando raw no expone los keys SM-2, cae a defaults del schema', () => {
    // Caso edge: scheduler FSRS u otra forma cuyo `raw` no incluye los keys SM-2.
    const sched = freshSchedulingState({
      algorithm: 'fsrs',
      raw: { stability: 4.2, difficulty: 0.3 },
    });
    const row = masteryStateToRow(makeMasteryState({ schedulingState: sched }));
    expect(row.ease_factor).toBe(2.5);
    expect(row.interval_days).toBe(0);
    expect(row.repetitions).toBe(0);
  });
});

describe('rowToMasteryState — reconstrucción desde JSON canónico', () => {
  it('round-trip identity sobre MasteryState complejo', () => {
    const complex: MasteryState = {
      conceptId: CONCEPT_ID,
      schedulingState: {
        algorithm: 'sm2',
        version: 1,
        paramsHash: 'sm2-v1-hash',
        raw: { easeFactor: 2.18, intervalDays: 6, repetitions: 3 },
        nextDueAt: '2026-05-20T12:30:00.000Z',
      },
      accuracyWindow: [
        { outcome: 'correct', weight: 1.0, at: '2026-05-10T10:00:00.000Z' },
        { outcome: 'partial', weight: 0.5, at: '2026-05-11T10:00:00.000Z' },
        { outcome: 'incorrect', weight: 0.0, at: '2026-05-12T10:00:00.000Z' },
      ],
      scaffoldTrajectory: [
        { at: '2026-05-10T10:00:00.000Z', avgLevel: 1.0 },
        { at: '2026-05-11T10:00:00.000Z', avgLevel: 0.5 },
      ],
      bloomCoverage: ['recall', 'application'],
      confidenceInterval: 0.72,
      masteryLabel: 'practicing',
      lastReviewAt: '2026-05-12T10:00:00.000Z',
      updatedAt: '2026-05-12T10:00:00.000Z',
    };
    const row = masteryStateToRow(complex);
    const back = rowToMasteryState(row);
    expect(back).toEqual(complex);
  });

  it('parsea JSON crudo desde una row sintética sin pasar por masteryStateToRow', () => {
    const row: MasteryStateRow = {
      concept_id: CONCEPT_ID,
      ease_factor: 2.5,
      interval_days: 1,
      repetitions: 1,
      next_due_at: '2026-05-11T00:00:00.000Z',
      scheduling_state_json: JSON.stringify({
        algorithm: 'sm2',
        version: 1,
        paramsHash: 'h',
        raw: { easeFactor: 2.5, intervalDays: 1, repetitions: 1 },
        nextDueAt: '2026-05-11T00:00:00.000Z',
      }),
      accuracy_window_json: '[]',
      scaffold_trajectory_json: '[]',
      bloom_coverage_json: '["recall"]',
      confidence_interval: 0.1,
      mastery_label: 'learning',
      last_review_at: '2026-05-10T00:00:00.000Z',
      updated_at: NOW,
    };
    const state = rowToMasteryState(row);
    expect(state.conceptId).toBe(CONCEPT_ID);
    expect(state.bloomCoverage).toEqual(['recall']);
    expect(state.masteryLabel).toBe('learning');
    expect(state.schedulingState.nextDueAt).toBe('2026-05-11T00:00:00.000Z');
  });
});

describe('serialización JSON — parse/stringify son inversas exactas por campo', () => {
  it('accuracyWindow con múltiples entries sobrevive round-trip', () => {
    const aw = [
      { outcome: 'correct' as const, weight: 1.0, at: NOW },
      { outcome: 'partial' as const, weight: 0.5, at: NOW },
    ];
    const row = masteryStateToRow(makeMasteryState({ accuracyWindow: aw }));
    expect(JSON.parse(row.accuracy_window_json)).toEqual(aw);
  });

  it('scaffoldTrajectory sobrevive round-trip', () => {
    const traj = [
      { at: NOW, avgLevel: 0 },
      { at: NOW, avgLevel: 2.5 },
    ];
    const row = masteryStateToRow(makeMasteryState({ scaffoldTrajectory: traj }));
    expect(JSON.parse(row.scaffold_trajectory_json)).toEqual(traj);
  });

  it('bloomCoverage sobrevive round-trip', () => {
    const bc = ['recall', 'application', 'analysis'] as const;
    const row = masteryStateToRow(makeMasteryState({ bloomCoverage: [...bc] }));
    expect(JSON.parse(row.bloom_coverage_json)).toEqual([...bc]);
  });

  it('schedulingState con todos los campos sobrevive round-trip', () => {
    const sched: SchedulingState = {
      algorithm: 'sm2',
      version: 2,
      paramsHash: 'sm2-v2-7f3a',
      raw: { easeFactor: 1.7, intervalDays: 12, repetitions: 4 },
      nextDueAt: '2026-06-01T00:00:00.000Z',
    };
    const row = masteryStateToRow(makeMasteryState({ schedulingState: sched }));
    expect(JSON.parse(row.scheduling_state_json)).toEqual(sched);
  });
});
