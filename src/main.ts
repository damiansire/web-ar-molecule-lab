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
import { experienceHint, type ExperienceKind } from "./domain/experiences";
import { requestCamera, CameraError } from "./camera/camera";
import { HandTracker } from "./inference/hand-tracker";
import type { ARScene } from "./render/ar-scene";
import { permissionScreen, loadingScreen, errorScreen } from "./ui/screens";
import { arView } from "./ui/ar-view";
import type { ControlsState } from "./ui/ar-controls";
import { capturePhoto } from "./render/capture";

const appEl = document.getElementById("app")!;

let state: AppState = INITIAL_STATE;
let lastStatus: AppState["status"] | null = null;
let cameraMessage = "No se pudo acceder a la cámara.";

// Recursos que viven mientras la app está activa.
let stream: MediaStream | null = null;
let tracker: HandTracker | null = null;
let scene: ARScene | null = null;
let frameActive = false;
let onResize: (() => void) | null = null;

/**
 * Libera cámara, worker, escena, loop de cuadros y listeners. Se llama al
 * volver a una pantalla sin AR (reintento o error), para no dejar la cámara
 * prendida ni workers/renderers colgando.
 */
function cleanup(): void {
  frameActive = false;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  tracker?.dispose();
  tracker = null;
  scene?.dispose();
  scene = null;
  if (onResize) {
    window.removeEventListener("resize", onResize);
    onResize = null;
  }
}

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
      cleanup();
      renderPermission();
      break;
    case "permission-denied":
      cleanup();
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
      cleanup();
      renderError(state.error ?? "Error inesperado.", () => dispatch({ type: "RETRY" }));
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

/** Error no recuperable (p. ej. sin WebGL): muestra el mensaje y ofrece recargar. */
function showFatal(message: string): void {
  appEl.replaceChildren();
  const { root, button } = errorScreen(message, "Recargar");
  button.addEventListener("click", () => location.reload());
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

  // Crear el renderer puede fallar si el navegador no tiene ni WebGPU ni WebGL2:
  // lo manejamos con gracia en vez de dejar la app en blanco. `ARScene.create`
  // intenta WebGPU y cae automáticamente a WebGL2 (puede reemplazar el canvas).
  let created: ARScene;
  try {
    created = await ARScene.create(view.canvas);
  } catch {
    cleanup();
    showFatal("Tu navegador no pudo iniciar WebGPU ni WebGL2, necesarios para el 3D.");
    return;
  }

  appEl.appendChild(view.root);
  // Ahora que el canvas está en el DOM y tiene su tamaño real, ajustamos cámara
  // y renderer (en el constructor el canvas estaba suelto → tamaño por defecto).
  created.resize();
  scene = created;

  if (stream) view.video.srcObject = stream;
  void view.video.play().catch(() => {});

  scene.setFigure(DEFAULT_FIGURE);
  scene.start();

  view.selector.addEventListener("figure-change", (e) => {
    scene?.setFigure((e as CustomEvent<FigureKind>).detail);
  });

  // Cartel de instrucción del modo (toast central que se desvanece solo).
  let hintTimer = 0;
  const showHint = (text: string): void => {
    if (!text) return;
    view.hint.textContent = text;
    view.hint.classList.add("show");
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => view.hint.classList.remove("show"), 3500);
  };

  // HUD de puntaje: la experiencia activa decide qué mostrar (null = ocultar).
  scene.setHudListener((text) => {
    view.hud.hidden = text === null;
    view.hud.textContent = text ?? "";
  });

  // Cambio de experiencia creativa: activa el modo, muestra/oculta el selector de
  // figuras (sólo relevante en "figuras") y anuncia la instrucción del modo.
  view.experience.addEventListener("experience-change", (e) => {
    const kind = (e as CustomEvent<ExperienceKind>).detail;
    scene?.setExperience(kind);
    const figuras = kind === "figuras";
    // Los sliders/toggles de material sólo aplican a las figuras 3D: fuera de ese
    // modo, ocultamos tanto el selector de figuras como el panel de controles.
    view.selector.style.display = figuras ? "" : "none";
    view.controls.style.display = figuras ? "" : "none";
    showHint(experienceHint(kind));
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

  view.capture.addEventListener("click", () => {
    const c = view.controls.getState();
    // Render explícito en este tick: el canvas queda legible sin depender de
    // preserveDrawingBuffer. El canvas puede haber sido reemplazado por el
    // fallback WebGPU→WebGL2, por eso lo tomamos del propio renderer.
    const glCanvas = scene?.renderForCapture() ?? view.canvas;
    capturePhoto({
      video: view.video,
      glCanvas,
      mirrored: c.mirrored,
      background: c.bgEnabled ? c.bgColor : null,
    });
  });

  onResize = () => scene?.resize();
  window.addEventListener("resize", onResize);

  tracker?.onHands((hands) => scene?.setHands(hands));

  startFrameLoop(view.video);
}

/**
 * Bombea cuadros del video al tracker. Usa `requestVideoFrameCallback` cuando
 * existe (sólo dispara con cuadros nuevos del video) y cae a `requestAnimationFrame`
 * si no está disponible.
 */
function startFrameLoop(video: HTMLVideoElement): void {
  frameActive = true;
  const hasRVFC = "requestVideoFrameCallback" in video;

  const schedule = () => {
    if (!frameActive) return; // `cleanup()` corta el loop
    if (hasRVFC) {
      (video as VideoFrameCallbackHost).requestVideoFrameCallback(pump);
    } else {
      requestAnimationFrame(pump);
    }
  };

  const pump = (now: number) => {
    if (!frameActive) return;
    if (video.readyState >= 2) {
      void tracker?.track(video, now);
    }
    schedule();
  };

  schedule();
}

// `requestVideoFrameCallback` no está en todas las definiciones de TS.
interface VideoFrameCallbackHost {
  requestVideoFrameCallback(cb: (now: number) => void): number;
}

render();
