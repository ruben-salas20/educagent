// tests/adapters/persistence/sqlite/SqliteAttemptRepository.integration.test.ts
// Integration tests con SQLite real en :memory:. Validan:
// - happy path save/find
// - orden cronológico de findBySessionId
// - trigger SQL append-only (UPDATE bloqueado)
// - duplicate id → duplicate_id
// - FK violation → foreign_key_violation
// - not_found

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openConnection } from '../../../../src/adapters/persistence/sqlite/connection.js';
import { applyMigrations } from '../../../../src/adapters/persistence/sqlite/migrations/runner.js';
import { SqliteAttemptRepository } from '../../../../src/adapters/persistence/sqlite/SqliteAttemptRepository.js';
import type { Attempt } from '../../../../src/core/entities/Attempt.js';

const PROJECT_ID = 'proj-1';
const SESSION_ID = 'sess-1';
const ITEM_ID = 'item-1';

function seedFixtures(db: Database.Database): void {
  const now = '2026-05-10T00:00:00.000Z';

  db.prepare(
    `INSERT INTO projects (id, name, created_at, last_active_at) VALUES (?, ?, ?, ?)`,
  ).run(PROJECT_ID, 'Test project', now, now);

  db.prepare(
    `INSERT INTO sessions (id, project_id, started_at) VALUES (?, ?, ?)`,
  ).run(SESSION_ID, PROJECT_ID, now);

  db.prepare(
    `INSERT INTO items (id, project_id, prompt_text, origin, bloom_level, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(ITEM_ID, PROJECT_ID, '¿Qué es X?', 'rag_curated', 'recall', now, now);
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'att-1',
    projectId: PROJECT_ID,
    sessionId: SESSION_ID,
    itemId: ITEM_ID,
    mode: 'socratic',
    startedAt: '2026-05-10T00:00:00.000Z',
    submittedAt: '2026-05-10T00:00:30.000Z',
    latencyMs: 30_000,
    responseText: 'una respuesta',
    outcome: 'correct',
    scaffoldLevelReached: 0,
    scaffoldRequestedBy: null,
    errorType: null,
    preConfidence: null,
    postConfidence: null,
    retryCount: 0,
    affectiveSnapshot: {},
    ...overrides,
  };
}

let db: Database.Database;
let repo: SqliteAttemptRepository;

beforeEach(() => {
  db = openConnection({ filename: ':memory:' });
  const r = applyMigrations(db);
  if (!r.ok) throw new Error(`migrations failed: ${JSON.stringify(r.error)}`);
  seedFixtures(db);
  repo = new SqliteAttemptRepository(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteAttemptRepository.save / findById', () => {
  it('persiste un Attempt y lo recupera idéntico', async () => {
    const a = makeAttempt({ affectiveSnapshot: { latencyZ: 1.2 } });
    const saveR = await repo.save(a);
    expect(saveR.ok).toBe(true);

    const findR = await repo.findById(a.id);
    expect(findR.ok).toBe(true);
    if (!findR.ok) throw new Error('unreachable');
    expect(findR.value).toEqual(a);
  });

  it('findById de id inexistente retorna not_found', async () => {
    const r = await repo.findById('no-existe');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('not_found');
  });
});

describe('SqliteAttemptRepository.findBySessionId', () => {
  it('retorna attempts en orden cronológico ascendente', async () => {
    const a1 = makeAttempt({
      id: 'att-1',
      startedAt: '2026-05-10T00:00:00.000Z',
      submittedAt: '2026-05-10T00:00:10.000Z',
    });
    const a2 = makeAttempt({
      id: 'att-2',
      startedAt: '2026-05-10T00:01:00.000Z',
      submittedAt: '2026-05-10T00:01:10.000Z',
    });
    const a3 = makeAttempt({
      id: 'att-3',
      startedAt: '2026-05-10T00:00:30.000Z',
      submittedAt: '2026-05-10T00:00:40.000Z',
    });
    // Insertar fuera de orden
    await repo.save(a2);
    await repo.save(a1);
    await repo.save(a3);

    const r = await repo.findBySessionId(SESSION_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value.map((a) => a.id)).toEqual(['att-1', 'att-3', 'att-2']);
  });

  it('retorna [] cuando no hay attempts en la sesión', async () => {
    const r = await repo.findBySessionId(SESSION_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('unreachable');
    expect(r.value).toEqual([]);
  });
});

describe('SqliteAttemptRepository — append-only enforcement', () => {
  it('TRIGGER bloquea UPDATE directo sobre attempts (defense in depth)', async () => {
    const a = makeAttempt();
    await repo.save(a);

    // Bypass del adapter: UPDATE directo sobre la conexión raw.
    expect(() =>
      db.prepare(`UPDATE attempts SET outcome = 'incorrect' WHERE id = ?`).run(a.id),
    ).toThrow(/immutable|updates not allowed/i);
  });

  it('TRIGGER bloquea DELETE directo sin entry en _privacy_purges', async () => {
    const a = makeAttempt();
    await repo.save(a);

    expect(() => db.prepare(`DELETE FROM attempts WHERE id = ?`).run(a.id)).toThrow(
      /privacy purge|only be deleted/i,
    );
  });

  it('save con id duplicado retorna duplicate_id', async () => {
    const a = makeAttempt();
    const r1 = await repo.save(a);
    expect(r1.ok).toBe(true);

    const r2 = await repo.save(a);
    expect(r2.ok).toBe(false);
    if (r2.ok) throw new Error('unreachable');
    expect(r2.error.kind).toBe('duplicate_id');
  });

  it('save con session_id inexistente retorna foreign_key_violation', async () => {
    const a = makeAttempt({ sessionId: 'sess-no-existe' });
    const r = await repo.save(a);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.error.kind).toBe('foreign_key_violation');
  });
});
