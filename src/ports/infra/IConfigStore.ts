// src/ports/infra/IConfigStore.ts
import type { Result } from '../../core/result/Result.js';

/**
 * Provider LLM seleccionado por el usuario.
 * - 'ollama'    → Local. Requiere instalación de Ollama y un modelo descargado.
 * - 'anthropic' → API remota. Requiere ANTHROPIC_API_KEY en env var (NUNCA en config).
 * - 'none'      → Sin LLM real. El comando learn imprime hint y exit 1.
 */
export interface LLMConfig {
  readonly provider: 'ollama' | 'anthropic' | 'none';
  /** Nombre del modelo. null si provider='none'. */
  readonly model: string | null;
  /** URL Ollama. Solo aplica si provider='ollama'. Default 'http://localhost:11434'. */
  readonly ollamaUrl?: string;
}

/**
 * Configuración global del usuario, persistida en ~/.educagent/config.toml.
 * Schema versionado para permitir migraciones futuras sin romper instalaciones viejas.
 *
 * IMPORTANTE: las API keys NUNCA viven acá. Siempre en env var (evita leaks por
 * backups, screen sharing, commits accidentales).
 */
export interface UserConfig {
  readonly schemaVersion: number;
  readonly profile: {
    readonly domain: 'programming' | 'math' | 'humanities' | 'languages' | 'other';
    readonly agentLanguage: 'auto' | 'es' | 'en';
    readonly retentionLevel: 'strict' | 'standard' | 'full';
  };
  /** NUEVO en v2. Selección del LLM provider + modelo. */
  readonly llm: LLMConfig;
  /** Para futuros campos sin breaking changes (telemetría, etc.). */
  readonly extras?: Readonly<Record<string, unknown>>;
}

export const CURRENT_SCHEMA_VERSION = 2;

export type ConfigStoreError =
  | { kind: 'not_found'; path: string }
  | { kind: 'parse_error'; path: string; cause: string }
  | { kind: 'write_error'; path: string; cause: string }
  | { kind: 'schema_mismatch'; expected: number; got: number };

export interface IConfigStore {
  /** Retorna el path absoluto donde vive el config (para mostrar al usuario). */
  configPath(): string;

  /** Lee el config. `not_found` es el caso esperable para `init`. */
  read(): Promise<Result<UserConfig, ConfigStoreError>>;

  /** Escribe el config. Crea el directorio padre si no existe. */
  write(config: UserConfig): Promise<Result<void, ConfigStoreError>>;
}
