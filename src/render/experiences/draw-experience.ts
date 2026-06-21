/**
 * Experiencia "Dibujar": el dedo índice deja un trazo luminoso que se desvanece
 * solo (estilo filtro de Instagram). Pellizcar (pulgar+índice) o cerrar el índice
 * levanta el lápiz, así se puede mover la mano sin pintar y arrancar otro trazo.
 *
 * El trazo es un "pincel": una nube de círculos aditivos superpuestos a lo largo
 * del recorrido (InstancedMesh, 1 draw call), que da grosor y glow reales en vez
 * de una línea de 1px. Cada punto encoge con la edad hasta desaparecer.
 */
import {
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { uniform, uv, vec2, smoothstep, oneMinus } from "three/tsl";
import { landmarkToScreen } from "../../domain/hand-tracking";
import { fingertip, isFingerExtended, PinchDetector } from "../../domain/hand-gestures";
import type { Experience, ExperienceContext } from "./experience";

const LIFETIME = 2.6; // s que tarda un punto en desvanecerse
const MAX_PER_HAND = 280; // puntos vivos por mano (ring buffer)
const MAX_DOTS = MAX_PER_HAND * 2; // instancias totales (2 manos)
const MIN_STEP = 2.5; // px mínimos entre puntos
const BRUSH = 13; // radio máximo del pincel (px)

interface Dot {
  x: number;
  y: number;
  age: number;
}

export class DrawExperience implements Experience {
  readonly object = new Group();
  private geo = new CircleGeometry(1, 16);
  private colorU = uniform(new Color(0xf45e61));
  private mat: MeshStandardNodeMaterial;
  private dots: InstancedMesh;
  private trails: Dot[][] = [[], []];
  private pinch = [new PinchDetector(), new PinchDetector()];
  private wasDrawing = [false, false];
  private m = new Matrix4();
  private hidden = new Matrix4().makeScale(0, 0, 0);

  constructor() {
    // Material emisivo opaco (los puntos se superponen formando un trazo grueso).
    // Sin test/escritura de profundidad: los puntos son coplanares (z=0) y así se
    // pintan en orden sin z-fighting.
    this.mat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mat.colorNode = this.colorU;
    this.mat.emissiveNode = this.colorU;
    // Borde suave (glow): opaco al centro, se desvanece hacia el radio del punto.
    const d = uv().sub(vec2(0.5, 0.5)).length();
    this.mat.opacityNode = oneMinus(smoothstep(0.15, 0.5, d));
    this.dots = new InstancedMesh(this.geo, this.mat, MAX_DOTS);
    this.dots.instanceMatrix.setUsage(DynamicDrawUsage);
    this.dots.frustumCulled = false;
    for (let i = 0; i < MAX_DOTS; i++) this.dots.setMatrixAt(i, this.hidden);
    this.dots.instanceMatrix.needsUpdate = true;
    this.object.add(this.dots);
  }

  update(ctx: ExperienceContext): void {
    this.colorU.value.set(ctx.color);
    const dt = Math.min(ctx.dt, 0.05);

    for (let i = 0; i < 2; i++) {
      const hand = ctx.hands[i];
      const tip = fingertip(hand, "index");
      const pinching = this.pinch[i].update(hand);
      const drawing = tip !== null && !pinching && isFingerExtended(hand, "index");
      const trail = this.trails[i];

      if (drawing && tip) {
        const p = landmarkToScreen(tip, ctx.width, ctx.height, ctx.mirrored);
        const last = trail[trail.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_STEP) {
          // Interpolar puntos intermedios para un trazo continuo aun a velocidad
          // alta (sin saltos entre frames).
          if (last && this.wasDrawing[i]) {
            const d = Math.hypot(p.x - last.x, p.y - last.y);
            const steps = Math.min(8, Math.floor(d / MIN_STEP));
            for (let s = 1; s < steps; s++) {
              trail.push({
                x: last.x + ((p.x - last.x) * s) / steps,
                y: last.y + ((p.y - last.y) * s) / steps,
                age: 0,
              });
            }
          }
          trail.push({ x: p.x, y: p.y, age: 0 });
          while (trail.length > MAX_PER_HAND) trail.shift();
        }
      }
      this.wasDrawing[i] = drawing;

      for (const d of trail) d.age += dt;
      while (trail.length && trail[0].age > LIFETIME) trail.shift();
    }

    // Volcar todos los puntos al InstancedMesh.
    let n = 0;
    for (const trail of this.trails) {
      for (const d of trail) {
        if (n >= MAX_DOTS) break;
        const k = Math.max(0, 1 - d.age / LIFETIME);
        const r = BRUSH * (0.35 + 0.65 * k); // encoge con la edad
        this.dots.setMatrixAt(n++, this.m.makeScale(r, r, 1).setPosition(d.x, d.y, 0));
      }
    }
    for (let i = n; i < MAX_DOTS; i++) this.dots.setMatrixAt(i, this.hidden);
    this.dots.instanceMatrix.needsUpdate = true;
  }

  hud(): string | null {
    return null;
  }

  reset(): void {
    this.trails = [[], []];
    for (const d of this.pinch) d.reset();
    this.wasDrawing = [false, false];
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.dots.dispose();
  }
}
