import { describe, it, expect } from "vitest";
import {
  isHeld,
  resolvePlacement,
  applyFacingHysteresis,
  cornerTarget,
} from "./placement";

describe("isHeld", () => {
  it("sostiene dentro de la ventana de gracia", () => {
    expect(isHeld(true, 1000, 1300, 500)).toBe(true);
  });
  it("suelta pasada la gracia", () => {
    expect(isHeld(true, 1000, 1600, 500)).toBe(false);
  });
  it("nunca sostiene si nunca se vio la mano", () => {
    expect(isHeld(false, 1000, 1000, 500)).toBe(false);
  });
});

describe("resolvePlacement", () => {
  const hand = { x: 100, y: 200, s: 1.2 };
  const corner = { x: 900, y: 80, s: 0.55 };

  it("sobre la mano cuando hay mano", () => {
    expect(resolvePlacement({ onHand: true, hand, isPrimary: true, corner })).toEqual({
      show: true,
      ...hand,
    });
  });

  it("a la esquina si es principal y no hay mano", () => {
    expect(resolvePlacement({ onHand: false, hand, isPrimary: true, corner })).toEqual({
      show: true,
      ...corner,
    });
  });

  it("oculta si no es principal y no hay mano", () => {
    expect(resolvePlacement({ onHand: false, hand, isPrimary: false, corner }).show).toBe(
      false,
    );
  });
});

describe("applyFacingHysteresis", () => {
  it("dorso con señal positiva fuerte", () => {
    expect(applyFacingHysteresis(false, 0.6, 0.18)).toBe(true);
  });
  it("palma con señal negativa fuerte", () => {
    expect(applyFacingHysteresis(true, -0.6, 0.18)).toBe(false);
  });
  it("conserva el estado dentro de la zona muerta", () => {
    expect(applyFacingHysteresis(true, 0.1, 0.18)).toBe(true);
    expect(applyFacingHysteresis(false, -0.1, 0.18)).toBe(false);
  });
});

describe("cornerTarget", () => {
  it("ubica la figura cerca de la esquina superior derecha", () => {
    const t = cornerTarget(1000, 120, 0.55);
    expect(t.x).toBeLessThan(1000);
    expect(t.x).toBeGreaterThan(800);
    expect(t.y).toBe(120 * 0.9 * 0.55 + 26);
  });
});
