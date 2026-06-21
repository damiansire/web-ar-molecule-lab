/**
 * Fábrica de experiencias: traduce un `ExperienceKind` (data del dominio) a la
 * instancia de render correspondiente. "figuras" no es una Experience: es el
 * modo clásico que maneja directamente `ARScene`, así que devuelve `null`.
 */
import type { ExperienceKind } from "../../domain/experiences";
import type { Experience } from "./experience";
import { DrawExperience } from "./draw-experience";
import { CatchExperience } from "./catch-experience";
import { GalaxyExperience } from "./galaxy-experience";
import { LaserExperience } from "./laser-experience";

export type { Experience, ExperienceContext } from "./experience";

export function createExperience(kind: ExperienceKind): Experience | null {
  switch (kind) {
    case "figuras":
      return null;
    case "dibujo":
      return new DrawExperience();
    case "atrapar":
      return new CatchExperience();
    case "galaxia":
      return new GalaxyExperience();
    case "lasers":
      return new LaserExperience();
  }
}
