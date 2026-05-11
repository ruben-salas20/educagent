// tests/cli/components/LearnFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { LearnFlow } from '../../../src/cli/components/LearnFlow.js';

const ENTER = '\r';

function delay(ms = 30): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('LearnFlow — Ink component', () => {
  it('renderiza el prompt y el branding en el step inicial', () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <LearnFlow
        promptText="¿Qué es una variable?"
        onSubmit={onSubmit}
        autoExit={false}
      />,
    );
    expect(lastFrame()).toContain('EducAgent');
    expect(lastFrame()).toContain('Socrático');
    expect(lastFrame()).toContain('¿Qué es una variable?');
  });

  it('transiciona de prompt a input tras el delay y muestra el cursor', async () => {
    const onSubmit = vi.fn();
    const { lastFrame } = render(
      <LearnFlow
        promptText="¿Qué es una variable?"
        onSubmit={onSubmit}
        autoExit={false}
      />,
    );
    // PROMPT_DURATION_MS = 800
    await delay(900);
    expect(lastFrame()).toContain('Enter para enviar');
  });

  it('invoca onSubmit con el texto tipeado al presionar Enter', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: true as const,
      feedbackText: 'Bien hecho.',
    }));
    const { stdin } = render(
      <LearnFlow
        promptText="¿Qué es una variable?"
        onSubmit={onSubmit}
        autoExit={false}
      />,
    );
    await delay(900);
    stdin.write('una caja con datos');
    await delay(30);
    stdin.write(ENTER);
    await delay(50);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('una caja con datos');
  });

  it('muestra el step processing mientras onSubmit está en curso', async () => {
    let resolveSubmit: ((v: { ok: true; feedbackText: string }) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<{ ok: true; feedbackText: string }>((res) => {
          resolveSubmit = res;
        }),
    );
    const { stdin, lastFrame } = render(
      <LearnFlow promptText="Q" onSubmit={onSubmit} autoExit={false} />,
    );
    await delay(900);
    stdin.write('algo');
    await delay(20);
    stdin.write(ENTER);
    await delay(50);
    expect(lastFrame()).toContain('Procesando');
    // Resolver para no dejar la promise colgando.
    resolveSubmit?.({ ok: true, feedbackText: 'ok' });
    await delay(50);
  });

  it('muestra el feedbackText retornado por onSubmit en el step feedback', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: true as const,
      feedbackText: 'Excelente definición.',
    }));
    const { stdin, lastFrame } = render(
      <LearnFlow promptText="Q" onSubmit={onSubmit} autoExit={false} />,
    );
    await delay(900);
    stdin.write('respuesta');
    await delay(20);
    stdin.write(ENTER);
    await delay(80);
    expect(lastFrame()).toContain('Excelente definición.');
    expect(lastFrame()).toContain('Hattie');
  });

  it('muestra el step error cuando onSubmit retorna ok:false', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: false as const,
      error: 'mastery_persist_failed',
    }));
    const { stdin, lastFrame } = render(
      <LearnFlow promptText="Q" onSubmit={onSubmit} autoExit={false} />,
    );
    await delay(900);
    stdin.write('algo');
    await delay(20);
    stdin.write(ENTER);
    await delay(80);
    expect(lastFrame()).toContain('Hubo un error');
    expect(lastFrame()).toContain('mastery_persist_failed');
  });

  it('autoExit=false NO desmonta el árbol tras feedback', async () => {
    const onSubmit = vi.fn(async () => ({
      ok: true as const,
      feedbackText: 'ok',
    }));
    const { stdin, lastFrame } = render(
      <LearnFlow promptText="Q" onSubmit={onSubmit} autoExit={false} />,
    );
    await delay(900);
    stdin.write('x');
    await delay(20);
    stdin.write(ENTER);
    // Esperamos MÁS que EXIT_DELAY_MS (2500ms) para confirmar que NO sale.
    await delay(2700);
    // Si autoExit hubiese disparado, el frame estaría vacío o el proceso muerto.
    expect(lastFrame()).toContain('ok');
    expect(lastFrame()).toContain('Hattie');
  });
});
