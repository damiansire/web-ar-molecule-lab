import { describe, it, expect } from "vitest";
import { FIGURES, DEFAULT_FIGURE, isFigureKind } from "./figures";

describe("figures", () => {
  it("la figura por defecto existe en el catálogo", () => {
    expect(FIGURES.some((f) => f.kind === DEFAULT_FIGURE)).toBe(true);
  });

  it("isFigureKind valida correctamente", () => {
    expect(isFigureKind("cube")).toBe(true);
    expect(isFigureKind("dodecaedro")).toBe(false);
    expect(isFigureKind(42)).toBe(false);
    expect(isFigureKind(undefined)).toBe(false);
  });

  it("no hay kinds duplicados", () => {
    const kinds = FIGURES.map((f) => f.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
