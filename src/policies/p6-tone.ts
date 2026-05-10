// src/policies/p6-tone.ts
// P6 — Tono, Persona y Lenguaje Atribucional (Weiner, 1985).
// Ver docs/research/01-politicas-operativas.md §P6 y docs/architecture/04-testing-setup.md.
//
// Función PURA: sin I/O, sin LLM, sin DB. Sólo strings + templates.
//
// Atribuciones a FOMENTAR (Weiner 1985): internas + controlables + inestables
//   → esfuerzo, estrategia, tiempo dedicado.
// Atribuciones a EVITAR: internas + estables + incontrolables
//   → capacidad innata ("sos inteligente", "you're smart", "no sos bueno en esto").

import type { Outcome } from '../core/value-objects/Outcome.js';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export type AttributionSituation =
  | 'achievement'
  | 'error'
  | 'effort_without_success'
  | 'abandonment'
  | 'return_after_pause';

export type AttributedTo = 'strategy' | 'effort' | 'time_spent' | 'process' | 'neutral';

export type Language = 'es' | 'en';

export interface BuildAttributionInput {
  readonly outcome: Outcome;
  /** Tiempo dedicado al ítem, en minutos. */
  readonly effortMinutes: number;
  /** Estrategia que el usuario usó (texto libre, ej: "descomposición"). */
  readonly strategy: string;
  readonly language: Language;
  /**
   * Situación contextual. Si no se pasa, se deduce de `outcome` + `effortMinutes`.
   * `return_after_pause` SIEMPRE debe pasarse explícitamente: no es deducible
   * desde outcome solo (requiere contexto de sesión que esta función no tiene).
   */
  readonly situation?: AttributionSituation;
}

export interface AttributionResult {
  readonly text: string;
  /** Atributo Weiner de la atribución elegida — para auditoría. */
  readonly attributedTo: AttributedTo;
  readonly language: Language;
}

// ---------------------------------------------------------------------------
// Constantes — umbral de "esfuerzo alto"
// ---------------------------------------------------------------------------

/**
 * Si effortMinutes >= HIGH_EFFORT_THRESHOLD_MIN, un outcome no-correcto deja
 * de leerse como "error sin más" y pasa a "esfuerzo sin acierto" (Weiner:
 * reforzar la atribución a esfuerzo + estrategia, no a capacidad).
 */
const HIGH_EFFORT_THRESHOLD_MIN = 10;

/**
 * Para acierto: si el usuario invirtió tiempo, se prefiere atribuir a
 * time_spent (también controlable+inestable). Si fue rápido, a strategy.
 */
const ACHIEVEMENT_TIME_SPENT_THRESHOLD_MIN = 5;

// ---------------------------------------------------------------------------
// Deducción de `situation`
// ---------------------------------------------------------------------------

function deriveSituation(outcome: Outcome, effortMinutes: number): AttributionSituation {
  if (outcome === 'correct') return 'achievement';
  if (outcome === 'skipped' || outcome === 'gave_up') return 'abandonment';
  // 'incorrect' | 'partial'
  return effortMinutes >= HIGH_EFFORT_THRESHOLD_MIN ? 'effort_without_success' : 'error';
}

// ---------------------------------------------------------------------------
// Builders por situación + idioma
// ---------------------------------------------------------------------------
//
// Cada builder retorna { text, attributedTo }. La función pública sólo añade
// `language`. Mantenemos la tabla cerca de las frases-fuente del blueprint
// para que un cambio editorial sea localizable en un único lugar.

interface PhraseAndAttr {
  readonly text: string;
  readonly attributedTo: AttributedTo;
}

