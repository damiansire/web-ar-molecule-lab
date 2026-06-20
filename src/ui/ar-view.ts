/**
 * Construye la vista de realidad aumentada: el <video> de la cámara de fondo
 * (espejado), el <canvas> de Three.js encima y el selector de figuras.
 */
import { FigureSelector } from "./figure-selector";
import { ARControls } from "./ar-controls";

// Asegura que los custom elements queden registrados aunque haya tree-shaking.
void FigureSelector;
void ARControls;

export interface ARView {
  root: HTMLElement;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  selector: FigureSelector;
  controls: ARControls;
}

export function arView(): ARView {
  const root = document.createElement("div");
  root.className = "ar-view";

  const video = document.createElement("video");
  video.className = "ar-video";
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;

  const canvas = document.createElement("canvas");
  canvas.className = "ar-canvas";

  const selector = document.createElement("figure-selector") as FigureSelector;
  selector.className = "ar-selector";

  const controls = document.createElement("ar-controls") as ARControls;
  controls.className = "ar-controls-panel";

  root.append(video, canvas, controls, selector);
  return { root, video, canvas, selector, controls };
}
