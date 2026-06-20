/**
 * Configuración centralizada de los assets de MediaPipe.
 *
 * Se cargan desde el CDN oficial de jsDelivr, fijados a la versión exacta del
 * paquete `@mediapipe/tasks-vision` instalado. Si en el futuro se quieren
 * self-hostear, basta con copiar el directorio `wasm` y el `.task` a `public/`
 * y cambiar estas dos URLs por rutas locales.
 */
const TASKS_VISION_VERSION = "0.10.35";

export const MEDIAPIPE = {
  /** Fileset WASM (SIMD / no-SIMD) que resuelve MediaPipe en runtime. */
  wasmBase: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`,
  /** Modelo de detección de manos (float16, 1 mano). */
  handLandmarkerModel:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
} as const;
