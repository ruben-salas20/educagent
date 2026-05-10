// src/core/entities/Concept.ts
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE concepts".

import type { Bloom } from '../value-objects/Bloom.js';

export type Granularity = 'section' | 'document' | 'atomic';

export interface Concept {
  readonly id: string;
  readonly projectId: string;
  readonly parentConceptId: string | null;
  readonly name: string;
  readonly granularity: Granularity;
  readonly bloomLevelsSeen: ReadonlyArray<Bloom>;
  readonly createdAt: string; // ISO 8601 UTC
}
