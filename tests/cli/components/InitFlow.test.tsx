// tests/cli/components/InitFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { InitFlow } from '../../../src/cli/components/InitFlow.js';
import type { UserConfig } from '../../../src/ports/infra/IConfigStore.js';

// Tecla ENTER en TTY = '\r'. Las flechas (down='[B') no las necesitamos
// porque SelectInput selecciona el primer item por default con Enter.

const ENTER = '\r';
const DOWN = '[B';

function delay(ms = 30): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('InitFlow — Ink component', () => {
  it('renderiza la pantalla welcome al inicio', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    expect(lastFrame()).toContain('EducAgent');
    expect(lastFrame()).toContain('configurar');
  });

  it('avanza automáticamente desde welcome a la pregunta de dominio', async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    // El componente avanza tras 1500ms — esperamos un poco más.
    await delay(1600);
    expect(lastFrame()).toContain('dominio');
  });

  it('flow happy-path: confirma defaults y llama a onSubmit con el config correcto', async () => {
    const onSubmit = vi.fn(async (_config: UserConfig) => ({
      ok: true,
      path: '/tmp/fake.toml',
    }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );

    // Esperar transición welcome → domain.
    await delay(1600);
    expect(lastFrame()).toContain('dominio');

    // Seleccionar programming (default, primer item).
    stdin.write(ENTER);
    await delay(50);
    expect(lastFrame()).toContain('idioma');

    // Seleccionar auto (primer item).
    stdin.write(ENTER);
    await delay(50);
    expect(lastFrame()).toContain('privacidad');

    // Seleccionar strict (primer item).
    stdin.write(ENTER);
    await delay(50);
    expect(lastFrame()).toContain('Resumen');

    // Confirmar (primer item del SelectInput de confirmación).
    stdin.write(ENTER);
    await delay(100);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      schemaVersion: 1,
      profile: {
        domain: 'programming',
        agentLanguage: 'auto',
        retentionLevel: 'strict',
      },
    });
  });

  it('selecciona "math" cuando el usuario baja una vez en el step de dominio', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/fake.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    await delay(1600);
    expect(lastFrame()).toContain('dominio');

    // Down → math.
    stdin.write(DOWN);
    await delay(30);
    stdin.write(ENTER);
    await delay(50);

    expect(lastFrame()).toContain('idioma');

    // Aceptar defaults para llegar a summary.
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);

    expect(lastFrame()).toContain('Matemáticas');
  });

  it('muestra pantalla de error y mensaje cuando el usuario cancela en summary', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/fake.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    await delay(1600);

    // Pasar por las 3 preguntas con defaults.
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    expect(lastFrame()).toContain('Resumen');

    // Cancelar (segundo item del SelectInput).
    stdin.write(DOWN);
    await delay(30);
    stdin.write(ENTER);
    await delay(50);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Cancelado');
  });

  it('muestra pantalla de éxito tras onSubmit ok con el path retornado', async () => {
    const onSubmit = vi.fn(async () => ({ ok: true, path: '/tmp/configured.toml' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    await delay(1600);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(100);

    expect(lastFrame()).toContain('Configuración creada');
    expect(lastFrame()).toContain('/tmp/configured.toml');
  });

  it('muestra pantalla de error cuando onSubmit retorna ok:false', async () => {
    const onSubmit = vi.fn(async () => ({ ok: false, error: 'disk full' }));
    const { stdin, lastFrame } = render(
      <InitFlow onSubmit={onSubmit} configPath="/tmp/fake.toml" />,
    );
    await delay(1600);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(50);
    stdin.write(ENTER);
    await delay(100);

    expect(lastFrame()).toContain('No se pudo completar');
    expect(lastFrame()).toContain('disk full');
  });
});
