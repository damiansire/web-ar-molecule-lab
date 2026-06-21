/**
 * Experiencia "Láseres": los dedos se conectan con rayos. Dentro de cada mano se
 * unen la muñeca con las puntas y las puntas entre sí (silueta cableada); con las
 * dos manos presentes, además se tienden rayos punta-a-punta entre ambas.
 *
 * Para que se vean como haces neón (y no líneas de 1px), cada rayo es un plano
 * delgado orientado a lo largo del segmento (InstancedMesh, blending aditivo), con
 * un nodo luminoso en cada punta. El color va por `colorNode` (uniform), no `.color`.
 */
import {
  CircleGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three/webgpu";
import { uniform, uv, vec2, smoothstep, oneMinus } from "three/tsl";
import { landmarkToScreen, type ScreenPoint } from "../../domain/hand-tracking";
import { FINGERTIPS } from "../../domain/hand-gestures";
import type { Experience, ExperienceContext } from "./experience";

const WRIST = 0;
const TIPS = [
  FINGERTIPS.thumb,
  FINGERTIPS.index,
  FINGERTIPS.middle,
  FINGERTIPS.ring,
  FINGERTIPS.pinky,
];
const MAX_BEAMS = 64;
const MAX_NODES = 16;
const BEAM_WIDTH = 5; // grosor del rayo (px)

export class LaserExperience implements Experience {
  readonly object = new Group();

  private beamGeo = new PlaneGeometry(1, 1);
  private beamColor = uniform(new Color(0x6cf0ff));
  private beamMat: MeshStandardNodeMaterial;
  private beams: InstancedMesh;

  private nodeGeo = new CircleGeometry(1, 16);
  private nodeColor = uniform(new Color(0xffffff));
  private nodeMat: MeshStandardNodeMaterial;
  private nodes: InstancedMesh;

  private mat = new Matrix4();
  private pos = new Vector3();
  private scl = new Vector3();
  private quat = new Quaternion();
  private euler = new Euler();
  private hidden = new Matrix4().makeScale(0, 0, 0);

  constructor() {
    this.beamMat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.beamMat.colorNode = this.beamColor;
    this.beamMat.emissiveNode = this.beamColor;
    // Núcleo neón: brillante en el eje del haz, se apaga hacia los bordes (uv.y).
    const ny = uv().y.sub(0.5).abs(); // 0 centro → 0.5 borde
    this.beamMat.opacityNode = oneMinus(smoothstep(0.1, 0.5, ny));
    this.beams = this.instanced(this.beamGeo, this.beamMat, MAX_BEAMS);

    this.nodeMat = new MeshStandardNodeMaterial({
      metalness: 0,
      roughness: 0.7,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.nodeMat.colorNode = this.nodeColor;
    this.nodeMat.emissiveNode = this.nodeColor;
    const dn = uv().sub(vec2(0.5, 0.5)).length();
    this.nodeMat.opacityNode = oneMinus(smoothstep(0.1, 0.5, dn));
    this.nodes = this.instanced(this.nodeGeo, this.nodeMat, MAX_NODES);

    this.object.add(this.beams, this.nodes);
  }

  private instanced(
    geo: PlaneGeometry | CircleGeometry,
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
    const { width: w, height: h } = ctx;
    // Color base teñido por el usuario, con un parpadeo sutil de brillo.
    const flicker = 0.75 + 0.25 * Math.sin(ctx.time * 8);
    this.beamColor.value.set(ctx.color).multiplyScalar(flicker);
    this.nodeColor.value.set(ctx.color).lerp(new Color(0xffffff), 0.6);

    const screen = (hand: readonly { x: number; y: number; z: number }[], idx: number): ScreenPoint =>
      landmarkToScreen(hand[idx], w, h, ctx.mirrored);

    let beamCount = 0;
    let nodeCount = 0;
    const beam = (a: ScreenPoint, b: ScreenPoint) => {
      if (beamCount >= MAX_BEAMS) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 0.001;
      this.pos.set((a.x + b.x) / 2, (a.y + b.y) / 2, -1);
      this.euler.set(0, 0, Math.atan2(dy, dx));
      this.quat.setFromEuler(this.euler);
      this.scl.set(len, BEAM_WIDTH, 1);
      this.beams.setMatrixAt(beamCount++, this.mat.compose(this.pos, this.quat, this.scl));
    };
    const node = (p: ScreenPoint, r: number) => {
      if (nodeCount >= MAX_NODES) return;
      this.nodes.setMatrixAt(nodeCount++, this.mat.makeScale(r, r, 1).setPosition(p.x, p.y, 6));
    };

    const presentTips: (ScreenPoint[] | null)[] = [null, null];
    for (let i = 0; i < ctx.hands.length && i < 2; i++) {
      const hand = ctx.hands[i];
      if (!hand || hand.length < 21) continue;
      const wrist = screen(hand, WRIST);
      const tips = TIPS.map((t) => screen(hand, t));
      presentTips[i] = tips;
      for (const t of tips) beam(wrist, t); // radios desde la muñeca
      for (let k = 0; k < tips.length; k++) beam(tips[k], tips[(k + 1) % tips.length]); // anillo
      node(wrist, 8);
      for (const t of tips) node(t, 10);
    }

    // Rayos entre las dos manos (punta con punta).
    if (presentTips[0] && presentTips[1]) {
      for (let k = 0; k < TIPS.length; k++) beam(presentTips[0][k], presentTips[1][k]);
    }

    for (let i = beamCount; i < MAX_BEAMS; i++) this.beams.setMatrixAt(i, this.hidden);
    for (let i = nodeCount; i < MAX_NODES; i++) this.nodes.setMatrixAt(i, this.hidden);
    this.beams.instanceMatrix.needsUpdate = true;
    this.nodes.instanceMatrix.needsUpdate = true;
  }

  hud(): string | null {
    return null;
  }

  reset(): void {
    for (let i = 0; i < MAX_BEAMS; i++) this.beams.setMatrixAt(i, this.hidden);
    this.beams.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.beamGeo.dispose();
    this.beamMat.dispose();
    this.beams.dispose();
    this.nodeGeo.dispose();
    this.nodeMat.dispose();
    this.nodes.dispose();
  }
}
