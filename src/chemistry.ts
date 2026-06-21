/**
 * Dominio puro de Molecule Lab: catálogo de elementos, geometría de las
 * moléculas (para dibujar su "forma") y reglas de combinación por estequiometría.
 * Sin dependencias del DOM ni de la cámara: se testea aislado con Vitest.
 */

export type ElementSymbol = 'H' | 'O' | 'C' | 'N' | 'Na' | 'Cl';

export interface ChemElement {
  symbol: ElementSymbol;
  name: string;
  /** Número atómico (protones). */
  atomicNumber: number;
  /** Color base para el render (hex). */
  color: string;
  category: 'no-metal' | 'metal' | 'halogeno';
  /** Radio relativo del átomo (unidades locales) para el ball-and-stick. */
  radius: number;
  /** Electrones por capa (modelo de Bohr), para dibujar la "forma" del átomo. */
  shells: number[];
}

/** Un átomo dentro de la estructura de una molécula (coords locales, y hacia abajo). */
export interface Atom {
  symbol: ElementSymbol;
  x: number;
  y: number;
}
export interface Bond {
  a: number; // índice en atoms
  b: number;
  order: 1 | 2 | 3;
}

export type Composition = Partial<Record<ElementSymbol, number>>;

export interface Molecule {
  formula: string;
  name: string;
  color: string;
  /** Descripción breve: para qué se usa / por qué importa (en inglés). */
  description: string;
  /** Cuántos átomos de cada elemento la forman. */
  composition: Composition;
  /** Geometría 2D para dibujar la forma. */
  atoms: Atom[];
  bonds: Bond[];
}

/** Una mano sostiene N unidades de un elemento. */
export interface ElementStack {
  symbol: ElementSymbol;
  count: number;
}

// ---------------------------------------------------------------------------
// Catálogo de elementos
// ---------------------------------------------------------------------------
export const ELEMENTS: Record<ElementSymbol, ChemElement> = {
  H: { symbol: 'H', name: 'Hydrogen', atomicNumber: 1, color: '#7dd3fc', category: 'no-metal', radius: 0.3, shells: [1] },
  O: { symbol: 'O', name: 'Oxygen', atomicNumber: 8, color: '#f87171', category: 'no-metal', radius: 0.42, shells: [2, 6] },
  C: { symbol: 'C', name: 'Carbon', atomicNumber: 6, color: '#94a3b8', category: 'no-metal', radius: 0.45, shells: [2, 4] },
  N: { symbol: 'N', name: 'Nitrogen', atomicNumber: 7, color: '#818cf8', category: 'no-metal', radius: 0.42, shells: [2, 5] },
  Na: { symbol: 'Na', name: 'Sodium', atomicNumber: 11, color: '#fbbf24', category: 'metal', radius: 0.55, shells: [2, 8, 1] },
  Cl: { symbol: 'Cl', name: 'Chlorine', atomicNumber: 17, color: '#4ade80', category: 'halogeno', radius: 0.5, shells: [2, 8, 7] },
};

export const ELEMENT_ORDER: ElementSymbol[] = ['H', 'O', 'C', 'N', 'Na', 'Cl'];

