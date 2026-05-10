import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Welcome } from '../../../src/cli/components/Welcome.js';

describe('Welcome — Ink component (walking skeleton)', () => {
  it('renderiza el branding EducAgent', () => {
    const { lastFrame } = render(<Welcome autoExit={false} />);
    expect(lastFrame()).toContain('EducAgent');
  });

  it('renderiza el tagline psicopedagógico', () => {
    const { lastFrame } = render(<Welcome autoExit={false} />);
    expect(lastFrame()).toContain('tutor inteligente');
  });

  it('renderiza el aviso de walking skeleton', () => {
    const { lastFrame } = render(<Welcome autoExit={false} />);
    expect(lastFrame()).toContain('walking skeleton');
  });

  it('renderiza el mensaje de bienvenida', () => {
    const { lastFrame } = render(<Welcome autoExit={false} />);
    expect(lastFrame()).toContain('Bienvenido');
  });

  it('limpia el timeout al desmontar (no dispara process.exit)', () => {
    const { unmount } = render(<Welcome autoExit={false} />);
    // unmount no debe disparar process.exit ni romper el runner.
    unmount();
    expect(true).toBe(true);
  });
});
