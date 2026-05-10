// tests/policies/p4-off-ramps.test.ts
// Tests para P4 — Off-Ramps. Cubre los 3 tests pin del blueprint
// (docs/architecture/04-testing-setup.md §P4) + casos derivados de
// docs/research/01-politicas-operativas.md §P4.

import { describe, it, expect } from 'vitest';
import {
  shouldForceRetrievalOffRamp,
  shouldPauseSimulacro,
  getTransitionMatrix,
} from '../../src/policies/p4-off-ramps.js';

// ---------------------------------------------------------------------------
// shouldForceRetrievalOffRamp — Pin tests del blueprint
// ---------------------------------------------------------------------------

describe('P4 — Off-ramp forzado Explorador → retrieval', () => {
  it('dispara retrieval forzado cuando agente emitió >1500 tokens sin retrieval', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 1501,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 5,
      fluencyIllusionFlags: [],
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
      fluencyIllusionFlags: ['ya_entendi', 'ya_entendi'],
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
      fluencyIllusionFlags: ['ya_entendi'],
    });
    expect(decision.trigger).toBe(false);
    expect(decision.reason).toBe('not_applicable_mode');
  });
});

// ---------------------------------------------------------------------------
// shouldForceRetrievalOffRamp — Casos derivados
// ---------------------------------------------------------------------------

describe('P4 — Off-ramp Explorador: disparadores adicionales', () => {
  it('dispara por requested_summary con una sola instancia', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 200,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 3,
      fluencyIllusionFlags: ['requested_summary'],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('fluency_illusion_detected');
  });

  it('dispara por 3 conceptos nuevos en el segmento (new_concepts_threshold)', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 400,
      newConceptsIntroduced: 3,
      minutesSinceLastRetrieval: 5,
      fluencyIllusionFlags: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('new_concepts_threshold');
  });

  it('dispara por 21 minutos sin retrieval (time_threshold)', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 400,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 21,
      fluencyIllusionFlags: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('time_threshold');
  });

  it('cuando hay tokens >1500 Y fluency_illusion, reporta fluency_illusion_detected (mayor prioridad)', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 2000,
      newConceptsIntroduced: 4,
      minutesSinceLastRetrieval: 25,
      fluencyIllusionFlags: ['ya_entendi', 'ya_entendi'],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.reason).toBe('fluency_illusion_detected');
  });

  it('NO dispara cuando todo está bajo umbral', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 500,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 5,
      fluencyIllusionFlags: ['claro'], // solo 1, debajo del umbral
    });
    expect(decision.trigger).toBe(false);
    expect(decision.reason).toBe('below_thresholds');
    expect(decision.text).toBe('');
  });

  it('questionCount sube a 3 cuando newConceptsIntroduced >= 5', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 1600,
      newConceptsIntroduced: 6,
      minutesSinceLastRetrieval: 10,
      fluencyIllusionFlags: [],
    });
    expect(decision.trigger).toBe(true);
    expect(decision.questionCount).toBe(3);
  });

  it('questionCount es 2 por defecto cuando dispara con pocos conceptos nuevos', () => {
    const decision = shouldForceRetrievalOffRamp({
      currentMode: 'explorer',
      tokensSinceLastRetrieval: 1600,
      newConceptsIntroduced: 1,
      minutesSinceLastRetrieval: 5,
      fluencyIllusionFlags: [],
    });
    expect(decision.questionCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// shouldPauseSimulacro
// ---------------------------------------------------------------------------

describe('P4 — Cascada Simulacro → Explorador', () => {
  it('pausa y ofrece Explorador con 3 errores conceptual+procedural sin mismo concepto', () => {
    const decision = shouldPauseSimulacro({
      consecutiveErrors: 3,
      errorTypesInCascade: ['conceptual', 'procedural', 'conceptual'],
      sameConceptRepeated: false,
    });
    expect(decision.action).toBe('pause_offer_explorador');
    expect(decision.text).toMatch(/explorador/i);
  });

  it('NO pausa cuando los 3 errores son del mismo concepto (item mal calibrado)', () => {
    const decision = shouldPauseSimulacro({
      consecutiveErrors: 3,
      errorTypesInCascade: ['conceptual', 'conceptual', 'conceptual'],
      sameConceptRepeated: true,
    });
    expect(decision.action).toBe('continue');
  });

  it('NO pausa cuando los 3 errores son de transferencia (esperado en simulacro)', () => {
    const decision = shouldPauseSimulacro({
      consecutiveErrors: 3,
      errorTypesInCascade: ['transferencia', 'transferencia', 'transferencia'],
      sameConceptRepeated: false,
    });
    expect(decision.action).toBe('continue');
  });

  it('NO pausa con menos de 3 errores consecutivos', () => {
    const decision = shouldPauseSimulacro({
      consecutiveErrors: 2,
      errorTypesInCascade: ['conceptual', 'procedural'],
      sameConceptRepeated: false,
    });
    expect(decision.action).toBe('continue');
  });
});

// ---------------------------------------------------------------------------
// getTransitionMatrix
// ---------------------------------------------------------------------------

describe('P4 — Mapa de transiciones entre modos', () => {
  it('Simulacro → Socrático está bloqueado (rompe integridad del test)', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.simulacro.socratic).toBe('blocked');
  });

  it('Simulacro → Arquitecto está bloqueado (rompe integridad del test)', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.simulacro.architect).toBe('blocked');
  });

  it('Socrático → Arquitecto es manual', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.socratic.architect).toBe('manual');
  });

  it('Explorador → cualquier otro modo es manual (off-ramp es a retrieval, no a otro modo)', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.explorer.socratic).toBe('manual');
    expect(matrix.explorer.architect).toBe('manual');
    expect(matrix.explorer.simulacro).toBe('manual');
  });

  it('Arquitecto → Simulacro es forced (plan completo → propone testearlo)', () => {
    const matrix = getTransitionMatrix();
    expect(matrix.architect.simulacro).toBe('forced');
  });
});
