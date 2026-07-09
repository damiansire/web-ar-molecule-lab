/**
 * Render 3D real de átomos y moléculas (three.js), como capa aditiva sobre el
 * `#stage` 2D existente: un canvas WebGL transparente encima que SOLO dibuja
 * ingredientes (átomos sueltos con su modelo de Bohr, moléculas ball-and-stick
 * con bonds), en las mismas coordenadas de pantalla (device px) que ya calcula
 * `main.ts`. Video, HUD, botones y partículas siguen en el `#stage` 2D — ver
 * CLAUDE.md § "cero allocations en el render loop" para el porqué del pooling.
 *
 * API espejo de `structure.ts` (drawAtom/drawMolecule) para que `main.ts` solo
 * cambie el call-site, no la lógica de layout/interacción (que sigue en 2D).
 */
import * as THREE from 'three';
import { ELEMENTS, type ElementSymbol, type Molecule } from './chemistry';

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Temporales a nivel módulo — cero alloc por frame (patrón three.js/drei, ver
// creative/from-mrdoob-three.js.md y creative/from-pmndrs-drei.md del corpus).
// ---------------------------------------------------------------------------
const _dir = /*@__PURE__*/ new THREE.Vector3();
const _mid = /*@__PURE__*/ new THREE.Vector3();
const _perp = /*@__PURE__*/ new THREE.Vector3();
const _quat = /*@__PURE__*/ new THREE.Quaternion();
const _yAxis = /*@__PURE__*/ new THREE.Vector3(0, 1, 0);
const _camForward = /*@__PURE__*/ new THREE.Vector3(0, 0, 1);

/** Geometrías unitarias compartidas: cada mesh las escala/orienta, nunca las recrea. */
const SPHERE_GEO = /*@__PURE__*/ new THREE.SphereGeometry(1, 20, 16);
const CYLINDER_GEO = /*@__PURE__*/ new THREE.CylinderGeometry(1, 1, 1, 12);
const RING_GEO = /*@__PURE__*/ new THREE.TorusGeometry(1, 0.01, 6, 48);

/** Rota (x,z) alrededor de Y un ángulo dado. Sin allocar: devuelve por parámetros de salida no aplica en JS, así que se usa como función pura chica. */
function rotY(x: number, z: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c + z * s, z * c - x * s];
}

/** Pool de meshes de un solo "tipo" (misma geometría), crecimiento perezoso. */
class MeshPool {
  private readonly geometry: THREE.BufferGeometry;
  private readonly group: THREE.Group;
  private readonly materialOpts: THREE.MeshStandardMaterialParameters;
  private items: THREE.Mesh[] = [];
  private used = 0;

  constructor(geometry: THREE.BufferGeometry, group: THREE.Group, materialOpts: THREE.MeshStandardMaterialParameters = {}) {
    this.geometry = geometry;
    this.group = group;
    this.materialOpts = materialOpts;
  }

  reset() {
    this.used = 0;
  }

  /** Devuelve el próximo mesh libre del pool (lo crea si hace falta) y lo marca visible. */
  next(): THREE.Mesh {
    let mesh = this.items[this.used];
    if (!mesh) {
      mesh = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial(this.materialOpts));
      this.items.push(mesh);
      this.group.add(mesh);
    }
    mesh.visible = true;
    this.used++;
    return mesh;
  }

  /** Oculta lo que no se usó este frame (no se destruye: se reusa el próximo). */
  hideUnused() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

export class Scene3D {
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly nucleusPool: MeshPool;
  private readonly electronPool: MeshPool;
  private readonly ringPool: MeshPool;
  private readonly bondPool: MeshPool;
  private readonly ballPool: MeshPool;
  private width = 0;
  private height = 0;

