/**
 * Orquestador de la app. Conecta la máquina de estados (dominio puro) con los
 * shells imperativos: cámara, worker de inferencia, escena Three.js y UI.
 *
 * Sólo re-renderiza cuando el `status` cambia, evitando el re-render
 * destructivo del código original que recreaba componentes en cada evento.
 */
import "./styles.css";
import {
  INITIAL_STATE,
  transition,
  type AppState,
  type AppEvent,
} from "./domain/app-state";
import { DEFAULT_FIGURE, type FigureKind } from "./domain/figures";
import { requestCamera, CameraError } from "./camera/camera";
import { HandTracker } from "./inference/hand-tracker";
import type { ARScene } from "./render/ar-scene";
import { permissionScreen, loadingScreen, errorScreen } from "./ui/screens";
import { arView } from "./ui/ar-view";
import type { ControlsState } from "./ui/ar-controls";

const appEl = document.getElementById("app")!;

let state: AppState = INITIAL_STATE;
let lastStatus: AppState["status"] | null = null;
let cameraMessage = "No se pudo acceder a la cámara.";

// Recursos que viven mientras la app está activa.
let stream: MediaStream | null = null;
let tracker: HandTracker | null = null;
let scene: ARScene | null = null;

function dispatch(event: AppEvent): void {
  state = transition(state, event);
  render();
}

function render(): void {
  if (state.status === lastStatus) return; // sólo cambiamos pantalla si cambió el status
  lastStatus = state.status;
  appEl.replaceChildren();

  switch (state.status) {
    case "requesting-permission":
      renderPermission();
      break;
    case "permission-denied":
      renderError(cameraMessage, () => dispatch({ type: "RETRY" }));
      break;
    case "loading-model":
      appEl.appendChild(loadingScreen());
      // Precargamos el chunk de Three.js en paralelo con la descarga del modelo,
      // así su parseo no cae de golpe al pasar a la vista AR (menos "freeze").
      void import("./render/ar-scene");
      startModel();
      break;
    case "ready":
      void renderAR();
      break;
    case "error":
      renderError(state.error ?? "Error inesperado.", () =>
        dispatch({ type: "RETRY" }),
      );
      break;
  }
}

function renderPermission(): void {
  const { root, button } = permissionScreen();
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Pidiendo acceso…";
    try {
      stream = await requestCamera();
      dispatch({ type: "PERMISSION_GRANTED" });
    } catch (err) {
      cameraMessage =
        err instanceof CameraError ? err.message : "Error desconocido de cámara.";
      dispatch({ type: "PERMISSION_DENIED" });
    }
  });
  appEl.appendChild(root);
}

function renderError(message: string, onRetry: () => void): void {
  const { root, button } = errorScreen(message);
  button.addEventListener("click", onRetry);
  appEl.appendChild(root);
}

async function startModel(): Promise<void> {
  tracker = new HandTracker();
  try {
    await tracker.init();
    dispatch({ type: "MODEL_LOADED" });
  } catch (err) {
    dispatch({
      type: "MODEL_ERROR",
      message: err instanceof Error ? err.message : "No se pudo cargar el modelo.",
    });
  }
}

async function renderAR(): Promise<void> {
  // Three.js se carga sólo al entrar a la vista AR (code-splitting): las
  // pantallas de permiso y carga no arrastran ese chunk.
  const { ARScene } = await import("./render/ar-scene");

  const view = arView();
  appEl.appendChild(view.root);

  if (stream) view.video.srcObject = stream;
  void view.video.play().catch(() => {});

  scene = new ARScene(view.canvas);
  scene.setFigure(DEFAULT_FIGURE);
  scene.start();

  view.selector.addEventListener("figure-change", (e) => {
    scene?.setFigure((e as CustomEvent<FigureKind>).detail);
  });

  view.controls.addEventListener("controls-change", (e) => {
    const c = (e as CustomEvent<ControlsState>).detail;
    scene?.setSize(c.size);
    scene?.setSpeed(c.speed);
    scene?.setColor(c.color);
    scene?.setFaces(c.faces);
    scene?.setOpacity(c.opacity);
    scene?.setMetalness(c.metalness);
    scene?.setRoughness(c.roughness);
    scene?.setWireframe(c.wireframe);
    scene?.setEdges(c.edges);
    scene?.setEdgeColor(c.edgeColor);
    scene?.setShadow(c.shadow);
    scene?.setMultiHand(c.multiHand);
    scene?.setOcclusion(c.occlusion);
    // El espejado del overlay (escena) debe coincidir con el del <video> (CSS).
    scene?.setMirrored(c.mirrored);
    view.video.style.transform = c.mirrored ? "scaleX(-1)" : "none";
    // Fondo de color: oculta el video de la cámara y pinta el color elegido
    // detrás de la figura (equivale al "Background" de la versión original).
    view.video.style.visibility = c.bgEnabled ? "hidden" : "visible";
    view.root.style.background = c.bgEnabled ? c.bgColor : "#000";
  });

  const onResize = () => scene?.resize();
  window.addEventListener("resize", onResize);

  tracker?.onHands((f) => scene?.setHands(f.hands, f.handedness));

  if (import.meta.env.DEV || location.search.includes("debug")) {
    setupDiagnostics(view.root);
  }

  startFrameLoop(view.video);
}