function buildAchievement(
  effortMinutes: number,
  strategy: string,
  language: Language,
): PhraseAndAttr {
  const usedTimeAttribution = effortMinutes >= ACHIEVEMENT_TIME_SPENT_THRESHOLD_MIN;
  const minutes = Math.max(0, Math.round(effortMinutes));

  if (language === 'es') {
    return usedTimeAttribution
      ? {
          text: `Te llevó ${minutes} minutos pero llegaste.`,
          attributedTo: 'time_spent',
        }
      : {
          text: `Lo resolviste. La estrategia de ${strategy} funcionó acá.`,
          attributedTo: 'strategy',
        };
  }

  return usedTimeAttribution
    ? {
        text: `Took you ${minutes} minutes but you got there.`,
        attributedTo: 'time_spent',
      }
    : {
        text: `You solved it. The ${strategy} strategy worked here.`,
        attributedTo: 'strategy',
      };
}

function buildError(language: Language): PhraseAndAttr {
  if (language === 'es') {
    return {
      text: 'Esa estrategia no aplica para este caso.',
      attributedTo: 'strategy',
    };
  }
  return {
    text: "That strategy doesn't apply to this case.",
    attributedTo: 'strategy',
  };
}

function buildEffortWithoutSuccess(
  effortMinutes: number,
  strategy: string,
  language: Language,
): PhraseAndAttr {
  const minutes = Math.max(0, Math.round(effortMinutes));
  if (language === 'es') {
    return {
      text: `Trabajaste con esto ${minutes} minutos. La estrategia que probaste (${strategy}) tiene un agujero.`,
      attributedTo: 'effort',
    };
  }
  return {
    text: `You worked on this for ${minutes} minutes. The strategy you tried (${strategy}) has a gap.`,
    attributedTo: 'effort',
  };
}

function buildAbandonment(language: Language): PhraseAndAttr {
  if (language === 'es') {
    return {
      text: 'Cerraste sin terminar el ítem. Lo dejo en pendiente.',
      attributedTo: 'neutral',
    };
  }
  return {
    text: "You closed without finishing the item. I'll leave it pending.",
    attributedTo: 'neutral',
  };
}

function buildReturnAfterPause(language: Language): PhraseAndAttr {
  // Esta función no recibe contexto de sesión (días desde última sesión,
  // tema activo), por diseño: la frase concreta la compone el caller con
  // esos datos. Devolvemos una plantilla neutra orientadora.
  if (language === 'es') {
    return {
      text: 'Retomamos donde quedaste o arrancamos algo nuevo.',
      attributedTo: 'neutral',
    };
  }
  return {
    text: 'We can resume where you left off or start something new.',
    attributedTo: 'neutral',
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Construye una frase de feedback atribucional (Weiner) a partir del outcome
 * y el esfuerzo. NO emite halago vacío, NO atribuye a capacidad estable.
 *
 * Garantías (verificadas por tests):
 *  - Para `achievement`, la frase NUNCA contiene "inteligente" / "smart" /
 *    "good at".
 *  - Para `error` / `effort_without_success`, la frase NUNCA contiene
 *    "no sos bueno" / "not (a|an) X person".
 *  - Para `abandonment`, la frase NUNCA contiene "no te rindas" / "don't
 *    give up".
 *  - El texto es una sola línea (sin `\n`).
 */
export function buildAttribution(input: BuildAttributionInput): AttributionResult {
  const { outcome, effortMinutes, strategy, language } = input;
  const situation = input.situation ?? deriveSituation(outcome, effortMinutes);

  let phrase: PhraseAndAttr;
  switch (situation) {
    case 'achievement':
      phrase = buildAchievement(effortMinutes, strategy, language);
      break;
    case 'error':
      phrase = buildError(language);
      break;
    case 'effort_without_success':
      phrase = buildEffortWithoutSuccess(effortMinutes, strategy, language);
      break;
    case 'abandonment':
      phrase = buildAbandonment(language);
      break;
    case 'return_after_pause':
      phrase = buildReturnAfterPause(language);
      break;
    default:
      // Fallback defensivo: situation no estándar → neutro.
      phrase = {
        text:
          language === 'es'
            ? 'Seguimos con el próximo ítem.'
            : 'Moving on to the next item.',
        attributedTo: 'neutral',
      };
  }

  return {
    text: phrase.text,
    attributedTo: phrase.attributedTo,
    language,
  };
}
