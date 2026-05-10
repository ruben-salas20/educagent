// tests/adapters/persistence/sqlite/migrations/runner.test.ts
import { describe, it, expect } from 'vitest';
import { openConnection } from '../../../../../src/adapters/persistence/sqlite/connection.js';
import { applyMigrations } from '../../../../../src/adapters/persistence/sqlite/migrations/runner.js';

const EXPECTED_TABLES = [
  '_migrations',
  '_privacy_purges',
  'affective_aggregates',
  'affective_logs',
  'attempts',
  'concept_node_links',
  'concept_source_anchors',
  'concepts',
  'curriculum_node_prereqs',
  'curriculum_nodes',
  'curriculums',
  'item_concepts',
  'item_sources',
  'items',
  'knowledge_sources',
  'mastery_states',
  'metacognitive_signals',
  'projects',
  'sessions',
  'source_attribution_logs',
  'source_attribution_refs',
];

const EXPECTED_VIEWS = ['item_bank_pool'];

const EXPECTED_TRIGGERS = ['attempts_no_update', 'attempts_no_delete'];

describe('applyMigrations', () => {
  it('aplica 0001_initial y crea todas las tablas + view + triggers', () => {
    const db = openConnection({ filename: ':memory:' });
    const result = applyMigrations(db);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.value.applied).toContain('0001_initial');

    // Tablas
    const tables = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    for (const t of EXPECTED_TABLES) {
      expect(tables, `falta tabla ${t}`).toContain(t);
    }

    // Views
    const views = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type='view'`).all() as Array<{
        name: string;
      }>
    ).map((r) => r.name);
    for (const v of EXPECTED_VIEWS) {
      expect(views).toContain(v);
    }

    // Triggers
    const triggers = (
      db
        .prepare(`SELECT name FROM sqlite_master WHERE type='trigger'`)
        .all() as Array<{ name: string }>
    ).map((r) => r.name);
    for (const tr of EXPECTED_TRIGGERS) {
      expect(triggers).toContain(tr);
    }

    db.close();
  });

  it('es idempotente: segunda corrida NO duplica', () => {
    const db = openConnection({ filename: ':memory:' });

    const first = applyMigrations(db);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('unreachable');
    expect(first.value.applied.length).toBeGreaterThan(0);

    const second = applyMigrations(db);
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error('unreachable');
    expect(second.value.applied).toEqual([]);

    // _migrations contiene exactamente las del primer run
    const rows = db.prepare(`SELECT id FROM _migrations ORDER BY id`).all() as Array<{
      id: string;
    }>;
    expect(rows.map((r) => r.id)).toEqual(first.value.applied);

    db.close();
  });

  it('cuenta total: 16 tablas de dominio + _migrations + _privacy_purges + 1 view', () => {
    const db = openConnection({ filename: ':memory:' });
    applyMigrations(db);

    const tableCount = (
      db.prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='table'`).get() as {
        c: number;
      }
    ).c;
    // 16 dominio + _migrations + _privacy_purges = 18
    expect(tableCount).toBe(18);

    const viewCount = (
      db.prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='view'`).get() as {
        c: number;
      }
    ).c;
    expect(viewCount).toBe(1);

    db.close();
  });
});
