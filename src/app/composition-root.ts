// src/app/composition-root.ts
// Composition root: la ÚNICA carpeta de `app/` autorizada a importar adapters.
// Arma el grafo de dependencies con adapters reales (SQLite + SM-2 + SystemClock)
// y retorna un container tipado por ports.
//
// Llamar UNA vez al arrancar la app (CLI bin.ts o tests integration).
// Si falla la apertura de DB o las migraciones, throw CompositionRootError —
// la app no puede arrancar sin DB lista.

import { homedir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { IAttemptRepository } from '../ports/persistence/IAttemptRepository.js';
import type { IMasteryStateRepository } from '../ports/persistence/IMasteryStateRepository.js';
import type { IScheduler } from '../ports/inference/IScheduler.js';
import type { IClock } from '../ports/infra/IClock.js';
import type { UserConfig } from '../ports/infra/IConfigStore.js';
import type { ILLMProvider } from '../ports/llm/ILLMProvider.js';
import {
  openConnection,
  type ConnectionConfig,
} from '../adapters/persistence/sqlite/connection.js';
import { applyMigrations } from '../adapters/persistence/sqlite/migrations/runner.js';
import { SqliteAttemptRepository } from '../adapters/persistence/sqlite/SqliteAttemptRepository.js';
import { SqliteMasteryStateRepository } from '../adapters/persistence/sqlite/SqliteMasteryStateRepository.js';
import { Sm2Scheduler } from '../adapters/inference/Sm2Scheduler.js';
import { SystemClock } from '../adapters/infra/SystemClock.js';

// ---------------------------------------------------------------------------
// Contrato público
// ---------------------------------------------------------------------------

export interface AppContainer {
  readonly attempts: IAttemptRepository;
  readonly masteryStates: IMasteryStateRepository;
  readonly scheduler: IScheduler;
  readonly clock: IClock;
  /**
   * Config del usuario expuesto para que use cases consulten preferences
   * (idioma, retentionLevel, domain). Inmutable durante el ciclo de vida
   * del container — si el usuario edita el TOML, hay que rebuild.
   */
  readonly userConfig: UserConfig;
  /**
   * Acceso directo a la DB. Expuesto porque los tests integration necesitan
   * insertar fixtures de FK (projects, sessions, items, concepts) antes de
   * ejercitar use cases. Producción NO debería tocar este handle directamente —
   * cuando todos los repos cubran el dominio, este campo se puede sacar.
   */
  readonly db: Database.Database;
  /**
   * Proveedor LLM inyectado por el caller (BYOK). `null` si el comando no
   * necesita LLM o si el caller no configuró ninguno — los use cases que
   * dependen del LLM deben verificar este campo antes de invocarlo.
   */
  readonly llm: ILLMProvider | null;
}

export interface BuildContainerConfig {
  /**
   * Config del usuario (de ~/.educagent/config.toml). Para tests con DB en memoria,
   * pasar un UserConfig dummy con cualquier perfil — no afecta SQLite cuando
   * sqliteFilename override es ':memory:'.
   */
  readonly userConfig: UserConfig;
  /**
   * Override del SQLite path. Default: derivado del config dir (ver buildContainer).
   * Para tests integration usar ':memory:'.
   */
  readonly sqliteFilename?: string;
  /**
   * Override del directorio donde vive el config (default: ~/.educagent). Solo
   * afecta el default de sqliteFilename — el config en sí ya fue leído antes
   * de este builder.
   */
  readonly configDir?: string;
  /**
   * Si true, no aplica WAL. `:memory:` lo desactiva automáticamente.
   * Útil para entornos donde WAL no aplica (tests, ramdisk, etc.).
   */
  readonly disableWAL?: boolean;
  /**
   * Proveedor LLM ya construido por el caller (composition root no instancia
   * adapters de LLM porque el modelo/apiKey vienen del CLI/env). Si es null
   * o se omite, el container queda con `llm: null`.
   */
  readonly llm?: ILLMProvider | null;
}

/**
 * Error explícito de bootstrap. El caller puede discriminar por `name` o por
 * `instanceof` para distinguir fallos de composition root de errores runtime.
 */
export class CompositionRootError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CompositionRootError';
    this.cause = cause;
  }
}

/**
 * Bootstrap del grafo de dependencies. Llamar UNA vez al arrancar la app.
 *
 * Side effects:
 * - Abre la conexión SQLite (con PRAGMA foreign_keys ON + WAL si aplica).
 * - Aplica migraciones pendientes (idempotente).
 *
 * Si falla la apertura o las migraciones, throw CompositionRootError.
 */
export function buildContainer(config: BuildContainerConfig): AppContainer {
  const sqliteFilename = resolveSqliteFilename(config);

  const connConfig: ConnectionConfig = {
    filename: sqliteFilename,
    disableWAL: config.disableWAL,
  };

  let db: Database.Database;
  try {
    db = openConnection(connConfig);
  } catch (e) {
    throw new CompositionRootError(
      `Failed to open SQLite connection at '${sqliteFilename}': ${
        e instanceof Error ? e.message : String(e)
      }`,
      e,
    );
  }

  const migrationsResult = applyMigrations(db);
  if (!migrationsResult.ok) {
    // Cerrar handle antes de fallar para no leakear el file descriptor.
    try {
      db.close();
    } catch {
      // ignore — ya estamos en path de error
    }
    throw new CompositionRootError(
      `Failed to apply migrations: ${JSON.stringify(migrationsResult.error)}`,
      migrationsResult.error,
    );
  }

  return {
    db,
    attempts: new SqliteAttemptRepository(db),
    masteryStates: new SqliteMasteryStateRepository(db),
    scheduler: new Sm2Scheduler(),
    clock: new SystemClock(),
    userConfig: config.userConfig,
    llm: config.llm ?? null,
  };
}

/**
 * Resuelve el path final del SQLite según prioridad:
 *   1. config.sqliteFilename explícito (típico en tests: ':memory:').
 *   2. configDir + 'educagent.sqlite'.
 *   3. ~/.educagent/educagent.sqlite (default productivo).
 */
function resolveSqliteFilename(config: BuildContainerConfig): string {
  if (config.sqliteFilename !== undefined) return config.sqliteFilename;

  const baseDir = config.configDir ?? join(homedir(), '.educagent');
  return join(baseDir, 'educagent.sqlite');
}
