import { describe, it, expect, vi } from 'vitest';
import { printHelp } from '../../src/cli/help.js';

describe('printHelp — CLI help text', () => {
  it('imprime el header de uso', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(output).toContain('Uso: educagent');
  });

  it('lista el comando init', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(output).toContain('init');
  });

  it('lista las opciones --version y --help', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    printHelp();
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    expect(output).toContain('--version');
    expect(output).toContain('--help');
  });
});
