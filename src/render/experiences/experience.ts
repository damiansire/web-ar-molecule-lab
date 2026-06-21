/**
 * Contrato de una "experiencia" creativa: un modo interactivo que vive dentro de
 * la escena de Three.js (misma cámara ortográfica 1:1 a píxeles que las figuras).
 *
 * Cada experiencia maneja sus propios objetos: los cuelga de `object`, que
 * `ARScene` agrega a la escena al activarla y le saca/dispone al cambiar de modo.
 * El loop de `ARScene` llama `update(ctx)` por frame con las manos y el `dt`.
 */
import type { Object3D } from "three/webgpu";
import type { NormalizedLandmark } from "../../domain/hand-tracking";

export interface ExperienceContext {
  /** Manos del frame (hasta 2), 21 landmarks normalizados cada una. */
  hands: readonly (readonly NormalizedLandmark[])[];
  /** Tamaño del viewport en píxeles. */
  width: number;
  height: number;
  /** Vista espejada (selfie): debe coincidir con el espejado del video. */
  mirrored: boolean;
  /** Delta de tiempo del frame en segundos. */
  dt: number;
  /** Tiempo acumulado en segundos (para animaciones). */
  time: number;
  /** Color elegido por el usuario (hex CSS), para teñir los efectos. */
  color: string;
}

export interface Experience {
  /** Raíz de los objetos del modo; ARScene la agrega/saca de la escena. */
  readonly object: Object3D;
  /** Avanza un frame del efecto. */
  update(ctx: ExperienceContext): void;
  /** Texto para el HUD (ej. puntaje), o `null` si el modo no muestra nada. */
  hud(): string | null;
  /** Reinicia el estado del efecto (sin recrear objetos). */
  reset(): void;
  /** Libera geometrías y materiales. */
  dispose(): void;
}
