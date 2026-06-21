/**
 * Catálogo de "experiencias" creativas que el usuario puede elegir: desde las
 * figuras 3D clásicas hasta efectos interactivos al estilo de los filtros con IA
 * (dibujar con el dedo, atrapar círculos, galaxia/planeta, láseres entre manos).
 *
 * Data pura (sin Three.js): la usan tanto la UI (selector) como el render
 * (fábrica de experiencias). Cada modo decide internamente cómo usa las manos.
 */
export type ExperienceKind = "figuras" | "dibujo" | "atrapar" | "galaxia" | "lasers";

export interface ExperienceDef {
  readonly kind: ExperienceKind;
  readonly label: string;
  /** Instrucción corta que se muestra al elegir el modo. */
  readonly hint: string;
}

export const EXPERIENCES: readonly ExperienceDef[] = [
  {
    kind: "figuras",
    label: "Figuras 3D",
    hint: "Mové la mano: la figura te sigue",
  },
  {
    kind: "dibujo",
    label: "Dibujar",
    hint: "Dibujá con el índice · juntá los dedos para mover sin pintar",
  },
  {
    kind: "atrapar",
    label: "Atrapar",
    hint: "Atrapá los círculos con la mano y sumá puntos",
  },
  {
    kind: "galaxia",
    label: "Galaxia",
    hint: "Pellizcá para formar un planeta · soltá para el destello",
  },
  {
    kind: "lasers",
    label: "Láseres",
    hint: "Mostrá las dos manos: los dedos se conectan con rayos",
  },
] as const;

export const DEFAULT_EXPERIENCE: ExperienceKind = "figuras";

const VALID_KINDS = new Set<ExperienceKind>(EXPERIENCES.map((e) => e.kind));

export function isExperienceKind(value: unknown): value is ExperienceKind {
  return typeof value === "string" && VALID_KINDS.has(value as ExperienceKind);
}

export function experienceHint(kind: ExperienceKind): string {
  return EXPERIENCES.find((e) => e.kind === kind)?.hint ?? "";
}
