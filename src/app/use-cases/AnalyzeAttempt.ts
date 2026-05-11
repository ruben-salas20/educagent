// src/app/use-cases/AnalyzeAttempt.ts
// Use case que invoca el LLM para clasificar una respuesta del estudiante
// en outcome + errorType. Aislado de SubmitAttempt: éste se enfoca en persistir
// y derivar mastery; AnalyzeAttempt se enfoca en *entender* la respuesta.
//
// Diseño:
// - Recibe responseText + contexto (itemPrompt, mode, conceptName).
// - Construye system prompt pedagógico que pide JSON estricto.
// - Llama llm.complete con temperature 0 y maxTokens 200 (clasificación corta).
// - Parsea el JSON (con tolerancia a markdown fences) y valida contra los enums.
// - Retorna Result<{outcome, errorType}, AnalyzeAttemptError>.
//
// Dependencias: solo ports + core. NO conoce adapters concretos.

import type { ILLMProvider, LLMError } from '../../ports/llm/ILLMProvider.js';
import type { Mode } from '../../core/value-objects/Mode.js';
import type { Outcome } from '../../core/value-objects/Outcome.js';
import type { ErrorType } from '../../core/value-objects/ErrorType.js';
import type { Result } from '../../core/result/Result.js';
import { ok, err } from '../../core/result/Result.js';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export interface AnalyzeAttemptInput {
  /** Texto del prompt/pregunta que vio el estudiante */
  readonly itemPrompt: string;
  /** Respuesta textual del estudiante */
  readonly responseText: string;
  /** Modo activo del agente */
  readonly mode: Mode;
  /** Nombre humano del concepto en juego */
  readonly conceptName: string;
}

export interface AnalyzeAttemptDependencies {
  readonly llm: ILLMProvider;
}

export interface AttemptAnalysis {
  readonly outcome: Outcome;
  readonly errorType: ErrorType | null;
}

export type AnalyzeAttemptError =
  | { kind: 'llm_failed'; cause: LLMError }
  | { kind: 'response_parse_failed'; cause: string; rawText: string }
  | { kind: 'response_invalid_enum'; cause: string; rawText: string };

const VALID_OUTCOMES: ReadonlyArray<Outcome> = [
  'correct',
  'partial',
  'incorrect',
  'skipped',
  'gave_up',
];

const VALID_ERROR_TYPES: ReadonlyArray<ErrorType> = [
  'conceptual',
  'procedural',
  'notational',
  'careless',
  'off-topic',
  'partial-correct',
];

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * System prompt que el LLM va a recibir. Pide JSON estructurado para parseo.
 * Bilingüe por construcción: el LLM detecta el idioma del responseText/itemPrompt
 * automáticamente. Las reglas están en español pero las claves del JSON son estables.
 */
