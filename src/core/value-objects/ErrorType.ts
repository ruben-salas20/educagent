// src/core/value-objects/ErrorType.ts
/**
 * Taxonomía de errores que el agente puede detectar en una respuesta del estudiante.
 * Usado por P1 (Feedback Formativo) para decidir qué tipo de feedback dar.
 * También se persiste en attempts.error_type (ver migration 0001_initial.sql).
 *
 * - conceptual: usa constructo incorrecto o lo confunde con uno adyacente
 * - procedural: concepto bien identificado, pero pasos/orden/sintaxis fallan
 * - notational: error en notación específica (signos, formato)
 * - careless: respuesta apurada, no leyó bien
 * - off-topic: respondió otra cosa
 * - partial-correct: correcto parcialmente pero le falta cobertura
 *
 * Nota: el blueprint de P1 menciona también 'transferencia' (aplicación a contexto
 * distinto), 'incompleta' (cubre <60%) y 'no-sé' (skip). Esos son derivables de
 * los anteriores o de otras señales (outcome=skipped), no entran como variantes
 * propias del type.
 */
export type ErrorType =
  | 'conceptual'
  | 'procedural'
  | 'notational'
  | 'careless'
  | 'off-topic'
  | 'partial-correct';
