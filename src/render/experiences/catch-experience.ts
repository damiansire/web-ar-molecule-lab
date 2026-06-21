/**
 * Experiencia "Atrapar": caen círculos y se suman puntos al tocarlos con la mano.
 * Toda la lógica (spawn, caída, colisión, score) vive en el dominio puro
 * `catch-game.ts`; acá sólo se dibuja el estado y se anima la "explosión" de los
 * que se atrapan. La mano atrapa con dos puntos: la palma (radio grande) y la
 * punta del índice (radio chico), así sirve tanto abrir como apuntar.
 *
 * Render: `MeshStandardNodeMaterial` con `emissiveNode` (formas brillantes,
 * opacas). En este backend los `MeshBasicNodeMaterial` no escriben píxeles sobre
 * el canvas transparente; el Standard sí (es el que usan las figuras).
 */
import {
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  CircleGeometry,
  RingGeometry,
} from "three/webgpu";
import { uniform } from "three/tsl";
import { landmarkToScreen, handPerspectiveScale } from "../../domain/hand-tracking";
import { fingertip } from "../../domain/hand-gestures";
import {
  createCatchState,
  updateCatch,
  type CatchState,
  type Catcher,
} from "../../domain/catch-game";
import type { Experience, ExperienceContext } from "./experience";

const MAX_CIRCLES = 48;
const MAX_BURST = 96;
const PALM_RADIUS = 52; // px a escala 1 (se ajusta por perspectiva)
const TIP_RADIUS = 26;

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1 → 0
}

/** Material emisivo (forma plana brillante de un color dado). */
function glowMaterial(c: number): {
  mat: MeshStandardNodeMaterial;
  color: ReturnType<typeof uniform>;
} {
  const color = uniform(new Color(c));
  const mat = new MeshStandardNodeMaterial({
    metalness: 0,
    roughness: 0.7,
    side: DoubleSide,
  });
  mat.colorNode = color;
  mat.emissiveNode = color;
  return { mat, color };
}

export class CatchExperience implements Experience {
  readonly object = new Group();
  private state: CatchState = createCatchState();

  private circleGeo = new CircleGeometry(1, 32);
  private circleColor = uniform(new Color(0xf45e61));
  private circleMat: MeshStandardNodeMaterial;
  private circles: InstancedMesh;
  private cores: InstancedMesh;
  private coreMat: MeshStandardNodeMaterial;

  private burstGeo = new CircleGeometry(1, 16);
  private burstMat: MeshStandardNodeMaterial;
  private burstMesh: InstancedMesh;
  private burst: BurstParticle[] = [];

  private markerGeo = new RingGeometry(0.84, 1, 36);
  private markerMat: MeshStandardNodeMaterial;
  private markers: InstancedMesh;

  private mat = new Matrix4();
  private hidden = new Matrix4().makeScale(0, 0, 0);
  private catchers: Catcher[] = [];

  constructor() {
    this.circleMat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
    });
    this.circleMat.colorNode = this.circleColor;
    this.circleMat.emissiveNode = this.circleColor;
    this.circles = this.instanced(this.circleGeo, this.circleMat, MAX_CIRCLES);

    this.coreMat = glowMaterial(0xffe7e7).mat;
    this.cores = this.instanced(this.circleGeo, this.coreMat, MAX_CIRCLES);

    this.burstMat = glowMaterial(0xfff2c0).mat;
    this.burstMesh = this.instanced(this.burstGeo, this.burstMat, MAX_BURST);

    this.markerMat = glowMaterial(0x8fc7ff).mat;
    this.markers = this.instanced(this.markerGeo, this.markerMat, 2);

    this.object.add(this.markers, this.circles, this.cores, this.burstMesh);
  }

  private instanced(
    geo: CircleGeometry | RingGeometry,
    mat: MeshStandardNodeMaterial,
    n: number,
  ): InstancedMesh {
    const mesh = new InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, this.hidden);
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  update(ctx: ExperienceContext): void {
    this.circleColor.value.set(ctx.color);
    const { width: w, height: h } = ctx;

    // Puntos de mano que pueden atrapar (palma + punta del índice).
    this.catchers.length = 0;
    let markerCount = 0;
    for (let i = 0; i < ctx.hands.length && i < 2; i++) {
      const hand = ctx.hands[i];
      const scale = handPerspectiveScale(hand, w, h);
      const palm = hand?.[9];
      if (palm) {
        const p = landmarkToScreen(palm, w, h, ctx.mirrored);
        const r = PALM_RADIUS * scale;
        this.catchers.push({ x: p.x, y: p.y, r });
        this.markers.setMatrixAt(markerCount++, this.place(p.x, p.y, r, -1));
      }
      const tip = fingertip(hand, "index");
      if (tip) {
        const p = landmarkToScreen(tip, w, h, ctx.mirrored);
        this.catchers.push({ x: p.x, y: p.y, r: TIP_RADIUS * scale });
      }
    }
    for (let i = markerCount; i < 2; i++) this.markers.setMatrixAt(i, this.hidden);
    this.markers.instanceMatrix.needsUpdate = true;

    const out = updateCatch(this.state, {
      width: w,
      height: h,
      dt: Math.min(ctx.dt, 0.05),
      catchers: this.catchers,
      random: Math.random,
    });

    // Explosión por cada círculo atrapado.
    for (const c of out.caught) this.spawnBurst(c.x, c.y);

    // Dibujar círculos + su núcleo brillante (highlight desplazado).
    for (let i = 0; i < MAX_CIRCLES; i++) {
      const c = this.state.circles[i];
      this.circles.setMatrixAt(i, c ? this.place(c.x, c.y, c.r, 0) : this.hidden);
      this.cores.setMatrixAt(
        i,
        c ? this.place(c.x - c.r * 0.3, c.y - c.r * 0.3, c.r * 0.36, 1) : this.hidden,
      );
    }
    this.circles.instanceMatrix.needsUpdate = true;
    this.cores.instanceMatrix.needsUpdate = true;

    // Animar la explosión.
    this.updateBurst(Math.min(ctx.dt, 0.05));
  }

  private spawnBurst(x: number, y: number): void {
    const n = 12;
    for (let k = 0; k < n && this.burst.length < MAX_BURST; k++) {
      const a = (k / n) * Math.PI * 2;
      const speed = 140 + Math.random() * 180;
      this.burst.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 1 });
    }
  }

  private updateBurst(dt: number): void {
    const alive: BurstParticle[] = [];
    for (const p of this.burst) {
      p.life -= dt * 2.2;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt; // gravedad leve
      alive.push(p);
    }
    this.burst = alive;
    for (let i = 0; i < MAX_BURST; i++) {
      const p = this.burst[i];
      this.burstMesh.setMatrixAt(i, p ? this.place(p.x, p.y, 7 * p.life + 1, 2) : this.hidden);
    }
    this.burstMesh.instanceMatrix.needsUpdate = true;
  }

  private place(x: number, y: number, r: number, z = 0): Matrix4 {
    return this.mat.makeScale(r, r, 1).setPosition(x, y, z);
  }

  hud(): string | null {
    return `${this.state.score}`;
  }

  reset(): void {
    this.state = createCatchState();
    this.burst.length = 0;
  }

  dispose(): void {
    this.circleGeo.dispose();
    this.circleMat.dispose();
    this.circles.dispose();
    this.coreMat.dispose();
    this.cores.dispose();
    this.burstGeo.dispose();
    this.burstMat.dispose();
    this.burstMesh.dispose();
    this.markerGeo.dispose();
    this.markerMat.dispose();
    this.markers.dispose();
  }
}
