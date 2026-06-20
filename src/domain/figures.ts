/**
 * Catálogo de figuras 3D que el usuario puede superponer sobre su mano.
 * Es data pura (sin Three.js) para poder testearla y reutilizarla en la UI.
 */
export type FigureKind =
  | "none"
  | "square"
  | "cube"
  | "cylinder"
  | "cone"
  | "torus"
  | "sphere";

export interface FigureDef {
  readonly kind: FigureKind;
  readonly label: string;
}

export const FIGURES: readonly FigureDef[] = [
  { kind: "none", label: "Ninguna" },
  { kind: "square", label: "Cuadrado" },
  { kind: "cube", label: "Cubo" },
  { kind: "cylinder", label: "Cilindro" },
  { kind: "cone", label: "Cono" },
  { kind: "torus", label: "Toro" },
  { kind: "sphere", label: "Esfera" },
] as const;

export const DEFAULT_FIGURE: FigureKind = "cube";

const VALID_KINDS = new Set<FigureKind>(FIGURES.map((f) => f.kind));

export function isFigureKind(value: unknown): value is FigureKind {
  return typeof value === "string" && VALID_KINDS.has(value as FigureKind);
}
