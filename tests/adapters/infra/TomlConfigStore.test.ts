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
    schemaVersion: 2,
    profile: {
      domain: 'programming',
      agentLanguage: 'auto',
      retentionLevel: 'strict',
    },
    llm: { provider: 'none', model: null },
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

  it('write + read round trip preserva los valores (provider=none)', async () => {
    const writeResult = await store.write(defaultConfig);
    expect(writeResult.ok).toBe(true);

    const readResult = await store.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value).toEqual(defaultConfig);
  });

  it('round trip con provider=ollama persiste model y ollamaUrl no-default', async () => {
    const ollamaConfig: UserConfig = {
      schemaVersion: 2,
      profile: { domain: 'programming', agentLanguage: 'es', retentionLevel: 'strict' },
      llm: {
        provider: 'ollama',
        model: 'gemma4:latest',
        ollamaUrl: 'http://192.168.1.10:11434',
      },
    };
    const writeResult = await store.write(ollamaConfig);
    expect(writeResult.ok).toBe(true);

    const readResult = await store.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.llm.provider).toBe('ollama');
    expect(readResult.value.llm.model).toBe('gemma4:latest');
    expect(readResult.value.llm.ollamaUrl).toBe('http://192.168.1.10:11434');
  });

  it('round trip con provider=anthropic NUNCA serializa apiKey', async () => {
    const anthropicConfig: UserConfig = {
      schemaVersion: 2,
      profile: { domain: 'humanities', agentLanguage: 'en', retentionLevel: 'standard' },
      llm: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    };
    await store.write(anthropicConfig);
    const raw = await readFile(store.configPath(), 'utf-8');
    expect(raw).toContain('provider = "anthropic"');
    expect(raw).toContain('claude-sonnet-4-5-20250929');
    // Por seguridad: el cuerpo TOML (no comentarios) nunca debe contener una
    // clave 'api_key' serializada ni el prefijo de una key real.
    const tomlBody = raw
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(tomlBody).not.toMatch(/api_?key\s*=/i);
    expect(raw).not.toMatch(/sk-ant-/);
  });

  it('write omite ollama_url cuando es el default', async () => {
    const ollamaDefaultUrl: UserConfig = {
      schemaVersion: 2,
      profile: { domain: 'programming', agentLanguage: 'auto', retentionLevel: 'strict' },
      llm: {
        provider: 'ollama',
        model: 'qwen2.5:7b',
        ollamaUrl: 'http://localhost:11434',
      },
    };
    await store.write(ollamaDefaultUrl);
    const raw = await readFile(store.configPath(), 'utf-8');
    expect(raw).not.toContain('ollama_url');
  });

  it('write incluye header con timestamp ISO en el archivo TOML', async () => {
    await store.write(defaultConfig);
    const raw = await readFile(store.configPath(), 'utf-8');
    expect(raw).toContain('# EducAgent global config');
    expect(raw).toContain('# Creado por `educagent init`');
    expect(raw).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('write crea el directorio padre si no existe', async () => {
    const deeperStore = new TomlConfigStore(join(baseDir, 'nested', 'deeper'));
    const result = await deeperStore.write({
      schemaVersion: 2,
      profile: { domain: 'math', agentLanguage: 'es', retentionLevel: 'standard' },
      llm: { provider: 'none', model: null },
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
      extras: { telemetry: false, customField: 'x' },
    };
    await store.write(withExtras);
    const readResult = await store.read();
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value.extras).toEqual({ telemetry: false, customField: 'x' });
  });

  it('migración suave: schema_version=1 sin [llm] retorna v2 con llm none', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(
      join(baseDir, 'config.toml'),
      'schema_version = 1\n[profile]\ndomain = "programming"\nagent_language = "auto"\nretention_level = "strict"\n',
      'utf-8',
    );
    const result = await store.read();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schemaVersion).toBe(2);
    expect(result.value.llm).toEqual({ provider: 'none', model: null });
    expect(result.value.profile.domain).toBe('programming');
  });

  it('schema_version distinto (no 1 ni 2) retorna schema_mismatch', async () => {
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
    expect(result.error.expected).toBe(2);
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
      'schema_version = 2\n[profile]\ndomain = "physics"\nagent_language = "auto"\nretention_level = "strict"\n[llm]\nprovider = "none"\nmodel = ""\n',
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
    await writeFile(join(baseDir, 'config.toml'), 'schema_version = 2\n', 'utf-8');
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
  });

  it('v2 sin sección [llm] retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    await writeFile(
      join(baseDir, 'config.toml'),
      'schema_version = 2\n[profile]\ndomain = "programming"\nagent_language = "auto"\nretention_level = "strict"\n',
      'utf-8',
    );
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
    if (result.error.kind !== 'parse_error') return;
    expect(result.error.cause).toContain('llm');
  });

  it('llm.provider inválido retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    // smol-toml requiere strings con comillas; usamos un valor fuera del enum.
    const toml = [
      'schema_version = 2',
      '[profile]',
      'domain = "programming"',
      'agent_language = "auto"',
      'retention_level = "strict"',
      '[llm]',
      'provider = "openai"',
      'model = "gpt-4"',
      '',
    ].join('\n');
    await writeFile(join(baseDir, 'config.toml'), toml, 'utf-8');
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
    if (result.error.kind !== 'parse_error') return;
    expect(result.error.cause).toContain('provider');
  });

  it('llm provider=ollama sin model retorna parse_error', async () => {
    await mkdir(baseDir, { recursive: true });
    const toml = [
      'schema_version = 2',
      '[profile]',
      'domain = "programming"',
      'agent_language = "auto"',
      'retention_level = "strict"',
      '[llm]',
      'provider = "ollama"',
      'model = ""',
      '',
    ].join('\n');
    await writeFile(join(baseDir, 'config.toml'), toml, 'utf-8');
    const result = await store.read();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('parse_error');
  });
});
