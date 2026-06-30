/**
 * Dominio puro de Molecule Lab: catálogo de elementos, geometría de las
 * moléculas (para dibujar su "forma") y reglas de combinación por estequiometría.
 * Sin dependencias del DOM ni de la cámara: se testea aislado con Vitest.
 */

export type ElementSymbol = 'H' | 'O' | 'C' | 'N' | 'Na' | 'Cl' | 'F' | 'S' | 'P';

export interface ChemElement {
  symbol: ElementSymbol;
  name: string;
  /** Nombre en español, para el HUD y el match de voz. */
  nameEs: string;
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
  /** Nombre en español, para el HUD y el match de voz. */
  nameEs: string;
  color: string;
  /** Descripción breve: para qué se usa / por qué importa (en inglés). */
  description: string;
  /** Cuántos átomos de cada elemento la forman. */
  composition: Composition;
  /**
   * Producto de 2º nivel: se craftea combinando OTRAS moléculas en el cuenco,
   * no juntando átomos sueltos. Si es `true`, no se deriva una receta base de
   * átomos (su única receta es la de alquimia en ALCHEMY_RECIPES).
   */
  compound?: boolean;
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
  H: { symbol: 'H', name: 'Hydrogen', nameEs: 'Hidrógeno', atomicNumber: 1, color: '#7dd3fc', category: 'no-metal', radius: 0.3, shells: [1] },
  O: { symbol: 'O', name: 'Oxygen', nameEs: 'Oxígeno', atomicNumber: 8, color: '#f87171', category: 'no-metal', radius: 0.42, shells: [2, 6] },
  C: { symbol: 'C', name: 'Carbon', nameEs: 'Carbono', atomicNumber: 6, color: '#94a3b8', category: 'no-metal', radius: 0.45, shells: [2, 4] },
  N: { symbol: 'N', name: 'Nitrogen', nameEs: 'Nitrógeno', atomicNumber: 7, color: '#818cf8', category: 'no-metal', radius: 0.42, shells: [2, 5] },
  Na: { symbol: 'Na', name: 'Sodium', nameEs: 'Sodio', atomicNumber: 11, color: '#fbbf24', category: 'metal', radius: 0.55, shells: [2, 8, 1] },
  Cl: { symbol: 'Cl', name: 'Chlorine', nameEs: 'Cloro', atomicNumber: 17, color: '#4ade80', category: 'halogeno', radius: 0.5, shells: [2, 8, 7] },
  F: { symbol: 'F', name: 'Fluorine', nameEs: 'Flúor', atomicNumber: 9, color: '#a3e635', category: 'halogeno', radius: 0.38, shells: [2, 7] },
  S: { symbol: 'S', name: 'Sulfur', nameEs: 'Azufre', atomicNumber: 16, color: '#facc15', category: 'no-metal', radius: 0.5, shells: [2, 8, 6] },
  P: { symbol: 'P', name: 'Phosphorus', nameEs: 'Fósforo', atomicNumber: 15, color: '#fb923c', category: 'no-metal', radius: 0.5, shells: [2, 8, 5] },
};

export const ELEMENT_ORDER: ElementSymbol[] = ['H', 'O', 'C', 'N', 'S', 'P', 'F', 'Na', 'Cl'];

