/**
 * Lógica pura del juego "atrapar círculos": caen circulitos desde arriba y se
 * suman puntos al tocarlos con la mano. Sin DOM ni Three.js, y determinista: la
 * aleatoriedad entra por una función `random` inyectable, así se puede testear
 * paso a paso. El render (ar-scene) sólo dibuja el estado que produce este módulo.
 *
 * Coordenadas en píxeles de pantalla (mismo espacio que `landmarkToScreen`):
 * origen arriba-izquierda, Y hacia abajo.
 */

export interface Circle {
  readonly id: number;
  x: number;
  y: number;
  /** Velocidad de caída en px/s. */
  vy: number;
  readonly r: number;
}

export interface CatchState {
  circles: Circle[];
  score: number;
  missed: number;
  nextId: number;
  /** Segundos hasta el próximo spawn. */
  spawnTimer: number;
}

/** Punto de la mano que atrapa (en píxeles), con su radio de captura. */
export interface Catcher {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CatchConfig {
  /** Ancho/alto del área de juego en píxeles. */
  width: number;
  height: number;
  /** Delta de tiempo del frame en segundos. */
  dt: number;
  /** Puntos de mano que pueden atrapar este frame. */
  catchers: readonly Catcher[];
  /** Fuente de aleatoriedad [0,1). Inyectable para tests deterministas. */
  random: () => number;
  /** Cada cuántos segundos aparece un círculo (default 0.9). */
  spawnEvery?: number;
  /** Velocidad base de caída en px/s (default 220). */
  fallSpeed?: number;
  /** Radio de los círculos en píxeles (default 26). */
  radius?: number;
}

export interface CatchOutcome {
  /** Círculos atrapados este frame (para el efecto de "explosión"). */
  caught: Circle[];
}

export function createCatchState(): CatchState {
  return { circles: [], score: 0, missed: 0, nextId: 1, spawnTimer: 0 };
}

const DEFAULTS = { spawnEvery: 0.9, fallSpeed: 220, radius: 26 } as const;

/**
 * Avanza un frame del juego (muta `state`): aparece un círculo cuando vence el
 * timer, todos caen, se atrapan los que tocan un catcher (suma puntos) y se
 * descartan los que salen por abajo (suma fallos). Devuelve los atrapados.
 */
export function updateCatch(state: CatchState, cfg: CatchConfig): CatchOutcome {
  const spawnEvery = cfg.spawnEvery ?? DEFAULTS.spawnEvery;
  const fallSpeed = cfg.fallSpeed ?? DEFAULTS.fallSpeed;
  const radius = cfg.radius ?? DEFAULTS.radius;

  // Spawn por tiempo.
  state.spawnTimer -= cfg.dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer += spawnEvery;
    const margin = radius + 4;
    const x = margin + cfg.random() * Math.max(0, cfg.width - margin * 2);
    // Pequeña variación de velocidad para que no caigan todos igual.
    const vy = fallSpeed * (0.75 + cfg.random() * 0.6);
    state.circles.push({ id: state.nextId++, x, y: -radius, vy, r: radius });
  }

  const outcome: CatchOutcome = { caught: [] };
  const survivors: Circle[] = [];

  for (const c of state.circles) {
    c.y += c.vy * cfg.dt;

    // ¿Lo atrapa alguna mano?
    let grabbed = false;
    for (const cat of cfg.catchers) {
      const reach = c.r + cat.r;
      if ((c.x - cat.x) ** 2 + (c.y - cat.y) ** 2 <= reach * reach) {
        grabbed = true;
        break;
      }
    }
    if (grabbed) {
      state.score++;
      outcome.caught.push(c);
      continue;
    }

    // ¿Se fue por abajo?
    if (c.y - c.r > cfg.height) {
      state.missed++;
      continue;
    }
    survivors.push(c);
  }

  state.circles = survivors;
  return outcome;
}
