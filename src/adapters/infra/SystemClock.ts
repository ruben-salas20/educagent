// src/adapters/infra/SystemClock.ts
// Adapter trivial de IClock que usa el reloj del sistema.

import type { IClock } from '../../ports/infra/IClock.js';

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
