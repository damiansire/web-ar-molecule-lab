/**
 * Geometría de la UI (paleta de átomos, cuenco, botones Mezclar/Vaciar,
 * estante de inventario): derivada solo del tamaño del canvas (+ DPR) y del
 * inventario, cacheada hasta el próximo resize/cambio. Sin DOM ni estado de
 * juego (manos, cuenco, voz) — primer extracto del God-module `main.ts`
 * (ver _audits/SCORECARD.md, hallazgo high #4).
 */
import { ELEMENT_ORDER, type ElementSymbol } from './chemistry';

export interface Tile { symbol: ElementSymbol; x: number; y: number; size: number; }
export interface Rect { x: number; y: number; w: number; h: number; }
export interface CauldronGeo { cx: number; cy: number; r: number; }
export interface ShelfCell extends Rect { formula: string; }

const SHELF_MAX = 12; // celdas visibles del estante (las más recientes)

export class Layout {
  private readonly dpr: number;
  private width = 0;
  private height = 0;
  private tilesCache: Tile[] | null = null;
  private cauldronGeoCache: CauldronGeo | null = null;
  private mixRectCache: Rect | null = null;
  private clearRectCache: Rect | null = null;
  private shelfCellsCache: ShelfCell[] | null = null;

  constructor(dpr: number) {
    this.dpr = dpr;
  }

  /** Llamar en cada resize del canvas: invalida TODA la geometría cacheada. */
  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tilesCache = null;
    this.cauldronGeoCache = null;
    this.mixRectCache = null;
    this.clearRectCache = null;
    this.shelfCellsCache = null;
  }

  /** El estante cambia con el inventario, no con el tamaño del canvas. */
  invalidateShelf() {
    this.shelfCellsCache = null;
  }

  tiles(): Tile[] {
    if (this.tilesCache) return this.tilesCache;
    const n = ELEMENT_ORDER.length;
    const size = Math.min(this.width / (n + 2), 116 * this.dpr);
    const gap = size * 0.24;
    const totalW = n * size + (n - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const y = size * 0.34;
    return (this.tilesCache = ELEMENT_ORDER.map((symbol, i) => ({ symbol, x: startX + i * (size + gap), y, size })));
  }

  /** Cuenco central (círculo). */
  cauldron(): CauldronGeo {
    if (this.cauldronGeoCache) return this.cauldronGeoCache;
    const cx = this.width / 2;
    const cy = this.height * 0.5;
    const r = Math.min(this.width * 0.17, this.height * 0.26, 230 * this.dpr);
    return (this.cauldronGeoCache = { cx, cy, r });
  }

  mixButton(): Rect {
    if (this.mixRectCache) return this.mixRectCache;
    const c = this.cauldron();
    const w = Math.min(this.width * 0.22, 220 * this.dpr);
    const h = 64 * this.dpr;
    const gap = 14 * this.dpr;
    return (this.mixRectCache = { x: c.cx - w - gap / 2, y: c.cy + c.r + 30 * this.dpr, w, h });
  }

  clearButton(): Rect {
    if (this.clearRectCache) return this.clearRectCache;
    const c = this.cauldron();
    const w = Math.min(this.width * 0.15, 150 * this.dpr);
    const h = 64 * this.dpr;
    const gap = 14 * this.dpr;
    return (this.clearRectCache = { x: c.cx + gap / 2, y: c.cy + c.r + 30 * this.dpr, w, h });
  }

  /** Celdas del estante (los últimos SHELF_MAX productos descubiertos). */
  shelf(invList: string[]): ShelfCell[] {
    if (this.shelfCellsCache) return this.shelfCellsCache;
    const list = invList.slice(-SHELF_MAX);
    const cell = 64 * this.dpr;
    const gap = 10 * this.dpr;
    const pad = 16 * this.dpr;
    const y = this.height - cell - 22 * this.dpr;
    return (this.shelfCellsCache = list.map((formula, i) => ({ formula, x: pad + i * (cell + gap), y, w: cell, h: cell })));
  }
}

/** Hit-testing puro, sin estado: ¿qué tile de la paleta cubre (px,py)? */
export function tileUnder(px: number, py: number, tiles: Tile[]): Tile | null {
  return tiles.find((t) => px >= t.x && px <= t.x + t.size && py >= t.y && py <= t.y + t.size) ?? null;
}

/** Hit-testing puro: ¿(px,py) cae dentro de un rectángulo? */
export function inRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
