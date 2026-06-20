/**
 * Escena de Three.js que dibuja la figura 3D como overlay transparente sobre
 * el video. Usa una cámara ortográfica mapeada 1:1 a píxeles de pantalla
 * (origen arriba-izquierda, Y hacia abajo) para poder posicionar la figura
 * directamente con las coordenadas que devuelve `landmarkToScreen`.
 */
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import type { FigureKind } from "../domain/figures";
import { depthToScale, landmarkToScreen, pickAnchor } from "../domain/hand-tracking";
import type { NormalizedLandmark } from "../domain/hand-tracking";

const BASE = 120; // tamaño base de la figura en píxeles

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

export class ARScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: OrthographicCamera;
  private material = new MeshStandardMaterial({
    color: 0xf45e61,
    metalness: 0.25,
    roughness: 0.35,
  });
  private mesh: Mesh;
  private figure: FigureKind = "cube";
  private hands: NormalizedLandmark[][] = [];
  private mirrored = true;
  private running = false;

  // Controles ajustables por el usuario.
  private sizeScale = 1; // multiplicador de tamaño (sobre la escala por profundidad)
  private rotationSpeed = 1; // multiplicador de velocidad de giro
  private spin = 0; // ángulo acumulado (rad), para no saltar al cambiar la velocidad
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0); // fondo transparente: se ve el video
    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new OrthographicCamera(0, w, 0, h, -1000, 1000);

    this.scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(0.5, -1, 1);
    this.scene.add(key);

    this.mesh = new Mesh(geometryFor("cube") ?? new BoxGeometry(1, 1, 1), this.material);
    this.scene.add(this.mesh);

    this.resize();
  }

  setFigure(kind: FigureKind): void {
    if (kind === this.figure) return;
    this.figure = kind;
    const geo = geometryFor(kind);
    // Para "none" no tocamos la geometría (la figura simplemente se oculta en
    // el frame), así evitamos dejar el mesh con una geometría liberada.
    if (geo) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = geo;
    }
  }

  setHands(hands: NormalizedLandmark[][]): void {
    this.hands = hands;
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
    const anchor = pickAnchor(this.hands);

    // La figura sólo se muestra si hay una elegida y una mano detectada.
    this.mesh.visible = this.figure !== "none" && anchor !== null;

    if (this.mesh.visible && anchor) {
      const p = landmarkToScreen(anchor, w, h, this.mirrored);
      this.mesh.position.set(p.x, p.y, 0);
      this.mesh.scale.setScalar(depthToScale(p.z) * this.sizeScale);
      // Acumulamos el ángulo (rad/s) en vez de derivarlo de `time`, así cambiar
      // la velocidad no produce un salto brusco en la rotación.
      this.spin += dt * this.rotationSpeed;
      this.mesh.rotation.set(this.spin * 0.9, this.spin * 1.1, this.spin * 0.5);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.stop();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
