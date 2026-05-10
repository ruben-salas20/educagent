// src/policies/p4-off-ramps.ts
// P4 — Off-Ramps y Acoplamientos entre Modos.
// Ver docs/research/01-politicas-operativas.md §P4 (disparadores, umbrales,
// frases, mapa de transiciones) y docs/architecture/04-testing-setup.md §P4
// (3 tests pin).
//
// Funciones PURAS: sin I/O, sin LLM, sin DB. Solo lookup en tabla + comparación
// de umbrales. La detección textual de "fluency illusion" la hace el caller
// (regex bilingüe sobre el texto del usuario) y emite los flags ya
// pre-clasificados.

import type { Mode } from '../core/value-objects/Mode.js';

// ---------------------------------------------------------------------------
// Off-ramp forzado Explorador → retrieval
// ---------------------------------------------------------------------------

/**
 * Flags de "fluency illusion" detectados en los últimos turnos del usuario.
 * Cada token corresponde a una expresión del usuario sin output cognitivo propio.
 * Ej: ['ya_entendi', 'ya_entendi', 'claro'] = 3 expresiones de comprensión
 * sin que el usuario haya producido contenido sustantivo.
 *
 * Detección textual: el caller usa regex bilingüe sobre el texto del usuario
 * y emite el flag correspondiente. Esta función NO hace regex matching ella
 * misma — recibe los flags ya pre-clasificados.
 */
export type FluencyIllusionFlag =
  | 'ya_entendi' // "ya entendí", "got it"
  | 'claro' // "claro!", "now i get it"
  | 'requested_summary' // usuario pidió resumen al agente
  | 'dale'; // "dale", aceptación pasiva

export interface OffRampInput {
  readonly currentMode: Mode;
  /** Tokens emitidos por el agente desde el último retrieval del usuario */
  readonly tokensSinceLastRetrieval: number;
  /** Conceptos nuevos introducidos en el segmento actual */
  readonly newConceptsIntroduced: number;
  /** Minutos transcurridos desde el último retrieval */
  readonly minutesSinceLastRetrieval: number;
  /** Flags de comprensión declarada sin producción propia */
  readonly fluencyIllusionFlags: ReadonlyArray<FluencyIllusionFlag>;
}

export type OffRampReason =
  | 'token_budget_exceeded' // >1500 tokens
  | 'new_concepts_threshold' // ≥3 conceptos nuevos
  | 'time_threshold' // >20 min sin retrieval
  | 'fluency_illusion_detected' // ≥2 flags del mismo tipo o requested_summary
  | 'not_applicable_mode' // currentMode no es 'explorer'
  | 'below_thresholds'; // ningún disparador activo

export interface OffRampDecision {
  /** True si el agente debe forzar un mini-quiz de retrieval AHORA */
  readonly trigger: boolean;
  /** Razón del disparo (o por qué no dispara) */
  readonly reason: OffRampReason;
  /** Texto a emitir al usuario (vacío si trigger=false) */
  readonly text: string;
  /** Cantidad sugerida de preguntas de retrieval */
  readonly questionCount: number;
}

// Umbrales del blueprint (todos [heurística operativa]).
const TOKEN_BUDGET_LIMIT = 1500;
const NEW_CONCEPTS_LIMIT = 3;
const NEW_CONCEPTS_HIGH = 5;
const TIME_LIMIT_MINUTES = 20;
const FLUENCY_REPEAT_THRESHOLD = 2;

const OFF_RAMP_TEXT_ES =
  'Antes de seguir — quiero chequear que esto te quedó. 2 preguntas rápidas.';

/**
 * Detecta si los flags de fluency illusion superan el umbral.
 * Dispara si:
 *   - 'requested_summary' aparece al menos 1 vez (señal fuerte), O
 *   - cualquier otro flag aparece ≥ FLUENCY_REPEAT_THRESHOLD veces.
 */
