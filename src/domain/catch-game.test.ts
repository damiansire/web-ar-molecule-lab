import { describe, it, expect } from "vitest";
import {
  createCatchState,
  updateCatch,
  type CatchState,
  type Catcher,
} from "./catch-game";

const W = 640;
const H = 480;

/** `random` constante (útil para fijar la posición de spawn). */
const fixed = (v: number) => () => v;

describe("createCatchState", () => {
  it("arranca vacío y en cero", () => {
    const s = createCatchState();
    expect(s.circles).toHaveLength(0);
    expect(s.score).toBe(0);
    expect(s.missed).toBe(0);
  });
});

describe("updateCatch — spawn", () => {
  it("aparece un círculo al vencer el timer y se reinicia", () => {
    const s = createCatchState();
    updateCatch(s, { width: W, height: H, dt: 0.016, catchers: [], random: fixed(0.5) });
    expect(s.circles).toHaveLength(1);
    expect(s.spawnTimer).toBeGreaterThan(0);
  });

  it("respeta el período de spawn (no aparece antes de tiempo)", () => {
    const s = createCatchState();
    s.spawnTimer = 0.5; // todavía no toca
    updateCatch(s, {
      width: W,
      height: H,
      dt: 0.1,
      catchers: [],
      random: fixed(0.5),
      spawnEvery: 0.9,
    });
    expect(s.circles).toHaveLength(0);
  });

  it("ubica el spawn dentro del ancho jugable", () => {
    const s = createCatchState();
    updateCatch(s, { width: W, height: H, dt: 1, catchers: [], random: fixed(0) });
    const left = s.circles[0];
    s.circles = [];
    s.spawnTimer = 0;
    updateCatch(s, { width: W, height: H, dt: 1, catchers: [], random: fixed(1) });
    const right = s.circles[0];
    expect(left.x).toBeGreaterThanOrEqual(left.r);
    expect(right.x).toBeLessThanOrEqual(W - right.r);
    expect(right.x).toBeGreaterThan(left.x);
  });
});

describe("updateCatch — caída", () => {
  it("los círculos caen según vy*dt", () => {
    const s: CatchState = createCatchState();
    s.spawnTimer = 10; // sin spawn
    s.circles = [{ id: 1, x: 100, y: 0, vy: 200, r: 26 }];
    updateCatch(s, { width: W, height: H, dt: 0.5, catchers: [], random: fixed(0) });
    expect(s.circles[0].y).toBe(100);
  });

  it("descarta y cuenta como fallo el que sale por abajo", () => {
    const s = createCatchState();
    s.spawnTimer = 10;
    s.circles = [{ id: 1, x: 100, y: H + 30, vy: 100, r: 26 }];
    updateCatch(s, { width: W, height: H, dt: 0.1, catchers: [], random: fixed(0) });
    expect(s.circles).toHaveLength(0);
    expect(s.missed).toBe(1);
  });
});

describe("updateCatch — colisión y score", () => {
  const catcher = (x: number, y: number, r = 40): Catcher => ({ x, y, r });

  it("suma punto y quita el círculo al tocarlo con la mano", () => {
    const s = createCatchState();
    s.spawnTimer = 10;
    s.circles = [{ id: 1, x: 100, y: 100, vy: 0, r: 26 }];
    const out = updateCatch(s, {
      width: W,
      height: H,
      dt: 0.016,
      catchers: [catcher(100, 100)],
      random: fixed(0),
    });
    expect(s.score).toBe(1);
    expect(s.circles).toHaveLength(0);
    expect(out.caught.map((c) => c.id)).toEqual([1]);
  });

  it("no atrapa si la mano está lejos", () => {
    const s = createCatchState();
    s.spawnTimer = 10;
    s.circles = [{ id: 1, x: 100, y: 100, vy: 0, r: 26 }];
    updateCatch(s, {
      width: W,
      height: H,
      dt: 0.016,
      catchers: [catcher(500, 400)],
      random: fixed(0),
    });
    expect(s.score).toBe(0);
    expect(s.circles).toHaveLength(1);
  });

  it("la colisión usa la suma de radios (mano + círculo)", () => {
    const s = createCatchState();
    s.spawnTimer = 10;
    // Centros a 60px: alcanzable sólo si r_circulo(26)+r_mano(40)=66 ≥ 60.
    s.circles = [{ id: 1, x: 100, y: 100, vy: 0, r: 26 }];
    updateCatch(s, {
      width: W,
      height: H,
      dt: 0.016,
      catchers: [catcher(160, 100, 40)],
      random: fixed(0),
    });
    expect(s.score).toBe(1);
  });
});
