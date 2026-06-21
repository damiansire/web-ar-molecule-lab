/**
 * Escena de Three.js que dibuja las figuras 3D como overlay transparente sobre
 * el video. Usa una cámara ortográfica mapeada 1:1 a píxeles de pantalla
 * (origen arriba-izquierda, Y hacia abajo) para posicionar la figura
 * directamente con las coordenadas que devuelve `landmarkToScreen`.
 *
 * Renderer: `WebGPURenderer` (de `three/webgpu`) con materiales de nodos (TSL).
 * El mismo renderer corre sobre el backend WebGPU si el navegador lo soporta
 * (`navigator.gpu`) o cae automáticamente al backend **WebGL2** vía
 * `forceWebGL: true`. Los node-materials y el `InstancedMesh` funcionan igual en
 * ambos backends, así que hay un único camino de render.
 *
 * Las figuras se dibujan con `InstancedMesh`: una sola geometría/material para N
 * manos → 1 draw call para todas las figuras (+1 para sus sombras), en vez de un
 * `Mesh` por mano. Los bordes (opcionales, off por defecto) usan un pool chico
 * de `LineSegments` porque la topología de líneas no se instancia trivialmente.
 *
 * Hot loop near-zero-alloc: las escrituras de transform reusan un `Matrix4`/
 * `Quaternion`/`Euler`/`Vector3` y structs `target`/`corner` preasignados; no se
 * crean objetos por frame ni por figura.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  Euler,
  InstancedMesh,
  LineBasicNodeMaterial,
  LineSegments,
  Matrix4,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import {
  cameraPosition,
  color,
  dot,
  normalWorld,
  oneMinus,
  positionWorld,
  pow,
  uniform,
} from "three/tsl";
import type { FigureKind } from "../domain/figures";
import {
  anchorOf,
  handPerspectiveScale,
  landmarkToScreen,
  palmWinding,
} from "../domain/hand-tracking";
import type { NormalizedLandmark } from "../domain/hand-tracking";
import {
  applyFacingHysteresis,
  cornerTarget,
  isHeld,
  resolvePlacement,
} from "../domain/placement";
import { convexHull, fanTriangulate, type Pt } from "../domain/occluder";
import { Vec3Smoother } from "../domain/smoothing";
import type { ExperienceKind } from "../domain/experiences";
import { createExperience, type Experience, type ExperienceContext } from "./experiences";

const BASE = 120; // tamaño base de la figura en píxeles
const MAX_FIGURES = 16; // tope de figuras simultáneas (InstancedMesh: 1 draw call)
const PREVIEW_SCALE = 0.55; // tamaño de la figura cuando está en la esquina (preview)
const HAND_GRACE_MS = 500; // tolerancia ante pérdidas breves de la mano (sin parpadear)
const FACING_DEADZONE = 0.18; // zona muerta de la señal palma/dorso (anti-parpadeo)
const HARD_HAND_CAP = 2; // MediaPipe detecta hasta 2 manos; el resto del pool queda inactivo

function geometryFor(kind: FigureKind): BufferGeometry | null {
  switch (kind) {
    case "square":
      return new PlaneGeometry(BASE * 1.4, BASE * 1.4);
    case "cube":
      return new BoxGeometry(BASE, BASE, BASE);
    case "cylinder":
      return new CylinderGeometry(BASE / 2, BASE / 2, BASE, 48);
    case "cone":
      return new ConeGeometry(BASE / 2, BASE, 48);
    case "torus":
      return new TorusGeometry(BASE / 2, BASE / 6, 24, 48);
    case "sphere":
      return new SphereGeometry(BASE / 1.6, 48, 32);
    case "none":
      return null;
  }
}

/** Estado por figura del pool (suavizado, gracia, visibilidad). */
interface FigureSlot {
  smoother: Vec3Smoother; // suavizado predictivo (One-Euro) por figura
  x: number;
  y: number;
  s: number;
  primed: boolean; // ya tiene una posición real (para no interpolar desde 0,0)
  hx: number; // última posición/escala conocida de la mano (gracia)
  hy: number;
  hs: number;
  lastSeen: number;
  everSeen: boolean;
  visible: boolean;
}

