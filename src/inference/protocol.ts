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
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number };

/** Mensajes que el worker devuelve al hilo principal. */
export type WorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "init-error"; message: string }
  | {
      type: "result";
      timestamp: number;
      hands: NormalizedLandmark[][];
      handedness: string[];
    };
