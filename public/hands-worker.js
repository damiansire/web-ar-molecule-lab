/*
 * Worker CLÁSICO de detección de manos. Se sirve tal cual desde /public (sin que
 * Vite lo transforme), así funciona igual en `vite dev` y en el build.
 *
 * Por qué clásico y no module worker: MediaPipe carga su loader de WASM con
 * importScripts, que solo existe en classic workers (en module worker da
 * "ModuleFactory not set"). El bundle ESM de MediaPipe se trae con import()
 * dinámico, que sí está permitido dentro de un classic worker.
 *
 * Protocolo:
 *   main → worker: { type:'init' } | { type:'frame', bitmap, timestamp }
 *   worker → main: { type:'ready' } | { type:'error', message } | { type:'result', hands }
 */
const VERSION = '0.10.35';
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker = null;
// detectForVideo exige timestamps estrictamente crecientes por instancia.
let lastTs = 0;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg && msg.type === 'init') {
    try {
      const { HandLandmarker, FilesetResolver } = await import(BUNDLE_URL);
      const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarker = await HandLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        numHands: 2,
        runningMode: 'VIDEO',
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
    return;
  }

  if (msg && msg.type === 'frame') {
    const bitmap = msg.bitmap;
    if (!landmarker) {
      bitmap.close();
      self.postMessage({ type: 'result', hands: [] });
      return;
    }
    let ts = msg.timestamp | 0;
    if (ts <= lastTs) ts = lastTs + 1;
    lastTs = ts;

    let hands = [];
    try {
      const res = landmarker.detectForVideo(bitmap, ts);
      hands = res.landmarks.map((landmarks, i) => ({
        handedness: (res.handednesses[i] && res.handednesses[i][0] && res.handednesses[i][0].categoryName) || 'Unknown',
        landmarks,
      }));
    } catch {
      // Frame problemático: devolvemos vacío en vez de tirar el worker.
    } finally {
      bitmap.close();
    }
    self.postMessage({ type: 'result', hands });
  }
};
