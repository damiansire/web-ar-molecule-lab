import { describe, it, expect } from 'vitest';
import {
  combineStacks,
  mergeStacks,
  recipeText,
  brew,
  ingredientKey,
  ingredientLabel,
  localizedName,
  allNames,
  RECIPES,
  ALCHEMY_RECIPES,
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

describe('ingredientKey (clave canónica del cuenco)', () => {
  it('es independiente del orden de inserción', () => {
    expect(ingredientKey({ 'CO₂': 1, 'H₂O': 1 })).toBe(ingredientKey({ 'H₂O': 1, 'CO₂': 1 }));
  });
  it('separa ids multi-carácter sin ambigüedad', () => {
    // Sin separador, {Na:1, Cl:1} y un hipotético "NaCl:1" colisionarían.
    expect(ingredientKey({ Na: 1, Cl: 1 })).toBe('Cl:1,Na:1');
    expect(ingredientKey({ NaCl: 1 })).toBe('NaCl:1');
  });
  it('ignora ingredientes con count cero o negativo', () => {
    expect(ingredientKey({ H: 2, O: 0 })).toBe('H:2');
  });
});

describe('brew (cuenco de alquimia)', () => {
  it('forma moléculas base desde átomos (mismo dominio que combineStacks)', () => {
    expect(brew({ H: 2, O: 1 })?.formula).toBe('H₂O');
    expect(brew({ C: 1, O: 2 })?.formula).toBe('CO₂');
    expect(brew({ Na: 1, Cl: 1 })?.formula).toBe('NaCl');
  });

  it('es orden-independiente y exige proporción exacta', () => {
    expect(brew({ O: 1, H: 2 })?.formula).toBe('H₂O');
    expect(brew({ H: 1, O: 1 })).toBeNull(); // falta un H
    expect(brew({ H: 3, O: 1 })).toBeNull(); // sobra un H
  });

  it('combina PRODUCTOS para formar productos de 2º nivel (árbol de alquimia)', () => {
    expect(brew({ 'H₂O': 1, 'CO₂': 1 })?.formula).toBe('H₂CO₃');
    expect(brew({ 'NH₃': 1, 'HCl': 1 })?.formula).toBe('NH₄Cl');
    expect(brew({ 'SO₂': 1, 'H₂O': 1 })?.formula).toBe('H₂SO₃');
    expect(brew({ 'NH₃': 1, 'H₂O': 1 })?.formula).toBe('NH₄OH');
  });

  it('forma las moléculas nuevas de 1º nivel desde átomos', () => {
    expect(brew({ H: 2, O: 2 })?.formula).toBe('H₂O₂');
    expect(brew({ O: 3 })?.formula).toBe('O₃');
    expect(brew({ C: 1, O: 1 })?.formula).toBe('CO');
    expect(brew({ S: 1, O: 2 })?.formula).toBe('SO₂');
    expect(brew({ H: 1, F: 1 })?.formula).toBe('HF');
  });

  it('un producto compound NO se craftea desde átomos sueltos (obliga el árbol)', () => {
    // H₂CO₃ tiene composición {H:2,C:1,O:3} pero su única receta es Agua + CO₂.
    expect(brew({ H: 2, C: 1, O: 3 })).toBeNull();
  });

  it('devuelve null para un contenido sin receta', () => {
    expect(brew({})).toBeNull();
    expect(brew({ 'H₂O': 2 })).toBeNull();
    expect(brew({ Na: 1, C: 1 })).toBeNull();
  });
});

describe('recetas y productos', () => {
  it('cada receta de alquimia apunta a una molécula existente', () => {
    const formulas = new Set(MOLECULES.map((m) => m.formula));
    for (const r of ALCHEMY_RECIPES) expect(formulas.has(r.output)).toBe(true);
  });

  it('toda molécula compound tiene una receta de alquimia', () => {
    const outputs = new Set(ALCHEMY_RECIPES.map((r) => r.output));
    for (const m of MOLECULES) if (m.compound) expect(outputs.has(m.formula)).toBe(true);
  });

  it('no hay dos recetas con el mismo conjunto de ingredientes', () => {
    const keys = RECIPES.map((r) => ingredientKey(r.inputs));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('ingredientLabel devuelve el nombre localizado de átomos y productos', () => {
    expect(ingredientLabel('O', 'es')).toBe('Oxígeno');
    expect(ingredientLabel('O', 'en')).toBe('Oxygen');
    expect(ingredientLabel('O', 'it')).toBe('Ossigeno');
    expect(ingredientLabel('H₂O', 'pt')).toBe('Água');
    expect(ingredientLabel('H₂O', 'es')).toBe('Agua');
  });

  it('localizedName y allNames cubren los 4 idiomas', () => {
    expect(localizedName(ELEMENTS.Na, 'it')).toBe('Sodio');
    expect(localizedName(ELEMENTS.S, 'pt')).toBe('Enxofre');
    const water = MOLECULES.find((m) => m.formula === 'H₂O')!;
    expect(allNames(water)).toEqual(['Water', 'Agua', 'Acqua', 'Água']);
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

  it('todo elemento y molécula tiene nombre en los 4 idiomas', () => {
    for (const sym of ELEMENT_ORDER) {
      const el = ELEMENTS[sym];
      for (const n of [el.name, el.nameEs, el.nameIt, el.namePt]) expect(n.trim().length).toBeGreaterThan(1);
    }
    for (const m of MOLECULES) {
      for (const n of [m.name, m.nameEs, m.nameIt, m.namePt]) expect(n.trim().length).toBeGreaterThan(1);
    }
  });
});
