// src/ports/infra/IClock.ts
/**
 * Reloj inyectable. Crítico para tests deterministas — el use case nunca
 * llama a `new Date()` directamente, siempre pasa por IClock.
 */
export interface IClock {
  now(): Date;
}
