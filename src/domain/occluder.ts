/**
 * Geometría pura de la silueta del oclusor de la mano: envolvente convexa de los
 * landmarks proyectados + triangulación tipo "abanico" (fan) de ese polígono.
 * Sin DOM ni Three.js, así se puede testear de forma aislada (T-1).
 *
 * El oclusor es un polígono que sólo escribe profundidad: tapa la figura cuando
 * el dorso de la mano mira a la cámara. La envolvente convexa da una silueta
 * simple y siempre triangulable por abanico (un polígono convexo no tiene
 * "orejas" cóncavas).
 */
export interface Pt {
  x: number;
  y: number;
}

/**
 * Envolvente convexa por *monotone chain* (Andrew). Devuelve los vértices del
 * casco en orden, sin repetir el primero al final. Para < 3 puntos devuelve los
 * puntos ordenados (no hay polígono).
 *
 * Nota: usa `<= 0` en el test de giro, por lo que descarta puntos colineales
 * (casco mínimo, sin vértices redundantes sobre una arista).
 */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Triangulación en abanico de un polígono **convexo** de `n` vértices: emite los
 * índices (3 por triángulo) de los triángulos (0, k, k+1) para k en [1, n-2].
 * Escribe in-place en `out` (alloc-free) y devuelve la cantidad de índices
 * escritos. Para `n < 3` no escribe nada y devuelve 0.
 *
 * Precondición: `out.length >= (n - 2) * 3`.
 */
export function fanTriangulate(n: number, out: Uint16Array): number {
  if (n < 3) return 0;
  let t = 0;
  for (let k = 1; k < n - 1; k++) {
    out[t++] = 0;
    out[t++] = k;
    out[t++] = k + 1;
  }
  return t;
}
