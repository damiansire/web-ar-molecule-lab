/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Web Worker de inferencia (worker CLÁSICO, autocontenido).
 *
 * Acá vive el trabajo pesado: cargar MediaPipe, el modelo de manos y correr la
 * detección cuadro a cuadro. Al estar en un worker, el hilo principal queda
 * libre para capturar la cámara y renderizar con Three.js sin jank (era el
 * "main thread blocking" del repo original).
 *
 * Decisiones clave (a propósito):
 *  - MediaPipe se carga con `importScripts` desde su bundle CJS. MediaPipe
 *    necesita `importScripts`, que NO existe en workers de tipo módulo (de ahí
 *    el clásico error "ModuleFactory not set").
 *  - El archivo NO tiene `import`/`export`: así esbuild lo trata como script
 *    clásico (sin envoltorio de módulo) y funciona igual en el dev server de
 *    Vite y en el build. Por eso los tipos van inline en vez de importados.
 */

// --- Contrato de mensajes (espejo de ./protocol.ts; ver nota arriba) ---
interface InitRequest {
  type: "init";
  bundleUrl: string;
  wasmBase: string;
  modelUrl: string;
  forceCpu: boolean;
}
interface FrameRequest {
  type: "frame";
  bitmap: ImageBitmap;
  timestamp: number;
}
type WorkerRequest = InitRequest | FrameRequest;

let landmarker: any = null;

function post(message: unknown, transfer?: Transferable[]): void {
  (self as DedicatedWorkerGlobalScope).postMessage(message, transfer ?? []);
}

async function loadMediaPipe(bundleUrl: string): Promise<any> {
  // El bundle .cjs del CDN se sirve con Content-Type `application/node`, que el
  // navegador rechaza en `importScripts` (exige un MIME de JavaScript). Lo
  // bajamos con fetch (CORS habilitado) y lo cargamos desde un Blob URL
  // mismo-origen con MIME correcto.
  const code = await fetch(bundleUrl).then((r) => {
    if (!r.ok) throw new Error(`No se pudo descargar MediaPipe (${r.status}).`);
    return r.text();
  });
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  // Shim de CommonJS: el bundle es CJS y asigna a `module.exports`.
  const g = self as any;
  g.module = { exports: {} };
  g.exports = g.module.exports;
  try {
    importScripts(blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
  return g.module.exports;
}

/** ¿Hay WebGL2 vía OffscreenCanvas en este worker? (requisito del delegate GPU). */
function gpuAvailable(): boolean {
  try {
    return !!new OffscreenCanvas(1, 1).getContext("webgl2");
  } catch {
    return false;
  }
}

async function init(
  bundleUrl: string,
  wasmBase: string,
  modelUrl: string,
  forceCpu: boolean,
): Promise<void> {
  const mp = await loadMediaPipe(bundleUrl);
  const fileset = await mp.FilesetResolver.forVisionTasks(wasmBase);
  // GPU es mucho más rápido, pero en algunos navegadores el delegate GPU dentro
  // de un worker cuelga el hilo. Probamos WebGL2 y, si el hilo principal pide
  // forceCpu (porque un intento previo no respondió a tiempo), usamos CPU.
  const delegate = !forceCpu && gpuAvailable() ? "GPU" : "CPU";
  landmarker = await mp.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: "VIDEO",
    numHands: 2,
  });
  post({ type: "ready", delegate });
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
      init(msg.bundleUrl, msg.wasmBase, msg.modelUrl, msg.forceCpu).catch(
        (err: unknown) => {
          post({
            type: "init-error",
            message: err instanceof Error ? err.message : String(err),
          });
        },
      );
      break;
    case "frame":
      detect(msg.bitmap, msg.timestamp);
      break;
  }
};
