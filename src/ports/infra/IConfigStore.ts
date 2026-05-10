// src/ports/infra/IConfigStore.ts
import type { Result } from '../../core/result/Result.js';

/**
 * Configuración global del usuario, persistida en ~/.educagent/config.toml.
 * Schema versionado para permitir migraciones futuras sin romper instalaciones viejas.
 */
export interface UserConfig {
  readonly schemaVersion: number;
  readonly profile: {
    readonly domain: 'programming' | 'math' | 'humanities' | 'languages' | 'other';
    readonly agentLanguage: 'auto' | 'es' | 'en';
    readonly retentionLevel: 'strict' | 'standard' | 'full';
  };
  /** Para futuros campos sin breaking changes (telemetría, providers, etc.). */
  readonly extras?: Readonly<Record<string, unknown>>;
}

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
