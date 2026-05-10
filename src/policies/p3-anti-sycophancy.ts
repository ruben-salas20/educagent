// src/policies/p3-anti-sycophancy.ts
// P3 — Anti-Sycophancy y Disenso Explícito.
// Ver docs/research/01-politicas-operativas.md §P3 y docs/architecture/04-testing-setup.md.
//
// Funciones PURAS: sin I/O, sin LLM, sin DB. Solo strings + regex.

import type { ConfidenceTier } from '../core/value-objects/ConfidenceTier.js';

/**
 * Lista negra bilingüe (ES + EN). Cada entrada tiene:
 *  - `pattern`: regex case-insensitive ya anchored / con flanqueo para reducir falsos positivos.
 *  - `id`: identificador estable para reporting / sanitize.
 *
 * Diseño: usamos word-boundaries (`\b`) o contexto de inicio/puntuación
 * para evitar comer falsos positivos dentro de palabras inocentes
 * (ej. "perfectamente" NO debe matchear "perfecto").
 */
interface BlacklistEntry {
  readonly id: string;
  readonly pattern: RegExp;
}

// Patterns ES
const ES_PATTERNS: ReadonlyArray<BlacklistEntry> = [
  { id: 'es.excelente_pregunta', pattern: /excelente\s+pregunta/i },
  { id: 'es.buena_pregunta', pattern: /buena\s+pregunta/i },
  { id: 'es.que_buena_observacion', pattern: /qu[eé]\s+buena\s+observaci[oó]n/i },
  { id: 'es.me_encanta', pattern: /me\s+encanta\s+(que|c[oó]mo)\b/i },
  {
    id: 'es.sos_muy_adj',
    pattern: /\bsos\s+muy\s+(inteligente|sharp|insightful|brillante|genial)\b/i,
  },
  { id: 'es.tenes_toda_la_razon', pattern: /ten[eé]s\s+toda\s+la\s+raz[oó]n/i },
  // "exactamente" como respuesta única / enfática (con !). Evitamos matchear
  // "exactamente la mitad" en frases neutras pero capturamos "exactamente!" y
  // "eso es exactamente." al final de oración.
  { id: 'es.exactamente_enfatico', pattern: /\bexactamente\s*[!.]/i },
  // TODO: refinar contexto-aware. Por ahora "perfecto" como palabra independiente
  // (con word boundary) matchea — se aceptan falsos positivos sobre uso parcial
  // hasta que tengamos un detector de contexto-de-corrección.
  { id: 'es.perfecto', pattern: /\bperfecto\b/i },
  { id: 'es.genial', pattern: /\bgenial\b/i },
  { id: 'es.brillante', pattern: /\bbrillante\b/i },
];

