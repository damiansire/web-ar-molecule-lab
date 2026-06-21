/**
 * Set de íconos SVG inline (sin dependencias, funciona offline). Todos usan
 * `currentColor`, así heredan el color del texto donde se inserten.
 *
 * Reemplazan los textos en español de la UI por símbolos universales, para que
 * se entienda sin saber el idioma. El nombre en texto queda como tooltip.
 */
const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export type IconName =
  | "none"
  | "square"
  | "cube"
  | "cylinder"
  | "cone"
  | "torus"
  | "sphere"
  | "size"
  | "speed"
  | "opacity"
  | "metalness"
  | "roughness"
  | "color"
  | "faces"
  | "wireframe"
  | "edges"
  | "shadow"
  | "hand"
  | "mirror"
  | "background"
  | "occlusion"
  | "camera"
  // --- experiencias creativas ---
  | "figuras"
  | "dibujo"
  | "atrapar"
  | "galaxia"
  | "lasers";

export const ICONS: Record<IconName, string> = {
  // --- figuras ---
  none: svg(
    '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
  ),
  square: svg('<rect x="5" y="5" width="14" height="14" rx="1"/>'),
  cube: svg(
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
  ),
  cylinder: svg(
    '<ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6v12"/><path d="M18 6v12"/><path d="M6 18a6 2.5 0 0 0 12 0"/>',
  ),
  cone: svg('<path d="M12 4l7 14H5z"/><ellipse cx="12" cy="18" rx="7" ry="2"/>'),
  torus: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>'),
  sphere: svg(
    '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="8.5" ry="3.2"/>',
  ),

  // --- controles ---
  size: svg(
    '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  ),
  speed: svg('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 4 21 9 16 9"/>'),
  opacity: svg(
    '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
  ),
  metalness: svg('<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>'),
  roughness: svg(
    '<path d="M3 8c3-3 6 3 9 0s6-3 9 0"/><path d="M3 15c3-3 6 3 9 0s6-3 9 0"/>',
  ),
  color: svg('<path d="M12 2s7 7.6 7 12a7 7 0 0 1-14 0c0-4.4 7-12 7-12z"/>'),
  faces: svg(
    '<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none"/>',
  ),
  wireframe: svg(
    '<rect x="4" y="4" width="16" height="16"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="4" x2="20" y2="20"/>',
  ),
  edges: svg(
    '<path d="M4 9V4h5"/><path d="M15 4h5v5"/><path d="M20 15v5h-5"/><path d="M9 20H4v-5"/>',
  ),
  shadow: svg(
    '<circle cx="12" cy="9" r="5" fill="currentColor" stroke="none"/><ellipse cx="12" cy="19" rx="6" ry="1.6" fill="currentColor" stroke="none" opacity="0.4"/>',
  ),
  hand: svg(
    '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-1a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5.2-3l-1.8-3a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
  ),
  mirror: svg(
    '<line x1="12" y1="3" x2="12" y2="21"/><path d="M9 7l-4 5 4 5z" fill="currentColor" stroke="none"/><path d="M15 7l4 5-4 5z"/>',
  ),
  background: svg(
    '<rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" stroke="none"/><path d="M4 16l5-4 4 3 3-2 4 3"/>',
  ),
  // oclusión: una forma por detrás de otra (profundidad)
  occlusion: svg(
    '<rect x="10" y="4" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/><rect x="4" y="10" width="10" height="10" rx="1.5" fill="#1f2937" stroke="currentColor"/>',
  ),
  camera: svg(
    '<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
  ),

  // --- experiencias creativas ---
  // figuras: cuadrado + círculo superpuestos (formas 3D)
  figuras: svg(
    '<rect x="4" y="4" width="11" height="11" rx="1.5"/><circle cx="15" cy="15" r="5"/>',
  ),
  // dibujo: lápiz
  dibujo: svg(
    '<path d="M4 20l1-4 11-11 3 3-11 11z"/><path d="M14.5 6.5l3 3"/><line x1="4" y1="20" x2="5" y2="16"/>',
  ),
  // atrapar: circulitos cayendo a una "cuenca"
  atrapar: svg(
    '<circle cx="8" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.6" fill="currentColor" stroke="none"/><circle cx="11" cy="9" r="1.3" fill="currentColor" stroke="none"/><path d="M4 13a8 6 0 0 0 16 0"/>',
  ),
  // galaxia: estrella + chispas
  galaxia: svg(
    '<path d="M11 2l1.6 4.6L17 8l-4.4 1.4L11 14l-1.6-4.6L5 8l4.4-1.4z" fill="currentColor" stroke="none"/><circle cx="18" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="6" cy="17" r="1" fill="currentColor" stroke="none"/>',
  ),
  // lasers: nodos conectados por rayos
  lasers: svg(
    '<circle cx="6" cy="6" r="1.7"/><circle cx="18" cy="6" r="1.7"/><circle cx="6" cy="18" r="1.7"/><circle cx="18" cy="18" r="1.7"/><path d="M7.3 7.3l9.4 9.4M16.7 7.3l-9.4 9.4"/>',
  ),
};
