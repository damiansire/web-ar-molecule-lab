/**
 * Suavizado predictivo de señales escalares (posición X/Y, escala), puro y
 * testeable sin DOM ni Three.js.
 *
 * Implementa el filtro **One-Euro** (Casiez et al., 2012): un paso-bajo
 * adaptativo cuya frecuencia de corte sube con la velocidad de la señal. A baja
 * velocidad filtra fuerte (mata el jitter de la inferencia, que llega a 15-25
 * fps); a alta velocidad filtra poco (no introduce lag perceptible al mover la
 * mano rápido). Encima añade **predicción por velocidad**: extrapola la señal
 * filtrada por la latencia de inferencia medida, compensando que el detector va
 * siempre un intervalo atrasado respecto del render (60 fps).
 *
 * El lerp exponencial anterior (`1 - exp(-dt*k)`) es correcto e independiente
 * del framerate pero puramente reactivo: nunca adelanta a la mano. One-Euro +
 * predicción tensa el tracking sin sumar jitter.
 */

/** Parámetros del filtro One-Euro. Valores por defecto razonables para tracking de manos. */
export interface OneEuroConfig {
  /** Frecuencia de corte mínima (Hz). Más bajo = más suave en reposo. */
  readonly minCutoff: number;
  /** Pendiente de adaptación a la velocidad. Más alto = menos lag al moverse. */
  readonly beta: number;
  /** Frecuencia de corte del derivador (Hz). Suaviza la estimación de velocidad. */
  readonly dCutoff: number;
  /**
   * Cuánto extrapolar hacia adelante, en segundos. Típicamente la latencia de
   * inferencia (~1 frame de detección). 0 desactiva la predicción.
   */
  readonly predictSeconds: number;
}

export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 1.2,
  beta: 0.025,
  dCutoff: 1.0,
  predictSeconds: 0.0,
};

/**
 * Coeficiente de un paso-bajo de primer orden para un corte `cutoff` (Hz) dado
 * un paso temporal `dt` (s). Equivale a `1 - exp(...)` linealizado del paper.
 */
export function smoothingAlpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/**
 * Filtro One-Euro para una señal escalar, alloc-free tras la construcción:
 * `filter()` no asigna en el hot path (solo escribe campos primitivos).
 */
export class OneEuroFilter {
  private cfg: OneEuroConfig;
  private xPrev = 0;
  private dxPrev = 0;
  private hasPrev = false;

  constructor(config: Partial<OneEuroConfig> = {}) {
    this.cfg = { ...DEFAULT_ONE_EURO, ...config };
  }

  /** Reinicia el estado: el próximo `filter` arranca limpio (sin interpolar desde 0). */
  reset(): void {
    this.hasPrev = false;
    this.xPrev = 0;
    this.dxPrev = 0;
  }

  /**
   * Filtra `value` con paso temporal `dt` (s). Devuelve la estimación suavizada
   * y, si `predictSeconds > 0`, extrapolada por la velocidad estimada.
   */
  filter(value: number, dt: number): number {
    // Primer valor o dt no válido: adoptamos el valor crudo sin filtrar.
    if (!this.hasPrev || dt <= 0) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.hasPrev = true;
      return value;
    }

    // Velocidad cruda, suavizada con el corte del derivador.
    const dx = (value - this.xPrev) / dt;
    const aD = smoothingAlpha(this.cfg.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    // Corte adaptativo: sube con la magnitud de la velocidad estimada.
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(dxHat);
    const a = smoothingAlpha(cutoff, dt);
    const xHat = a * value + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    // Predicción: extrapola por la velocidad suavizada (compensa la latencia de
    // inferencia). Sin predicción (predictSeconds=0) devuelve el suavizado puro.
    return xHat + dxHat * this.cfg.predictSeconds;
  }
}

/**
 * Trío de filtros (x, y, escala) con la misma configuración, para el objetivo de
 * una figura. Práctico para la escena: una llamada por instancia y frame.
 */
export class Vec3Smoother {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  private fs: OneEuroFilter;

  constructor(config: Partial<OneEuroConfig> = {}) {
    this.fx = new OneEuroFilter(config);
    this.fy = new OneEuroFilter(config);
    // La escala no se beneficia de la predicción (cambia poco y lento); usa el
    // mismo filtro pero sin extrapolar para no "respirar".
    this.fs = new OneEuroFilter({ ...config, predictSeconds: 0 });
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
    this.fs.reset();
  }

  /** Filtra in-place sobre `out` (alloc-free): out.x/y/s quedan suavizados. */
  filterInto(out: { x: number; y: number; s: number }, dt: number): void {
    out.x = this.fx.filter(out.x, dt);
    out.y = this.fy.filter(out.y, dt);
    out.s = this.fs.filter(out.s, dt);
  }
}
