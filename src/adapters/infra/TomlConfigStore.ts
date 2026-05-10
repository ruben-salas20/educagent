// src/adapters/infra/TomlConfigStore.ts
// Adapter de IConfigStore que persiste a ~/.educagent/config.toml usando smol-toml.
//
// Decisiones:
// - schema_version explícito en disco → migraciones futuras sin romper instalaciones viejas.
// - Validación mínima (typeof + enums); para validación completa post-MVP usar zod.
// - read() retorna `not_found` como caso esperable (init lo usa para decidir flow).

import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { parse, stringify } from 'smol-toml';
import type {
  IConfigStore,
  UserConfig,
  ConfigStoreError,
} from '../../ports/infra/IConfigStore.js';
import { ok, err, type Result } from '../../core/result/Result.js';

const CURRENT_SCHEMA_VERSION = 1;

const VALID_DOMAINS = ['programming', 'math', 'humanities', 'languages', 'other'] as const;
const VALID_LANGUAGES = ['auto', 'es', 'en'] as const;
const VALID_RETENTION = ['strict', 'standard', 'full'] as const;

export class TomlConfigStore implements IConfigStore {
  private readonly path: string;

  /**
   * @param baseDir directorio donde vive `config.toml`. Default: `~/.educagent`.
   * Inyectable para tests (tmpdir) sin tocar el home real del usuario.
   */
  constructor(baseDir: string = join(homedir(), '.educagent')) {
    this.path = join(baseDir, 'config.toml');
  }

  configPath(): string {
    return this.path;
  }

  async read(): Promise<Result<UserConfig, ConfigStoreError>> {
    try {
      await access(this.path);
    } catch {
      return err({ kind: 'not_found', path: this.path });
    }

    let content: string;
    try {
      content = await readFile(this.path, 'utf-8');
    } catch (e) {
      return err({
        kind: 'parse_error',
        path: this.path,
        cause: e instanceof Error ? e.message : String(e),
      });
    }

    let data: Record<string, unknown>;
    try {
      data = parse(content) as Record<string, unknown>;
    } catch (e) {
      return err({
        kind: 'parse_error',
        path: this.path,
        cause: e instanceof Error ? e.message : String(e),
      });
    }

    if (typeof data.schema_version !== 'number') {
      return err({ kind: 'parse_error', path: this.path, cause: 'missing schema_version' });
    }
    if (data.schema_version !== CURRENT_SCHEMA_VERSION) {
      return err({
        kind: 'schema_mismatch',
        expected: CURRENT_SCHEMA_VERSION,
        got: data.schema_version,
      });
    }

    const profile = data.profile as Record<string, unknown> | undefined;
    if (!profile || typeof profile !== 'object') {
      return err({ kind: 'parse_error', path: this.path, cause: 'missing [profile] section' });
    }

    const domain = profile.domain;
    const agentLanguage = profile.agent_language;
    const retentionLevel = profile.retention_level;

    if (typeof domain !== 'string' || !VALID_DOMAINS.includes(domain as never)) {
      return err({ kind: 'parse_error', path: this.path, cause: `invalid profile.domain: ${String(domain)}` });
    }
    if (typeof agentLanguage !== 'string' || !VALID_LANGUAGES.includes(agentLanguage as never)) {
      return err({
        kind: 'parse_error',
        path: this.path,
        cause: `invalid profile.agent_language: ${String(agentLanguage)}`,
      });
    }
    if (typeof retentionLevel !== 'string' || !VALID_RETENTION.includes(retentionLevel as never)) {
      return err({
        kind: 'parse_error',
        path: this.path,
        cause: `invalid profile.retention_level: ${String(retentionLevel)}`,
      });
    }

    const config: UserConfig = {
      schemaVersion: data.schema_version,
      profile: {
        domain: domain as UserConfig['profile']['domain'],
        agentLanguage: agentLanguage as UserConfig['profile']['agentLanguage'],
        retentionLevel: retentionLevel as UserConfig['profile']['retentionLevel'],
      },
      ...(data.extras ? { extras: data.extras as UserConfig['extras'] } : {}),
    };
    return ok(config);
  }

  async write(config: UserConfig): Promise<Result<void, ConfigStoreError>> {
    try {
      await mkdir(dirname(this.path), { recursive: true });
      const tomlContent = stringify({
        schema_version: config.schemaVersion,
        profile: {
          domain: config.profile.domain,
          agent_language: config.profile.agentLanguage,
          retention_level: config.profile.retentionLevel,
        },
        ...(config.extras ? { extras: config.extras } : {}),
      });
      const fullContent = [
        '# EducAgent global config',
        `# Creado por \`educagent init\` el ${new Date().toISOString()}`,
        '',
        tomlContent,
        '',
      ].join('\n');
      await writeFile(this.path, fullContent, 'utf-8');
      return ok(undefined);
    } catch (e) {
      return err({
        kind: 'write_error',
        path: this.path,
        cause: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
