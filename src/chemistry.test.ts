import { describe, it, expect } from 'vitest';
import {
  combineStacks,
  mergeStacks,
  recipeText,
  MOLECULES,
  ELEMENTS,
  ELEMENT_ORDER,
  type ElementSymbol,
  type ElementStack,
} from './chemistry';

const stack = (symbol: ElementSymbol, count: number): ElementStack => ({ symbol, count });

describe('combineStacks (estequiometría)', () => {
  it('forma agua con 2 H + 1 O', () => {
    const m = combineStacks(stack('H', 2), stack('O', 1));
    expect(m?.formula).toBe('H₂O');
    expect(m?.name).toBe('Water');
  });

  it('es independiente del orden de las manos', () => {
    expect(combineStacks(stack('H', 2), stack('O', 1))).toEqual(
      combineStacks(stack('O', 1), stack('H', 2)),
    );
  });

  it('respeta las proporciones: 1 H + 1 O no es agua', () => {
    expect(combineStacks(stack('H', 1), stack('O', 1))).toBeNull();
  });

  it.each<[ElementStack, ElementStack, string]>([
    [stack('C', 1), stack('O', 2), 'CO₂'],
    [stack('N', 1), stack('H', 3), 'NH₃'],
    [stack('C', 1), stack('H', 4), 'CH₄'],
    [stack('Na', 1), stack('Cl', 1), 'NaCl'],
    [stack('H', 1), stack('Cl', 1), 'HCl'],
    [stack('H', 1), stack('H', 1), 'H₂'],
    [stack('O', 1), stack('O', 1), 'O₂'],
    [stack('N', 1), stack('N', 1), 'N₂'],
  ])('combina %o + %o → %s', (a, b, formula) => {
    expect(combineStacks(a, b)?.formula).toBe(formula);
  });

  it('una pila vacía (count 0) no aporta átomos', () => {
    // 1 H solo no alcanza para ninguna molécula.
    expect(combineStacks(stack('H', 1), stack('O', 0))).toBeNull();
    // 2 H aunque la otra mano esté vacía ya forman H₂.
    expect(combineStacks(stack('H', 2), stack('O', 0))?.formula).toBe('H₂');
  });

  it('devuelve null para composición sin receta', () => {
    expect(combineStacks(stack('Na', 1), stack('C', 1))).toBeNull();
    expect(combineStacks(stack('H', 5), stack('O', 1))).toBeNull();
  });
});

describe('mergeStacks', () => {
  it('acumula el mismo símbolo', () => {
    expect(mergeStacks(stack('H', 1), stack('H', 1))).toEqual({ H: 2 });
  });
  it('ignora counts en cero', () => {
    expect(mergeStacks(stack('H', 2), stack('O', 0))).toEqual({ H: 2 });
  });
});

describe('recipeText', () => {
  it('formatea la composición de forma legible', () => {
    expect(recipeText({ H: 2, O: 1 })).toBe('2 H + 1 O');
  });
});

describe('datos de las moléculas', () => {
  it('la geometría coincide con la composición declarada', () => {
    for (const m of MOLECULES) {
      const fromAtoms: Record<string, number> = {};
      for (const a of m.atoms) fromAtoms[a.symbol] = (fromAtoms[a.symbol] ?? 0) + 1;
      expect(fromAtoms).toEqual(m.composition);
    }
  });

  it('los bonds referencian índices de átomos válidos', () => {
    for (const m of MOLECULES) {
      for (const b of m.bonds) {
        expect(m.atoms[b.a]).toBeDefined();
        expect(m.atoms[b.b]).toBeDefined();
      }
    }
  });
});

describe('catálogo', () => {
  it('ELEMENT_ORDER cubre exactamente las claves de ELEMENTS', () => {
    expect([...ELEMENT_ORDER].sort()).toEqual(Object.keys(ELEMENTS).sort());
  });
  it('cada elemento tiene color hex y capas de electrones', () => {
    for (const sym of ELEMENT_ORDER) {
      const el = ELEMENTS[sym];
      expect(el.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(el.shells.length).toBeGreaterThan(0);
    }
  });
  it('el número atómico coincide con el total de electrones (átomo neutro)', () => {
    for (const sym of ELEMENT_ORDER) {
      const el = ELEMENTS[sym];
      const totalElectrons = el.shells.reduce((a, b) => a + b, 0);
      expect(el.atomicNumber).toBe(totalElectrons);
    }
  });
  it('toda molécula tiene una descripción no vacía', () => {
    for (const m of MOLECULES) {
      expect(m.description.trim().length).toBeGreaterThan(10);
    }
  });
});
