import { describe, it, expect } from "vitest";
import {
  EXPERIENCES,
  DEFAULT_EXPERIENCE,
  isExperienceKind,
  experienceHint,
} from "./experiences";

describe("experiences", () => {
  it("la experiencia por defecto existe en el catálogo", () => {
    expect(EXPERIENCES.some((e) => e.kind === DEFAULT_EXPERIENCE)).toBe(true);
  });

  it("isExperienceKind valida correctamente", () => {
    expect(isExperienceKind("galaxia")).toBe(true);
    expect(isExperienceKind("figuras")).toBe(true);
    expect(isExperienceKind("inexistente")).toBe(false);
    expect(isExperienceKind(7)).toBe(false);
    expect(isExperienceKind(undefined)).toBe(false);
  });

  it("no hay kinds duplicados", () => {
    const kinds = EXPERIENCES.map((e) => e.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("toda experiencia tiene label y hint no vacíos", () => {
    for (const e of EXPERIENCES) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.hint.length).toBeGreaterThan(0);
    }
  });

  it("experienceHint devuelve el hint del modo", () => {
    expect(experienceHint("atrapar")).toContain("círculos");
    expect(experienceHint("figuras")).toBeTruthy();
  });
});
