/**
 * Experiencia "Galaxia": un campo de estrellas a la deriva. Al pellizcar, las
 * estrellas se ordenan: 21 saltan sobre los landmarks de la mano (la "mano
 * estrellada") y el resto orbita un planeta que crece en el punto del pellizco.
 * Al soltar, el planeta pega un destello y las estrellas se dispersan.
 *
 * Los materiales de nodo (TSL) toman el color por `colorNode`/`emissiveNode`
 * (uniforms), no por `.color`.
 */
import {
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  SphereGeometry,
} from "three/webgpu";
import { uniform, uv, vec2, smoothstep, oneMinus } from "three/tsl";
import { landmarkToScreen } from "../../domain/hand-tracking";
import { PinchDetector } from "../../domain/hand-gestures";
import type { Experience, ExperienceContext } from "./experience";

const WHITE = new Color(0xffffff);
const STARS = 220;
const PLANET_R = 74; // radio objetivo del planeta (px)
const ORBIT_R = 150; // radio de la órbita de las estrellas al pellizcar
const FLASH = 0.6; // s que dura el destello al soltar

export class GalaxyExperience implements Experience {
  readonly object = new Group();

  private starGeo = new CircleGeometry(1, 12);
  private starColor = uniform(new Color(0xeaf2ff));
  private starMat: MeshStandardNodeMaterial;
  private stars: InstancedMesh;
  private x = new Float32Array(STARS);
  private y = new Float32Array(STARS);
  private vx = new Float32Array(STARS);
  private vy = new Float32Array(STARS);
  private phase = new Float32Array(STARS);
  private size = new Float32Array(STARS); // tamaño base por estrella (da profundidad)
  private seeded = false;

  private planet: Mesh;
  private planetColor = uniform(new Color(0xf45e61));
  private planetEmissive = uniform(new Color(0x000000));
  private planetMat: MeshStandardNodeMaterial;
  private haloGeo = new CircleGeometry(1, 40);
  private haloColor = uniform(new Color(0xf45e61));
  private haloMat: MeshStandardNodeMaterial;
  private halo: Mesh;
  private planetR = 0;
  private px = 0;
  private py = 0;

  private pinch = new PinchDetector();
  private flashT = 0;

  private mat = new Matrix4();

