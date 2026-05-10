// tests/app/bootstrap.test.ts
// Tests del helper bootstrap(). Usamos un IConfigStore stub para no tocar
// filesystem real — el flow read() -> buildContainer() es ortogonal al backend
// concreto del config.

import { describe, it, expect } from 'vitest';
import { bootstrap } from '../../src/app/bootstrap.js';
import type {
  IConfigStore,
  UserConfig,
  ConfigStoreError,
} from '../../src/ports/infra/IConfigStore.js';
import { ok, err, type Result } from '../../src/core/result/Result.js';

class StubConfigStore implements IConfigStore {
  constructor(
    private readonly readImpl: () => Promise<Result<UserConfig, ConfigStoreError>>,
    private readonly path: string = '/fake/.educagent/config.toml',
  ) {}
  configPath(): string {
    return this.path;
  }
  async read(): Promise<Result<UserConfig, ConfigStoreError>> {
    return this.readImpl();
  }
  async write(_config: UserConfig): Promise<Result<void, ConfigStoreError>> {
    return ok(undefined);
  }
}

const validConfig: UserConfig = {
  schemaVersion: 1,
  profile: {
    domain: 'programming',
    agentLanguage: 'auto',
    retentionLevel: 'strict',
  },
};

describe('bootstrap', () => {
  it('retorna container cuando el config existe (round-trip read + buildContainer)', async () => {
    const store = new StubConfigStore(async () => ok(validConfig));
    const result = await bootstrap(store, { sqliteFilename: ':memory:' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.userConfig).toEqual(validConfig);
    expect(result.value.db.open).toBe(true);
    result.value.db.close();
  });

  it('retorna config_missing con hint cuando no hay config en disco', async () => {
    const store = new StubConfigStore(async () =>
      err({ kind: 'not_found', path: '/fake/path' }),
    );
    const result = await bootstrap(store);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('config_missing');
    if (result.error.kind !== 'config_missing') return;
    expect(result.error.path).toBe('/fake/path');
    expect(result.error.hint).toContain('educagent init');
  });

  it('retorna config_invalid cuando el config tiene parse_error', async () => {
    const store = new StubConfigStore(async () =>
      err({ kind: 'parse_error', path: '/fake', cause: 'bad TOML' }),
    );
    const result = await bootstrap(store);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('config_invalid');
    if (result.error.kind !== 'config_invalid') return;
    expect(result.error.cause).toContain('parse_error');
  });

  it('retorna config_invalid cuando el config tiene schema_mismatch', async () => {
    const store = new StubConfigStore(async () =>
      err({ kind: 'schema_mismatch', expected: 1, got: 99 }),
    );
    const result = await bootstrap(store);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('config_invalid');
  });

  it('propaga errores de buildContainer como bootstrap_failed', async () => {
    const store = new StubConfigStore(async () => ok(validConfig));
    // Path con directorio padre inexistente: better-sqlite3 no crea
    // directorios, asi que open() falla y bootstrap envuelve el error.
    const bogusPath =
      process.platform === 'win32'
        ? 'Z:\\__educagent_no_existe__\\sub\\db.sqlite'
        : '/__educagent_no_existe__/sub/db.sqlite';
    const result = await bootstrap(store, { sqliteFilename: bogusPath });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('bootstrap_failed');
  });
});
