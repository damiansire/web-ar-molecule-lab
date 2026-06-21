/**
 * Cliente del worker de inferencia para el hilo principal.
 *
 * Se encarga de: arrancar el worker, capturar cuadros del <video> como
 * `ImageBitmap` (transferibles, sin copia), aplicar back-pressure (un solo
 * cuadro en vuelo) y entregar los últimos landmarks vía callback.
 */
import type { NormalizedLandmark } from "../domain/hand-tracking";
import type { WorkerRequest, WorkerResponse } from "./protocol";
import { MEDIAPIPE } from "../config";
import { supportsGpuDelegate } from "../domain/platform";
import { BackPressure } from "./back-pressure";

export type HandsListener = (hands: NormalizedLandmark[][]) => void;

export class HandTracker {
  private worker!: Worker;
  // Back-pressure de un solo cuadro en vuelo (lógica pura testeada).
  private gate = new BackPressure();
  private ready = false;
  private disposed = false;
  private listener: HandsListener | null = null;
  /** Delegate efectivamente usado, para diagnóstico. */
  delegate: "GPU" | "CPU" | null = null;

  constructor() {
    this.createWorker();
  }

  private createWorker(): void {
    // Worker clásico (sin `type: "module"`): el worker no tiene imports ESM y
    // carga MediaPipe con `importScripts`. Ver nota en el archivo del worker.
    this.worker = new Worker(new URL("./hand-landmarker.worker.ts", import.meta.url));
  }

  /**
   * Arranca el worker y resuelve cuando el modelo quedó cargado. Intenta GPU
   * primero; si no responde a tiempo (algunos navegadores cuelgan el worker con
   * el delegate GPU), recrea el worker y reintenta forzando CPU.
   */
  init(): Promise<void> {
    return this.attempt(false, 15000).catch(() => {
      this.worker.terminate(); // pudo quedar colgado en la init de GPU
      this.createWorker();
      this.gate.reset(); // worker nuevo: no hay nada en vuelo
      return this.attempt(true, 30000);
    });
  }

  private attempt(forceCpu: boolean, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        this.worker.removeEventListener("message", onMessage);
        this.worker.removeEventListener("error", onError);
        clearTimeout(timer);
      };
      const onError = (e: ErrorEvent) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Worker error: ${e.message || "no se pudo cargar el worker"}`));
      };
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "ready") {
          if (settled) return;
          settled = true;
          cleanup();
          this.ready = true;
          this.delegate = msg.delegate;
          this.worker.addEventListener("message", this.onResult);
          resolve();
        } else if (msg.type === "init-error") {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(msg.message));
        }
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("timeout"));
      }, timeoutMs);
      this.worker.addEventListener("message", onMessage);
      this.worker.addEventListener("error", onError);
      const req: WorkerRequest = {
        type: "init",
        bundleUrl: MEDIAPIPE.bundle,
        wasmBase: MEDIAPIPE.wasmBase,
        modelUrl: MEDIAPIPE.handLandmarkerModel,
        forceCpu,
        // Gate por navegador (la lógica testeada): el worker confirma luego con
        // su `hasWebGl2()` real, por eso acá asumimos WebGL2 presente.
        allowGpu: supportsGpuDelegate(navigator.userAgent, true),
      };
      this.worker.postMessage(req);
    });
  }

  onHands(listener: HandsListener): void {
    this.listener = listener;
  }

  /**
   * Envía un cuadro del video al worker. Si todavía hay uno procesándose,
   * lo descarta (mejor saltear cuadros que acumular latencia).
   */
  async track(source: HTMLVideoElement, timestamp: number): Promise<void> {
    if (!this.ready || !this.gate.tryAcquire()) return; // dropea si hay uno en vuelo
    const vw = source.videoWidth;
    const vh = source.videoHeight;
    if (!vw || !vh) {
      this.gate.release(); // todavía no hay cuadro de video: liberamos el gate
      return;
    }
    try {
      // Reducimos el cuadro a ~320px en el lado mayor (preservando aspecto)
      // antes de mandarlo al worker: el detector no necesita más resolución y
      // así abaratamos el createImageBitmap, la transferencia y el preprocesado.
      const scale = Math.min(1, 320 / Math.max(vw, vh));
      const bitmap = await createImageBitmap(source, {
        resizeWidth: Math.round(vw * scale),
        resizeHeight: Math.round(vh * scale),
        resizeQuality: "low",
      });
      // Carrera con dispose(): si el tracker se descartó mientras esperábamos el
      // bitmap, NO lo posteamos a un worker muerto (se fugaría sin .close()).
      // Lo cerramos acá y soltamos el gate (K-2).
      if (this.disposed) {
        bitmap.close();
        this.gate.release();
        return;
      }
      const req: WorkerRequest = { type: "frame", bitmap, timestamp };
      this.worker.postMessage(req, [bitmap]);
    } catch {
      this.gate.release();
    }
  }

  private onResult = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (msg.type === "result") {
      this.gate.release();
      this.listener?.(msg.hands);
    } else if (msg.type === "detect-error") {
      // El cuadro en vuelo falló en el worker: liberamos el back-pressure para
      // no quedar trabados, y dejamos que el próximo cuadro reintente.
      this.gate.release();
    }
  };

  dispose(): void {
    this.disposed = true;
    this.worker.terminate();
  }
}
