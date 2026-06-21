/**
 * Sistema de partículas con pool fijo (cero alocaciones en el hot path).
 * Render aditivo (composite 'lighter') para que el burst "brille".
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // segundos restantes
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

const MAX_PARTICLES = 600;
const TWO_PI = Math.PI * 2;

export class ParticleSystem {
  private readonly pool: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', active: false,
  }));

  /** Lanza un estallido radial de `count` partículas en (x, y). */
  burst(x: number, y: number, color: string, count = 120, speed = 520): void {
    let spawned = 0;
    for (const p of this.pool) {
      if (p.active) continue;
      const angle = Math.random() * TWO_PI;
      const v = speed * (0.25 + Math.random() * 0.75);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.7 + Math.random() * 0.8;
      p.life = p.maxLife;
      p.size = 3 + Math.random() * 5;
      p.color = color;
      p.active = true;
      if (++spawned >= count) break;
    }
  }

  /** Avanza la simulación `dt` segundos. */
  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt; // gravedad leve
      p.vx *= 0.98; // drag
      p.vy *= 0.98;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }
}
