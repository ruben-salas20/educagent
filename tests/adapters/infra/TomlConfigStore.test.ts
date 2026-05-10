// tests/adapters/infra/TomlConfigStore.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TomlConfigStore } from '../../../src/adapters/infra/TomlConfigStore.js';
import type { UserConfig } from '../../../src/ports/infra/IConfigStore.js';

describe('TomlConfigStore', () => {
  let baseDir: string;
  let store: TomlConfigStore;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'educagent-test-'));
    store = new TomlConfigStore(baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  const defaultConfig: UserConfig = {
    schemaVersion: 1,
    profile: {
      domain: 'programming',
      agentLanguage: 'auto',
      retentionLevel: 'strict',
    },
  };

  it('configPath retorna la ruta absoluta dentro del baseDir', () => {
    expect(store.configPath()).toBe(join(baseDir, 'config.toml'));
  });

  it('read sin archivo retorna not_found', async () => {
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not_found');
    if (result.error.kind !== 'not_found') return;
    expect(result.error.path).toBe(store.configPath());
  });

  it('write + read round trip preserva los valores', async () => {
    const writeResult = await store.write(defaultConfig);
    expect(writeResult.ok).toBe(true);

    const readResult = await store.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value).toEqual(defaultConfig);
  });

  it('write incluye header con timestamp ISO en el archivo TOML', async () => {
    await store.write(defaultConfig);
    const raw = await readFile(store.configPath(), 'utf-8');
    expect(raw).toContain('# EducAgent global config');
    expect(raw).toContain('# Creado por `educagent init`');
    // ISO timestamp pattern básico (YYYY-MM-DDTHH:MM:SS)
    expect(raw).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('write crea el directorio padre si no existe', async () => {
    const deeperStore = new TomlConfigStore(join(baseDir, 'nested', 'deeper'));
    const result = await deeperStore.write({
      schemaVersion: 1,
      profile: { domain: 'math', agentLanguage: 'es', retentionLevel: 'standard' },
    });
    expect(result.ok).toBe(true);

    const readResult = await deeperStore.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.profile.domain).toBe('math');
  });

  it('write preserva extras en round trip', async () => {
    const withExtras: UserConfig = {
      ...defaultConfig,
      extras: { telemetry: false, provider: 'anthropic' },
    };
    await store.write(withExtras);
    const readResult = await store.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.extras).toEqual({ telemetry: false, provider: 'anthropic' });
  });

  it('schema_version distinto retorna schema_mismatch', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(
      join(baseDir, 'config.toml'),
      'schema_version = 99\n[profile]\ndomain = "programming"\nagent_language = "auto"\nretention_level = "strict"\n',
      'utf-8',
    );
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('schema_mismatch');
    if (result.error.kind !== 'schema_mismatch') return;
    expect(result.error.expected).toBe(1);
    expect(result.error.got).toBe(99);
  });

  it('TOML corrupto retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(join(baseDir, 'config.toml'), 'this is not valid toml === [[[', 'utf-8');
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
  });

  it('schema_version faltante retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(
      join(baseDir, 'config.toml'),
      '[profile]\ndomain = "programming"\nagent_language = "auto"\nretention_level = "strict"\n',
      'utf-8',
    );
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
    if (result.error.kind !== 'parse_error') return;
    expect(result.error.cause).toContain('schema_version');
  });

  it('profile.domain inválido retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(
      join(baseDir, 'config.toml'),
      'schema_version = 1\n[profile]\ndomain = "physics"\nagent_language = "auto"\nretention_level = "strict"\n',
      'utf-8',
    );
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
    if (result.error.kind !== 'parse_error') return;
    expect(result.error.cause).toContain('domain');
  });

  it('seccion [profile] faltante retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(join(baseDir, 'config.toml'), 'schema_version = 1\n', 'utf-8');
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
  });
});
