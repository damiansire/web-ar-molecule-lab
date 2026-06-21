/**
 * Wrapper fino sobre MediaPipe HandLandmarker.
 * Detecta hasta 2 manos (21 landmarks normalizados c/u) sobre un <video>.
 * El modelo y el runtime WASM se cargan desde CDN para no inflar el bundle.
 */
import {
  HandLandmarker,
  FilesetResolver,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export interface Hand {
  /** 'Left' | 'Right' según MediaPipe (perspectiva de la cámara). */
  handedness: string;
  /** 21 landmarks normalizados (x,y en [0,1] sobre el frame sin espejar). */
  landmarks: NormalizedLandmark[];
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      numHands: 2,
      runningMode: 'VIDEO',
    });
  }

  /** Detecta manos en el frame actual del video para el timestamp dado (ms). */
  detect(video: HTMLVideoElement, timestampMs: number): Hand[] {
    if (!this.landmarker) return [];
    const res = this.landmarker.detectForVideo(video, timestampMs);
    return res.landmarks.map((landmarks, i) => ({
      handedness: res.handednesses[i]?.[0]?.categoryName ?? 'Unknown',
      landmarks,
    }));
  }
}

/** Índices de landmarks que usamos. */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
} as const;