/**
 * HUD de diagnóstico (sólo en debug): muestra en vivo la señal de orientación y
 * permite grabar unos segundos de datos y descargarlos en JSON para calibrar la
 * detección palma/dorso sin adivinar.
 */
function setupDiagnostics(root: HTMLElement): void {
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:absolute;right:1rem;bottom:1rem;z-index:5;pointer-events:auto;" +
    "background:rgba(17,24,39,.8);color:#f9fafb;font:600 0.75rem/1.4 monospace;" +
    "padding:.6rem .8rem;border-radius:.6rem;border:1px solid rgba(255,255,255,.15);min-width:11rem";
  const info = document.createElement("div");
  const btn = document.createElement("button");
  btn.textContent = "⏺ Grabar 8 s";
  btn.style.cssText =
    "margin-top:.5rem;width:100%;cursor:pointer;border:none;border-radius:.4rem;" +
    "padding:.4rem;background:#f45e61;color:#fff;font:600 .75rem system-ui";
  hud.append(info, btn);
  root.appendChild(hud);

  let recording: Array<Record<string, unknown>> | null = null;
  let recStart = 0;

  const tick = (t: number) => {
    const d = scene?.debugFacing();
    if (d) {
      info.textContent =
        `mano: ${d.handedness ?? "—"}\n` +
        `señal: ${d.signal.toFixed(3)}\n` +
        `orientación: ${d.facing}\n` +
        `ocluyendo: ${d.occluding ? "sí" : "no"}` +
        (recording ? `\n● grabando… ${recording.length}` : "");
      if (recording) {
        recording.push({ t: Math.round(t - recStart), ...d });
        if (t - recStart >= 8000) {
          downloadRecording(recording);
          recording = null;
        }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  btn.addEventListener("click", () => {
    recording = [];
    recStart = performance.now();
  });
}

function downloadRecording(data: Array<Record<string, unknown>>): void {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ar-recording.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Bombea cuadros del video al tracker. Usa `requestVideoFrameCallback` cuando
 * existe (sólo dispara con cuadros nuevos del video) y cae a `requestAnimationFrame`
 * si no está disponible.
 */
function startFrameLoop(video: HTMLVideoElement): void {
  const hasRVFC = "requestVideoFrameCallback" in video;

  const pump = (now: number) => {
    if (video.readyState >= 2) {
      void tracker?.track(video, now);
    }
    schedule();
  };

  const schedule = () => {
    if (hasRVFC) {
      (video as VideoFrameCallbackHost).requestVideoFrameCallback((now) => pump(now));
    } else {
      requestAnimationFrame((now) => pump(now));
    }
  };

  schedule();
}

// `requestVideoFrameCallback` no está en todas las definiciones de TS.
interface VideoFrameCallbackHost {
  requestVideoFrameCallback(cb: (now: number) => void): number;
}

render();

// Hook de depuración: en el dev server, o en producción con `?debug` en la URL.
// Permite inspeccionar el estado e inyectar manos sintéticas para probar el
// render sin una cámara/mano reales.
if (import.meta.env.DEV || location.search.includes("debug")) {
  (window as unknown as { __ar: unknown }).__ar = {
    status: () => state.status,
    delegate: () => tracker?.delegate ?? null,
    injectHands: (hands: unknown) => scene?.setHands(hands as never),
    figure: () => scene?.debugFigure() ?? null,
  };
}
