// tests/adapters/infra/SystemClock.test.ts

import { describe, it, expect } from 'vitest';
import { SystemClock } from '../../../src/adapters/infra/SystemClock.js';

describe('SystemClock', () => {
  it('now() retorna Date', () => {
    const clock = new SystemClock();
    expect(clock.now()).toBeInstanceOf(Date);
  });

  it('now() avanza entre llamadas (cuando hay tiempo entre ellas)', async () => {
    const clock = new SystemClock();
    const t1 = clock.now();
    await new Promise((r) => setTimeout(r, 10));
    const t2 = clock.now();
    expect(t2.getTime()).toBeGreaterThanOrEqual(t1.getTime());
  });
});
