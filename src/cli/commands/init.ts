// src/cli/commands/init.ts
// Comando `educagent init`. Detecta config existente o lanza el flow Ink.

import React from 'react';
import { render } from 'ink';
import { InitFlow, type InitFlowSubmitResult } from '../components/InitFlow.js';
import { TomlConfigStore } from '../../adapters/infra/TomlConfigStore.js';
import type { UserConfig } from '../../ports/infra/IConfigStore.js';

/**
 * Comando `educagent init`.
 *
 * 1. Si `~/.educagent/config.toml` existe y parsea: imprime info y sale (0).
 * 2. Si no existe o hay error de parse/schema: arranca el flow interactivo.
 *
 * Sobreescribir un config válido es post-MVP (requiere `--force` o similar).
 *
 * @returns exit code (0 éxito, 1 fallo de write o cancelación)
 */
export async function runInit(): Promise<number> {
  const store = new TomlConfigStore();

  const existing = await store.read();
  if (existing.ok) {
    console.log('Ya hay una configuración existente en:');
    console.log(`  ${store.configPath()}`);
    console.log('');
    console.log(`Dominio:     ${existing.value.profile.domain}`);
    console.log(`Idioma:      ${existing.value.profile.agentLanguage}`);
    console.log(`Privacidad:  ${existing.value.profile.retentionLevel}`);
    console.log(`Provider:    ${existing.value.llm.provider}`);
    console.log(`Modelo:      ${existing.value.llm.model ?? '—'}`);
    console.log('');
    console.log('Para reconfigurar, borrá el archivo y volvé a correr `educagent init`.');
    return 0;
  }

  // not_found es el caso esperable. parse_error / schema_mismatch también pueden
  // pasar (instalación rota, schema viejo) — en ambos arrancamos el flow para
  // que el usuario reconfigure. Avisamos si fue un error real, no un not_found.
  if (existing.error.kind !== 'not_found') {
    console.warn('Aviso: el config existente no es válido — vamos a reconfigurar.');
    console.warn(`  Detalle: ${JSON.stringify(existing.error)}`);
    console.warn('');
  }

  let finalCode = 0;
  const handleSubmit = async (config: UserConfig): Promise<InitFlowSubmitResult> => {
    const result = await store.write(config);
    if (result.ok) {
      return { ok: true, path: store.configPath() };
    }
    finalCode = 1;
    return { ok: false, error: JSON.stringify(result.error) };
  };

  const { waitUntilExit } = render(
    React.createElement(InitFlow, {
      onSubmit: handleSubmit,
      configPath: store.configPath(),
    }),
  );
  try {
    await waitUntilExit();
  } catch {
    // El usuario canceló o hubo error de write — el flow ya mostró el mensaje.
    finalCode = 1;
  }
  return finalCode;
}
