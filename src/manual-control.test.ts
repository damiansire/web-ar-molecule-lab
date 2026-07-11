import { describe, it, expect } from 'vitest';
import { buildFocusSequence, nextFocusIndex } from './manual-control';

describe('buildFocusSequence', () => {
  it('ordena átomos, estante y botones', () => {
    const seq = buildFocusSequence(2, 3);
    expect(seq).toEqual([
      { kind: 'atom', index: 0 },
      { kind: 'atom', index: 1 },
      { kind: 'shelf', index: 0 },
      { kind: 'shelf', index: 1 },
      { kind: 'shelf', index: 2 },
      { kind: 'mix' },
      { kind: 'clear' },
    ]);
  });

  it('sin productos descubiertos, el estante no aporta elementos', () => {
    const seq = buildFocusSequence(9, 0);
    expect(seq.filter((t) => t.kind === 'shelf')).toHaveLength(0);
    expect(seq).toHaveLength(11); // 9 átomos + mix + clear
  });
});

describe('nextFocusIndex', () => {
  it('sin foco previo, arranca en el primer elemento sin importar la dirección', () => {
    expect(nextFocusIndex(null, 5, 1)).toBe(0);
    expect(nextFocusIndex(null, 5, -1)).toBe(0);
  });

  it('avanza y retrocede dentro del rango', () => {
    expect(nextFocusIndex(2, 5, 1)).toBe(3);
    expect(nextFocusIndex(2, 5, -1)).toBe(1);
  });

  it('da la vuelta en los bordes', () => {
    expect(nextFocusIndex(4, 5, 1)).toBe(0); // último → primero
    expect(nextFocusIndex(0, 5, -1)).toBe(4); // primero → último
  });

  it('secuencia vacía no tiene foco posible', () => {
    expect(nextFocusIndex(null, 0, 1)).toBe(-1);
    expect(nextFocusIndex(0, 0, 1)).toBe(-1);
  });

  it('si la secuencia se achicó (ej. cambió el inventario) y el índice quedó fuera de rango, resetea al primero', () => {
    expect(nextFocusIndex(7, 3, 1)).toBe(0);
  });
});