// ---------------------------------------------------------------------------
// Moléculas (composición + geometría + descripción)
// ---------------------------------------------------------------------------
export const MOLECULES: Molecule[] = [
  {
    formula: 'H₂O', name: 'Water', nameEs: 'Agua', color: '#38bdf8',
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
    formula: 'CO₂', name: 'Carbon dioxide', nameEs: 'Dióxido de carbono', color: '#94a3b8',
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
    formula: 'NH₃', name: 'Ammonia', nameEs: 'Amoníaco', color: '#a5b4fc',
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
    formula: 'CH₄', name: 'Methane', nameEs: 'Metano', color: '#5eead4',
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
    formula: 'NaCl', name: 'Salt (sodium chloride)', nameEs: 'Sal', color: '#fcd34d',
    description: 'Everyday table salt. Essential for life and used to season and preserve food.',
    composition: { Na: 1, Cl: 1 },
    atoms: [
      { symbol: 'Na', x: -0.75, y: 0 },
      { symbol: 'Cl', x: 0.75, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'HCl', name: 'Hydrochloric acid', nameEs: 'Ácido clorhídrico', color: '#86efac',
    description: 'Your stomach makes it to digest food. Also a workhorse acid in industry.',
    composition: { H: 1, Cl: 1 },
    atoms: [
      { symbol: 'H', x: -0.65, y: 0 },
      { symbol: 'Cl', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'H₂', name: 'Hydrogen gas', nameEs: 'Hidrógeno gaseoso', color: '#7dd3fc',
    description: 'The lightest gas and a clean fuel: burning it produces only water.',
    composition: { H: 2 },
    atoms: [
      { symbol: 'H', x: -0.6, y: 0 },
      { symbol: 'H', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'O₂', name: 'Oxygen gas', nameEs: 'Oxígeno gaseoso', color: '#f87171',
    description: 'The gas you breathe to stay alive — about 21% of the air around you.',
    composition: { O: 2 },
    atoms: [
      { symbol: 'O', x: -0.62, y: 0 },
      { symbol: 'O', x: 0.62, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  },
  {
    formula: 'N₂', name: 'Nitrogen gas', nameEs: 'Nitrógeno gaseoso', color: '#818cf8',
    description: 'About 78% of the air. Inert and often used to keep food fresh.',
    composition: { N: 2 },
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'N', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 3 }],
  },
  {
    formula: 'H₂O₂', name: 'Hydrogen peroxide', nameEs: 'Peróxido de hidrógeno', color: '#bae6fd',
    description: 'A pale blue liquid used to disinfect wounds and bleach hair — water with one extra oxygen.',
    composition: { H: 2, O: 2 },
    atoms: [
      { symbol: 'O', x: -0.5, y: 0 },
      { symbol: 'O', x: 0.5, y: 0 },
      { symbol: 'H', x: -1.2, y: 0.6 },
      { symbol: 'H', x: 1.2, y: -0.6 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 1, b: 3, order: 1 }],
  },
  {
    formula: 'O₃', name: 'Ozone', nameEs: 'Ozono', color: '#fca5a5',
    description: 'High in the atmosphere it shields us from UV rays; at ground level it is a pollutant.',
    composition: { O: 3 },
    atoms: [
      { symbol: 'O', x: 0, y: -0.25 },
      { symbol: 'O', x: -0.95, y: 0.45 },
      { symbol: 'O', x: 0.95, y: 0.45 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'CO', name: 'Carbon monoxide', nameEs: 'Monóxido de carbono', color: '#cbd5e1',
    description: 'A colorless, odorless and toxic gas from incomplete burning of fuels.',
    composition: { C: 1, O: 1 },
    atoms: [
      { symbol: 'C', x: -0.6, y: 0 },
      { symbol: 'O', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 3 }],
  },
  {
    formula: 'NO', name: 'Nitric oxide', nameEs: 'Óxido nítrico', color: '#c7d2fe',
    description: 'A signaling molecule in your body that relaxes blood vessels and controls blood flow.',
    composition: { N: 1, O: 1 },
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'O', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  },
  {
    formula: 'SO₂', name: 'Sulfur dioxide', nameEs: 'Dióxido de azufre', color: '#fde047',
    description: 'A sharp-smelling gas from volcanoes and burning coal; used to preserve dried fruit.',
    composition: { S: 1, O: 2 },
    atoms: [
      { symbol: 'S', x: 0, y: -0.1 },
      { symbol: 'O', x: -0.98, y: 0.5 },
      { symbol: 'O', x: 0.98, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  {
    formula: 'H₂S', name: 'Hydrogen sulfide', nameEs: 'Sulfuro de hidrógeno', color: '#fef08a',
    description: 'The "rotten egg" gas, toxic in high amounts and produced by decaying matter.',
    composition: { H: 2, S: 1 },
    atoms: [
      { symbol: 'S', x: 0, y: -0.15 },
      { symbol: 'H', x: -0.85, y: 0.5 },
      { symbol: 'H', x: 0.85, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'HF', name: 'Hydrogen fluoride', nameEs: 'Fluoruro de hidrógeno', color: '#bef264',
    description: 'Dissolved in water it becomes hydrofluoric acid, used to etch glass and silicon.',
    composition: { H: 1, F: 1 },
    atoms: [
      { symbol: 'H', x: -0.6, y: 0 },
      { symbol: 'F', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'PH₃', name: 'Phosphine', nameEs: 'Fosfina', color: '#fdba74',
    description: 'A toxic, flammable gas with a garlic-like smell, used in the semiconductor industry.',
    composition: { P: 1, H: 3 },
    atoms: [
      { symbol: 'P', x: 0, y: 0 },
      { symbol: 'H', x: 0, y: 0.9 },
      { symbol: 'H', x: -0.8, y: -0.45 },
      { symbol: 'H', x: 0.8, y: -0.45 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },

  // --- Productos de 2º nivel (árbol de alquimia: se craftean combinando otras
  //     moléculas, no átomos sueltos). Ver ALCHEMY_RECIPES. ---
  {
    formula: 'H₂CO₃', name: 'Carbonic acid', nameEs: 'Ácido carbónico', color: '#67e8f9',
    description: 'Forms when CO₂ dissolves in water — it is what makes soda fizzy and rain slightly acidic.',
    composition: { H: 2, C: 1, O: 3 }, compound: true,
    atoms: [
      { symbol: 'C', x: 0, y: 0 },
      { symbol: 'O', x: 0, y: -1.05 },
      { symbol: 'O', x: -0.95, y: 0.55 },
      { symbol: 'O', x: 0.95, y: 0.55 },
      { symbol: 'H', x: -1.75, y: 1.0 },
      { symbol: 'H', x: 1.75, y: 1.0 },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 2, b: 4, order: 1 }, { a: 3, b: 5, order: 1 },
    ],
  },
  {
    formula: 'NH₄Cl', name: 'Ammonium chloride', nameEs: 'Cloruro de amonio', color: '#c4b5fd',
    description: 'A salt of ammonia and hydrochloric acid, used in fertilizers, batteries and cough medicine.',
    composition: { N: 1, H: 4, Cl: 1 }, compound: true,
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'H', x: -0.6, y: -0.9 },
      { symbol: 'H', x: -1.4, y: 0.35 },
      { symbol: 'H', x: -0.6, y: 0.9 },
      { symbol: 'H', x: 0.2, y: 0.35 },
      { symbol: 'Cl', x: 1.5, y: -0.1 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
    ],
  },
  {
    formula: 'H₂SO₃', name: 'Sulfurous acid', nameEs: 'Ácido sulfuroso', color: '#fef9c3',
    description: 'Forms when sulfur dioxide dissolves in water; the chemistry behind acid rain.',
    composition: { H: 2, S: 1, O: 3 }, compound: true,
    atoms: [
      { symbol: 'S', x: 0, y: 0 },
      { symbol: 'O', x: 0, y: -1.05 },
      { symbol: 'O', x: -0.95, y: 0.55 },
      { symbol: 'O', x: 0.95, y: 0.55 },
      { symbol: 'H', x: -1.75, y: 1.0 },
      { symbol: 'H', x: 1.75, y: 1.0 },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 },
      { a: 2, b: 4, order: 1 }, { a: 3, b: 5, order: 1 },
    ],
  },
  {
    formula: 'NH₄OH', name: 'Ammonium hydroxide', nameEs: 'Hidróxido de amonio', color: '#ddd6fe',
    description: 'Ammonia dissolved in water — the cloudy "ammonia" sold as a household cleaner.',
    composition: { N: 1, H: 5, O: 1 }, compound: true,
    atoms: [
      { symbol: 'N', x: -0.7, y: 0 },
      { symbol: 'H', x: -0.7, y: -0.9 },
      { symbol: 'H', x: -1.5, y: 0.4 },
      { symbol: 'H', x: -0.7, y: 0.9 },
      { symbol: 'H', x: 0.1, y: 0.4 },
      { symbol: 'O', x: 1.5, y: -0.1 },
      { symbol: 'H', x: 2.25, y: 0.4 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
      { a: 5, b: 6, order: 1 },
    ],
  },
];

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

// ---------------------------------------------------------------------------
// Cuenco de alquimia: combinación por IDENTIDAD de ingrediente
// ---------------------------------------------------------------------------
// Un ingrediente es un átomo (símbolo de elemento) o un producto ya creado
// (fórmula de una molécula). El cuenco acumula un multiset de ingredientes y al
// "mezclar" se busca una receta cuyo conjunto de entradas coincida EXACTO.
// Esto distingue "Agua + CO₂" de tirar H, C y O sueltos, y habilita el árbol de
// alquimia (los productos vuelven a ser ingredientes).

/** Un ingrediente: símbolo de elemento ('H') o fórmula de un producto ('H₂O'). */
export type IngredientId = string;

/** Contenido del cuenco / entradas de una receta: cuántas unidades de cada id. */
export type Cauldron = Partial<Record<IngredientId, number>>;

export interface Recipe {
  inputs: Cauldron;
  /** Fórmula de la molécula que se obtiene. */
  output: string;
}

/**
 * Clave canónica de un multiset de ingredientes: ids ordenados con su count y un
 * separador explícito (los ids pueden ser multi-carácter: `Na`, `H₂O`), p.ej.
 * `"CO₂:1,H₂O:1"`. Ignora ids con count ≤ 0.
 */
export function ingredientKey(c: Cauldron): string {
  return Object.keys(c)
    .filter((id) => (c[id] ?? 0) > 0)
    .sort()
    .map((id) => `${id}:${c[id]}`)
    .join(',');
}

const BY_FORMULA: Record<string, Molecule> = Object.fromEntries(
  MOLECULES.map((m) => [m.formula, m]),
);

/** Recetas base auto-derivadas: átomos → molécula de 1º nivel (no productos). */
const BASE_RECIPES: Recipe[] = MOLECULES
  .filter((m) => !m.compound)
  .map((m) => ({ inputs: { ...m.composition }, output: m.formula }));

/**
 * Recetas de alquimia: combinan productos (y/o átomos) para formar productos de
 * 2º nivel. Patrón extensible: agregar un objeto `{ inputs, output }`. El output
 * debe ser la fórmula de una molécula existente en MOLECULES.
 */
export const ALCHEMY_RECIPES: Recipe[] = [
  { inputs: { 'H₂O': 1, 'CO₂': 1 }, output: 'H₂CO₃' },
  { inputs: { 'NH₃': 1, 'HCl': 1 }, output: 'NH₄Cl' },
  { inputs: { 'SO₂': 1, 'H₂O': 1 }, output: 'H₂SO₃' },
  { inputs: { 'NH₃': 1, 'H₂O': 1 }, output: 'NH₄OH' },
];

export const RECIPES: Recipe[] = [...BASE_RECIPES, ...ALCHEMY_RECIPES];

const BY_INGREDIENTS: Record<string, Recipe> = Object.fromEntries(
  RECIPES.map((r) => [ingredientKey(r.inputs), r]),
);

/**
 * Resuelve el contenido del cuenco: devuelve la molécula producto si el conjunto
 * exacto de ingredientes coincide con una receta, o `null` (no reacciona).
 */
export function brew(c: Cauldron): Molecule | null {
  const recipe = BY_INGREDIENTS[ingredientKey(c)];
  return recipe ? BY_FORMULA[recipe.output] ?? null : null;
}

/** Etiqueta legible de un ingrediente (nombre en español si es producto). */
export function ingredientLabel(id: IngredientId): string {
  if (id in ELEMENTS) return ELEMENTS[id as ElementSymbol].nameEs;
  return BY_FORMULA[id]?.nameEs ?? id;
}

/** ¿Este ingrediente es un átomo (elemento de la tabla)? */
export function isElement(id: IngredientId): id is ElementSymbol {
  return id in ELEMENTS;
}

/** Molécula por fórmula, o undefined si no existe. */
export function findMolecule(formula: string): Molecule | undefined {
  return BY_FORMULA[formula];
}