  /** `null` si WebGL no está disponible: la capa 3D queda inerte (sin crashear la app). */
  readonly available: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10000);
    this.camera.position.z = 1000;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.renderer.setClearColor(0x000000, 0);
    } catch (err) {
      console.error('Scene3D: WebGL no disponible, la capa 3D queda apagada.', err);
      this.renderer = null;
    }
    this.available = this.renderer !== null;

    const group = new THREE.Group();
    this.scene.add(group);
    this.nucleusPool = new MeshPool(SPHERE_GEO, group);
    this.electronPool = new MeshPool(SPHERE_GEO, group, { emissiveIntensity: 0.6 });
    this.ringPool = new MeshPool(RING_GEO, group, {
      color: 0xe2e8f0, transparent: true, opacity: 0.25, roughness: 1,
    });
    this.bondPool = new MeshPool(CYLINDER_GEO, group, { color: 0xe2e8f0, roughness: 0.6 });
    this.ballPool = new MeshPool(SPHERE_GEO, group);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(-0.4, -0.5, 1); // misma esquina de highlight que el sprite 2D anterior
    this.scene.add(key);
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.camera.left = 0;
    this.camera.right = width;
    this.camera.top = 0; // y=0 arriba, como el canvas 2D (no el "arriba" matemático de three.js)
    this.camera.bottom = height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
  }

  beginFrame() {
    this.nucleusPool.reset();
    this.electronPool.reset();
    this.ringPool.reset();
    this.bondPool.reset();
    this.ballPool.reset();
  }

  /** Átomo aislado: modelo de Bohr (núcleo + capas con electrones orbitando). Espejo de structure.ts#drawAtom. */
  atom(cx: number, cy: number, radius: number, symbol: ElementSymbol, time: number) {
    if (!this.renderer) return;
    const el = ELEMENTS[symbol];
    const shells = el.shells;
    const nucleusR = radius * 0.34;
    const innerGap = nucleusR + radius * 0.16;
    const step = shells.length > 0 ? (radius - innerGap) / shells.length : 0;

    shells.forEach((count, s) => {
      const orbitR = innerGap + step * (s + 1);
      const ring = this.ringPool.next();
      ring.position.set(cx, cy, 0);
      ring.scale.setScalar(orbitR);

      const speed = 0.6 / (s + 1);
      const phase = time * speed + s * 1.3;
      const er = Math.max(1.5, radius * 0.05);
      for (let e = 0; e < count; e++) {
        const a = phase + (e / count) * TWO_PI;
        const electron = this.electronPool.next();
        electron.position.set(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, 0);
        electron.scale.setScalar(er);
        const mat = electron.material as THREE.MeshStandardMaterial;
        mat.color.set(el.color);
        mat.emissive.set(el.color);
      }
    });

    const nucleus = this.nucleusPool.next();
    nucleus.position.set(cx, cy, 0);
    nucleus.scale.setScalar(nucleusR);
    (nucleus.material as THREE.MeshStandardMaterial).color.set(el.color);
  }

  /**
   * Molécula ball-and-stick con bonds reales. `angle` (radianes, alrededor de
   * Y) lo decide el caller: la paleta/cuenco usan un tumble uniforme por
   * tiempo, las flotantes reusan su propio `rot` físico existente (así no se
   * pierde la variación de giro que ya tenían). Espejo de structure.ts#drawMolecule.
   */
  molecule(cx: number, cy: number, scale: number, molecule: Molecule, angle: number) {
    if (!this.renderer) return;
    // Rota cada átomo local (x,y,z) alrededor de Y — solo trig sobre números,
    // sin instanciar Group/Object3D. Excepción deliberada a "cero allocations
    // en el render loop": ≤7 átomos por molécula y ≤~30 moléculas visibles a
    // la vez son objetos cortos y pequeños que el GC generacional absorbe sin
    // jank perceptible; NO es el hot path real (ese es atom()/electrones, que
    // sí está pooled). Si el conteo de moléculas simultáneas crece mucho,
    // convertir a un scratch buffer plano sería el siguiente paso.
    const world = molecule.atoms.map((a) => {
      const [rx, rz] = rotY(a.x, a.z ?? 0, angle);
      return { x: cx + rx * scale, y: cy + a.y * scale, z: rz * scale };
    });

    const bondR = scale * 0.035;
    for (const bond of molecule.bonds) {
      const a = world[bond.a];
      const b = world[bond.b];
      _dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = _dir.length() || 1;
      _dir.normalize();
      _perp.crossVectors(_dir, _camForward);
      if (_perp.lengthSq() < 1e-6) _perp.set(1, 0, 0); // bond ~paralelo a cámara: fallback estable
      _perp.normalize();
      _quat.setFromUnitVectors(_yAxis, _dir);

      const spread = scale * 0.09;
      const n = bond.order === 1 ? 1 : bond.order === 2 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const o = n === 1 ? 0 : n === 2 ? (i === 0 ? -spread : spread) : (i - 1) * spread * 1.6;
        const cyl = this.bondPool.next();
        _mid.set((a.x + b.x) / 2 + _perp.x * o, (a.y + b.y) / 2 + _perp.y * o, (a.z + b.z) / 2 + _perp.z * o);
        cyl.position.copy(_mid);
        cyl.quaternion.copy(_quat);
        cyl.scale.set(bondR, len, bondR);
      }
    }

    for (let i = 0; i < molecule.atoms.length; i++) {
      const el = ELEMENTS[molecule.atoms[i].symbol];
      const p = world[i];
      const ball = this.ballPool.next();
      ball.position.set(p.x, p.y, p.z);
      ball.scale.setScalar(el.radius * scale * 0.62);
      (ball.material as THREE.MeshStandardMaterial).color.set(el.color);
    }
  }

  endFrame() {
    if (!this.renderer) return;
    this.nucleusPool.hideUnused();
    this.electronPool.hideUnused();
    this.ringPool.hideUnused();
    this.bondPool.hideUnused();
    this.ballPool.hideUnused();
    this.renderer.render(this.scene, this.camera);
  }
}
