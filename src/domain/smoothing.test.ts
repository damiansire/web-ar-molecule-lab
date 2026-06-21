import { describe, it, expect } from "vitest";
import {
  OneEuroFilter,
  Vec3Smoother,
  smoothingAlpha,
  DEFAULT_ONE_EURO,
} from "./smoothing";

describe("smoothingAlpha", () => {
  it("crece monótonamente con el corte (más Hz = menos filtrado)", () => {
    const dt = 1 / 60;
    expect(smoothingAlpha(2, dt)).toBeGreaterThan(smoothingAlpha(1, dt));
  });

  it("queda en (0,1) para cortes y dt razonables", () => {
    const a = smoothingAlpha(1.2, 1 / 60);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });

  it("tiende a 1 cuando el corte es muy alto respecto del dt", () => {
    expect(smoothingAlpha(10000, 1 / 60)).toBeGreaterThan(0.99);
  });
});

describe("OneEuroFilter", () => {
  it("adopta el primer valor sin filtrar (no interpola desde 0)", () => {
    const f = new OneEuroFilter();
    expect(f.filter(100, 1 / 60)).toBe(100);
  });

  it("converge al valor de una señal constante", () => {
    const f = new OneEuroFilter();
    f.filter(0, 1 / 60);
    let out = 0;
    for (let i = 0; i < 200; i++) out = f.filter(50, 1 / 60);
    expect(out).toBeCloseTo(50, 1);
  });

  it("atenúa el jitter de una señal ruidosa alrededor de una media", () => {
    const f = new OneEuroFilter();
    const noisy = [0, 10, -10, 12, -8, 9, -11, 10, -9, 11, -10, 10, -10];
    let out = 0;
    for (const v of noisy) out = f.filter(v, 1 / 60);
    // La media de la señal es ~0; el filtrado debe quedar mucho más cerca de 0
    // que la amplitud cruda (~10).
    expect(Math.abs(out)).toBeLessThan(5);
  });

  it("sigue (lag) a una rampa pero en la misma dirección", () => {
    const f = new OneEuroFilter();
    let out = 0;
    let raw = 0;
    for (let i = 0; i < 30; i++) {
      raw += 5;
      out = f.filter(raw, 1 / 60);
    }
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThanOrEqual(raw);
  });

  it("la predicción adelanta a la señal filtrada en una rampa", () => {
    const dt = 1 / 60;
    const reactive = new OneEuroFilter({ predictSeconds: 0 });
    const predictive = new OneEuroFilter({ predictSeconds: 0.1 });
    let r = 0;
    let p = 0;
    let raw = 0;
    for (let i = 0; i < 40; i++) {
      raw += 5;
      r = reactive.filter(raw, dt);
      p = predictive.filter(raw, dt);
    }
    // Con velocidad positiva sostenida, el predictivo va por delante del reactivo.
    expect(p).toBeGreaterThan(r);
  });

  it("la predicción no adelanta con la señal en reposo (velocidad ~0)", () => {
    const dt = 1 / 60;
    const predictive = new OneEuroFilter({ predictSeconds: 0.1 });
    predictive.filter(100, dt);
    let out = 0;
    for (let i = 0; i < 100; i++) out = predictive.filter(100, dt);
    expect(out).toBeCloseTo(100, 1);
  });

  it("reset vuelve a adoptar el siguiente valor sin filtrar", () => {
    const f = new OneEuroFilter();
    f.filter(0, 1 / 60);
    f.filter(50, 1 / 60);
    f.reset();
    expect(f.filter(999, 1 / 60)).toBe(999);
  });

  it("dt <= 0 devuelve el valor crudo (sin dividir por cero)", () => {
    const f = new OneEuroFilter();
    expect(f.filter(7, 0)).toBe(7);
    expect(Number.isFinite(f.filter(8, -1))).toBe(true);
  });

  it("expone defaults sensatos", () => {
    expect(DEFAULT_ONE_EURO.minCutoff).toBeGreaterThan(0);
    expect(DEFAULT_ONE_EURO.beta).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_ONE_EURO.predictSeconds).toBe(0);
  });
});

describe("Vec3Smoother", () => {
  it("filtra x/y/s in-place sin asignar un objeto nuevo", () => {
    const s = new Vec3Smoother();
    const out = { x: 0, y: 0, s: 1 };
    const ref = out;
    s.filterInto(out, 1 / 60);
    expect(out).toBe(ref); // mismo objeto (alloc-free)
  });

  it("converge cada componente a su objetivo constante", () => {
    const s = new Vec3Smoother();
    const out = { x: 0, y: 0, s: 1 };
    for (let i = 0; i < 200; i++) {
      out.x = 100;
      out.y = 200;
      out.s = 2;
      s.filterInto(out, 1 / 60);
    }
    expect(out.x).toBeCloseTo(100, 0);
    expect(out.y).toBeCloseTo(200, 0);
    expect(out.s).toBeCloseTo(2, 0);
  });

  it("reset reinicia los tres ejes", () => {
    const s = new Vec3Smoother();
    const out = { x: 0, y: 0, s: 1 };
    out.x = 50;
    s.filterInto(out, 1 / 60);
    s.reset();
    const fresh = { x: 999, y: 888, s: 7 };
    s.filterInto(fresh, 1 / 60);
    expect(fresh).toEqual({ x: 999, y: 888, s: 7 });
  });
});
