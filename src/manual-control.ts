/**
 * Modo de control manual (teclado + mouse/click): alternativa accesible al
 * gesto de mano frente a la cámara. Sin cámara, sin voz, sin mano flotante —
 * el jugador navega con flechas/Tab y activa con Enter/click.
 *
 * Puro y testeable: arma la secuencia de foco (paleta → estante → Mezclar →
 * Vaciar) y resuelve a qué índice mueve una flecha. El wiring real de
 * teclado/mouse (listeners DOM, hit-testing sobre layout.ts) vive en main.ts.
 */

/** Un elemento navegable del modo manual. */
export type ManualTarget =
  | { kind: 'atom'; index: number }
  | { kind: 'shelf'; index: number }
  | { kind: 'mix' }
  | { kind: 'clear' };

/**
 * Secuencia de foco completa para el estado actual del juego: primero los
 * átomos de la paleta (orden fijo), después el estante de productos
 * descubiertos (crece con el inventario), y por último los dos botones.
 */
export function buildFocusSequence(atomCount: number, shelfCount: number): ManualTarget[] {
  const seq: ManualTarget[] = [];
  for (let i = 0; i < atomCount; i++) seq.push({ kind: 'atom', index: i });
  for (let i = 0; i < shelfCount; i++) seq.push({ kind: 'shelf', index: i });
  seq.push({ kind: 'mix' });
  seq.push({ kind: 'clear' });
  return seq;
}

/**
 * Próximo índice al mover el foco con flechas/Tab, dando la vuelta en los
 * bordes (del último vuelve al primero y viceversa). `null`/`-1` (sin foco
 * previo) arranca siempre en el primer elemento, sin importar la dirección.
 */
export function nextFocusIndex(current: number | null, length: number, direction: 1 | -1): number {
  if (length <= 0) return -1;
  if (current === null || current < 0 || current >= length) return 0;
  return (current + direction + length) % length;
}
