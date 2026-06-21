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

/** Índice de la muñeca (WRIST). */
export const WRIST_LANDMARK_INDEX = 0;
/** Índices de la base del índice y del meñique (para el plano de la palma). */
export const INDEX_MCP_INDEX = 5;
export const PINKY_MCP_INDEX = 17;

/**
 * Distancia muñeca↔base-del-dedo-medio (relativa a la altura del frame) que
 * mapea a escala 1. Ajustado empíricamente para una mano a distancia media.
 */
export const SPAN_REFERENCE = 0.18;

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
 * Devuelve el landmark ancla de una mano, o `null` si la lista está incompleta.
 */
export function anchorOf(
  hand: readonly NormalizedLandmark[] | undefined,
): NormalizedLandmark | null {
  if (!hand || hand.length <= ANCHOR_LANDMARK_INDEX) return null;
  return hand[ANCHOR_LANDMARK_INDEX] ?? null;
}

/**
 * Devuelve el landmark ancla de la primera mano detectada, o `null` si no hay
 * ninguna mano o la lista está incompleta.
 */
export function pickAnchor(
  hands: readonly (readonly NormalizedLandmark[])[],
): NormalizedLandmark | null {
  return anchorOf(hands[0]);
}

/**
 * Escala por perspectiva según el tamaño aparente de la mano: cuanto más cerca
 * está de la cámara, más separados se ven los landmarks (mano más grande en
 * pantalla) → figura más grande; al alejarse, se juntan → más chica.
 *
 * Mide la distancia muñeca↔base-del-dedo-medio en píxeles (aspect-correcto) y
 * la normaliza por la altura del frame (independiente de la resolución). El
 * resultado se acota para que la figura no desaparezca ni explote.
 */
/**
 * "Winding" normalizado del triángulo de la palma (muñeca→base-índice→
 * base-meñique), en el rango [-1, 1]. Es ~sen(ángulo) de apertura proyectado:
 *
 *  - el SIGNO indica la orientación (palma vs dorso) y se invierte al dar vuelta
 *    la mano;
 *  - la MAGNITUD indica confianza: ~0 cuando la mano está de canto (ambiguo).
 *
 * Devuelve 0 si la mano no es válida. No depende del espejado de la pantalla
 * (la orientación física es invariante al espejo).
 *
 * OJO con la lateralidad: para una mano dada el signo es estable, pero NO es
 * invariante a izquierda/derecha (el triángulo muñeca→índice→meñique gira al
 * revés en la otra mano). Esta función devuelve el winding CRUDO y no resuelve
 * ese signo absoluto: para hacerlo haría falta la lateralidad (handedness) de
 * MediaPipe, que el único consumidor (ar-scene) decidió NO usar para evitar el
 * parpadeo Left↔Right. En consecuencia, palma/dorso quedan calibrados para la
 * mano DERECHA del usuario y se invierten con la mano izquierda.
 */
export function palmWinding(hand: readonly NormalizedLandmark[] | undefined): number {
  const wrist = hand?.[WRIST_LANDMARK_INDEX];
  const index = hand?.[INDEX_MCP_INDEX];
  const pinky = hand?.[PINKY_MCP_INDEX];
  if (!wrist || !index || !pinky) return 0;
  const ax = index.x - wrist.x;
  const ay = index.y - wrist.y;
  const bx = pinky.x - wrist.x;
  const by = pinky.y - wrist.y;
  const cross = ax * by - ay * bx;
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  return la && lb ? cross / (la * lb) : 0;
}

export function handPerspectiveScale(
  hand: readonly NormalizedLandmark[] | undefined,
  width: number,
  height: number,
  min = 0.35,
  max = 2.5,
): number {
  const wrist = hand?.[WRIST_LANDMARK_INDEX];
  const mcp = hand?.[ANCHOR_LANDMARK_INDEX];
  if (!wrist || !mcp) return 1;
  const dx = (wrist.x - mcp.x) * width;
  const dy = (wrist.y - mcp.y) * height;
  const spanRel = Math.hypot(dx, dy) / height;
  return Math.min(max, Math.max(min, spanRel / SPAN_REFERENCE));
}