// Patterns EN
const EN_PATTERNS: ReadonlyArray<BlacklistEntry> = [
  { id: 'en.great_question', pattern: /great\s+question/i },
  { id: 'en.good_question', pattern: /good\s+question/i },
  { id: 'en.great_point', pattern: /great\s+point/i },
  { id: 'en.excellent_point', pattern: /excellent\s+point/i },
  { id: 'en.i_love', pattern: /\bi\s+love\s+(how|that)\b/i },
  {
    id: 'en.youre_very_adj',
    pattern: /\byou(?:'re|\s+are)\s+(very|so)\s+(smart|sharp|insightful)\b/i,
  },
  { id: 'en.youre_absolutely_right', pattern: /\byou(?:'re|\s+are)\s+absolutely\s+right\b/i },
  { id: 'en.exactly_enfatico', pattern: /\bexactly\s*!/i },
  // TODO: refinar contexto-aware (idem ES).
  { id: 'en.perfect', pattern: /\bperfect\b/i },
  { id: 'en.brilliant', pattern: /\bbrilliant\b/i },
  { id: 'en.awesome', pattern: /\bawesome\b/i },
  { id: 'en.amazing', pattern: /\bamazing\b/i },
];

const BLACKLIST: ReadonlyArray<BlacklistEntry> = [...ES_PATTERNS, ...EN_PATTERNS];

// ---------------------------------------------------------------------------
// detectSycophancy
// ---------------------------------------------------------------------------

export interface SycophancyDetection {
  readonly hit: boolean;
  readonly matchedPattern?: string;
}

/**
 * Detecta sycophancy en `text`. Devuelve la primera coincidencia hallada (id).
 * Match case-insensitive (las regex ya tienen flag `i`).
 */
export function detectSycophancy(text: string): SycophancyDetection {
  for (const entry of BLACKLIST) {
    if (entry.pattern.test(text)) {
      return { hit: true, matchedPattern: entry.id };
    }
  }
  return { hit: false };
}

// ---------------------------------------------------------------------------
// sanitizeOutput
// ---------------------------------------------------------------------------

/**
 * Remueve las frases sycophantic preservando el contenido pedagógico.
 *
 * Estrategia conservadora:
 *  1. Eliminar segmentos sycophantic anclados a inicio + puntuación corta
 *     (ej. "Excelente pregunta. ", "Great question! ", "Perfecto, ").
 *  2. Si nada matcheó en el paso 1 pero detectSycophancy() hit, hacer un
 *     replace puntual de cada pattern por '' y limpiar espacios duplicados.
 *
 * No intenta reformular contenido — solo recorta inflación afectiva.
 */
export function sanitizeOutput(text: string): string {
  let out = text;

  // Paso 1: segmentos sycophantic al inicio o tras puntuación, hasta el
  // siguiente separador fuerte (`.`, `!`, `,`).
  const LEADING_SYCOPHANTIC_SEGMENT =
    /(^|[.!?]\s+)\s*[¡!]?\s*(excelente\s+pregunta|buena\s+pregunta|qu[eé]\s+buena\s+observaci[oó]n|tenés\s+toda\s+la\s+razón|tenes\s+toda\s+la\s+razon|great\s+question|good\s+question|great\s+point|excellent\s+point|you(?:'re|\s+are)\s+absolutely\s+right|brilliant|awesome|amazing|genial|brillante|perfecto|perfect|exactamente|exactly)\b[^.!?]*[.!?,]?\s*/gi;

  out = out.replace(LEADING_SYCOPHANTIC_SEGMENT, (_match, prefix: string) => prefix ?? '');

  // Paso 2: fallback — si todavía detecta sycophancy, reemplazar patterns
  // sueltos por '' y limpiar.
  if (detectSycophancy(out).hit) {
    for (const entry of BLACKLIST) {
      out = out.replace(new RegExp(entry.pattern.source, 'gi'), '');
    }
  }

  // Limpieza final: dobles espacios, espacios antes de puntuación, leading punctuation.
  out = out.replace(/\s+([.,!?])/g, '$1');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/^[\s,.!?¡]+/, '');
  out = out.trim();

  return out;
}

// ---------------------------------------------------------------------------
// handleInsistence
// ---------------------------------------------------------------------------

export interface InsistenceInput {
  readonly userTurn: string;
  readonly agentEvidence: { readonly tier: ConfidenceTier; readonly source: string } | null;
  readonly insistenceCount: number;
}

export interface InsistenceDecision {
  readonly cedes: boolean;
  readonly text: string;
}

/**
 * Reglas de disenso bajo presión del usuario (P3, Caso 3).
 *
 *  - Si hay evidencia primary/secondary (RAG/Web), el agente NO cede,
 *    y emite cita explícita de la fuente.
 *  - Si solo hay evidencia tertiary (LLM/GK), tras N>=3 insistencias el
 *    agente cede con humildad epistémica (admite incertidumbre).
 *
 * Constraint crítico (P3): el agente NUNCA cede a la insistencia si tiene
 * evidencia. Sharma et al. (2023), SycEval (2025).
 */
export function handleInsistence(input: InsistenceInput): InsistenceDecision {
  const { agentEvidence, insistenceCount } = input;

  // Caso A: hay evidencia primary o secondary -> NO cede, cita fuente.
  if (agentEvidence && (agentEvidence.tier === 'primary' || agentEvidence.tier === 'secondary')) {
    return {
      cedes: false,
      text:
        `Estamos en bucle. Te muestro la cita de la fuente: [${agentEvidence.source}]. ` +
        `Si ves algo que la contradiga, mostrámelo. Sino, sigamos.`,
    };
  }

  // Caso B: solo evidencia tertiary (LLM) o ninguna.
  //   - Antes de 3 insistencias: mantiene posición con disclaimer.
  //   - Desde 3 insistencias en adelante: humildad epistémica (cede con disclaimer).
  if (insistenceCount >= 3) {
    return {
      cedes: true,
      text:
        'No tengo una fuente primaria que respalde mi posición — solo conocimiento general. ' +
        'Si tu fuente es correcta, mi posición cambia. Verifiquemos juntos.',
    };
  }

  return {
    cedes: false,
    text:
      'Mi posición se basa en conocimiento general, no en una fuente primaria. ' +
      'Si tenés un material que diga lo contrario, traélo y lo revisamos.',
  };
}