function hasFluencyIllusion(flags: ReadonlyArray<FluencyIllusionFlag>): boolean {
  if (flags.includes('requested_summary')) {
    return true;
  }
  const counts = new Map<FluencyIllusionFlag, number>();
  for (const flag of flags) {
    counts.set(flag, (counts.get(flag) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= FLUENCY_REPEAT_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Decide si el agente debe forzar un off-ramp a retrieval.
 * Aplica SOLO al modo 'explorer' — los otros modos retornan trigger=false con
 * reason='not_applicable_mode'. Para off-ramps en otros modos (cascada en
 * Simulacro, productive failure en Arquitecto), ver funciones separadas más abajo.
 *
 * Umbrales del blueprint (todos `[heurística operativa]`):
 * - tokens > 1500
 * - conceptos nuevos ≥ 3
 * - minutos > 20
 * - fluencyIllusionFlags: ≥2 del mismo tipo OR 'requested_summary' presente
 *
 * Prioridad de razones (si hay múltiples disparadores activos):
 * 1. fluency_illusion_detected (señal más fuerte de problema pedagógico)
 * 2. token_budget_exceeded
 * 3. new_concepts_threshold
 * 4. time_threshold
 */
export function shouldForceRetrievalOffRamp(input: OffRampInput): OffRampDecision {
  if (input.currentMode !== 'explorer') {
    return {
      trigger: false,
      reason: 'not_applicable_mode',
      text: '',
      questionCount: 0,
    };
  }

  const fluencyHit = hasFluencyIllusion(input.fluencyIllusionFlags);
  const tokenHit = input.tokensSinceLastRetrieval > TOKEN_BUDGET_LIMIT;
  const conceptsHit = input.newConceptsIntroduced >= NEW_CONCEPTS_LIMIT;
  const timeHit = input.minutesSinceLastRetrieval > TIME_LIMIT_MINUTES;

  // Si conceptos nuevos altos, ofrecer 3 preguntas en vez de 2.
  const questionCount = input.newConceptsIntroduced >= NEW_CONCEPTS_HIGH ? 3 : 2;

  let reason: OffRampReason | null = null;
  if (fluencyHit) {
    reason = 'fluency_illusion_detected';
  } else if (tokenHit) {
    reason = 'token_budget_exceeded';
  } else if (conceptsHit) {
    reason = 'new_concepts_threshold';
  } else if (timeHit) {
    reason = 'time_threshold';
  }

  if (reason === null) {
    return {
      trigger: false,
      reason: 'below_thresholds',
      text: '',
      questionCount: 0,
    };
  }

  return {
    trigger: true,
    reason,
    text: OFF_RAMP_TEXT_ES,
    questionCount,
  };
}

// ---------------------------------------------------------------------------
// Cascada de errores en Simulacro → Explorador
// ---------------------------------------------------------------------------

export interface SimulacroCascadeInput {
  readonly consecutiveErrors: number;
  readonly errorTypesInCascade: ReadonlyArray<
    'conceptual' | 'procedural' | 'transferencia' | 'notational' | 'other'
  >;
  readonly sameConceptRepeated: boolean;
}

export type SimulacroCascadeAction =
  | 'continue' // no pausar
  | 'pause_offer_explorador' // sugerir pausar y volver a Explorador
  | 'pause_user_override'; // usuario ya rechazó pausa, continuar registrando

export interface SimulacroCascadeDecision {
  readonly action: SimulacroCascadeAction;
  readonly reason: string;
  readonly text: string; // texto a emitir si action != 'continue'
}

const CASCADE_THRESHOLD = 3;
const PAUSE_TEXT_ES =
  'Veo que se acumularon errores conceptuales/procedimentales en este tramo. ' +
  '¿Pausamos el simulacro y volvemos a Explorador para reforzar la base? ' +
  'Si preferís seguir, lo registro y continuamos.';

/**
 * Lógica del blueprint:
 * IF in_simulacro AND consecutive_errors >= 3
 *    AND error_type in {conceptual, procedural}
 *    AND not_same_concept_repeated:
 *   -- la base está débil, no es item difícil
 *   PAUSE simulacro, ofrecer Explorador
 *
 * No pausar si:
 * - Errores son del mismo concepto (ítem mal calibrado para ZDP)
 * - Errores son de transferencia (esperado en simulacro)
 */
export function shouldPauseSimulacro(
  input: SimulacroCascadeInput,
): SimulacroCascadeDecision {
  if (input.consecutiveErrors < CASCADE_THRESHOLD) {
    return {
      action: 'continue',
      reason: 'below_cascade_threshold',
      text: '',
    };
  }

  // Si todos los errores son del mismo concepto, no es base débil —
  // probablemente ítem mal calibrado para la ZDP del usuario.
  if (input.sameConceptRepeated) {
    return {
      action: 'continue',
      reason: 'same_concept_repeated_likely_miscalibrated',
      text: '',
    };
  }

  // Si todos los errores en la cascada son de transferencia, es esperado
  // en simulacro (mide aplicación a contexto nuevo) — no pausar.
  const hasNonTransferenciaError = input.errorTypesInCascade.some(
    (e) => e !== 'transferencia',
  );
  if (!hasNonTransferenciaError) {
    return {
      action: 'continue',
      reason: 'all_transferencia_expected_in_simulacro',
      text: '',
    };
  }

  // Necesitamos al menos un error conceptual o procedural para pausar
  // (el blueprint exige base débil, no errores casuales/notacionales/other).
  const hasBaseError = input.errorTypesInCascade.some(
    (e) => e === 'conceptual' || e === 'procedural',
  );
  if (!hasBaseError) {
    return {
      action: 'continue',
      reason: 'no_base_error_in_cascade',
      text: '',
    };
  }

  return {
    action: 'pause_offer_explorador',
    reason: 'base_weakness_detected',
    text: PAUSE_TEXT_ES,
  };
}

// ---------------------------------------------------------------------------
// Mapa de transiciones entre modos
// ---------------------------------------------------------------------------

export type TransitionType = 'manual' | 'forced' | 'blocked';

export interface TransitionMatrix {
  readonly socratic: Record<Mode, TransitionType>;
  readonly architect: Record<Mode, TransitionType>;
  readonly simulacro: Record<Mode, TransitionType>;
  readonly explorer: Record<Mode, TransitionType>;
}

/**
 * Retorna el mapa estático de transiciones permitidas/forzadas/bloqueadas
 * entre modos. Del blueprint §"P4 → Mapa de transiciones permitidas/forzadas".
 *
 * "manual"  = sólo el usuario lo dispara
 * "forced"  = sistema propone, usuario acepta o declina
 * "blocked" = no permitido (ej: durante simulacro no se puede ir a Socrático)
 *
 * Diagonal (mismo modo → mismo modo) se trata como 'manual' (no-op desde la
 * perspectiva del usuario: pedirlo no rompe nada, simplemente no transiciona).
 *
 * Notas del blueprint:
 *  - Desde Simulacro NO se puede ir a Socrático ni a Arquitecto: rompería la
 *    integridad de la evaluación. Sólo se puede salir a Explorador (off-ramp
 *    de cascada, forced) o terminar el simulacro (manual).
 *  - Explorador → otros modos: siempre manual (off-ramp es a retrieval dentro
 *    del mismo modo, no a otro modo).
 *  - Arquitecto → Simulacro: forced cuando el plan está completo y el sistema
 *    propone testearlo.
 */
export function getTransitionMatrix(): TransitionMatrix {
  return {
    socratic: {
      socratic: 'manual',
      architect: 'manual',
      simulacro: 'manual',
      explorer: 'forced', // off-ramp socrático: si el usuario no progresa, el sistema propone bajar a Explorador
    },
    architect: {
      socratic: 'manual',
      architect: 'manual',
      simulacro: 'forced', // plan completo → sistema propone testearlo
      explorer: 'manual',
    },
    simulacro: {
      socratic: 'blocked', // rompe integridad del test
      architect: 'blocked', // rompe integridad del test
      simulacro: 'manual',
      explorer: 'forced', // cascada de errores → sistema propone pausar
    },
    explorer: {
      socratic: 'manual',
      architect: 'manual',
      simulacro: 'manual',
      explorer: 'manual',
    },
  };
}
