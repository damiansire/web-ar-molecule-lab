/**
 * Escena de Three.js que dibuja la figura 3D como overlay transparente sobre
 * el video. Usa una cámara ortográfica mapeada 1:1 a píxeles de pantalla
 * (origen arriba-izquierda, Y hacia abajo) para posicionar la figura
 * directamente con las coordenadas que devuelve `landmarkToScreen`.
 *
 * Maneja un pool de hasta MAX_FIGURES instancias (una por mano detectada). Las
 * geometrías y materiales se comparten entre instancias: todas se ven igual,
 * sólo cambia su posición/rotación/escala.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import type { FigureKind } from "../domain/figures";
import {
  anchorOf,
  handPerspectiveScale,
  landmarkToScreen,
  palmWinding,
} from "../domain/hand-tracking";
import type { NormalizedLandmark } from "../domain/hand-tracking";

const BASE = 120; // tamaño base de la figura en píxeles
const MAX_FIGURES = 2; // tope de manos simultáneas
const PREVIEW_SCALE = 0.55; // tamaño de la figura cuando está en la esquina (preview)
const HAND_GRACE_MS = 500; // tolerancia ante pérdidas breves de la mano (sin parpadear)
const FACING_DEADZONE = 0.18; // zona muerta de la señal palma/dorso (anti-parpadeo)

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

interface Pt {
  x: number;
  y: number;
}

/** Envolvente convexa (monotone chain), CCW. Para la silueta del oclusor. */
function convexHull(points: Pt[]): Pt[] {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

interface FigureInstance {
  mesh: Mesh;
  edges: LineSegments; // hijo del mesh (hereda transform y visibilidad)
  shadow: Mesh; // suelto en la escena (no rota con la figura)
  // Estado de suavizado: posición/escala actuales que persiguen al objetivo.
  x: number;
  y: number;
  s: number;
  primed: boolean; // true una vez que tiene una posición real (para no interpolar desde 0,0)
  // Última posición/escala conocida de la mano (para sostener ante pérdidas breves).
  hx: number;
  hy: number;
  hs: number;
  lastSeen: number; // timestamp (ms) de la última detección de mano
  everSeen: boolean;
}

export class ARScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: OrthographicCamera;

  private material = new MeshStandardMaterial({
    color: 0xf45e61,
    metalness: 0.25,
    roughness: 0.35,
  });
  private edgeMaterial = new LineBasicMaterial({ color: 0x0b1020 });
  private shadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  private geo: BufferGeometry; // geometría actual, compartida por todos los mesh
  private edgeGeo: EdgesGeometry;
  private shadowGeo = new CircleGeometry(BASE * 0.55, 40);
  private instances: FigureInstance[] = [];

  // Oclusor: silueta de la mano que sólo escribe profundidad (sin color), para
  // esconder la figura "por detrás" cuando el dorso de la mano da a la cámara.
  private occluderMesh: Mesh;
  private occluderPos = new Float32Array(21 * 3);
  private occluderIdx = new Uint16Array((21 - 2) * 3);
  private occluderGeo = new BufferGeometry();

  private figure: FigureKind = "cube";
  private hands: NormalizedLandmark[][] = [];
  private handedness: string[] = [];
  private occlusionEnabled = true;
  private facingBack = false; // estado con histéresis (palma/dorso) de la mano 0
  private lastWinding = 0; // última señal de orientación (debug)

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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0); // fondo transparente: se ve el video
    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new OrthographicCamera(0, w, 0, h, -1000, 1000);

    this.scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(0.5, -1, 1);
    this.scene.add(key);

    this.geo = geometryFor("cube") ?? new BoxGeometry(BASE, BASE, BASE);
    this.edgeGeo = new EdgesGeometry(this.geo);

    for (let i = 0; i < MAX_FIGURES; i++) {
      const mesh = new Mesh(this.geo, this.material);
      const edges = new LineSegments(this.edgeGeo, this.edgeMaterial);
      edges.visible = this.edgesEnabled;
      mesh.add(edges);
      const shadow = new Mesh(this.shadowGeo, this.shadowMaterial);
      shadow.visible = false;
      this.scene.add(mesh, shadow);
      this.instances.push({
        mesh,
        edges,
        shadow,
        x: 0,
        y: 0,
        s: 1,
        primed: false,
        hx: 0,
        hy: 0,
        hs: 1,
        lastSeen: -Infinity,
        everSeen: false,
      });
    }

    // Oclusor: malla dinámica (solo profundidad). Se dibuja primero y "tapa" la
    // figura que quede detrás, dejando ver el video (la mano) por encima.
    const posAttr = new BufferAttribute(this.occluderPos, 3);
    posAttr.setUsage(DynamicDrawUsage);
    this.occluderGeo.setAttribute("position", posAttr);
    this.occluderGeo.setIndex(new BufferAttribute(this.occluderIdx, 1));
    // DoubleSide: la silueta puede quedar con winding invertido (pantalla Y
    // hacia abajo); sin esto se descartaría por backface culling y no ocluiría.
    const occluderMat = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
    this.occluderMesh = new Mesh(this.occluderGeo, occluderMat);
    this.occluderMesh.frustumCulled = false;
    this.occluderMesh.renderOrder = -1; // se dibuja antes que las figuras
    this.occluderMesh.visible = false;
    this.scene.add(this.occluderMesh);

    this.resize();
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
    for (const inst of this.instances) {
      inst.mesh.geometry = this.geo;
      inst.edges.geometry = this.edgeGeo;
    }
    oldGeo.dispose();
    oldEdgeGeo.dispose();
  }

  setHands(hands: NormalizedLandmark[][], handedness: string[] = []): void {
    this.hands = hands;
    this.handedness = handedness;
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
    for (const inst of this.instances) inst.edges.visible = enabled;
  }

  /** Color de las aristas. */
  setEdgeColor(color: string): void {
    this.edgeMaterial.color.set(color);
  }

  /** Sombra (blob) proyectada bajo la figura. */
  setShadow(enabled: boolean): void {
    this.shadowEnabled = enabled;
  }

  /** Dibujar figuras en todas las manos detectadas (hasta MAX_FIGURES). */
  setMultiHand(enabled: boolean): void {
    this.multiHand = enabled;
  }

  /**
   * Actualiza el oclusor con la silueta (envolvente convexa) de la mano, en una
   * profundidad por delante de la figura, para que ésta quede tapada.
   */
  private updateOccluder(hand: NormalizedLandmark[], w: number, h: number): void {
    const sp: Pt[] = [];
    for (const lm of hand) {
      const p = landmarkToScreen(lm, w, h, this.mirrored);
      sp.push({ x: p.x, y: p.y });
    }
    const hull = convexHull(sp);
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
    let t = 0;
    for (let k = 1; k < n - 1; k++) {
      this.occluderIdx[t++] = 0;
      this.occluderIdx[t++] = k;
      this.occluderIdx[t++] = k + 1;
    }
    (this.occluderGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    const idx = this.occluderGeo.getIndex();
    if (idx) idx.needsUpdate = true;
    this.occluderGeo.setDrawRange(0, t);
    this.occluderMesh.visible = true;
  }

  /** Señal de orientación de la mano 0 (sólo para depuración/calibración). */
  debugFacing(): {
    handedness: string | null;
    signal: number;
    facing: "front" | "back";
    occluding: boolean;
    landmarks: NormalizedLandmark[] | null;
  } {
    return {
      handedness: this.handedness[0] ?? null,
      signal: Math.round(this.lastWinding * 1000) / 1000,
      facing: this.facingBack ? "back" : "front",
      occluding: this.occluderMesh.visible,
      landmarks: this.hands[0] ?? null,
    };
  }

  /** Estado de la primera figura (sólo para depuración/tests manuales). */
  debugFigure(): {
    x: number;
    y: number;
    visible: boolean;
    occluding: boolean;
  } | null {
    const i = this.instances[0];
    return i
      ? {
          x: Math.round(i.x),
          y: Math.round(i.y),
          visible: i.mesh.visible,
          occluding: this.occluderMesh.visible,
        }
      : null;
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

  private frame(time: number): void {
    const w = this.renderer.domElement.clientWidth || 640;
    const h = this.renderer.domElement.clientHeight || 480;
    const dt = this.lastTime ? (time - this.lastTime) / 1000 : 0;
    this.lastTime = time;
    // Acumulamos el ángulo (rad/s) en vez de derivarlo de `time`, así cambiar
    // la velocidad no produce un salto brusco en la rotación.
    this.spin += dt * this.rotationSpeed;
    const maxFigures = this.multiHand ? MAX_FIGURES : 1;

    // Suavizado exponencial independiente del framerate: la figura "persigue"
    // el objetivo en vez de saltar, así se ve fluida aunque la inferencia
    // llegue a 15-25 fps (la cámara/render van a 60).
    const smooth = 1 - Math.exp(-dt * 18);

    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      const allow = this.figure !== "none" && i < maxFigures;
      const hand = allow ? this.hands[i] : undefined;
      const anchor = anchorOf(hand);

      // Sin figura elegida o instancia no usada: ocultar.
      if (!allow) {
        inst.mesh.visible = false;
        inst.shadow.visible = false;
        inst.primed = false;
        continue;
      }

      // Si hay mano, actualizamos su última posición/escala conocidas.
      if (anchor) {
        const p = landmarkToScreen(anchor, w, h, this.mirrored);
        inst.hx = p.x;
        inst.hy = p.y;
        // Perspectiva: tamaño según la mano (cerca = grande, lejos = chica),
        // por el tamaño elegido en el slider.
        inst.hs = handPerspectiveScale(hand, w, h) * this.sizeScale;
        inst.lastSeen = time;
        inst.everSeen = true;
      }

      const held = inst.everSeen && time - inst.lastSeen < HAND_GRACE_MS;

      // Objetivo de la figura. Nunca desaparece de golpe: si la mano se va,
      // primero se sostiene (gracia) y luego se desliza hacia la esquina.
      let tx: number;
      let ty: number;
      let ts: number;
      if (anchor || held) {
        // Sobre la mano (o sosteniendo su última posición ante una pérdida breve).
        tx = inst.hx;
        ty = inst.hy;
        ts = inst.hs;
      } else if (i === 0) {
        // Mano ausente: preview en la esquina superior derecha (se desliza hacia
        // allá, no desaparece). Margen amplio para que no se salga al rotar.
        ts = PREVIEW_SCALE * this.sizeScale;
        const margin = BASE * 0.9 * ts + 26;
        tx = w - margin;
        ty = margin;
      } else {
        // Segunda figura sin su mano: se oculta (no hay segunda esquina).
        inst.mesh.visible = false;
        inst.shadow.visible = false;
        inst.primed = false;
        continue;
      }

      inst.mesh.visible = true; // las aristas (hijas) heredan la visibilidad
      inst.shadow.visible = this.shadowEnabled;

      // Snap sólo en el primer frame (para no deslizar desde 0,0); después
      // siempre interpolamos → transición continua mano <-> esquina.
      if (!inst.primed) {
        inst.x = tx;
        inst.y = ty;
        inst.s = ts;
        inst.primed = true;
      } else {
        inst.x += (tx - inst.x) * smooth;
        inst.y += (ty - inst.y) * smooth;
        inst.s += (ts - inst.s) * smooth;
      }

      inst.mesh.position.set(inst.x, inst.y, 0);
      inst.mesh.scale.setScalar(inst.s);
      inst.mesh.rotation.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
      // Sombra: elipse plana debajo de la figura, sin rotar.
      inst.shadow.position.set(inst.x, inst.y + BASE * 0.55 * inst.s, -2);
      inst.shadow.scale.set(inst.s, inst.s * 0.4, inst.s);
    }

    // Oclusión: si la mano principal está con el dorso hacia la cámara, tapamos
    // la figura con su silueta → queda "por atrás".
    const hand0 = this.figure !== "none" ? this.hands[0] : undefined;
    if (hand0 && anchorOf(hand0)) {
      // Señal de orientación = winding crudo del triángulo de la palma.
      // NO usamos la lateralidad (handedness) de MediaPipe: parpadea Left↔Right
      // con la mano quieta y eso invertía la orientación (el "todo troto").
      // El winding en cambio es estable: negativo con la palma, positivo con el
      // dorso (para la mano derecha del usuario). Histéresis con zona muerta
      // para no parpadear cuando la mano está casi de canto (señal ~0).
      const signal = palmWinding(hand0);
      this.lastWinding = signal;
      if (signal > FACING_DEADZONE) this.facingBack = true; // dorso a la cámara
      else if (signal < -FACING_DEADZONE) this.facingBack = false; // palma
      // dentro de la zona muerta: se conserva el estado anterior
    }

    if (hand0 && anchorOf(hand0) && this.occlusionEnabled && this.facingBack) {
      this.updateOccluder(hand0, w, h);
    } else {
      this.occluderMesh.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    this.geo.dispose();
    this.edgeGeo.dispose();
    this.shadowGeo.dispose();
    this.occluderGeo.dispose();
    (this.occluderMesh.material as MeshBasicMaterial).dispose();
    this.material.dispose();
    this.edgeMaterial.dispose();
    this.shadowMaterial.dispose();
    this.renderer.dispose();
  }
}
