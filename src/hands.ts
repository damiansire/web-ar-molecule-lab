/**
 * Tracking de manos sobre un <video>, desacoplado del render.
 *
 * La detección de MediaPipe es síncrona y bloquea el hilo que la corre, así que
 * la delegamos a un Web Worker (ver hands.worker.ts). El loop principal solo
 * "bombea" frames (createImageBitmap, transferible) cuando el worker está libre
 * y lee el último resultado disponible — nunca espera la inferencia. Si el worker
 * o las APIs necesarias no están disponibles, cae a detección síncrona.
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

// Frame que mandamos al detector: 480px de ancho alcanza para los landmarks y
// abarata el upload + la inferencia (el render usa el video full-res aparte).
const DETECT_WIDTH = 480;

export interface Hand {
  /** 'Left' | 'Right' según MediaPipe (perspectiva de la cámara). */
  handedness: string;
  /** 21 landmarks normalizados (x,y en [0,1] sobre el frame sin espejar). */
  landmarks: NormalizedLandmark[];
}

// No tiene sentido detectar más rápido que esto: el dwell de la UI no lo
// necesita y limita cuántas veces por segundo agarramos un frame.
const MIN_DETECT_INTERVAL_MS = 33; // ~30 Hz

export class HandTracker {
  private worker: Worker | null = null;
  private busy = false;
  private lastVideoTime = -1;
  private lastPumpAt = 0;
  private _hands: Hand[] = [];

  // Canvas reusado para bajar el frame a tamaño de detección sin readback caro.
  private grab: OffscreenCanvas | null = null;
  private grabCtx: OffscreenCanvasRenderingContext2D | null = null;

  // Fallback síncrono (solo si el worker no se pudo inicializar).
  private syncLandmarker: HandLandmarker | null = null;
  private syncLastTs = 0;

  /** Contador de detecciones completadas (para medir Hz reales). */
  resultCount = 0;

  /** Último resultado de detección (se actualiza async desde el worker). */
  get hands(): Hand[] {
    return this._hands;
  }

  async init(): Promise<void> {
    try {
      // Worker clásico servido desde /public (ver hands-worker.js): corre la
      // inferencia fuera del hilo principal. Clásico —no module— porque
      // MediaPipe usa importScripts para su loader de WASM.
      const worker = new Worker('/hands-worker.js');
      await new Promise<void>((resolve, reject) => {
        const onMsg = (e: MessageEvent) => {
          if (e.data?.type === 'ready') { cleanup(); resolve(); }
          else if (e.data?.type === 'error') { cleanup(); reject(new Error(e.data.message)); }
        };
        const onErr = () => { cleanup(); reject(new Error('hand worker failed to start')); };
        const cleanup = () => {
          worker.removeEventListener('message', onMsg);
          worker.removeEventListener('error', onErr);
        };
        worker.addEventListener('message', onMsg);
        worker.addEventListener('error', onErr);
        worker.postMessage({ type: 'init' });
      });
      // Recepción continua de resultados.
      worker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'result') {
          this._hands = e.data.hands as Hand[];
          this.busy = false;
          this.resultCount++;
        }
      });
      this.worker = worker;
    } catch (err) {
      console.warn('Hand worker no disponible; uso detección síncrona.', err);
      await this.initSync();
    }
  }

  private async initSync(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    this.syncLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      numHands: 2,
      runningMode: 'VIDEO',
    });
  }

  /**
   * No bloquea: si hay worker libre, le manda el frame actual; si no, detecta
   * de forma síncrona (fallback). Lee el resultado vía `hands`.
   */
  pump(video: HTMLVideoElement, now: number): void {
    if (now - this.lastPumpAt < MIN_DETECT_INTERVAL_MS) return;
    if (video.currentTime === this.lastVideoTime) return;

    if (this.worker) {
      if (this.busy) return; // backpressure: un frame en vuelo a la vez
      const bitmap = this.grabBitmap(video);
      if (!bitmap) return;
      this.lastVideoTime = video.currentTime;
      this.lastPumpAt = now;
      this.busy = true;
      this.worker.postMessage({ type: 'frame', bitmap, timestamp: Math.round(now) }, [bitmap]);
      return;
    }

    if (this.syncLandmarker) {
      this.lastVideoTime = video.currentTime;
      this.lastPumpAt = now;
      let ts = Math.round(now);
      if (ts <= this.syncLastTs) ts = this.syncLastTs + 1;
      this.syncLastTs = ts;
      const res = this.syncLandmarker.detectForVideo(video, ts);
      this._hands = res.landmarks.map((landmarks, i) => ({
        handedness: res.handednesses[i]?.[0]?.categoryName ?? 'Unknown',
        landmarks,
      }));
      this.resultCount++;
    }
  }

  /**
   * Baja el frame a DETECT_WIDTH en un canvas reusado y lo entrega como
   * ImageBitmap transferible. drawImage + transferToImageBitmap es síncrono y
   * barato (escala en GPU), a diferencia de createImageBitmap(video) que puede
   * forzar un readback. Devuelve null si el video todavía no tiene tamaño.
   */
  private grabBitmap(video: HTMLVideoElement): ImageBitmap | null {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return null;
    try {
      if (!this.grab) {
        const h = Math.max(1, Math.round(DETECT_WIDTH * (vh / vw)));
        this.grab = new OffscreenCanvas(DETECT_WIDTH, h);
        this.grabCtx = this.grab.getContext('2d');
      }
      if (!this.grabCtx) return null;
      this.grabCtx.drawImage(video, 0, 0, this.grab.width, this.grab.height);
      return this.grab.transferToImageBitmap();
    } catch {
      return null;
    }
  }
}

/** Índices de landmarks que usamos. */
export const LM = {
  WRIST: 0,
  THUMB_TIP: 4,
  INDEX_TIP: 8,
} as const;
