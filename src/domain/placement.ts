/**
 * Lógica pura de ubicación de la figura y de la orientación palma/dorso.
 * Extraída de la escena para poder testearla sin Three.js ni DOM.
 */

/** Tamaño/posición objetivo de una figura en pantalla. */
export interface Target {
  show: boolean;
  x: number;
  y: number;
  s: number;
}

/**
 * ¿Se sostiene la última posición de la mano ante una pérdida breve? Durante la
 * ventana de gracia la figura no parpadea ni se va a la esquina de inmediato.
 */
export function isHeld(
  everSeen: boolean,
  lastSeen: number,
  now: number,
  graceMs: number,
): boolean {
  return everSeen && now - lastSeen < graceMs;
}

/**
 * Resuelve dónde va la figura:
 *  - sobre la mano (detectada o sostenida por la gracia);
 *  - si no hay mano y es la figura principal → preview en la esquina;
 *  - si no, oculta (segunda mano ausente).
 */
export function resolvePlacement(opts: {
  onHand: boolean;
  hand: { x: number; y: number; s: number };
  isPrimary: boolean;
  corner: { x: number; y: number; s: number };
}): Target {
  if (opts.onHand) return { show: true, ...opts.hand };
  if (opts.isPrimary) return { show: true, ...opts.corner };
  return { show: false, x: 0, y: 0, s: 0 };
}

/**
 * Aplica histéresis con zona muerta a la señal de orientación: sólo cambia el
 * estado fuera de la banda; dentro (mano casi de canto) conserva el anterior.
 * `signal` negativo = palma; positivo = dorso. Devuelve `true` si es dorso.
 */
export function applyFacingHysteresis(
  prev: boolean,
  signal: number,
  deadzone: number,
): boolean {
  if (signal > deadzone) return true;
  if (signal < -deadzone) return false;
  return prev;
}

/** Posición de la esquina (margen amplio para que la figura no se salga al rotar). */
export function cornerTarget(
  width: number,
  base: number,
  scale: number,
): { x: number; y: number } {
  const margin = base * 0.9 * scale + 26;
  return { x: width - margin, y: margin };
}
