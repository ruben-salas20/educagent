// src/app/bootstrap.ts
// Helper que combina lectura de UserConfig + armado del container en un solo
// paso. Es el entrypoint preferido para comandos del CLI (learn, review, etc.)
// que necesitan container y no quieren manejar el flow `read() → buildContainer()`
// manualmente.
//
// Si el config no existe, retorna `config_missing` con un hint para que el
// caller pueda mostrar "corré `educagent init`" sin acoplar a strings hardcoded.

import type { IConfigStore } from '../ports/infra/IConfigStore.js';
import type { ILLMProvider } from '../ports/llm/ILLMProvider.js';
import { ok, err, type Result } from '../core/result/Result.js';
import {
  buildContainer,
  CompositionRootError,
  type AppContainer,
} from './composition-root.js';

export type BootstrapError =
  | { kind: 'config_missing'; path: string; hint: string }
  | { kind: 'config_invalid'; path: string; cause: string }
  | { kind: 'bootstrap_failed'; cause: string };

export interface BootstrapOptions {
  /** Override del SQLite path. Útil para tests o para correr contra DB temporal. */
  readonly sqliteFilename?: string;
  /**
   * Proveedor LLM (BYOK) construido por el caller. Si es null o se omite,
   * el container queda con `llm: null` y los comandos que requieran LLM
   * deben rechazar la operación con mensaje claro.
   */
  readonly llm?: ILLMProvider | null;
}

/**
 * Lee el UserConfig vía configStore + invoca buildContainer. Si no hay config,
 * retorna `config_missing` con hint para que el caller muestre el mensaje
 * "corré `educagent init`".
 *
 * Uso típico desde un comando CLI:
 *
 *   const store = new TomlConfigStore();
 *   const result = await bootstrap(store);
 *   if (!result.ok) {
 *     if (result.error.kind === 'config_missing') {
 *       console.error(result.error.hint);
 *       return 1;
 *     }
 *     // otros errores...
 *   }
 *   const container = result.value;
 */
export async function bootstrap(
  configStore: IConfigStore,
  options: BootstrapOptions = {},
): Promise<Result<AppContainer, BootstrapError>> {
  const readResult = await configStore.read();
  if (!readResult.ok) {
    if (readResult.error.kind === 'not_found') {
      return err({
        kind: 'config_missing',
        path: readResult.error.path,
        hint: 'No se encontró configuración. Corré `educagent init` para crearla.',
      });
    }
    return err({
      kind: 'config_invalid',
      path: configStore.configPath(),
      cause: JSON.stringify(readResult.error),
    });
  }

  try {
    const container = buildContainer({
      userConfig: readResult.value,
      sqliteFilename: options.sqliteFilename,
      llm: options.llm,
    });
    return ok(container);
  } catch (e) {
    if (e instanceof CompositionRootError) {
      return err({ kind: 'bootstrap_failed', cause: e.message });
    }
    return err({
      kind: 'bootstrap_failed',
      cause: e instanceof Error ? e.message : String(e),
    });
  }
}
