/**
 * Render de "formas": átomos (modelo de Bohr con capas de electrones) y
 * moléculas (ball-and-stick con enlaces simples/dobles/triples).
 * Todo dibujado en Canvas 2D, escalable, sin estado propio.
 */
import { ELEMENTS, type ChemElement, type Molecule } from './chemistry';

const TWO_PI = Math.PI * 2;

// ---------------------------------------------------------------------------
// Cache de sprites de esfera
// ---------------------------------------------------------------------------
// El gradiente radial + el símbolo de cada átomo son idénticos frame a frame:
// solo cambian de posición y escala. Crear un `createRadialGradient` por átomo
// y por frame era el mayor costo del render (decenas por frame). En su lugar
// rasterizamos cada esfera UNA vez a un canvas offscreen de alta resolución y
// después la estampamos escalada con `drawImage` (mucho más barato).
const SPRITE_R = 160; // radio de la esfera en el sprite base (px)
const SPRITE_PAD = 6; // margen para que el antialias del borde no se recorte
const spriteCache = new Map<string, HTMLCanvasElement>();

function sphereSprite(el: ChemElement, withLabel: boolean): HTMLCanvasElement {
  const key = `${el.symbol}:${withLabel ? 1 : 0}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const c = document.createElement('canvas');
  const center = SPRITE_R + SPRITE_PAD;
  c.width = c.height = center * 2;
  const g = c.getContext('2d')!;

  const grad = g.createRadialGradient(
    center - SPRITE_R * 0.35, center - SPRITE_R * 0.35, SPRITE_R * 0.1,
    center, center, SPRITE_R,
  );
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, el.color);
  grad.addColorStop(1, shade(el.color, -0.45));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(center, center, SPRITE_R, 0, TWO_PI);
  g.fill();

  if (withLabel) {
    g.fillStyle = '#05060a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${SPRITE_R * 0.95}px system-ui, sans-serif`;
    g.fillText(el.symbol, center, center + SPRITE_R * 0.04);
  }

  spriteCache.set(key, c);
  return c;
}

/** Esfera con gradiente + símbolo. Base de átomos y moléculas. */
function drawSphere(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  el: ChemElement,
  withLabel = true,
) {
  const sprite = sphereSprite(el, withLabel);
  // El sprite mapea su radio SPRITE_R -> r; el margen escala con él.
  const half = (SPRITE_R + SPRITE_PAD) * (r / SPRITE_R);
  ctx.drawImage(sprite, cx - half, cy - half, half * 2, half * 2);
}

/**
 * Dibuja un átomo aislado como modelo de Bohr: núcleo + capas con electrones
 * que orbitan (animados con `time`). `radius` es el radio total ocupado.
 */
export function drawAtom(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  symbol: keyof typeof ELEMENTS,
  time = 0,
) {
  const el = ELEMENTS[symbol];
  const shells = el.shells;
  const nucleusR = radius * 0.34;
  const innerGap = nucleusR + radius * 0.16;
  const step = shells.length > 0 ? (radius - innerGap) / shells.length : 0;

  ctx.save();
  // Capas + electrones.
  shells.forEach((count, s) => {
    const orbitR = innerGap + step * (s + 1);
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
    ctx.lineWidth = Math.max(1, radius * 0.012);
    ctx.stroke();

    const speed = 0.6 / (s + 1);
    const phase = time * speed + s * 1.3;
    const er = Math.max(1.5, radius * 0.05);
    ctx.fillStyle = el.color;
    for (let e = 0; e < count; e++) {
      const a = phase + (e / count) * TWO_PI;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * orbitR, cy + Math.sin(a) * orbitR, er, 0, TWO_PI);
      ctx.fill();
    }
  });

  // Núcleo.
  drawSphere(ctx, cx, cy, nucleusR, el);
  ctx.restore();
}

/**
 * Dibuja una molécula ball-and-stick centrada en (cx, cy).
 * `scale` = px por unidad local (la distancia típica entre átomos es ~1).
 */
export function drawMolecule(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  molecule: Molecule,
) {
  ctx.save();
  ctx.lineCap = 'round';

  // Enlaces primero (debajo de los átomos).
  for (const bond of molecule.bonds) {
    const a = molecule.atoms[bond.a];
    const b = molecule.atoms[bond.b];
    const ax = cx + a.x * scale;
    const ay = cy + a.y * scale;
    const bx = cx + b.x * scale;
    const by = cy + b.y * scale;

    // Para dobles/triples, desplazamos líneas paralelas perpendiculares.
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const spread = scale * 0.09;
    const offsets =
      bond.order === 1 ? [0] : bond.order === 2 ? [-spread, spread] : [-spread * 1.6, 0, spread * 1.6];

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.lineWidth = scale * 0.07;
    for (const o of offsets) {
      ctx.beginPath();
      ctx.moveTo(ax + px * o, ay + py * o);
      ctx.lineTo(bx + px * o, by + py * o);
      ctx.stroke();
    }
  }

  // Átomos encima.
  for (const atom of molecule.atoms) {
    const el = ELEMENTS[atom.symbol];
    drawSphere(ctx, cx + atom.x * scale, cy + atom.y * scale, el.radius * scale * 0.62, el);
  }
  ctx.restore();
}

/** Aclara/oscurece un color hex por un factor [-1, 1]. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const f = (c: number) =>
    Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)
      .toString(16)
      .padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
