import { describe, it, expect } from 'vitest';
import { Layout, tileUnder, inRect } from './layout';
import { ELEMENT_ORDER } from './chemistry';

describe('Layout', () => {
  it('tiles(): una por elemento, en el orden del catálogo, dentro del ancho del canvas', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const tiles = layout.tiles();
    expect(tiles.map((t) => t.symbol)).toEqual(ELEMENT_ORDER);
    for (const t of tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.size).toBeLessThanOrEqual(1000 + 1); // +1 tolerancia de redondeo
    }
  });

  it('cauldron(): centrado horizontalmente y dentro del canvas', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const c = layout.cauldron();
    expect(c.cx).toBe(500);
    expect(c.r).toBeGreaterThan(0);
  });

  it('mixButton/clearButton: quedan pegados debajo del cuenco, uno a cada lado', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const c = layout.cauldron();
    const mix = layout.mixButton();
    const clear = layout.clearButton();
    expect(mix.y).toBeCloseTo(c.cy + c.r + 30, 5);
    expect(clear.y).toBeCloseTo(mix.y, 5);
    expect(mix.x + mix.w).toBeLessThanOrEqual(clear.x + 1); // mix a la izquierda, clear a la derecha
  });

  it('shelf(): recorta al máximo visible y conserva el orden (los más recientes)', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const many = Array.from({ length: 20 }, (_, i) => `M${i}`);
    const cells = layout.shelf(many);
    expect(cells).toHaveLength(12);
    expect(cells[0].formula).toBe('M8'); // slice(-12) de 20 empieza en el índice 8
    expect(cells.at(-1)?.formula).toBe('M19');
  });

  it('resize(): invalida toda la geometría cacheada (no arrastra el tamaño viejo)', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const before = layout.cauldron();
    layout.resize(2000, 800);
    const after = layout.cauldron();
    expect(after.cx).not.toBe(before.cx);
  });

  it('invalidateShelf(): recalcula el estante sin tocar el resto de la geometría', () => {
    const layout = new Layout(1);
    layout.resize(1000, 800);
    const cauldronBefore = layout.cauldron();
    layout.shelf(['A']);
    layout.invalidateShelf();
    const cells = layout.shelf(['A', 'B']);
    expect(cells).toHaveLength(2);
    expect(layout.cauldron()).toBe(cauldronBefore); // misma referencia: no se invalidó
  });
});

describe('tileUnder / inRect (hit-testing puro)', () => {
  const tiles = [{ symbol: 'H' as const, x: 0, y: 0, size: 10 }, { symbol: 'O' as const, x: 20, y: 0, size: 10 }];

  it('tileUnder encuentra el tile que cubre el punto', () => {
    expect(tileUnder(5, 5, tiles)?.symbol).toBe('H');
    expect(tileUnder(25, 5, tiles)?.symbol).toBe('O');
    expect(tileUnder(15, 5, tiles)).toBeNull(); // hueco entre tiles
  });

  it('inRect respeta los bordes inclusive', () => {
    const r = { x: 0, y: 0, w: 10, h: 10 };
    expect(inRect(0, 0, r)).toBe(true);
    expect(inRect(10, 10, r)).toBe(true);
    expect(inRect(11, 5, r)).toBe(false);
  });
});
