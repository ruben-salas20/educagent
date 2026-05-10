// src/core/entities/Item.ts
// Ver docs/architecture/02-schema-sqlite.md §"CREATE TABLE items".

import type { Bloom } from '../value-objects/Bloom.js';
import type { Mode } from '../value-objects/Mode.js';

export type ItemOrigin = 'rag_curated' | 'bank_curated' | 'llm_improvised';
export type ItemValidityStatus = 'active' | 'under_review' | 'retired';

export interface Item {
  readonly id: string;
  readonly projectId: string;
  readonly promptText: string;
  readonly origin: ItemOrigin;
  readonly bloomLevel: Bloom;
  readonly modeAffinity: ReadonlyArray<Mode>;
  readonly expectedDifficulty: number; // 0..1
  readonly observedDifficulty: number | null; // cache lazy según D-A2
  readonly scaffoldLevelsAvailable: ReadonlyArray<number>;
  readonly validityStatus: ItemValidityStatus;
  readonly poolMembership: boolean;
  readonly conceptIds: ReadonlyArray<string>;
  readonly createdAt: string; // ISO 8601 UTC
  readonly updatedAt: string; // ISO 8601 UTC
}
