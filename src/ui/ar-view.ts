/**
 * Construye la vista de realidad aumentada: el <video> de la cámara de fondo
 * (espejado), el <canvas> de Three.js encima, el selector de experiencias, el
 * selector de figuras (sólo relevante en el modo "figuras"), el HUD de puntaje y
 * un cartel con la instrucción del modo elegido.
 */
import { FigureSelector } from "./figure-selector";
import { ExperienceSelector } from "./experience-selector";
import { ARControls } from "./ar-controls";
import { ICONS } from "./icons";

// Asegura que los custom elements queden registrados aunque haya tree-shaking.
void FigureSelector;
void ExperienceSelector;
void ARControls;

export interface ARView {
  root: HTMLElement;
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  /** Selector de experiencias (modo creativo). */
  experience: ExperienceSelector;
  /** Selector de figuras 3D (visible sólo en el modo "figuras"). */
  selector: FigureSelector;
  controls: ARControls;
  capture: HTMLButtonElement;
  /** HUD de puntaje (modo "atrapar"). */
  hud: HTMLElement;
  /** Cartel con la instrucción del modo activo. */
  hint: HTMLElement;
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

  const hud = document.createElement("div");
  hud.className = "ar-hud";
  hud.hidden = true;

  const hint = document.createElement("div");
  hint.className = "ar-hint";

  const selector = document.createElement("figure-selector") as FigureSelector;
  selector.className = "ar-selector";

  const experience = document.createElement("experience-selector") as ExperienceSelector;
  experience.className = "ar-experience";

  const controls = document.createElement("ar-controls") as ARControls;
  controls.className = "ar-controls-panel";

  const capture = document.createElement("button");
  capture.className = "ar-capture";
  capture.innerHTML = ICONS.camera;
  capture.title = "Sacar foto / Take photo";
  capture.setAttribute("aria-label", "Sacar foto / Take photo");

  root.append(video, canvas, controls, hud, hint, selector, experience, capture);
  return { root, video, canvas, experience, selector, controls, capture, hud, hint };
}
