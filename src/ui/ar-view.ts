/**
 * Construye la vista de realidad aumentada: el <video> de la cámara de fondo
 * (espejado), el <canvas> de Three.js encima y el selector de figuras.
 */
import { FigureSelector } from "./figure-selector";

// Asegura que el custom element esté registrado aunque se haga tree-shaking.
void FigureSelector;

export interface ARView {
  root: HTMLElement;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  selector: FigureSelector;
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

  root.append(video, canvas, selector);
  return { root, video, canvas, selector };
}
