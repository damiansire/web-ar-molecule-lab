import { describe, it, expect } from "vitest";
import { convexHull, fanTriangulate, type Pt } from "./occluder";

/** Área con signo de un polígono (shoelace). Positiva = CCW en ejes Y-arriba. */
function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

describe("convexHull", () => {
  it("devuelve los puntos tal cual si hay menos de 3", () => {
    expect(convexHull([])).toEqual([]);
    expect(convexHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }]);
    expect(convexHull([{ x: 1, y: 1 }, { x: 2, y: 2 }]).length).toBe(2);
  });

  it("de un cuadrado con puntos internos devuelve sólo las 4 esquinas", () => {
    const square: Pt[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 }, // interno: debe quedar fuera del casco
      { x: 3, y: 7 }, // interno
    ];
    const hull = convexHull(square);
    expect(hull.length).toBe(4);
    for (const corner of [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]) {
      expect(hull).toContainEqual(corner);
    }
  });

  it("descarta puntos colineales sobre una arista (casco mínimo)", () => {
    const withMid: Pt[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 }, // colineal sobre la arista inferior
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(convexHull(withMid).length).toBe(4);
  });

  it("produce un polígono con orientación consistente (no nula)", () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(Math.abs(signedArea(hull))).toBeCloseTo(100, 5);
  });

  it("es robusto a puntos duplicados", () => {
    const dup: Pt[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    expect(convexHull(dup).length).toBe(4);
  });
});

describe("fanTriangulate", () => {
  it("no escribe nada para menos de 3 vértices", () => {
    const out = new Uint16Array(60);
    expect(fanTriangulate(0, out)).toBe(0);
    expect(fanTriangulate(2, out)).toBe(0);
  });

  it("emite 1 triángulo para 3 vértices", () => {
    const out = new Uint16Array(60);
    expect(fanTriangulate(3, out)).toBe(3);
    expect(Array.from(out.slice(0, 3))).toEqual([0, 1, 2]);
  });

  it("emite (n-2) triángulos en abanico desde el vértice 0", () => {
    const out = new Uint16Array(60);
    const n = 5;
    const written = fanTriangulate(n, out);
    expect(written).toBe((n - 2) * 3);
    expect(Array.from(out.slice(0, written))).toEqual([0, 1, 2, 0, 2, 3, 0, 3, 4]);
  });

  it("todos los índices quedan dentro de [0, n)", () => {
    const out = new Uint16Array(60);
    const n = 12;
    const written = fanTriangulate(n, out);
    for (let i = 0; i < written; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0);
      expect(out[i]).toBeLessThan(n);
    }
  });

  it("cubre el caso real del oclusor (21 landmarks -> hasta 19 triángulos)", () => {
    const out = new Uint16Array((21 - 2) * 3);
    const written = fanTriangulate(21, out);
    expect(written).toBe((21 - 2) * 3);
    expect(out.length).toBeGreaterThanOrEqual(written);
  });
});
