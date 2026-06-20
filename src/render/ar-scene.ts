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
import { anchorOf, depthToScale, landmarkToScreen } from "../domain/hand-tracking";
import type { NormalizedLandmark } from "../domain/hand-tracking";

const BASE = 120; // tamaño base de la figura en píxeles
const MAX_FIGURES = 2; // tope de manos simultáneas

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
      this.instances.push({ mesh, edges, shadow });
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

    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      const anchor =
        this.figure !== "none" && i < maxFigures ? anchorOf(this.hands[i]) : null;
      const visible = anchor !== null;
      inst.mesh.visible = visible; // las aristas (hijas) heredan la visibilidad
      inst.shadow.visible = visible && this.shadowEnabled;

      if (visible && anchor) {
        const p = landmarkToScreen(anchor, w, h, this.mirrored);
        const s = depthToScale(p.z) * this.sizeScale;
        inst.mesh.position.set(p.x, p.y, 0);
        inst.mesh.scale.setScalar(s);
        inst.mesh.rotation.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
        // Sombra: elipse plana debajo de la figura, sin rotar.
        inst.shadow.position.set(p.x, p.y + BASE * 0.55 * s, -2);
        inst.shadow.scale.set(s, s * 0.4, s);
      }
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
