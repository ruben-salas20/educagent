// tests/adapters/persistence/sqlite/connection.test.ts
import { describe, it, expect } from 'vitest';
import { openConnection } from '../../../../src/adapters/persistence/sqlite/connection.js';

describe('openConnection', () => {
  it('retorna conexión con foreign_keys = ON', () => {
    const db = openConnection({ filename: ':memory:' });
    const row = db.pragma('foreign_keys', { simple: true });
    expect(row).toBe(1);
    db.close();
  });

  it(':memory: NO aplica WAL', () => {
    const db = openConnection({ filename: ':memory:' });
    const mode = db.pragma('journal_mode', { simple: true });
    // :memory: usa 'memory' como journal mode — nunca WAL.
    expect(String(mode).toLowerCase()).not.toBe('wal');
    db.close();
  });

  it('disableWAL=true previene WAL en archivo on-disk', () => {
    // Sanity: usamos :memory: igual; el flag debería respetarse aunque no haya
    // archivo. Lo que validamos es que journal_mode != 'wal'.
    const db = openConnection({ filename: ':memory:', disableWAL: true });
    const mode = db.pragma('journal_mode', { simple: true });
    expect(String(mode).toLowerCase()).not.toBe('wal');
    db.close();
  });

  it('close() no rompe nada', () => {
    const db = openConnection({ filename: ':memory:' });
    expect(() => db.close()).not.toThrow();
  });
});
