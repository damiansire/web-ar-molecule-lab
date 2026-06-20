/// <reference lib="webworker" />
/**
 * Web Worker de inferencia.
 *
 * Acá vive todo el trabajo pesado: cargar el WASM de MediaPipe, el modelo de
 * manos y correr la detección cuadro a cuadro. Al estar en un worker, el hilo
 * principal queda libre para capturar la cámara y renderizar con Three.js sin
 * jank (era el "main thread blocking" que mencionaba el repo original).
 */
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { WorkerRequest, WorkerResponse } from "./protocol";

let landmarker: HandLandmarker | null = null;

function post(message: WorkerResponse, transfer?: Transferable[]): void {
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer ?? []);
}

async function init(wasmBase: string, modelUrl: string): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBase);
  landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
    runningMode: "VIDEO",
    numHands: 1,
  });
  post({ type: "ready" });
}

function detect(bitmap: ImageBitmap, timestamp: number): void {
  if (!landmarker) {
    bitmap.close();
    return;
  }
  try {
    const result = landmarker.detectForVideo(bitmap, timestamp);
    post({ type: "result", timestamp, hands: result.landmarks ?? [] });
  } finally {
    // Liberamos el bitmap siempre, haya o no detección, para no perder memoria.
    bitmap.close();
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  switch (msg.type) {
    case "init":
      init(msg.wasmBase, msg.modelUrl).catch((err: unknown) => {
        post({
          type: "init-error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
      break;
    case "frame":
      detect(msg.bitmap, msg.timestamp);
      break;
  }
};