// ---------------------------------------------------------------------------
// Moléculas (composición + geometría + descripción)
// ---------------------------------------------------------------------------
export const MOLECULES: Molecule[] = [
  {
    formula: 'H₂O', name: 'Water', color: '#38bdf8',
    description: 'The basis of all known life. Covers about 71% of Earth and makes up most of your body.',
    composition: { H: 2, O: 1 },
    atoms: [
      { symbol: 'O', x: 0, y: -0.15 },
      { symbol: 'H', x: -0.8, y: 0.5 },
      { symbol: 'H', x: 0.8, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'CO₂', name: 'Carbon dioxide', color: '#94a3b8',
    description: 'Exhaled by animals, used by plants in photosynthesis, and a key greenhouse gas.',
    composition: { C: 1, O: 2 },
    atoms: [
      { symbol: 'C', x: 0, y: 0 },
      { symbol: 'O', x: -1.05, y: 0 },
      { symbol: 'O', x: 1.05, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  {
    formula: 'NH₃', name: 'Ammonia', color: '#a5b4fc',
    description: 'Used to make fertilizers that feed most of the world, and in cleaning products.',
    composition: { N: 1, H: 3 },
    atoms: [
      { symbol: 'N', x: 0, y: 0 },
      { symbol: 'H', x: 0, y: 0.9 },
      { symbol: 'H', x: -0.8, y: -0.45 },
      { symbol: 'H', x: 0.8, y: -0.45 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },
  {
    formula: 'CH₄', name: 'Methane', color: '#5eead4',
    description: 'The main component of natural gas — a common fuel and a potent greenhouse gas.',
    composition: { C: 1, H: 4 },
    atoms: [
      { symbol: 'C', x: 0, y: 0 },
      { symbol: 'H', x: -0.72, y: -0.72 },
      { symbol: 'H', x: 0.72, y: -0.72 },
      { symbol: 'H', x: -0.72, y: 0.72 },
      { symbol: 'H', x: 0.72, y: 0.72 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
    ],
  },
  {
    formula: 'NaCl', name: 'Salt (sodium chloride)', color: '#fcd34d',
    description: 'Everyday table salt. Essential for life and used to season and preserve food.',
    composition: { Na: 1, Cl: 1 },
    atoms: [
      { symbol: 'Na', x: -0.75, y: 0 },
      { symbol: 'Cl', x: 0.75, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'HCl', name: 'Hydrochloric acid', color: '#86efac',
    description: 'Your stomach makes it to digest food. Also a workhorse acid in industry.',
    composition: { H: 1, Cl: 1 },
    atoms: [
      { symbol: 'H', x: -0.65, y: 0 },
      { symbol: 'Cl', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'H₂', name: 'Hydrogen gas', color: '#7dd3fc',
    description: 'The lightest gas and a clean fuel: burning it produces only water.',
    composition: { H: 2 },
    atoms: [
      { symbol: 'H', x: -0.6, y: 0 },
      { symbol: 'H', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'O₂', name: 'Oxygen gas', color: '#f87171',
    description: 'The gas you breathe to stay alive — about 21% of the air around you.',
    composition: { O: 2 },
    atoms: [
      { symbol: 'O', x: -0.62, y: 0 },
      { symbol: 'O', x: 0.62, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  },
  {
    formula: 'N₂', name: 'Nitrogen gas', color: '#818cf8',
    description: 'About 78% of the air. Inert and often used to keep food fresh.',
    composition: { N: 2 },
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'N', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 3 }],
  },
];

/** Acceso rápido por fórmula. */
export const MOLECULE_BY_FORMULA: Record<string, Molecule> = Object.fromEntries(
  MOLECULES.map((m) => [m.formula, m]),
);

// ---------------------------------------------------------------------------
// Combinación por estequiometría
// ---------------------------------------------------------------------------
/** Clave canónica de una composición: símbolos ordenados, p.ej. "H2O1". */
function compositionKey(c: Composition): string {
  return (Object.keys(c) as ElementSymbol[])
    .filter((s) => (c[s] ?? 0) > 0)
    .sort()
    .map((s) => `${s}${c[s]}`)
    .join('');
}

const BY_COMPOSITION: Record<string, Molecule> = Object.fromEntries(
  MOLECULES.map((m) => [compositionKey(m.composition), m]),
);

/** Suma las dos pilas en una composición total (mismo símbolo se acumula). */
export function mergeStacks(a: ElementStack, b: ElementStack): Composition {
  const out: Composition = {};
  for (const stack of [a, b]) {
    if (stack.count > 0) out[stack.symbol] = (out[stack.symbol] ?? 0) + stack.count;
  }
  return out;
}

/**
 * Combina lo que sostienen las dos manos respetando la estequiometría.
 * Es orden-independiente y devuelve `null` si la composición exacta no
 * corresponde a ninguna molécula conocida (faltan/sobran átomos).
 */
export function combineStacks(a: ElementStack, b: ElementStack): Molecule | null {
  return BY_COMPOSITION[compositionKey(mergeStacks(a, b))] ?? null;
}

/** Texto de receta legible, p.ej. "2 H + 1 O". */
export function recipeText(c: Composition): string {
  return (Object.keys(c) as ElementSymbol[])
    .filter((s) => (c[s] ?? 0) > 0)
    .map((s) => `${c[s]} ${s}`)
    .join(' + ');
}
