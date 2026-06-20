/**
 * Geometría pura para traducir los landmarks normalizados de MediaPipe
 * (cada coordenada en el rango 0..1) a coordenadas de pantalla en píxeles.
 * Sin dependencias de DOM ni de Three.js, así se puede testear de forma aislada.
 */
export interface NormalizedLandmark {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  /** Profundidad relativa que reporta MediaPipe (negativa = más cerca). */
  readonly z: number;
}

/**
 * Índice del landmark usado como ancla de la figura.
 * 9 = base del dedo medio (MIDDLE_FINGER_MCP) ≈ centro de la palma,
 * mucho más estable que la punta de un dedo.
 */
export const ANCHOR_LANDMARK_INDEX = 9;

/**
 * Convierte un landmark normalizado a píxeles dentro de un viewport de
 * `width`×`height`. Si `mirrored` es true (vista tipo "selfie"), se espeja
 * el eje X para que el overlay coincida con el video reflejado.
 */
export function landmarkToScreen(
  landmark: NormalizedLandmark,
  width: number,
  height: number,
  mirrored: boolean,
): ScreenPoint {
  const nx = mirrored ? 1 - landmark.x : landmark.x;
  return {
    x: nx * width,
    y: landmark.y * height,
    z: landmark.z,
  };
}

/**
 * Devuelve el landmark ancla de la primera mano detectada, o `null` si no hay
 * ninguna mano o la lista está incompleta.
 */
export function pickAnchor(
  hands: readonly (readonly NormalizedLandmark[])[],
): NormalizedLandmark | null {
  const first = hands[0];
  if (!first || first.length <= ANCHOR_LANDMARK_INDEX) return null;
  return first[ANCHOR_LANDMARK_INDEX] ?? null;
}

/**
 * Factor de escala de la figura según la cercanía de la mano.
 * `z` de MediaPipe es ~0 en la muñeca y negativo cuanto más cerca está la
 * cámara; lo mapeamos a un rango acotado para que la figura "respire" sin
 * desaparecer ni explotar.
 */
export function depthToScale(z: number, min = 0.6, max = 1.8): number {
  const raw = 1 - z * 6; // z negativo → escala > 1
  return Math.min(max, Math.max(min, raw));
}
