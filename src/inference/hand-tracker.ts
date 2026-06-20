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

export type HandsListener = (hands: NormalizedLandmark[][]) => void;

export class HandTracker {
  private worker: Worker;
  private busy = false;
  private ready = false;
  private listener: HandsListener | null = null;

  constructor() {
    this.worker = new Worker(
      new URL("./hand-landmarker.worker.ts", import.meta.url),
      { type: "module" },
    );
  }

  /** Arranca el worker y resuelve cuando el modelo quedó cargado. */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        const msg = event.data;
        if (msg.type === "ready") {
          this.ready = true;
          this.worker.removeEventListener("message", onMessage);
          this.worker.addEventListener("message", this.onResult);
          resolve();
        } else if (msg.type === "init-error") {
          this.worker.removeEventListener("message", onMessage);
          reject(new Error(msg.message));
        }
      };
      this.worker.addEventListener("message", onMessage);
      const req: WorkerRequest = {
        type: "init",
        wasmBase: MEDIAPIPE.wasmBase,
        modelUrl: MEDIAPIPE.handLandmarkerModel,
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
  async track(source: CanvasImageSource, timestamp: number): Promise<void> {
    if (!this.ready || this.busy) return;
    this.busy = true;
    try {
      const bitmap = await createImageBitmap(source);
      const req: WorkerRequest = { type: "frame", bitmap, timestamp };
      this.worker.postMessage(req, [bitmap]);
    } catch {
      this.busy = false;
    }
  }

  private onResult = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data;
    if (msg.type === "result") {
      this.busy = false;
      this.listener?.(msg.hands);
    }
  };

  dispose(): void {
    this.worker.terminate();
  }
}
