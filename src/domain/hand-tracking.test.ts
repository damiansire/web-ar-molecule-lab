import { describe, it, expect } from "vitest";
import {
  landmarkToScreen,
  pickAnchor,
  handPerspectiveScale,
  ANCHOR_LANDMARK_INDEX,
  WRIST_LANDMARK_INDEX,
  SPAN_REFERENCE,
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

describe("handPerspectiveScale", () => {
  // Construye una mano (21 landmarks) con la muñeca y el MCP separados `span`
  // en Y (normalizado), el resto irrelevante.
  const handWithSpan = (span: number): NormalizedLandmark[] => {
    const h = Array.from({ length: 21 }, () => lm(0.5, 0.5));
    h[WRIST_LANDMARK_INDEX] = lm(0.5, 0.5);
    h[ANCHOR_LANDMARK_INDEX] = lm(0.5, 0.5 - span);
    return h;
  };

  it("escala ~1 a la distancia de referencia (frame cuadrado)", () => {
    const s = handPerspectiveScale(handWithSpan(SPAN_REFERENCE), 480, 480);
    expect(s).toBeCloseTo(1, 5);
  });

  it("mano más cerca (más separación) → figura más grande", () => {
    const cerca = handPerspectiveScale(handWithSpan(SPAN_REFERENCE * 1.5), 480, 480);
    const lejos = handPerspectiveScale(handWithSpan(SPAN_REFERENCE * 0.6), 480, 480);
    expect(cerca).toBeGreaterThan(lejos);
  });

  it("queda acotado dentro de [min, max]", () => {
    expect(handPerspectiveScale(handWithSpan(5), 480, 480)).toBe(2.5);
    expect(handPerspectiveScale(handWithSpan(0.001), 480, 480)).toBe(0.35);
  });

  it("sin mano válida → escala neutra (1)", () => {
    expect(handPerspectiveScale(undefined, 480, 480)).toBe(1);
    expect(handPerspectiveScale([lm(0, 0)], 480, 480)).toBe(1);
  });
});
