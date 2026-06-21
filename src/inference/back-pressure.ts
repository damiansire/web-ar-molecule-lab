/**
 * Back-pressure de un solo cuadro en vuelo, como lógica pura y testeable.
 *
 * Política: mejor *dropear* cuadros que encolarlos (encolar acumula latencia).
 * Mientras hay un cuadro procesándose (`busy`), los nuevos se descartan. El gate
 * se libera SIEMPRE que el cuadro en vuelo termina —resultado, error de
 * detección, o fallo al capturar el bitmap—; de lo contrario el back-pressure se
 * trabaría para siempre y la detección se congelaría (bug real ya corregido).
 *
 * Esta clase no toca el `Worker` ni el DOM: el shell (`HandTracker`) la consulta
 * para decidir si manda un cuadro y le avisa de cada terminación. Así el camino
 * más bug-prone (el gate) queda cubierto por tests sin browser.
 */
export class BackPressure {
  private inFlight = false;

  /** ¿Hay un cuadro en vuelo? */
  get busy(): boolean {
    return this.inFlight;
  }

  /**
   * Intenta tomar el gate para enviar un cuadro. Devuelve `true` si se puede
   * enviar (y deja el gate tomado); `false` si ya hay uno en vuelo (dropear).
   */
  tryAcquire(): boolean {
    if (this.inFlight) return false;
    this.inFlight = true;
    return true;
  }

  /**
   * Libera el gate (el cuadro en vuelo terminó por cualquier vía). Idempotente:
   * llamarlo de más no rompe nada (p. ej. result tras un detect-error tardío).
   */
  release(): void {
    this.inFlight = false;
  }

  /** Reinicio duro (p. ej. al recrear el worker): nada en vuelo. */
  reset(): void {
    this.inFlight = false;
  }
}
