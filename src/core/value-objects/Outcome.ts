// src/core/value-objects/Outcome.ts
/**
 * Resultado de un Attempt sobre un Item.
 * 5-valued automático (D-S1): el agente lo deduce desde respuesta + scaffold_level_reached,
 * NO se pide rating explícito al usuario.
 */
export type Outcome = 'correct' | 'partial' | 'incorrect' | 'skipped' | 'gave_up';