export class ARScene {
  private renderer: WebGPURenderer;
  private scene = new Scene();
  private camera: OrthographicCamera;
  /** Backend efectivo, para diagnóstico ("webgpu" o "webgl"). */
  readonly backend: "webgpu" | "webgl";

  /** Canvas efectivamente usado (puede diferir si hubo fallback de WebGPU a WebGL2). */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  // Uniform de color compartido por el node-material (color base de la figura).
  private colorUniform = uniform(new Color(0xf45e61));
  private material: MeshStandardNodeMaterial;
  private edgeMaterial = new LineBasicNodeMaterial({ color: 0x0b1020 });
  private shadowMaterial = new MeshBasicNodeMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  private geo: BufferGeometry; // geometría actual, compartida por todas las instancias
  private edgeGeo: EdgesGeometry;
  private shadowGeo = new CircleGeometry(BASE * 0.55, 40);

  // InstancedMesh: una figura y una sombra por instancia, en un solo draw call.
  private figures: InstancedMesh;
  private shadows: InstancedMesh;
  // Bordes: pool chico de LineSegments (líneas no se instancian trivialmente).
  private edges: LineSegments[] = [];
  private slots: FigureSlot[] = [];

  // Oclusor: silueta de la mano que sólo escribe profundidad (sin color), para
  // esconder la figura "por detrás" cuando el dorso de la mano da a la cámara.
  private occluderMesh: InstancedMesh; // 1 instancia; usado como malla dinámica simple
  private occluderPos = new Float32Array(21 * 3);
  private occluderIdx = new Uint16Array((21 - 2) * 3);
  private occluderGeo = new BufferGeometry();

  private figure: FigureKind = "cube";
  private hands: NormalizedLandmark[][] = [];
  private occlusionEnabled = true;
  private facingBack = false; // estado con histéresis (palma/dorso) de la mano 0

  // Controles ajustables por el usuario.
  private mirrored = true;
  private sizeScale = 1;
  private rotationSpeed = 1;
  private spin = 0; // ángulo acumulado (rad), para no saltar al cambiar la velocidad
  private lastTime = 0;
  private edgesEnabled = false;
  private shadowEnabled = false;
  private multiHand = false;
  private running = false;

  // Experiencia creativa activa (null = modo "figuras" clásico).
  private experienceKind: ExperienceKind = "figuras";
  private experience: Experience | null = null;
  private currentColor = "#f45e61";
  private timeAcc = 0; // tiempo acumulado (s) para animar las experiencias
  private onHud: ((text: string | null) => void) | null = null;
  // Contexto reusado por frame (alloc-free) que se pasa a la experiencia.
  private expCtx: ExperienceContext = {
    hands: [],
    width: 0,
    height: 0,
    mirrored: true,
    dt: 0,
    time: 0,
    color: "#f45e61",
  };

