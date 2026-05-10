// src/core/value-objects/Bloom.ts
/**
 * Bloom level del Item (D-A2). Coincide con el CHECK constraint de items.bloom_level.
 * Nota: el `bloom_target` de CurriculumNode usa otro vocabulario
 * ('understand'|'apply'|'analyze'|'evaluate'|'create'); ese se modelará aparte si hace falta.
 */
export type Bloom = 'recall' | 'recognition' | 'application' | 'transfer' | 'analysis';
