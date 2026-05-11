// src/adapters/infra/TomlConfigStore.ts
// Adapter de IConfigStore que persiste a ~/.educagent/config.toml usando smol-toml.
//
// Decisiones:
// - schema_version explícito en disco → migraciones futuras sin romper instalaciones viejas.
// - Migración suave v1 → v2: cuando leemos un config v1, devolvemos v2 con
//   llm = { provider: 'none', model: null } como default. El próximo write() lo
//   persiste como v2.
// - Validación mínima (typeof + enums); para validación completa post-MVP usar zod.
// - read() retorna `not_found` como caso esperable (init lo usa para decidir flow).
// - API keys NUNCA se serializan acá (viven en env var por diseño).

import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { parse, stringify } from 'smol-toml';
import type {
  IConfigStore,
  UserConfig,
  LLMConfig,
  ConfigStoreError,
} from '../../ports/infra/IConfigStore.js';
import { CURRENT_SCHEMA_VERSION } from '../../ports/infra/IConfigStore.js';
import { ok, err, type Result } from '../../core/result/Result.js';

const VALID_DOMAINS = ['programming', 'math', 'humanities', 'languages', 'other'] as const;
const VALID_LANGUAGES = ['auto', 'es', 'en'] as const;
const VALID_RETENTION = ['strict', 'standard', 'full'] as const;
const VALID_PROVIDERS = ['ollama', 'anthropic', 'none'] as const;

const DEFAULT_LLM_NONE: LLMConfig = { provider: 'none', model: null };

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

    // v1 y v2 son ambas legibles. v1 obtiene migración suave a v2.
    // Cualquier otra versión → schema_mismatch.
    const version = data.schema_version;
    if (version !== 1 && version !== CURRENT_SCHEMA_VERSION) {
      return err({
        kind: 'schema_mismatch',
        expected: CURRENT_SCHEMA_VERSION,
        got: version,
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

    // Parse de la sección [llm] — opcional en v1 (migración suave), requerida shape en v2.
    let llm: LLMConfig;
    if (version === 1) {
      // Migración suave: aceptamos que [llm] no exista. Default a 'none'.
      // El próximo write() persistirá como v2 con la sección llm completa.
      llm = DEFAULT_LLM_NONE;
    } else {
      const llmRaw = data.llm as Record<string, unknown> | undefined;
      if (!llmRaw || typeof llmRaw !== 'object') {
        return err({ kind: 'parse_error', path: this.path, cause: 'missing [llm] section (v2)' });
      }
      const parsedLlm = parseLlmSection(llmRaw);
      if (!parsedLlm.ok) {
        return err({ kind: 'parse_error', path: this.path, cause: parsedLlm.error });
      }
      llm = parsedLlm.value;
    }

    const config: UserConfig = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profile: {
        domain: domain as UserConfig['profile']['domain'],
        agentLanguage: agentLanguage as UserConfig['profile']['agentLanguage'],
        retentionLevel: retentionLevel as UserConfig['profile']['retentionLevel'],
      },
      llm,
      ...(data.extras ? { extras: data.extras as UserConfig['extras'] } : {}),
    };
    return ok(config);
  }

  async write(config: UserConfig): Promise<Result<void, ConfigStoreError>> {
    try {
      await mkdir(dirname(this.path), { recursive: true });

      // Sección [llm]. Solo serializamos ollama_url si fue seteado y no es el default.
      const llmSection: Record<string, unknown> = {
        provider: config.llm.provider,
        model: config.llm.model,
      };
      if (
        config.llm.ollamaUrl !== undefined &&
        config.llm.ollamaUrl !== 'http://localhost:11434'
      ) {
        llmSection.ollama_url = config.llm.ollamaUrl;
      }

      const tomlContent = stringify({
        schema_version: CURRENT_SCHEMA_VERSION,
        profile: {
          domain: config.profile.domain,
          agent_language: config.profile.agentLanguage,
          retention_level: config.profile.retentionLevel,
        },
        llm: llmSection,
        ...(config.extras ? { extras: config.extras } : {}),
      });
      const fullContent = [
        '# EducAgent global config',
        `# Creado por \`educagent init\` el ${new Date().toISOString()}`,
        '# NOTA: las API keys NO se guardan acá. Configurá ANTHROPIC_API_KEY como env var.',
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

/**
 * Valida la sección [llm] del TOML v2. Retorna mensaje de error claro si falla.
 */
function parseLlmSection(raw: Record<string, unknown>): Result<LLMConfig, string> {
  const provider = raw.provider;
  if (typeof provider !== 'string' || !VALID_PROVIDERS.includes(provider as never)) {
    return err(`invalid llm.provider: ${String(provider)} (esperado: ollama|anthropic|none)`);
  }

  const model = raw.model;
  if (provider === 'none') {
    // model debe ser null o ausente.
    if (model !== null && model !== undefined) {
      return err(`llm.model debe ser null si provider='none' (recibido: ${String(model)})`);
    }
  } else {
    // ollama / anthropic requieren un model string no vacío.
    if (typeof model !== 'string' || model.trim() === '') {
      return err(`llm.model requerido para provider='${provider}'`);
    }
  }

  const ollamaUrl = raw.ollama_url;
  if (ollamaUrl !== undefined && typeof ollamaUrl !== 'string') {
    return err(`llm.ollama_url debe ser string si está presente`);
  }

  const llm: LLMConfig = {
    provider: provider as LLMConfig['provider'],
    model: provider === 'none' ? null : (model as string),
    ...(typeof ollamaUrl === 'string' ? { ollamaUrl } : {}),
  };
  return ok(llm);
}
