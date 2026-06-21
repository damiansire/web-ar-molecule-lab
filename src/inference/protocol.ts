/**
 * Contrato de mensajes entre el hilo principal y el Web Worker de inferencia.
 * Tenerlo en un archivo compartido evita que worker y cliente se desincronicen.
 */
import type { NormalizedLandmark } from "../domain/hand-tracking";

/** Mensajes que el hilo principal envía al worker. */
export type WorkerRequest =
  | {
      type: "init";
      bundleUrl: string;
      wasmBase: string;
      modelUrl: string;
      forceCpu: boolean;
      // El hilo principal decide la parte de la lógica que depende del navegador
      // (WebKit<17 fuerza CPU) con `supportsGpuDelegate` de ../domain/platform
      // —la versión testeada—. El worker sólo aporta su `hasWebGl2()` local.
      allowGpu: boolean;
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

/** Mensajes que el worker devuelve al hilo principal. */
export type WorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "init-error"; message: string }
  | { type: "detect-error"; timestamp: number; message: string }
  | { type: "result"; timestamp: number; hands: NormalizedLandmark[][] };
