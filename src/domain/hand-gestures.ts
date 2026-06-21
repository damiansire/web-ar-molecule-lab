/**
 * Gestos de mano derivados de los landmarks de MediaPipe. Lógica pura (sin DOM
 * ni Three.js) y escala-invariante: las distancias entre dedos se normalizan por
 * el "palmo" de la mano (muñeca↔base del dedo medio), así los umbrales valen
 * igual con la mano cerca o lejos de la cámara.
 *
 * Complementa a `hand-tracking.ts` (que mapea landmarks a pantalla); acá vive la
 * interpretación de los gestos que disparan las experiencias creativas.
 */
import type { NormalizedLandmark } from "./hand-tracking";
import { WRIST_LANDMARK_INDEX, ANCHOR_LANDMARK_INDEX } from "./hand-tracking";

/** Índices de las puntas de los dedos (pulgar→meñique) en el modelo de 21 puntos. */
export const FINGERTIPS = {
  thumb: 4,
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
} as const;

/** Articulación PIP (segunda falange) de cada dedo, para medir extensión. */
export const FINGER_PIP = {
  index: 6,
  middle: 10,
  ring: 14,
  pinky: 18,
} as const;

export type FingerName = keyof typeof FINGERTIPS;

/** Distancia euclidiana 2D entre dos landmarks (en su mismo espacio). */
export function distance2D(
  a: NormalizedLandmark | undefined,
  b: NormalizedLandmark | undefined,
): number {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * "Palmo" de la mano: distancia muñeca↔base del dedo medio en espacio
 * normalizado. Sirve como unidad de referencia para hacer los umbrales de gesto
 * independientes de la distancia a la cámara. Devuelve 0 si la mano no es válida.
 */
export function handSpan(hand: readonly NormalizedLandmark[] | undefined): number {
  const wrist = hand?.[WRIST_LANDMARK_INDEX];
  const mid = hand?.[ANCHOR_LANDMARK_INDEX];
  if (!wrist || !mid) return 0;
  return Math.hypot(wrist.x - mid.x, wrist.y - mid.y);
}

/** Punta de un dedo, o `null` si la mano está incompleta. */
export function fingertip(
  hand: readonly NormalizedLandmark[] | undefined,
  finger: FingerName,
): NormalizedLandmark | null {
  return hand?.[FINGERTIPS[finger]] ?? null;
}

/**
 * Separación pulgar↔índice **relativa al palmo** de la mano (escala-invariante).
 * ~0.2–0.5 cuando los dedos se tocan (pinza), >1 con la mano abierta. Devuelve
 * `null` si la mano no es válida.
 */
export function pinchRatio(hand: readonly NormalizedLandmark[] | undefined): number | null {
  const thumb = hand?.[FINGERTIPS.thumb];
  const index = hand?.[FINGERTIPS.index];
  const span = handSpan(hand);
  if (!thumb || !index || span <= 0) return null;
  return distance2D(thumb, index) / span;
}

/** Umbrales de la pinza con histéresis (entra apretando, sale soltando). */
export const PINCH_ENTER = 0.55;
export const PINCH_EXIT = 0.8;

/**
 * Detector de pinza con histéresis: una vez cerrada, hay que abrir bastante para
 * soltar (evita el parpadeo cuando los dedos quedan cerca del umbral). Stateful
 * y puro: una instancia por mano.
 */
export class PinchDetector {
  private active = false;

  /** Actualiza el estado con la mano del frame y devuelve si está pellizcando. */
  update(hand: readonly NormalizedLandmark[] | undefined): boolean {
    const r = pinchRatio(hand);
    if (r === null) {
      this.active = false;
      return false;
    }
    if (this.active) {
      if (r > PINCH_EXIT) this.active = false;
    } else {
      if (r < PINCH_ENTER) this.active = true;
    }
    return this.active;
  }

  get pinching(): boolean {
    return this.active;
  }

  reset(): void {
    this.active = false;
  }
}

/**
 * ¿El dedo está extendido? Heurística: la punta está más lejos de la muñeca que
 * su articulación PIP (el dedo "apunta" hacia afuera). Sirve para distinguir
 * dibujar (índice estirado) de mover (mano cerrada/pinza).
 */
export function isFingerExtended(
  hand: readonly NormalizedLandmark[] | undefined,
  finger: Exclude<FingerName, "thumb">,
): boolean {
  const wrist = hand?.[WRIST_LANDMARK_INDEX];
  const tip = hand?.[FINGERTIPS[finger]];
  const pip = hand?.[FINGER_PIP[finger]];
  if (!wrist || !tip || !pip) return false;
  return distance2D(wrist, tip) > distance2D(wrist, pip);
}

/**
 * Cantidad de dedos (índice→meñique) extendidos. 0 ≈ puño, 4 ≈ mano abierta.
 * No cuenta el pulgar (su extensión es ambigua con esta heurística).
 */
export function extendedFingerCount(
  hand: readonly NormalizedLandmark[] | undefined,
): number {
  let n = 0;
  for (const f of ["index", "middle", "ring", "pinky"] as const) {
    if (isFingerExtended(hand, f)) n++;
  }
  return n;
}
