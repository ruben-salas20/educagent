// tests/policies/p1-feedback.test.ts
// Tests pin del blueprint + expansión por celdas de la matriz.
// Ver docs/research/01-politicas-operativas.md §P1 y docs/architecture/04-testing-setup.md §P1.

import { describe, it, expect } from 'vitest';
import { decideFeedback } from '../../src/policies/p1-feedback.js';

describe('P1 — Feedback formativo', () => {
  // -------------------------------------------------------------------------
  // Tests pin del blueprint (no se mueven sin justificación)
  // -------------------------------------------------------------------------

  it('en modo Socrático con error conceptual, NO emite la definición correcta', () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'conceptual',
      attemptText: 'la derivada de x^2 es x',
      conceptName: 'derivada de polinomios',
      sourceTier: 'primary',
    });

    expect(decision.kind).toBe('socratic_probe');
    expect(decision.scaffoldLevelOffered).toBe(0);
    expect(decision.text).toMatch(/¿podés definir.+con tus palabras\?/i);
    expect(decision.text).not.toContain('2x');
    expect(decision.prohibited).toContain('give_correct_definition');
  });

  it('en modo Explorador con error conceptual, corrige el hecho con cita RAG', () => {
    const decision = decideFeedback({
      mode: 'explorer',
      errorType: 'conceptual',
      attemptText: 'la derivada de x^2 es x',
      conceptName: 'derivada de polinomios',
      sourceTier: 'primary',
      ragCitation: { source: 'calculus.pdf', page: 42 },
    });

    expect(decision.kind).toBe('direct_correction');
    expect(decision.text).toContain('[RAG: calculus.pdf, p.42]');
    expect(decision.text).toMatch(/2x/);
  });

  // -------------------------------------------------------------------------
  // Expansión por modo / tipo de error
  // -------------------------------------------------------------------------

  it('en Simulacro con cualquier errorType emite simulacro_silent sin scaffolding', () => {
    const decision = decideFeedback({
      mode: 'simulacro',
      errorType: 'conceptual',
      attemptText: 'respuesta cualquiera',
      conceptName: 'integrales por partes',
      sourceTier: 'tertiary',
    });

    expect(decision.kind).toBe('simulacro_silent');
    expect(decision.scaffoldLevelOffered).toBe(0);
    expect(decision.prohibited).toContain('explain_mid_test');
    expect(decision.question).toBe('');
  });

  it('en Simulacro con no-sé, registra "omitido" sin pregunta', () => {
    const decision = decideFeedback({
      mode: 'simulacro',
      errorType: 'no-sé',
      attemptText: 'no sé',
      conceptName: 'integrales',
      sourceTier: 'tertiary',
    });

    expect(decision.kind).toBe('simulacro_silent');
    expect(decision.text).toMatch(/omitido/i);
    expect(decision.question).toBe('');
    expect(decision.prohibited).toContain('explain_mid_test');
  });

  it('en Arquitecto con error procedural, marca el plan (no el detalle conceptual)', () => {
    const decision = decideFeedback({
      mode: 'architect',
      errorType: 'procedural',
      attemptText: 'plan con paso 3 antes que paso 2',
      conceptName: 'plan de migración',
      sourceTier: 'secondary',
    });

    expect(decision.kind).toBe('plan_review');
    expect(decision.text).toMatch(/plan|nodo/i);
    expect(decision.scaffoldLevelOffered).toBeGreaterThanOrEqual(1);
  });

  it('no-sé en Socrático ofrece menú de niveles 1-5 (rendition_menu)', () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'no-sé',
      attemptText: 'no sé',
      conceptName: 'límites',
      sourceTier: 'tertiary',
    });

    expect(decision.kind).toBe('rendition_menu');
    expect(decision.text).toMatch(/\[1\].*\[2\].*\[3\].*\[4\].*\[5\]/s);
    expect(decision.prohibited).toContain('penalize_user');
  });

  it("no-sé en Arquitecto ofrece template de plan análogo (rendition_menu nivel >=3)", () => {
    const decision = decideFeedback({
      mode: 'architect',
      errorType: 'no-sé',
      attemptText: 'no sé por dónde arrancar',
      conceptName: 'plan de refactor',
      sourceTier: 'tertiary',
    });

    expect(decision.kind).toBe('rendition_menu');
    expect(decision.scaffoldLevelOffered).toBeGreaterThanOrEqual(3);
  });

  it("no-sé en Explorador ofrece micro-explicación (progressive_explanation)", () => {
    const decision = decideFeedback({
      mode: 'explorer',
      errorType: 'no-sé',
      attemptText: 'no tengo idea',
      conceptName: 'recursión',
      sourceTier: 'tertiary',
    });

    expect(decision.kind).toBe('progressive_explanation');
    expect(decision.text).toMatch(/recursi[oó]n/i);
    expect(decision.question).toMatch(/alcanza|ejemplo/i);
  });

  it("'transferencia' en Socrático se resuelve a celda conceptual y conserva resolvedErrorType original", () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'transferencia',
      attemptText: 'apliqué la fórmula del caso A',
      conceptName: 'derivada de polinomios',
      sourceTier: 'primary',
    });

    // Cae en la celda conceptual de Socrático → socratic_probe sin revelar.
    expect(decision.kind).toBe('socratic_probe');
    expect(decision.prohibited).toContain('give_correct_definition');
    // El input original se preserva auditable.
    expect(decision.resolvedErrorType).toBe('transferencia');
  });

  it("'incompleta' en Socrático se resuelve a celda partial-correct", () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'incompleta',
      attemptText: 'una respuesta a medias',
      conceptName: 'integración por partes',
      sourceTier: 'primary',
    });

    expect(decision.kind).toBe('socratic_probe');
    expect(decision.text).toMatch(/falta una parte/i);
    expect(decision.resolvedErrorType).toBe('incompleta');
  });

  it('Socrático con procedural + isRepeatRequest sube scaffold a 1', () => {
    const decision = decideFeedback({
      mode: 'socratic',
      errorType: 'procedural',
      attemptText: 'paso mal ordenado',
      conceptName: 'integrales',
      sourceTier: 'primary',
      isRepeatRequest: true,
    });

    expect(decision.scaffoldLevelOffered).toBe(1);
    expect(decision.kind).toBe('socratic_probe');
  });

  it('Explorador sin ragCitation agrega disclaimer de conocimiento general', () => {
    const decision = decideFeedback({
      mode: 'explorer',
      errorType: 'conceptual',
      attemptText: 'algo',
      conceptName: 'topología algebraica',
      sourceTier: 'tertiary',
    });

    expect(decision.text).toMatch(/sin cita|conocimiento general/i);
    expect(decision.kind).toBe('direct_correction');
  });

  it('prohibited siempre contiene al menos un item auditable', () => {
    const modes = ['socratic', 'architect', 'simulacro', 'explorer'] as const;
    const errors = [
      'conceptual',
      'procedural',
      'notational',
      'careless',
      'off-topic',
      'partial-correct',
      'transferencia',
      'incompleta',
      'no-sé',
    ] as const;

    for (const mode of modes) {
      for (const errorType of errors) {
        const decision = decideFeedback({
          mode,
          errorType,
          attemptText: 'x',
          conceptName: 'concepto X',
          sourceTier: 'primary',
        });
        expect(decision.prohibited.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('el texto NUNCA matchea patrones sycophantic (P3)', () => {
    const modes = ['socratic', 'architect', 'simulacro', 'explorer'] as const;
    const errors = ['conceptual', 'procedural', 'partial-correct', 'no-sé'] as const;
    const sycophantic = /excelente pregunta|great question|sos (muy )?inteligente|you're so smart|brilliant|amazing/i;

    for (const mode of modes) {
      for (const errorType of errors) {
        const decision = decideFeedback({
          mode,
          errorType,
          attemptText: 'x',
          conceptName: 'álgebra lineal',
          sourceTier: 'primary',
        });
        expect(decision.text).not.toMatch(sycophantic);
        expect(decision.question).not.toMatch(sycophantic);
      }
    }
  });

  it('el texto cuando hay error NUNCA atribuye a capacidad estable (P6/Weiner)', () => {
    const weinerForbidden = /no sos bueno|you're not good|no tenés cabeza|sos malo en/i;

    for (const errorType of ['conceptual', 'procedural', 'partial-correct'] as const) {
      const decision = decideFeedback({
        mode: 'socratic',
        errorType,
        attemptText: 'x',
        conceptName: 'cálculo diferencial',
        sourceTier: 'primary',
      });
      expect(decision.text).not.toMatch(weinerForbidden);
    }
  });
});