  constructor() {
    this.starMat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
    });
    this.starMat.colorNode = this.starColor;
    this.starMat.emissiveNode = this.starColor;
    this.stars = new InstancedMesh(this.starGeo, this.starMat, STARS);
    this.stars.instanceMatrix.setUsage(DynamicDrawUsage);
    this.stars.frustumCulled = false;

    this.planetMat = new MeshStandardNodeMaterial({ metalness: 0.25, roughness: 0.5 });
    this.planetMat.colorNode = this.planetColor;
    this.planetMat.emissiveNode = this.planetEmissive;
    this.planet = new Mesh(new SphereGeometry(1, 36, 24), this.planetMat);
    this.planet.frustumCulled = false;
    this.planet.visible = false;

    // Halo = glow radial real: opaco en el centro, se desvanece hacia el borde
    // (opacityNode sobre la UV del disco), no un disco macizo del color del planeta.
    this.haloMat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.haloMat.colorNode = this.haloColor;
    this.haloMat.emissiveNode = this.haloColor;
    const d = uv().sub(vec2(0.5, 0.5)).length(); // 0 centro → ~0.5 borde
    this.haloMat.opacityNode = oneMinus(smoothstep(0.05, 0.5, d));
    this.halo = new Mesh(this.haloGeo, this.haloMat);
    this.halo.frustumCulled = false;
    this.halo.visible = false;

    this.object.add(this.halo, this.stars, this.planet);
  }

  private seed(w: number, h: number): void {
    for (let i = 0; i < STARS; i++) {
      this.x[i] = Math.random() * w;
      this.y[i] = Math.random() * h;
      this.vx[i] = (Math.random() - 0.5) * 14;
      this.vy[i] = (Math.random() - 0.5) * 14;
      this.phase[i] = Math.random() * Math.PI * 2;
      // Mayoría de estrellas chicas, unas pocas grandes → sensación de campo/profundidad.
      const r = Math.random();
      this.size[i] = r > 0.92 ? 3.5 + Math.random() * 2 : 1 + Math.random() * 1.6;
    }
    this.seeded = true;
  }

  update(ctx: ExperienceContext): void {
    const { width: w, height: h } = ctx;
    if (!this.seeded) this.seed(w, h);
    const dt = Math.min(ctx.dt, 0.05);

    const c = new Color(ctx.color);
    this.planetColor.value.copy(c);
    this.haloColor.value.copy(c);
    this.planetEmissive.value.copy(c).multiplyScalar(0.45);

    const hand = ctx.hands[0];
    const wasPinching = this.pinch.pinching;
    const pinching = this.pinch.update(hand);

    // Punto del pellizco = medio entre punta de pulgar e índice (o palma).
    if (pinching && hand) {
      const a = hand[4];
      const b = hand[8];
      const mid = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 0 } : hand[9];
      if (mid) {
        const p = landmarkToScreen(mid, w, h, ctx.mirrored);
        this.px = p.x;
        this.py = p.y;
      }
    }

    // Flanco de bajada (soltar): destello + dispersión de estrellas.
    if (wasPinching && !pinching) {
      this.flashT = FLASH;
      for (let i = 0; i < STARS; i++) {
        const dx = this.x[i] - this.px;
        const dy = this.y[i] - this.py;
        const d = Math.hypot(dx, dy) || 1;
        const push = 280;
        this.vx[i] = (dx / d) * push;
        this.vy[i] = (dy / d) * push;
      }
    }

    // Radio del planeta: crece al pellizcar, pulsa al soltar.
    if (pinching) {
      this.planetR += (PLANET_R - this.planetR) * Math.min(1, dt * 6);
    } else if (this.flashT > 0) {
      this.flashT -= dt;
      const k = this.flashT / FLASH; // 1 → 0
      this.planetR = PLANET_R * (1 + 1.8 * k);
    } else {
      this.planetR += (0 - this.planetR) * Math.min(1, dt * 8);
    }

    // Estrellas.
    const handPts =
      pinching && hand ? hand.map((lm) => landmarkToScreen(lm, w, h, ctx.mirrored)) : null;
    for (let i = 0; i < STARS; i++) {
      if (pinching) {
        let tx: number;
        let ty: number;
        if (handPts && i < handPts.length) {
          tx = handPts[i].x;
          ty = handPts[i].y; // estrella sobre el landmark → "mano estrellada"
        } else {
          const ang = (i / STARS) * Math.PI * 2 + ctx.time * 0.6;
          tx = this.px + Math.cos(ang) * ORBIT_R;
          ty = this.py + Math.sin(ang) * ORBIT_R;
        }
        this.x[i] += (tx - this.x[i]) * Math.min(1, dt * 7);
        this.y[i] += (ty - this.y[i]) * Math.min(1, dt * 7);
      } else {
        // Deriva libre con rebote suave en los bordes.
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.vx[i] *= 1 - dt * 0.6;
        this.vy[i] *= 1 - dt * 0.6;
        if (this.x[i] < 0 || this.x[i] > w) this.vx[i] *= -1;
        if (this.y[i] < 0 || this.y[i] > h) this.vy[i] *= -1;
        this.x[i] = Math.max(0, Math.min(w, this.x[i]));
        this.y[i] = Math.max(0, Math.min(h, this.y[i]));
      }
      // Tamaño por estrella + titileo (da variedad/profundidad al campo).
      const tw = this.size[i] * (0.7 + 0.4 * Math.sin(ctx.time * 3 + this.phase[i]));
      this.stars.setMatrixAt(
        i,
        this.mat.makeScale(tw, tw, 1).setPosition(this.x[i], this.y[i], 5),
      );
    }
    this.stars.instanceMatrix.needsUpdate = true;

    // Planeta + halo.
    const r = this.planetR;
    const visible = r > 1.5;
    this.planet.visible = visible;
    this.halo.visible = visible;
    if (visible) {
      this.planet.scale.setScalar(r);
      this.planet.position.set(this.px, this.py, 0);
      // Halo grande y más claro que el planeta (atmósfera vs cuerpo); el desvanecido
      // lo da el opacityNode radial, no la escala.
      this.halo.scale.setScalar(r * (this.flashT > 0 ? 3.4 : 2.7));
      this.halo.position.set(this.px, this.py, -2);
      this.haloColor.value.copy(c).lerp(WHITE, 0.4);
    }
  }

  hud(): string | null {
    return null;
  }

  reset(): void {
    this.seeded = false;
    this.planetR = 0;
    this.flashT = 0;
    this.pinch.reset();
    this.planet.visible = false;
    this.halo.visible = false;
  }

  dispose(): void {
    this.starGeo.dispose();
    this.starMat.dispose();
    this.stars.dispose();
    this.planet.geometry.dispose();
    this.planetMat.dispose();
    this.haloGeo.dispose();
    this.haloMat.dispose();
  }
}
