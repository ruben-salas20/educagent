// tests/cli/components/InitFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InitFlow } from '../../../src/cli/components/InitFlow.js';
import type { UserConfig } from '../../../src/ports/infra/IConfigStore.js';
import { ok, err } from '../../../src/core/result/Result.js';
import type { OllamaModelInfo } from '../../../src/cli/lib/ollamaCatalog.js';

// Tecla ENTER en TTY = '\r'. Las flechas (down='[B') las usamos para mover SelectInput.
const ENTER = '\r';
// Secuencia ANSI completa para flecha abajo. El '[B' suelto a veces no se procesa
// como tecla de control; agregar el ESC inicial fuerza a Ink a interpretarlo como arrow key.
const DOWN = '[B';

function delay(ms = 80): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Espera hasta que `lastFrame()` contenga el substring esperado, o timeout.
 * Después de encontrar el match, da un pequeño grace period para que el
 * SelectInput del nuevo step termine de montarse y se suscriba al stdin.
 */
async function waitFor(
  lastFrame: () => string | undefined,
  needle: string,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((lastFrame() ?? '').includes(needle)) {
      await delay(80);
      return;
    }
    await delay(30);
  }
  throw new Error(`timed out waiting for "${needle}". Last frame:\n${lastFrame()}`);
}

const FAKE_OLLAMA_MODELS: ReadonlyArray<OllamaModelInfo> = [
  { name: 'gemma2:9b', sizeBytes: 9_500_000_000, modifiedAt: '2026-05-01T10:00:00Z' },
  { name: 'qwen2.5:7b', sizeBytes: 4_700_000_000, modifiedAt: '2026-05-02T10:00:00Z' },
];

function makeOkCatalog() {
  return vi.fn(async () => ok(FAKE_OLLAMA_MODELS));
}

describe('InitFlow — Ink component', () => {
  it('renderiza la pantalla welcome al inicio', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );
    expect(lastFrame()).toContain('EducAgent');
    expect(lastFrame()).toContain('configurar');
  });

  it('avanza automáticamente desde welcome a la pregunta de dominio', async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );
    await waitFor(lastFrame, 'dominio');
  });

  it('llega al step llm_provider después de retention', async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );
    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
  });

  it('flow con provider=none: salta a summary y llama onSubmit con llm none', async () => {
    const onSubmit = vi.fn(async (_config: UserConfig) => ({
      ok: true,
      path: '/tmp/fake.toml',
    }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );

    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');

    // Bajar dos veces hasta 'none' (item 3). Necesitamos delays generosos:
    // ink-select-input procesa la tecla en el siguiente tick, no inmediatamente.
    stdin.write(DOWN);
    await delay(300);
    stdin.write(DOWN);
    await delay(300);
    stdin.write(ENTER);
    await waitFor(lastFrame, 'Resumen');

    stdin.write(ENTER); // confirm
    await delay(200);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      schemaVersion: 2,
      profile: {
        domain: 'programming',
        agentLanguage: 'auto',
        retentionLevel: 'strict',
      },
      llm: { provider: 'none', model: null },
    });
  });

  it('flow con provider=ollama: pasa por loading y muestra modelos del catalog', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/fake.toml' }));
    const fetchCatalog = vi.fn(async () => ok(FAKE_OLLAMA_MODELS));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={fetchCatalog} />,
    );

    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    // Ollama es el primer item.
    stdin.write(ENTER);
    await waitFor(lastFrame, 'gemma2:9b');
    expect(fetchCatalog).toHaveBeenCalled();
  });

  it('flow con provider=ollama: error de catalog muestra hint', async () => {
    const onSubmit = vi.fn();
    const fetchCatalog = vi.fn(async () =>
      err({ kind: 'not_running' as const, url: 'http://localhost:11434', cause: 'ECONNREFUSED' }),
    );
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={fetchCatalog} />,
    );

    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    stdin.write(ENTER); // ollama
    await waitFor(lastFrame, 'ollama serve');
  });

  it('flow con provider=anthropic: muestra modelos hardcoded y completa hasta summary', async () => {
    const onSubmit = vi.fn(async (_c: UserConfig) => ({ ok: true, path: '/tmp/fake.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );

    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    // Provider: bajar 1 → anthropic.
    stdin.write(DOWN);
    await delay(300);
    stdin.write(ENTER);
    await waitFor(lastFrame, 'Elegí el modelo Anthropic');
    expect(lastFrame()).toContain('Sonnet');
    expect(lastFrame()).toContain('ANTHROPIC_API_KEY');

    // Seleccionar sonnet (primer item) → summary.
    stdin.write(ENTER);
    await waitFor(lastFrame, 'Resumen');
    expect(lastFrame()).toContain('claude-sonnet-4-5-20250929');

    stdin.write(ENTER); // confirm
    await delay(200);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        llm: { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
      }),
    );
  });

  it('muestra pantalla de error cuando el usuario cancela en summary', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/fake.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );

    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    // Provider: ollama (default).
    stdin.write(ENTER);
    await waitFor(lastFrame, 'gemma2:9b');
    stdin.write(ENTER); // pick first model
    await waitFor(lastFrame, 'Resumen');

    // Cancelar en summary (segundo item).
    stdin.write(DOWN);
    await delay(300);
    stdin.write(ENTER);
    await waitFor(lastFrame, 'Cancelado');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('muestra pantalla de éxito tras onSubmit ok con el path retornado', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/configured.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );
    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    stdin.write(ENTER); // ollama
    await waitFor(lastFrame, 'gemma2:9b');
    stdin.write(ENTER); // pick model
    await waitFor(lastFrame, 'Resumen');
    stdin.write(ENTER); // confirm
    await waitFor(lastFrame, 'Configuración creada');
    expect(lastFrame()).toContain('/tmp/configured.toml');
  });

  it('muestra pantalla de error cuando onSubmit retorna ok:false', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, error: 'disk full' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" fetchCatalog={makeOkCatalog()} />,
    );
    await waitFor(lastFrame, 'dominio');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'idioma');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'privacidad');
    stdin.write(ENTER);
    await waitFor(lastFrame, 'LLM');
    stdin.write(ENTER); // ollama
    await waitFor(lastFrame, 'gemma2:9b');
    stdin.write(ENTER); // pick model
    await waitFor(lastFrame, 'Resumen');
    stdin.write(ENTER); // confirm
    await waitFor(lastFrame, 'No se pudo completar');
    expect(lastFrame()).toContain('disk full');
  });
});
