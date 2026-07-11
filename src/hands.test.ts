import { describe, it, expect } from 'vitest';
import { isWorkerBackpressureStale, WORKER_RESULT_TIMEOUT_MS, resolveHandSlots, type Hand } from './hands';

/** Construye una detección de MediaPipe con la punta del índice en (tipX, tipY) normalizados. */
function hand(handedness: string, tipX: number, tipY: number): Hand {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
  landmarks[8] = { x: tipX, y: tipY, z: 0, visibility: 0 };
  return { handedness, landmarks };
}

describe('resolveHandSlots', () => {
  const W = 1000;
  const H = 800;

  it('sin detecciones, los dos slots quedan ausentes', () => {
    const r = resolveHandSlots([], W, H);
    expect(r.Left.present).toBe(false);
    expect(r.Right.present).toBe(false);
  });

  it('asigna cada mano a su slot y espeja X (video en espejo)', () => {
    const r = resolveHandSlots([hand('Left', 0.2, 0.5), hand('Right', 0.8, 0.25)], W, H);
    expect(r.Left).toEqual({ present: true, x: (1 - 0.2) * W, y: 0.5 * H });
    expect(r.Right).toEqual({ present: true, x: (1 - 0.8) * W, y: 0.25 * H });
  });

  it('una mano con handedness desconocida cae en Left', () => {
    const r = resolveHandSlots([hand('Unknown', 0.5, 0.5)], W, H);
    expect(r.Left.present).toBe(true);
    expect(r.Right.present).toBe(false);
  });

  it('dos detecciones con la misma lateralidad no pisan el mismo slot: la segunda va al otro', () => {
    const r = resolveHandSlots([hand('Left', 0.1, 0.1), hand('Left', 0.9, 0.9)], W, H);
    expect(r.Left).toEqual({ present: true, x: (1 - 0.1) * W, y: 0.1 * H });
    expect(r.Right).toEqual({ present: true, x: (1 - 0.9) * W, y: 0.9 * H });
  });

  it('con los dos slots ya ocupados, una tercera detección se descarta (no rompe nada)', () => {
    const r = resolveHandSlots(
      [hand('Left', 0.1, 0.1), hand('Left', 0.9, 0.9), hand('Left', 0.5, 0.5)],
      W,
      H,
    );
    expect(r.Left.present).toBe(true);
    expect(r.Right.present).toBe(true);
    // La tercera ("Left" de nuevo, ambos slots ocupados) no pisa ninguna de las dos.
    expect(r.Left.x).toBe((1 - 0.1) * W);
    expect(r.Right.x).toBe((1 - 0.9) * W);
  });
});

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
