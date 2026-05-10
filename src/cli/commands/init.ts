import React from 'react';
import { render } from 'ink';
import { Welcome } from '../components/Welcome.js';

/**
 * Comando `educagent init`. Walking skeleton: solo renderiza el componente Welcome.
 *
 * TODO post-walking-skeleton: detectar si ya existe ~/.educagent/config.toml,
 * crearlo si no, configurar dominio del proyecto, idioma, retention_level,
 * providers LLM, etc.
 */
export async function runInit(): Promise<void> {
  const { waitUntilExit } = render(React.createElement(Welcome));
  await waitUntilExit();
}
