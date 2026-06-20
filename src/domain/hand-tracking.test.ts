import { describe, it, expect } from "vitest";
import {
  landmarkToScreen,
  pickAnchor,
  depthToScale,
  ANCHOR_LANDMARK_INDEX,
  type NormalizedLandmark,
} from "./hand-tracking";

const lm = (x: number, y: number, z = 0): NormalizedLandmark => ({ x, y, z });

describe("landmarkToScreen", () => {
  it("escala coordenadas normalizadas al viewport", () => {
    expect(landmarkToScreen(lm(0.5, 0.5), 640, 480, false)).toMatchObject({
      x: 320,
      y: 240,
    });
  });

  it("espeja el eje X cuando el video está reflejado", () => {
    expect(landmarkToScreen(lm(0.25, 0.5), 640, 480, true).x).toBe(480);
    expect(landmarkToScreen(lm(0.25, 0.5), 640, 480, false).x).toBe(160);
  });

  it("preserva la profundidad z", () => {
    expect(landmarkToScreen(lm(0, 0, -0.3), 100, 100, false).z).toBe(-0.3);
  });
});

describe("pickAnchor", () => {
  it("devuelve el landmark ancla de la primera mano", () => {
    const hand = Array.from({ length: 21 }, (_, i) => lm(i / 21, 0));
    const anchor = pickAnchor([hand]);
    expect(anchor).toBe(hand[ANCHOR_LANDMARK_INDEX]);
  });

  it("devuelve null si no hay manos", () => {
    expect(pickAnchor([])).toBeNull();
  });

  it("devuelve null si la mano está incompleta", () => {
    expect(pickAnchor([[lm(0, 0), lm(0.1, 0.1)]])).toBeNull();
  });
});

describe("depthToScale", () => {
  it("queda acotado dentro de [min, max]", () => {
    expect(depthToScale(-100)).toBe(1.8);
    expect(depthToScale(100)).toBe(0.6);
  });

  it("mano más cerca (z negativo) → figura más grande", () => {
    expect(depthToScale(-0.05)).toBeGreaterThan(depthToScale(0));
  });
});
