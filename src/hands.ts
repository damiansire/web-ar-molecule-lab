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

// Vendorizado desde npm a public/mediapipe/ por scripts/vendor-mediapipe.mjs
// (predev/prebuild) — servido desde 'self', no jsdelivr. BASE_URL resuelve
// correcto tanto en dev ('/') como en GitHub Pages ('/web-ar-molecule-lab/').
const WASM_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`;
// El modelo (.task) es un binario de datos ajeno al paquete npm — sigue en el
// CDN de Google (ver vite.config.ts para el porqué de no vendorizarlo).
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

// Si un frame en vuelo no recibe `result` en este lapso, asumimos que el worker
// se perdió el mensaje o murió y reseteamos `busy` para no congelar el tracking.
export const WORKER_RESULT_TIMEOUT_MS = 2000;

// Si el handshake de init() (worker listo o CDN de MediaPipe respondiendo) no
// resuelve en este lapso, asumimos que el worker/CDN está colgado y caemos al
// fallback síncrono en vez de dejar al usuario esperando para siempre en
// "Cargando…" (el watchdog de arriba cubre el pump por-frame; este cubre el
// arranque, que hoy no tenía ningún límite).
export const WORKER_INIT_TIMEOUT_MS = 9000;

/**
 * ¿El back-pressure del worker está vencido? Lógica pura del watchdog: dado que
 * hay un frame en vuelo (`busy`), decide si ya pasó demasiado tiempo desde el
 * último post como para soltar `busy` y no congelar el tracking para siempre.
 */
export function isWorkerBackpressureStale(
  busy: boolean,
  now: number,
  lastPostAt: number,
  timeoutMs: number = WORKER_RESULT_TIMEOUT_MS,
): boolean {
  return busy && now - lastPostAt > timeoutMs;
}

export class HandTracker {
  private worker: Worker | null = null;
  private busy = false;
  /** `performance.now()` del último frame posteado al worker (watchdog). */
  private lastPostAt = 0;
  private workerDead = false;
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
      //
      // BASE_URL, no un path absoluto de raíz: GitHub Pages sirve el proyecto
      // bajo /web-ar-molecule-lab/ (vite.config.ts base), así que
      // '/hands-worker.js' resolvía a la RAÍZ del dominio y daba 404 en
      // producción — degradando en silencio al fallback síncrono (bloqueante)
      // en cada frame, sin que ningún error visible lo delatara.
      const worker = new Worker(`${import.meta.env.BASE_URL}hands-worker.js`);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => { cleanup(); reject(new Error('hand worker init timed out (CDN/WASM colgado)')); },
          WORKER_INIT_TIMEOUT_MS,
        );
        const onMsg = (e: MessageEvent) => {
          if (e.data?.type === 'ready') { cleanup(); resolve(); }
          else if (e.data?.type === 'error') { cleanup(); reject(new Error(e.data.message)); }
        };
        const onErr = () => { cleanup(); reject(new Error('hand worker failed to start')); };
        const cleanup = () => {
          clearTimeout(timer);
          worker.removeEventListener('message', onMsg);
          worker.removeEventListener('error', onErr);
        };
        worker.addEventListener('message', onMsg);
        worker.addEventListener('error', onErr);
        worker.postMessage({ type: 'init' });
      }).catch((err) => {
        // El timeout deja un worker a medio inicializar (o realmente colgado):
        // no lo dejamos vivo, el catch externo va a intentar el fallback síncrono.
        try { worker.terminate(); } catch { /* noop */ }
        throw err;
      });
      // Recepción continua de resultados.
      worker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type === 'result') {
          this._hands = e.data.hands as Hand[];
          this.busy = false;
          this.resultCount++;
        }
      });
      // Si el worker muere tras el init (OOM de WASM, crash del delegate GPU),
      // no queremos que `busy` quede `true` para siempre y congele el tracking:
      // lo marcamos muerto y dejamos de bombearle frames. pump() degrada a
      // "no detecta" en vez de trabarse; intentamos un fallback síncrono.
      worker.addEventListener('error', (e: ErrorEvent) => {
        console.warn('Hand worker murió; intento fallback síncrono.', e.message);
        this.handleWorkerLoss();
      });
      this.worker = worker;
    } catch (err) {
      console.warn('Hand worker no disponible; uso detección síncrona.', err);
      await this.initSync();
    }
  }

  /** Limpia el estado del worker perdido y arranca el fallback síncrono. */
  private handleWorkerLoss(): void {
    if (this.workerDead) return;
    this.workerDead = true;
    this.busy = false;
    const w = this.worker;
    this.worker = null;
    if (w) { try { w.terminate(); } catch { /* noop */ } }
    // Re-init síncrono en background; si falla, quedamos sin tracking (mejor que
    // un freeze): el resto del juego (voz, render) sigue vivo.
    this.initSync().catch((err) => console.warn('Fallback síncrono falló.', err));
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
      if (this.busy) {
        // Watchdog: si el frame en vuelo no volvió en WORKER_RESULT_TIMEOUT_MS
        // (result perdido, worker trabado/muerto sin disparar 'error'), soltamos
        // el back-pressure para no congelar el tracking de forma permanente.
        if (isWorkerBackpressureStale(this.busy, now, this.lastPostAt)) this.busy = false;
        else return; // backpressure: un frame en vuelo a la vez
      }
      const bitmap = this.grabBitmap(video);
      if (!bitmap) return;
      this.lastVideoTime = video.currentTime;
      this.lastPumpAt = now;
      this.busy = true;
      this.lastPostAt = now;
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

  /**
   * Libera el worker. Higiene de teardown: se llama al abortar el arranque o
   * cuando la página se oculta, para no dejar un worker (y su WASM) colgando.
   */
  dispose(): void {
    this.busy = false;
    const w = this.worker;
    this.worker = null;
    if (w) { try { w.terminate(); } catch { /* noop */ } }
    this.syncLandmarker = null;
  }
}

/** Índices de landmarks que usamos (solo la punta del índice por ahora). */
export const LM = {
  INDEX_TIP: 8,
} as const;
