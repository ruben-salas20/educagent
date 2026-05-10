// tests/policies/p3-anti-sycophancy.test.ts
import { describe, it, expect } from 'vitest';
import {
  detectSycophancy,
  sanitizeOutput,
  handleInsistence,
} from '../../src/policies/p3-anti-sycophancy.js';

describe('P3 — Anti-sycophancy regex bilingüe', () => {
  const sycophantic_es = [
    '¡Excelente pregunta! Veamos...',
    'Qué buena observación tuviste.',
    'Tenés toda la razón, no me había dado cuenta.',
    'Sos muy inteligente para haber pensado en eso.',
    'Perfecto, eso es exactamente.',
  ];

  const sycophantic_en = [
    'Great question! Let me explain...',
    "You're absolutely right.",
    'I love how you think about this.',
    'Brilliant! Amazing insight.',
  ];

  const acceptable_recognition = [
    'Identificaste correctamente la variable independiente.',
    'You identified the bug correctly.',
    'Esa parte está. Falta el manejo del caso vacío.',
    'Tu hipótesis es plausible. Verifiquémosla.',
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
      insistenceCount: 3,
    });
    expect(decision.cedes).toBe(false);
    expect(decision.text).toMatch(/cita.+fuente/i);
  });
});
