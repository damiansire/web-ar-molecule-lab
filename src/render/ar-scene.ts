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
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
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
import { anchorOf, handPerspectiveScale, landmarkToScreen } from "../domain/hand-tracking";
import type { NormalizedLandmark } from "../domain/hand-tracking";

const BASE = 120; // tamaño base de la figura en píxeles
const MAX_FIGURES = 2; // tope de manos simultáneas
const PREVIEW_SCALE = 0.55; // tamaño de la figura cuando está en la esquina (preview)

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

interface FigureInstance {
  mesh: Mesh;
  edges: LineSegments; // hijo del mesh (hereda transform y visibilidad)
  shadow: Mesh; // suelto en la escena (no rota con la figura)
  // Estado de suavizado: posición/escala actuales que persiguen al objetivo.
  x: number;
  y: number;
  s: number;
  primed: boolean; // true una vez que tiene una posición real (para no interpolar desde 0,0)
  parked: boolean; // true cuando está en la esquina (preview, sin mano)
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

  private figure: FigureKind = "cube";
  private hands: NormalizedLandmark[][] = [];

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
        parked: false,
      });
    }

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

  setHands(hands: NormalizedLandmark[][]): void {
    this.hands = hands;
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

      let tx: number;
      let ty: number;
      let ts: number;
      let parked: boolean;

      if (anchor) {
        const p = landmarkToScreen(anchor, w, h, this.mirrored);
        tx = p.x;
        ty = p.y;
        // Perspectiva: tamaño según la mano (cerca = grande, lejos = chica),
        // por el tamaño elegido en el slider.
        ts = handPerspectiveScale(hand, w, h) * this.sizeScale;
        parked = false;
      } else if (i === 0 && this.figure !== "none") {
        // Sin mano: la primera figura queda como preview en la esquina superior
        // derecha, para ver cómo se ven los ajustes actuales.
        ts = PREVIEW_SCALE * this.sizeScale;
        const margin = BASE * 0.55 * ts + 16;
        tx = w - margin;
        ty = margin;
        parked = true;
      } else {
        inst.mesh.visible = false;
        inst.shadow.visible = false;
        inst.primed = false;
        continue;
      }

      inst.mesh.visible = true; // las aristas (hijas) heredan la visibilidad
      inst.shadow.visible = this.shadowEnabled;

      // Snap al primer frame o al cambiar de modo (mano <-> esquina), para no
      // cruzar la pantalla deslizándose.
      if (!inst.primed || inst.parked !== parked) {
        inst.x = tx;
        inst.y = ty;
        inst.s = ts;
        inst.primed = true;
      } else {
        inst.x += (tx - inst.x) * smooth;
        inst.y += (ty - inst.y) * smooth;
        inst.s += (ts - inst.s) * smooth;
      }
      inst.parked = parked;

      inst.mesh.position.set(inst.x, inst.y, 0);
      inst.mesh.scale.setScalar(inst.s);
      inst.mesh.rotation.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
      // Sombra: elipse plana debajo de la figura, sin rotar.
      inst.shadow.position.set(inst.x, inst.y + BASE * 0.55 * inst.s, -2);
      inst.shadow.scale.set(inst.s, inst.s * 0.4, inst.s);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    this.geo.dispose();
    this.edgeGeo.dispose();
    this.shadowGeo.dispose();
    this.material.dispose();
    this.edgeMaterial.dispose();
    this.shadowMaterial.dispose();
    this.renderer.dispose();
  }
}
