// tests/policies/p7-calibration.test.ts
import { describe, it, expect } from 'vitest';
import {
  decideDifficultyAdjustment,
  selectNextItem,
  type AccuracyOutcome,
} from '../../src/policies/p7-calibration.js';

describe('P7 — Calibración 85% y selección de próximo ítem', () => {
  // ---- Pin tests del blueprint (docs/architecture/04-testing-setup.md §P7) ----

  it('con accuracy > 0.92 en window de 10, sube dificultad', () => {
    const window: AccuracyOutcome[] = Array(10).fill('correct');
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(+1);
  });

  it('con accuracy < 0.75, baja dificultad', () => {
    const window: AccuracyOutcome[] = [
      'correct',
      'correct',
      'incorrect',
      'incorrect',
      'incorrect',
      'correct',
      'incorrect',
      'correct',
      'incorrect',
      'correct',
    ]; // 0.5
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(-1);
  });

  it('prioriza repaso SM-2 sobre material nuevo cuando hay ítems vencidos', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [{ conceptId: 'c1', overdueDays: 3 }],
      weakItems: [],
      candidatesNew: [{ conceptId: 'c5' }],
      accuracyWindow: Array(10).fill('correct'),
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
      accuracyWindow: Array(10).fill('correct'),
    });
    expect(next.conceptId).not.toBe('c5');
  });

  // ---- Edge cases ----

  it('accuracy en banda [0.75, 0.92] mantiene (delta=0)', () => {
    // 8/10 correct = 0.8 → mantiene
    const window: AccuracyOutcome[] = [
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
      'incorrect',
      'incorrect',
    ];
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(0);
  });

  it('partial cuenta como 0.5 al calcular accuracy ponderada', () => {
    // 10 partial = 0.5 weighted → bajo umbral 0.75 → baja
    const window: AccuracyOutcome[] = Array(10).fill('partial');
    const decision = decideDifficultyAdjustment({ accuracyWindow: window });
    expect(decision.deltaDifficulty).toBe(-1);
  });

  it('concepto débil (errors>=2) tiene prioridad sobre material nuevo', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [],
      weakItems: [{ conceptId: 'cw', errorsInLast3: 2 }],
      candidatesNew: [{ conceptId: 'cn' }],
      accuracyWindow: Array(10).fill('correct'),
    });
    expect(next.priority).toBe(2);
    expect(next.reason).toBe('weak_concept');
    expect(next.conceptId).toBe('cw');
  });

  it('sin due ni weak, con accuracy alta, entrega material nuevo', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [],
      weakItems: [],
      candidatesNew: [{ conceptId: 'cn' }],
      accuracyWindow: Array(10).fill('correct'),
    });
    expect(next.priority).toBe(3);
    expect(next.reason).toBe('new_material');
    expect(next.conceptId).toBe('cn');
  });

  it('sin due ni weak pero accuracy baja, NO entrega nuevo (cae a deepening)', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [],
      weakItems: [],
      candidatesNew: [{ conceptId: 'cn' }],
      accuracyWindow: Array(10).fill('incorrect'),
    });
    expect(next.priority).toBe(4);
    expect(next.reason).toBe('deepening');
    expect(next.conceptId).toBeNull();
  });

  it('en modo Explorador sin candidatos, retorna no_candidate', () => {
    const next = selectNextItem({
      mode: 'explorer',
      dueItems: [{ conceptId: 'c1', overdueDays: 5 }], // ignorado en explorer
      candidatesNew: [],
      accuracyWindow: Array(10).fill('correct'),
    });
    expect(next.priority).toBe(4);
    expect(next.reason).toBe('no_candidate');
    expect(next.conceptId).toBeNull();
  });

  it('priorisa el due con mayor overdueDays cuando hay varios', () => {
    const next = selectNextItem({
      mode: 'socratic',
      dueItems: [
        { conceptId: 'c1', overdueDays: 1 },
        { conceptId: 'c2', overdueDays: 7 },
        { conceptId: 'c3', overdueDays: 3 },
      ],
      accuracyWindow: Array(10).fill('correct'),
    });
    expect(next.conceptId).toBe('c2');
  });
});
