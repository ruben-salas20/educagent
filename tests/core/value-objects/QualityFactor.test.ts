// tests/core/value-objects/QualityFactor.test.ts
import { describe, it, expect } from 'vitest';
import { outcomeToQualityFactor } from '../../../src/core/value-objects/QualityFactor.js';

describe('outcomeToQualityFactor — mapping ADR-0002', () => {
  it('correct + scaffold=0 -> q=5', () => {
    expect(outcomeToQualityFactor('correct', 0)).toBe(5);
  });

  it('correct + scaffold=1 -> q=3 (4-1)', () => {
    expect(outcomeToQualityFactor('correct', 1)).toBe(3);
  });

  it('correct + scaffold=2 -> q=2 (4-2)', () => {
    expect(outcomeToQualityFactor('correct', 2)).toBe(2);
  });

  it('correct + scaffold=3 -> q=1 (4-3, clamp piso 1)', () => {
    expect(outcomeToQualityFactor('correct', 3)).toBe(1);
  });

  it('correct + scaffold=4 -> q=1 (4-4=0, clamp a 1)', () => {
    expect(outcomeToQualityFactor('correct', 4)).toBe(1);
  });

  it('correct + scaffold=5 -> q=1 (clamp piso defensivo)', () => {
    expect(outcomeToQualityFactor('correct', 5)).toBe(1);
  });

  it('partial -> q=3 sin importar scaffold', () => {
    expect(outcomeToQualityFactor('partial', 0)).toBe(3);
    expect(outcomeToQualityFactor('partial', 3)).toBe(3);
  });

  it('incorrect -> q=2', () => {
    expect(outcomeToQualityFactor('incorrect', 0)).toBe(2);
    expect(outcomeToQualityFactor('incorrect', 4)).toBe(2);
  });

  it('skipped -> q=1', () => {
    expect(outcomeToQualityFactor('skipped', 0)).toBe(1);
  });

  it('gave_up -> q=0', () => {
    expect(outcomeToQualityFactor('gave_up', 0)).toBe(0);
  });
});
