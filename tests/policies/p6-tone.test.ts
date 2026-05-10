// tests/policies/p6-tone.test.ts
import { describe, it, expect } from 'vitest';
import { buildAttribution } from '../../src/policies/p6-tone.js';

describe('P6 — Lenguaje atribucional Weiner', () => {
  // -------------------------------------------------------------------------
  // Pin tests del blueprint (docs/architecture/04-testing-setup.md §P6)
  // -------------------------------------------------------------------------

  it('frente a acierto, atribuye a estrategia (controlable+inestable), no a inteligencia', () => {
    const phrase = buildAttribution({
      outcome: 'correct',
      effortMinutes: 3,
      strategy: 'descomposición',
      language: 'es',
    });
    expect(phrase.text).toMatch(/estrategia.+funcionó/i);
    expect(phrase.text).not.toMatch(/inteligente/i);
    expect(phrase.attributedTo).toBe('strategy');
  });

  it('frente a error, atribuye a estrategia inaplicable, no a capacidad', () => {
    const phrase = buildAttribution({
      outcome: 'incorrect',
      effortMinutes: 8,
      strategy: 'memorización',
      language: 'es',
    });
    expect(phrase.text).toMatch(/esa estrategia no aplica/i);
    expect(phrase.text).not.toMatch(/no sos bueno/i);
    expect(phrase.attributedTo).toBe('strategy');
  });

  // -------------------------------------------------------------------------
  // Achievement — variantes
  // -------------------------------------------------------------------------

  it('acierto con esfuerzo alto atribuye a tiempo invertido (no a estrategia)', () => {
    const phrase = buildAttribution({
      outcome: 'correct',
      effortMinutes: 12,
      strategy: 'descomposición',
      language: 'es',
    });
    expect(phrase.text).toMatch(/12 minutos.+llegaste/i);
    expect(phrase.attributedTo).toBe('time_spent');
    expect(phrase.text).not.toMatch(/inteligente|sos bueno|fácil/i);
  });

  it('acierto en EN atribuye a estrategia, sin "smart" ni "good at"', () => {
    const phrase = buildAttribution({
      outcome: 'correct',
      effortMinutes: 2,
      strategy: 'decomposition',
      language: 'en',
    });
    expect(phrase.text).toMatch(/strategy worked/i);
    expect(phrase.text).not.toMatch(/smart|good at/i);
    expect(phrase.language).toBe('en');
  });

  // -------------------------------------------------------------------------
  // Esfuerzo sin acierto (effortMinutes >= 10 y outcome no-correcto)
  // -------------------------------------------------------------------------

  it('esfuerzo sin acierto: incorrect + tiempo alto refuerza esfuerzo + estrategia con agujero', () => {
    const phrase = buildAttribution({
      outcome: 'incorrect',
      effortMinutes: 20,
      strategy: 'fuerza bruta',
      language: 'es',
    });
    expect(phrase.text).toMatch(/trabajaste.+20 minutos/i);
    expect(phrase.text).toMatch(/agujero/i);
    expect(phrase.text).not.toMatch(/buen intento|esfuerzo es lo que cuenta/i);
    expect(phrase.attributedTo).toBe('effort');
  });

  it('esfuerzo sin acierto en EN no usa "good try" vacío', () => {
    const phrase = buildAttribution({
      outcome: 'partial',
      effortMinutes: 15,
      strategy: 'brute force',
      language: 'en',
    });
    expect(phrase.text).toMatch(/worked on this for 15 minutes/i);
    expect(phrase.text).toMatch(/gap/i);
    expect(phrase.text).not.toMatch(/good try/i);
  });

  // -------------------------------------------------------------------------
  // Abandonment
  // -------------------------------------------------------------------------

  it('abandono (gave_up) es neutro, sin paternalismo', () => {
    const phrase = buildAttribution({
      outcome: 'gave_up',
      effortMinutes: 4,
      strategy: 'ninguna',
      language: 'es',
    });
    expect(phrase.text).toMatch(/cerraste sin terminar/i);
    expect(phrase.text).not.toMatch(/no te rindas/i);
    expect(phrase.attributedTo).toBe('neutral');
  });

  it('skipped también clasifica como abandonment en EN, sin "don\'t give up"', () => {
    const phrase = buildAttribution({
      outcome: 'skipped',
      effortMinutes: 1,
      strategy: 'none',
      language: 'en',
    });
    expect(phrase.text).toMatch(/closed without finishing/i);
    expect(phrase.text).not.toMatch(/don't give up/i);
    expect(phrase.attributedTo).toBe('neutral');
  });

  // -------------------------------------------------------------------------
  // Return after pause (situation explícita)
  // -------------------------------------------------------------------------

  it('retorno tras pausa devuelve plantilla neutra orientadora, no afecto vacío', () => {
    const phrase = buildAttribution({
      outcome: 'correct',
      effortMinutes: 0,
      strategy: '',
      language: 'es',
      situation: 'return_after_pause',
    });
    expect(phrase.text).toMatch(/retomamos|arrancamos algo nuevo/i);
    expect(phrase.text).not.toMatch(/te extrañé|welcome back/i);
    expect(phrase.attributedTo).toBe('neutral');
  });

  // -------------------------------------------------------------------------
  // Constraints duros (lista de evitadas)
  // -------------------------------------------------------------------------

  it('NUNCA emite frases de la lista de evitadas para acierto', () => {
    const variants: Array<{ effort: number; lang: 'es' | 'en' }> = [
      { effort: 1, lang: 'es' },
      { effort: 8, lang: 'es' },
      { effort: 1, lang: 'en' },
      { effort: 30, lang: 'en' },
    ];
    for (const v of variants) {
      const { text } = buildAttribution({
        outcome: 'correct',
        effortMinutes: v.effort,
        strategy: 'X',
        language: v.lang,
      });
      expect(text).not.toMatch(/inteligente|bueno en|smart|good at/i);
      expect(text).not.toMatch(/fácil cuando le agarrás la mano/i);
    }
  });

  it('el texto es siempre una sola línea (sin saltos internos)', () => {
    const cases: BuildAttributionInputLite[] = [
      { outcome: 'correct', effortMinutes: 3, strategy: 'X', language: 'es' },
      { outcome: 'incorrect', effortMinutes: 8, strategy: 'X', language: 'es' },
      { outcome: 'partial', effortMinutes: 15, strategy: 'X', language: 'en' },
      { outcome: 'gave_up', effortMinutes: 2, strategy: 'X', language: 'es' },
      { outcome: 'skipped', effortMinutes: 0, strategy: 'X', language: 'en' },
    ];
    for (const c of cases) {
      const { text } = buildAttribution(c);
      expect(text).not.toContain('\n');
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

// Alias local para evitar re-importar el tipo en cada caso del table-test.
type BuildAttributionInputLite = Parameters<typeof buildAttribution>[0];
