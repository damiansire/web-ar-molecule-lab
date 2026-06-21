import { describe, it, expect } from 'vitest';
import { isWorkerBackpressureStale, WORKER_RESULT_TIMEOUT_MS } from './hands';

/**
 * Watchdog del back-pressure del worker: si un frame quedó "en vuelo" (busy) y
 * el worker murió o perdió el `result`, el tracking NO debe congelarse para
 * siempre. `isWorkerBackpressureStale` decide cuándo soltar `busy`.
 */
describe('isWorkerBackpressureStale', () => {
  it('no suelta el back-pressure si no hay frame en vuelo', () => {
    expect(isWorkerBackpressureStale(false, 1e9, 0)).toBe(false);
  });

  it('mantiene el back-pressure mientras el frame está dentro del timeout', () => {
    const lastPostAt = 1000;
    const now = lastPostAt + WORKER_RESULT_TIMEOUT_MS - 1;
    expect(isWorkerBackpressureStale(true, now, lastPostAt)).toBe(false);
  });

  it('suelta el back-pressure cuando se vence el timeout (worker muerto/result perdido)', () => {
    const lastPostAt = 1000;
    const now = lastPostAt + WORKER_RESULT_TIMEOUT_MS + 1;
    expect(isWorkerBackpressureStale(true, now, lastPostAt)).toBe(true);
  });

  it('respeta un timeout custom', () => {
    expect(isWorkerBackpressureStale(true, 600, 0, 500)).toBe(true);
    expect(isWorkerBackpressureStale(true, 400, 0, 500)).toBe(false);
  });
});