function buildSystemPrompt(mode: Mode, conceptName: string): string {
  return [
    'Sos un evaluador pedagógico de EducAgent — un tutor inteligente con base psicopedagógica.',
    '',
    'Tu trabajo es analizar la respuesta de un estudiante a una pregunta sobre un concepto técnico y clasificarla en un JSON estricto.',
    '',
    'Devolvé ÚNICAMENTE un JSON válido con esta estructura exacta, sin texto adicional, sin markdown, sin code fences, sin comentarios:',
    '',
    '{',
    '  "outcome": "<uno de: correct | partial | incorrect | skipped | gave_up>",',
    '  "errorType": "<uno de: conceptual | procedural | notational | careless | off-topic | partial-correct | null>"',
    '}',
    '',
    'REGLAS PARA outcome:',
    '- "correct": la respuesta es esencialmente correcta y completa.',
    '- "partial": la respuesta tiene el concepto correcto pero falta detalle o cobertura sustancial.',
    '- "incorrect": la respuesta es factualmente errónea.',
    "- \"skipped\": la respuesta está vacía o solo dice \"no sé\" / \"idk\" / \"i don't know\" / \"paso\" / \"skip\".",
    '- "gave_up": la respuesta indica explícitamente que el estudiante quiere rendirse ("me rindo", "i give up").',
    '',
    'REGLAS PARA errorType:',
    '- "conceptual": el estudiante usa un constructo incorrecto o lo confunde con otro adyacente.',
    '- "procedural": el concepto está identificado bien pero los pasos/orden/sintaxis fallan.',
    '- "notational": error específico en notación (signos, formato, símbolos).',
    '- "careless": respuesta apurada con errores triviales que el estudiante seguramente reconoce.',
    '- "off-topic": respondió algo distinto de lo preguntado.',
    '- "partial-correct": correcto en parte pero le falta cobertura.',
    '- null: usá null cuando outcome es "correct", "skipped" o "gave_up" (no hay error que clasificar).',
    '',
    `MODO ACTIVO: ${mode}`,
    `CONCEPTO: ${conceptName}`,
    '',
    'Recordá: SOLO el JSON. Nada más. Sin "```json", sin explicación, sin texto antes o después.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers de parseo
// ---------------------------------------------------------------------------

/**
 * Quita code fences ```json ... ``` que algunos modelos insisten en agregar
 * pese al system prompt. Defensa adicional al parseo.
 */
function stripMarkdownFences(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  return t.trim();
}

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

/**
 * Invoca al LLM para clasificar la respuesta del estudiante en outcome + errorType.
 *
 * Garantías:
 * - Si el LLM falla (auth, rate_limit, network, etc.) → `llm_failed`.
 * - Si la respuesta no es JSON parseable → `response_parse_failed`.
 * - Si el JSON tiene un outcome o errorType fuera del enum permitido → `response_invalid_enum`.
 *
 * En caso de éxito retorna `AttemptAnalysis` con `outcome` siempre presente y
 * `errorType` que puede ser `null` (especialmente para outcomes 'correct',
 * 'skipped' o 'gave_up').
 */
export async function analyzeAttempt(
  input: AnalyzeAttemptInput,
  deps: AnalyzeAttemptDependencies,
): Promise<Result<AttemptAnalysis, AnalyzeAttemptError>> {
  const systemPrompt = buildSystemPrompt(input.mode, input.conceptName);
  const userMessage = [
    `Pregunta: ${input.itemPrompt}`,
    '',
    `Respuesta del estudiante: ${
      input.responseText.trim() === '' ? '<vacía>' : input.responseText
    }`,
  ].join('\n');

  const completion = await deps.llm.complete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    {
      // Determinismo para clasificación: queremos la misma respuesta ante
      // el mismo input siempre que sea posible.
      temperature: 0.0,
      // El JSON estructurado es muy corto; cap bajo para latency + costo.
      maxTokens: 200,
    },
  );

  if (!completion.ok) {
    return err({ kind: 'llm_failed', cause: completion.error });
  }

  const rawText = completion.value.text;
  const cleanText = stripMarkdownFences(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanText);
  } catch (e) {
    return err({
      kind: 'response_parse_failed',
      cause: e instanceof Error ? e.message : String(e),
      rawText,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return err({
      kind: 'response_parse_failed',
      cause: 'response is not a JSON object',
      rawText,
    });
  }

  const obj = parsed as Record<string, unknown>;
  const outcomeRaw = obj.outcome;
  const errorTypeRaw = obj.errorType;

  if (
    typeof outcomeRaw !== 'string' ||
    !VALID_OUTCOMES.includes(outcomeRaw as Outcome)
  ) {
    return err({
      kind: 'response_invalid_enum',
      cause: `outcome inválido: ${JSON.stringify(outcomeRaw)}`,
      rawText,
    });
  }

  let errorType: ErrorType | null = null;
  if (errorTypeRaw !== null && errorTypeRaw !== undefined) {
    if (
      typeof errorTypeRaw !== 'string' ||
      !VALID_ERROR_TYPES.includes(errorTypeRaw as ErrorType)
    ) {
      return err({
        kind: 'response_invalid_enum',
        cause: `errorType inválido: ${JSON.stringify(errorTypeRaw)}`,
        rawText,
      });
    }
    errorType = errorTypeRaw as ErrorType;
  }

  return ok({ outcome: outcomeRaw as Outcome, errorType });
}
