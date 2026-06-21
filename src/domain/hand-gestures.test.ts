import { describe, it, expect } from "vitest";
import {
  distance2D,
  handSpan,
  fingertip,
  pinchRatio,
  PinchDetector,
  isFingerExtended,
  extendedFingerCount,
  FINGERTIPS,
  PINCH_ENTER,
  PINCH_EXIT,
} from "./hand-gestures";
import {
  WRIST_LANDMARK_INDEX,
  ANCHOR_LANDMARK_INDEX,
  type NormalizedLandmark,
} from "./hand-tracking";

const lm = (x: number, y: number, z = 0): NormalizedLandmark => ({ x, y, z });

/**
 * Construye una mano de 21 landmarks: muñeca en (0,1), base del dedo medio en
 * (0,0.6) → palmo = 0.4. Permite ubicar puntas concretas para los gestos.
 */
function hand(overrides: Record<number, NormalizedLandmark> = {}): NormalizedLandmark[] {
  const h = Array.from({ length: 21 }, () => lm(0, 0.5));
  h[WRIST_LANDMARK_INDEX] = lm(0, 1);
  h[ANCHOR_LANDMARK_INDEX] = lm(0, 0.6); // palmo = 0.4
  for (const [i, v] of Object.entries(overrides)) h[Number(i)] = v;
  return h;
}

describe("distance2D", () => {
  it("calcula la distancia euclidiana", () => {
    expect(distance2D(lm(0, 0), lm(3, 4))).toBe(5);
  });
  it("devuelve Infinity ante puntos faltantes", () => {
    expect(distance2D(undefined, lm(0, 0))).toBe(Infinity);
    expect(distance2D(lm(0, 0), undefined)).toBe(Infinity);
  });
});

describe("handSpan", () => {
  it("mide muñeca↔base del dedo medio", () => {
    expect(handSpan(hand())).toBeCloseTo(0.4, 6);
  });
  it("0 si la mano es inválida", () => {
    expect(handSpan(undefined)).toBe(0);
    expect(handSpan([lm(0, 0)])).toBe(0);
  });
});

describe("fingertip", () => {
  it("devuelve la punta pedida", () => {
    const h = hand({ [FINGERTIPS.index]: lm(0.2, 0.3) });
    expect(fingertip(h, "index")).toEqual(lm(0.2, 0.3));
  });
  it("null si la mano está incompleta", () => {
    expect(fingertip([lm(0, 0)], "pinky")).toBeNull();
  });
});

describe("pinchRatio", () => {
  it("es chico con los dedos juntos y grande con la mano abierta", () => {
    const juntos = pinchRatio(
      hand({ [FINGERTIPS.thumb]: lm(0, 0.5), [FINGERTIPS.index]: lm(0.02, 0.5) }),
    );
    const abiertos = pinchRatio(
      hand({ [FINGERTIPS.thumb]: lm(-0.3, 0.5), [FINGERTIPS.index]: lm(0.3, 0.4) }),
    );
    expect(juntos).not.toBeNull();
    expect(abiertos).not.toBeNull();
    expect(juntos!).toBeLessThan(abiertos!);
  });

  it("es escala-invariante (no depende del tamaño de la mano)", () => {
    // Misma pose, mano al doble de tamaño: el ratio no debería cambiar.
    const chica = pinchRatio(
      hand({ [FINGERTIPS.thumb]: lm(0, 0.5), [FINGERTIPS.index]: lm(0.1, 0.5) }),
    );
    const grandeBase = Array.from({ length: 21 }, () => lm(0, 1));
    grandeBase[WRIST_LANDMARK_INDEX] = lm(0, 2);
    grandeBase[ANCHOR_LANDMARK_INDEX] = lm(0, 1.2); // palmo = 0.8 (doble)
    grandeBase[FINGERTIPS.thumb] = lm(0, 1);
    grandeBase[FINGERTIPS.index] = lm(0.2, 1); // separación doble
    expect(chica!).toBeCloseTo(pinchRatio(grandeBase)!, 6);
  });

  it("null si la mano es inválida", () => {
    expect(pinchRatio(undefined)).toBeNull();
    expect(pinchRatio([lm(0, 0)])).toBeNull();
  });
});

describe("PinchDetector (histéresis)", () => {
  const pinchPose = (ratio: number) =>
    // separación = ratio * palmo(0.4)
    hand({ [FINGERTIPS.thumb]: lm(0, 0.5), [FINGERTIPS.index]: lm(ratio * 0.4, 0.5) });

  it("entra al cerrar y sólo sale al abrir bastante (no parpadea)", () => {
    const d = new PinchDetector();
    expect(d.update(pinchPose(0.5))).toBe(true); // < PINCH_ENTER → pellizca
    // En la zona muerta (entre ENTER y EXIT) mantiene el estado.
    expect(d.update(pinchPose((PINCH_ENTER + PINCH_EXIT) / 2))).toBe(true);
    expect(d.update(pinchPose(0.9))).toBe(false); // > PINCH_EXIT → suelta
  });

  it("arranca abierto y no se activa en la zona muerta", () => {
    const d = new PinchDetector();
    expect(d.update(pinchPose((PINCH_ENTER + PINCH_EXIT) / 2))).toBe(false);
  });

  it("se desactiva ante mano inválida", () => {
    const d = new PinchDetector();
    d.update(pinchPose(0.4));
    expect(d.update(undefined)).toBe(false);
    expect(d.pinching).toBe(false);
  });
});

describe("isFingerExtended / extendedFingerCount", () => {
  // Punta más lejos de la muñeca que el PIP → extendido.
  const extended = (tipIdx: number, pipIdx: number) => ({
    [pipIdx]: lm(0, 0.4),
    [tipIdx]: lm(0, 0.1),
  });
  const folded = (tipIdx: number, pipIdx: number) => ({
    [pipIdx]: lm(0, 0.4),
    [tipIdx]: lm(0, 0.7),
  });

  it("detecta un dedo estirado vs doblado", () => {
    expect(isFingerExtended(hand(extended(8, 6)), "index")).toBe(true);
    expect(isFingerExtended(hand(folded(8, 6)), "index")).toBe(false);
  });

  it("cuenta los dedos extendidos (mano abierta ≈ 4)", () => {
    const open = hand({
      ...extended(8, 6),
      ...extended(12, 10),
      ...extended(16, 14),
      ...extended(20, 18),
    });
    expect(extendedFingerCount(open)).toBe(4);
    expect(extendedFingerCount(hand())).toBe(0);
  });

  it("false ante mano inválida", () => {
    expect(isFingerExtended(undefined, "index")).toBe(false);
  });
});