  // Scratch reusable del hot loop (alloc-free).
  private mat = new Matrix4();
  private quat = new Quaternion();
  private euler = new Euler();
  private posVec = new Vector3();
  private sclVec = new Vector3();
  private hidden = new Matrix4().makeScale(0, 0, 0); // instancia "apagada"
  private target = { show: false, x: 0, y: 0, s: 0 }; // struct objetivo reusado
  private corner = { x: 0, y: 0, s: 0 }; // struct esquina reusado
  private occluderScratch: Pt[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));

  /**
   * Construcción: usar `await ARScene.create(canvas)` en vez del constructor.
   * `WebGPURenderer` requiere `await renderer.init()` antes de renderizar, lo que
   * no se puede hacer en un constructor síncrono.
   */
  private constructor(canvas: HTMLCanvasElement, preferWebGPU: boolean) {
    this.renderer = new WebGPURenderer({
      canvas,
      alpha: true,
      antialias: true,
      forceWebGL: !preferWebGPU, // sin WebGPU → backend WebGL2
    });
    this.backend = preferWebGPU ? "webgpu" : "webgl";
    this.renderer.setClearColor(0x000000, 0); // fondo transparente: se ve el video
    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new OrthographicCamera(0, w, 0, h, -1000, 1000);

    this.scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(0.5, -1, 1);
    this.scene.add(key);

    this.material = this.buildFigureMaterial();

    this.geo = geometryFor("cube") ?? new BoxGeometry(BASE, BASE, BASE);
    this.edgeGeo = new EdgesGeometry(this.geo);

    // InstancedMesh de figuras y sombras (un draw call cada uno para N figuras).
    this.figures = new InstancedMesh(this.geo, this.material, MAX_FIGURES);
    this.figures.instanceMatrix.setUsage(DynamicDrawUsage);
    this.figures.frustumCulled = false;
    this.shadows = new InstancedMesh(this.shadowGeo, this.shadowMaterial, MAX_FIGURES);
    this.shadows.instanceMatrix.setUsage(DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1; // sombras detrás de las figuras
    this.scene.add(this.shadows, this.figures);

    for (let i = 0; i < MAX_FIGURES; i++) {
      const edges = new LineSegments(this.edgeGeo, this.edgeMaterial);
      edges.visible = false;
      edges.frustumCulled = false;
      this.scene.add(edges);
      this.edges.push(edges);
      this.slots.push({
        smoother: new Vec3Smoother({ predictSeconds: 0.045 }),
        x: 0,
        y: 0,
        s: 1,
        primed: false,
        hx: 0,
        hy: 0,
        hs: 1,
        lastSeen: -Infinity,
        everSeen: false,
        visible: false,
      });
      // Arrancan apagadas (escala 0) hasta que el frame las posicione.
      this.figures.setMatrixAt(i, this.hidden);
      this.shadows.setMatrixAt(i, this.hidden);
    }
    this.figures.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;

    // Oclusor: malla dinámica (solo profundidad). Se dibuja primero y "tapa" la
    // figura que quede detrás, dejando ver el video (la mano) por encima.
    const posAttr = new BufferAttribute(this.occluderPos, 3);
    posAttr.setUsage(DynamicDrawUsage);
    this.occluderGeo.setAttribute("position", posAttr);
    this.occluderGeo.setIndex(new BufferAttribute(this.occluderIdx, 1));
    // DoubleSide: la silueta puede quedar con winding invertido (pantalla Y
    // hacia abajo); sin esto se descartaría por backface culling y no ocluiría.
    const occluderMat = new MeshBasicNodeMaterial({ colorWrite: false, side: DoubleSide });
    this.occluderMesh = new InstancedMesh(this.occluderGeo, occluderMat, 1);
    this.occluderMesh.setMatrixAt(0, new Matrix4());
    this.occluderMesh.instanceMatrix.needsUpdate = true;
    this.occluderMesh.frustumCulled = false;
    this.occluderMesh.renderOrder = -2; // antes que sombras y figuras
    this.occluderMesh.visible = false;
    this.scene.add(this.occluderMesh);

    this.resize();
  }

  /**
   * Crea la escena eligiendo backend: intenta WebGPU (`navigator.gpu`); si no hay
   * adapter o la init de WebGPU falla, reintenta con backend WebGL2. Inicializa
   * el renderer (async) antes de devolver.
   */
  static async create(canvas: HTMLCanvasElement): Promise<ARScene> {
    const preferWebGPU = await ARScene.detectWebGPU();
    if (preferWebGPU) {
      try {
        const scene = new ARScene(canvas, true);
        await scene.renderer.init();
        return scene;
      } catch {
        // El adapter existía pero la init de WebGPU falló (driver, feature, etc.).
        // El canvas ya tomó un contexto WebGPU y no se puede reusar para WebGL2,
        // así que lo reemplazamos por uno fresco en el DOM antes de reintentar.
        canvas = replaceCanvas(canvas);
      }
    }
    const scene = new ARScene(canvas, false);
    await scene.renderer.init();
    return scene;
  }

  /** ¿El navegador puede entregar un adapter WebGPU? (no fuerza el backend solo). */
  private static async detectWebGPU(): Promise<boolean> {
    const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
    if (!gpu) return false;
    try {
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Material de nodos (TSL) de la figura: color base por uniform + un rim-light
   * de fresnel sutil en el emissive (más brillo en los bordes mirando a cámara).
   * Funciona idéntico en backend WebGPU y WebGL2.
   */
  private buildFigureMaterial(): MeshStandardNodeMaterial {
    const mat = new MeshStandardNodeMaterial({ metalness: 0.25, roughness: 0.35 });
    mat.colorNode = this.colorUniform;
    // Fresnel: 1 en silueta, 0 de frente. Realza el contorno sin texturas.
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const fresnel = pow(oneMinus(dot(normalWorld, viewDir).clamp(0, 1)), 3.0);
    mat.emissiveNode = color(this.colorUniform).mul(fresnel).mul(0.6);
    return mat;
  }

  setFigure(kind: FigureKind): void {
    if (kind === this.figure) return;
    this.figure = kind;
    const geo = geometryFor(kind);
    // Para "none" no tocamos la geometría (las figuras se ocultan en el frame).
    if (!geo) return;
    const oldGeo = this.geo;
    const oldEdgeGeo = this.edgeGeo;
    this.geo = geo;
    this.edgeGeo = new EdgesGeometry(geo);
    this.figures.geometry = this.geo;
    for (const e of this.edges) e.geometry = this.edgeGeo;
    oldGeo.dispose();
    oldEdgeGeo.dispose();
  }

  setHands(hands: NormalizedLandmark[][]): void {
    this.hands = hands;
  }

  /** Activa/desactiva la oclusión (figura por detrás al dar vuelta la mano). */
  setOcclusion(enabled: boolean): void {
    this.occlusionEnabled = enabled;
  }

  /** Vista espejada (selfie). Debe coincidir con el espejado CSS del video. */
  setMirrored(mirrored: boolean): void {
    this.mirrored = mirrored;
  }

  /** Multiplicador de tamaño de la figura (1 = tamaño base). */
  setSize(scale: number): void {
    this.sizeScale = scale;
  }

  /** Multiplicador de velocidad de giro (0 = quieta, 1 = normal). */
  setSpeed(speed: number): void {
    this.rotationSpeed = speed;
  }

  /** Color de la figura (acepta cualquier color CSS, ej. "#f45e61"). */
  setColor(color: string): void {
    this.material.color.set(color);
    this.colorUniform.value.set(color);
    this.currentColor = color; // también tiñe la experiencia activa
  }

  /**
   * Cambia la experiencia activa. "figuras" vuelve al modo clásico (sin
   * Experience); el resto crea el efecto, lo agrega a la escena y dispone el
   * anterior. Idempotente si ya está en ese modo.
   */
  setExperience(kind: ExperienceKind): void {
    if (kind === this.experienceKind) return;
    this.experienceKind = kind;
    if (this.experience) {
      this.scene.remove(this.experience.object);
      this.experience.dispose();
      this.experience = null;
    }
    const exp = createExperience(kind);
    if (exp) {
      this.experience = exp;
      this.scene.add(exp.object);
    } else {
      // Volvemos a figuras: re-mostrar el InstancedMesh de figuras.
      this.figures.visible = true;
    }
    this.onHud?.(null);
  }

  /** Registra un callback para el HUD del modo (ej. el puntaje). */
  setHudListener(cb: (text: string | null) => void): void {
    this.onHud = cb;
  }

  /**
   * Muestra/oculta el relleno de las caras. Al ocultar sólo el material (no el
   * mesh), las aristas —que tienen su propio material— siguen visibles, así se
   * puede tener una figura "hueca" con sólo el contorno.
   */
  setFaces(enabled: boolean): void {
    this.material.visible = enabled;
  }

  /** Opacidad de la figura (0 = transparente, 1 = sólida). */
  setOpacity(opacity: number): void {
    this.material.transparent = opacity < 1;
    this.material.opacity = opacity;
  }

  /** Modo malla: dibuja sólo las aristas de los triángulos, sin caras. */
  setWireframe(enabled: boolean): void {
    this.material.wireframe = enabled;
  }

  /** Metalización del material (0 = mate, 1 = metálico). */
  setMetalness(value: number): void {
    this.material.metalness = value;
  }

  /** Rugosidad del material (0 = espejado, 1 = difuso). */
  setRoughness(value: number): void {
    this.material.roughness = value;
  }

  /** Muestra/oculta las aristas (bordes) de la figura. */
  setEdges(enabled: boolean): void {
    this.edgesEnabled = enabled;
    // La visibilidad real por instancia se resuelve en el frame (según slot).
    if (!enabled) for (const e of this.edges) e.visible = false;
  }

  /** Color de las aristas. */
  setEdgeColor(color: string): void {
    this.edgeMaterial.color.set(color);
  }

  /** Sombra (blob) proyectada bajo la figura. */
  setShadow(enabled: boolean): void {
    this.shadowEnabled = enabled;
  }

  /** Dibujar figuras en todas las manos detectadas (hasta el tope). */
  setMultiHand(enabled: boolean): void {
    this.multiHand = enabled;
  }

  /**
   * Actualiza el oclusor con la silueta (envolvente convexa) de la mano, en una
   * profundidad por delante de la figura, para que ésta quede tapada.
   */
  private updateOccluder(hand: NormalizedLandmark[], w: number, h: number): void {
    const sp = this.occluderScratch;
    let m = 0;
    for (const lm of hand) {
      if (m >= sp.length) break;
      const p = landmarkToScreen(lm, w, h, this.mirrored);
      sp[m].x = p.x;
      sp[m].y = p.y;
      m++;
    }
    // convexHull aloca su resultado (≤21 puntos, 1 vez por frame sólo cuando hay
    // oclusión activa); es un costo aceptado fuera del hot path de las figuras.
    const hull = convexHull(sp.slice(0, m));
    const n = hull.length;
    if (n < 3) {
      this.occluderMesh.visible = false;
      return;
    }
    for (let i = 0; i < n; i++) {
      this.occluderPos[i * 3] = hull[i].x;
      this.occluderPos[i * 3 + 1] = hull[i].y;
      this.occluderPos[i * 3 + 2] = 10; // por delante de la figura (z=0)
    }
    const t = fanTriangulate(n, this.occluderIdx);
    (this.occluderGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    const idx = this.occluderGeo.getIndex();
    if (idx) idx.needsUpdate = true;
    this.occluderGeo.setDrawRange(0, t);
    this.occluderMesh.visible = true;
  }

  /** Ajusta el renderer y la cámara al tamaño real del canvas. */
  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 480;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.right = w;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  stop(): void {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /**
   * Fuerza un render sincrónico para que el contenido del canvas sea legible
   * justo a continuación (para "sacar la foto"). Evita depender de
   * `preserveDrawingBuffer` (que ya no existe en WebGPURenderer y costaba una
   * copia por frame en WebGL — P-1 resuelto): se renderiza explícitamente y se
   * lee el canvas en el mismo tick.
   */
  renderForCapture(): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }

  /** Compone la matriz de instancia (translate * rotate(spin) * scale) en `this.mat`. */
  private composeMatrix(x: number, y: number, s: number, rotate: boolean): Matrix4 {
    this.posVec.set(x, y, 0);
    if (rotate) {
      this.euler.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
      this.quat.setFromEuler(this.euler);
    } else {
      this.quat.identity();
    }
    this.sclVec.set(s, s, s);
    return this.mat.compose(this.posVec, this.quat, this.sclVec);
  }

  private frame(time: number): void {
    const w = this.renderer.domElement.clientWidth || 640;
    const h = this.renderer.domElement.clientHeight || 480;
    const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;
    this.timeAcc += dt;

    // Modo experiencia creativa: ocultamos el pipeline de figuras y delegamos el
    // frame en la experiencia activa (que maneja sus propios objetos en la escena).
    if (this.experience) {
      if (this.figures.visible) {
        this.figures.visible = false;
        for (const e of this.edges) e.visible = false;
      }
      this.shadows.visible = false;
      this.occluderMesh.visible = false;
      const ctx = this.expCtx;
      ctx.hands = this.hands;
      ctx.width = w;
      ctx.height = h;
      ctx.mirrored = this.mirrored;
      ctx.dt = dt;
      ctx.time = this.timeAcc;
      ctx.color = this.currentColor;
      this.experience.update(ctx);
      this.onHud?.(this.experience.hud());
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.figures.visible) this.figures.visible = true;

    // Acumulamos el ángulo (rad/s) en vez de derivarlo de `time`, así cambiar
    // la velocidad no produce un salto brusco en la rotación.
    this.spin += dt * this.rotationSpeed;
    const maxFigures = this.multiHand ? HARD_HAND_CAP : 1;

    let figuresDirty = false;
    let shadowsDirty = false;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      const allow = this.figure !== "none" && i < maxFigures;
      const hand = allow ? this.hands[i] : undefined;
      const anchor = anchorOf(hand);

      // Sin figura elegida o instancia no usada: apagar (escala 0).
      if (!allow) {
        if (slot.visible) {
          this.figures.setMatrixAt(i, this.hidden);
          this.shadows.setMatrixAt(i, this.hidden);
          figuresDirty = true;
          shadowsDirty = true;
          slot.visible = false;
          slot.primed = false;
          slot.smoother.reset();
        }
        if (this.edges[i].visible) this.edges[i].visible = false;
        continue;
      }

      // Si hay mano, actualizamos su última posición/escala conocidas.
      if (anchor) {
        const p = landmarkToScreen(anchor, w, h, this.mirrored);
        slot.hx = p.x;
        slot.hy = p.y;
        // Perspectiva: tamaño según la mano (cerca = grande, lejos = chica),
        // por el tamaño elegido en el slider.
        slot.hs = handPerspectiveScale(hand, w, h) * this.sizeScale;
        slot.lastSeen = time;
        slot.everSeen = true;
      }

      // Objetivo de la figura (lógica pura): sobre la mano, sostenida por la
      // gracia, o preview en la esquina; nunca desaparece de golpe.
      const cornerScale = PREVIEW_SCALE * this.sizeScale;
      const c = cornerTarget(w, BASE, cornerScale);
      this.corner.x = c.x;
      this.corner.y = c.y;
      this.corner.s = cornerScale;
      const t = resolvePlacement({
        onHand:
          anchor !== null || isHeld(slot.everSeen, slot.lastSeen, time, HAND_GRACE_MS),
        hand: { x: slot.hx, y: slot.hy, s: slot.hs },
        isPrimary: i === 0,
        corner: this.corner,
      });
      this.target.show = t.show;
      this.target.x = t.x;
      this.target.y = t.y;
      this.target.s = t.s;

      if (!this.target.show) {
        if (slot.visible) {
          this.figures.setMatrixAt(i, this.hidden);
          this.shadows.setMatrixAt(i, this.hidden);
          figuresDirty = true;
          shadowsDirty = true;
          slot.visible = false;
          slot.primed = false;
          slot.smoother.reset();
        }
        if (this.edges[i].visible) this.edges[i].visible = false;
        continue;
      }

      slot.visible = true;

      // Suavizado predictivo (One-Euro): el target se filtra/extrapola in-place.
      // Snap sólo en el primer frame (para no deslizar desde 0,0).
      if (!slot.primed) {
        slot.x = this.target.x;
        slot.y = this.target.y;
        slot.s = this.target.s;
        slot.smoother.reset();
        slot.primed = true;
      } else {
        // Adoptamos el target crudo y dejamos que el filtro One-Euro lo suavice
        // y extrapole in-place sobre el propio slot (alloc-free).
        slot.x = this.target.x;
        slot.y = this.target.y;
        slot.s = this.target.s;
        slot.smoother.filterInto(slot, dt);
      }

      // Figura: translate * rotate(spin) * scale.
      this.figures.setMatrixAt(i, this.composeMatrix(slot.x, slot.y, slot.s, true));
      figuresDirty = true;

      // Sombra: elipse plana debajo de la figura, sin rotar (escala Y achatada).
      this.posVec.set(slot.x, slot.y + BASE * 0.55 * slot.s, -2);
      this.quat.identity();
      this.sclVec.set(slot.s, slot.s * 0.4, slot.s);
      this.shadows.setMatrixAt(i, this.mat.compose(this.posVec, this.quat, this.sclVec));
      shadowsDirty = true;

      // Bordes (pool por instancia): sólo cuando están activados.
      const edge = this.edges[i];
      if (this.edgesEnabled) {
        edge.visible = true;
        edge.position.set(slot.x, slot.y, 0);
        edge.scale.setScalar(slot.s);
        this.euler.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
        edge.quaternion.setFromEuler(this.euler);
      } else if (edge.visible) {
        edge.visible = false;
      }
    }

    // Visibilidad de los InstancedMesh: las sombras se apagan globalmente si el
    // usuario no las quiere (las instancias quedan en escala 0 igualmente).
    this.shadows.visible = this.shadowEnabled;
    if (figuresDirty) this.figures.instanceMatrix.needsUpdate = true;
    if (shadowsDirty) this.shadows.instanceMatrix.needsUpdate = true;

    // Oclusión: si la mano principal está con el dorso hacia la cámara, tapamos
    // la figura con su silueta → queda "por atrás".
    const hand0 = this.figure !== "none" ? this.hands[0] : undefined;
    const hasHand0 = anchorOf(hand0) !== null;
    if (hand0 && hasHand0) {
      // Señal de orientación = winding crudo del triángulo de la palma.
      // NO usamos la lateralidad (handedness) de MediaPipe: parpadea Left↔Right
      // con la mano quieta y eso invertía la orientación (el "todo troto").
      // El winding en cambio es estable: negativo con la palma, positivo con el
      // dorso (para la mano derecha del usuario). Histéresis con zona muerta
      // para no parpadear cuando la mano está casi de canto (señal ~0).
      this.facingBack = applyFacingHysteresis(
        this.facingBack,
        palmWinding(hand0),
        FACING_DEADZONE,
      );
    }

    if (hand0 && hasHand0 && this.occlusionEnabled && this.facingBack) {
      this.updateOccluder(hand0, w, h);
    } else {
      this.occluderMesh.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    if (this.experience) {
      this.scene.remove(this.experience.object);
      this.experience.dispose();
      this.experience = null;
    }
    this.geo.dispose();
    this.edgeGeo.dispose();
    this.shadowGeo.dispose();
    this.occluderGeo.dispose();
    this.figures.dispose();
    this.shadows.dispose();
    this.occluderMesh.dispose();
    (this.occluderMesh.material as MeshBasicNodeMaterial).dispose();
    this.material.dispose();
    this.edgeMaterial.dispose();
    this.shadowMaterial.dispose();
    this.renderer.dispose();
  }
}

/**
 * Reemplaza un canvas tainted (que ya tomó un contexto WebGPU) por un clon fresco
 * en su misma posición del DOM, copiando id/clases/atributos. Devuelve el nuevo
 * canvas para que el renderer WebGL2 pueda tomar su contexto sin conflicto.
 */
function replaceCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  const fresh = document.createElement("canvas");
  fresh.id = old.id;
  fresh.className = old.className;
  fresh.width = old.width;
  fresh.height = old.height;
  for (const { name, value } of Array.from(old.attributes)) {
    if (name !== "id" && name !== "class") fresh.setAttribute(name, value);
  }
  old.replaceWith(fresh);
  return fresh;
}
