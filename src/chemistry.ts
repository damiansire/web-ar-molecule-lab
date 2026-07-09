/**
 * Dominio puro de Molecule Lab: catálogo de elementos, geometría de las
 * moléculas (para dibujar su "forma") y reglas de combinación por estequiometría.
 * Sin dependencias del DOM ni de la cámara: se testea aislado con Vitest.
 */

import type { Lang } from './i18n';

export type ElementSymbol = 'H' | 'O' | 'C' | 'N' | 'Na' | 'Cl' | 'F' | 'S' | 'P';

export interface ChemElement {
  symbol: ElementSymbol;
  /** Nombre en inglés. */
  name: string;
  /** Nombre en español. */
  nameEs: string;
  /** Nombre en italiano. */
  nameIt: string;
  /** Nombre en portugués. */
  namePt: string;
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

/**
 * Un átomo dentro de la estructura de una molécula (coords locales, y hacia
 * abajo). `z` es opcional y por defecto 0 (molécula plana): solo las formas
 * genuinamente no-planares (tetraédrica, piramidal-trigonal) lo declaran, para
 * que el render 3D las muestre con su geometría real en vez de aplanadas.
 */
export interface Atom {
  symbol: ElementSymbol;
  x: number;
  y: number;
  z?: number;
}
export interface Bond {
  a: number; // índice en atoms
  b: number;
  order: 1 | 2 | 3;
}

export type Composition = Partial<Record<ElementSymbol, number>>;

export interface Molecule {
  formula: string;
  /** Nombre en inglés. */
  name: string;
  /** Nombre en español. */
  nameEs: string;
  /** Nombre en italiano. */
  nameIt: string;
  /** Nombre en portugués. */
  namePt: string;
  color: string;
  /** Descripción breve (inglés): para qué se usa / por qué importa. */
  description: string;
  /** Descripción en español. */
  descriptionEs: string;
  /** Descripción en italiano. */
  descriptionIt: string;
  /** Descripción en portugués. */
  descriptionPt: string;
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
  H: { symbol: 'H', name: 'Hydrogen', nameEs: 'Hidrógeno', nameIt: 'Idrogeno', namePt: 'Hidrogênio', atomicNumber: 1, color: '#7dd3fc', category: 'no-metal', radius: 0.3, shells: [1] },
  O: { symbol: 'O', name: 'Oxygen', nameEs: 'Oxígeno', nameIt: 'Ossigeno', namePt: 'Oxigênio', atomicNumber: 8, color: '#f87171', category: 'no-metal', radius: 0.42, shells: [2, 6] },
  C: { symbol: 'C', name: 'Carbon', nameEs: 'Carbono', nameIt: 'Carbonio', namePt: 'Carbono', atomicNumber: 6, color: '#94a3b8', category: 'no-metal', radius: 0.45, shells: [2, 4] },
  N: { symbol: 'N', name: 'Nitrogen', nameEs: 'Nitrógeno', nameIt: 'Azoto', namePt: 'Nitrogênio', atomicNumber: 7, color: '#818cf8', category: 'no-metal', radius: 0.42, shells: [2, 5] },
  Na: { symbol: 'Na', name: 'Sodium', nameEs: 'Sodio', nameIt: 'Sodio', namePt: 'Sódio', atomicNumber: 11, color: '#fbbf24', category: 'metal', radius: 0.55, shells: [2, 8, 1] },
  Cl: { symbol: 'Cl', name: 'Chlorine', nameEs: 'Cloro', nameIt: 'Cloro', namePt: 'Cloro', atomicNumber: 17, color: '#4ade80', category: 'halogeno', radius: 0.5, shells: [2, 8, 7] },
  F: { symbol: 'F', name: 'Fluorine', nameEs: 'Flúor', nameIt: 'Fluoro', namePt: 'Flúor', atomicNumber: 9, color: '#a3e635', category: 'halogeno', radius: 0.38, shells: [2, 7] },
  S: { symbol: 'S', name: 'Sulfur', nameEs: 'Azufre', nameIt: 'Zolfo', namePt: 'Enxofre', atomicNumber: 16, color: '#facc15', category: 'no-metal', radius: 0.5, shells: [2, 8, 6] },
  P: { symbol: 'P', name: 'Phosphorus', nameEs: 'Fósforo', nameIt: 'Fosforo', namePt: 'Fósforo', atomicNumber: 15, color: '#fb923c', category: 'no-metal', radius: 0.5, shells: [2, 8, 5] },
};

export const ELEMENT_ORDER: ElementSymbol[] = ['H', 'O', 'C', 'N', 'S', 'P', 'F', 'Na', 'Cl'];

// ---------------------------------------------------------------------------
// Moléculas (composición + geometría + descripción)
// ---------------------------------------------------------------------------
export const MOLECULES: Molecule[] = [
  {
    formula: 'H₂O', name: 'Water', nameEs: 'Agua', nameIt: 'Acqua', namePt: 'Água', color: '#38bdf8',
    description: 'The basis of all known life. Covers about 71% of Earth and makes up most of your body.',
    descriptionEs: 'La base de toda forma de vida conocida. Cubre cerca del 71% de la Tierra y forma la mayor parte de tu cuerpo.',
    descriptionIt: 'La base di ogni forma di vita conosciuta. Copre circa il 71% della Terra e costituisce gran parte del tuo corpo.',
    descriptionPt: 'A base de toda forma de vida conhecida. Cobre cerca de 71% da Terra e forma a maior parte do seu corpo.',
    composition: { H: 2, O: 1 },
    atoms: [
      { symbol: 'O', x: 0, y: -0.15 },
      { symbol: 'H', x: -0.8, y: 0.5 },
      { symbol: 'H', x: 0.8, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'CO₂', name: 'Carbon dioxide', nameEs: 'Dióxido de carbono', nameIt: 'Anidride carbonica', namePt: 'Dióxido de carbono', color: '#94a3b8',
    description: 'Exhaled by animals, used by plants in photosynthesis, and a key greenhouse gas.',
    descriptionEs: 'La exhalan los animales, la usan las plantas en la fotosíntesis, y es un gas de efecto invernadero clave.',
    descriptionIt: 'Espirata dagli animali, usata dalle piante nella fotosintesi, è un gas serra fondamentale.',
    descriptionPt: 'Exalado pelos animais, usado pelas plantas na fotossíntese e um gás de efeito estufa importante.',
    composition: { C: 1, O: 2 },
    atoms: [
      { symbol: 'C', x: 0, y: 0 },
      { symbol: 'O', x: -1.05, y: 0 },
      { symbol: 'O', x: 1.05, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  {
    formula: 'NH₃', name: 'Ammonia', nameEs: 'Amoníaco', nameIt: 'Ammoniaca', namePt: 'Amônia', color: '#a5b4fc',
    description: 'Used to make fertilizers that feed most of the world, and in cleaning products.',
    descriptionEs: 'Se usa para fabricar fertilizantes que alimentan a buena parte del mundo, y en productos de limpieza.',
    descriptionIt: 'Usata per produrre fertilizzanti che nutrono gran parte del mondo, e nei prodotti per la pulizia.',
    descriptionPt: 'Usada para fabricar fertilizantes que alimentam boa parte do mundo, e em produtos de limpeza.',
    composition: { N: 1, H: 3 },
    // Piramidal trigonal real: N en el vértice (z positivo, hacia la cámara),
    // los 3 H formando la base triangular (z negativo, hacia atrás).
    atoms: [
      { symbol: 'N', x: 0, y: 0, z: 0.35 },
      { symbol: 'H', x: 0, y: 0.9, z: -0.12 },
      { symbol: 'H', x: -0.8, y: -0.45, z: -0.12 },
      { symbol: 'H', x: 0.8, y: -0.45, z: -0.12 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },
  {
    formula: 'CH₄', name: 'Methane', nameEs: 'Metano', nameIt: 'Metano', namePt: 'Metano', color: '#5eead4',
    description: 'The main component of natural gas — a common fuel and a potent greenhouse gas.',
    descriptionEs: 'El componente principal del gas natural: un combustible común y un potente gas de efecto invernadero.',
    descriptionIt: 'Il componente principale del gas naturale: un combustibile comune e un potente gas serra.',
    descriptionPt: 'O principal componente do gás natural: um combustível comum e um potente gás de efeito estufa.',
    composition: { C: 1, H: 4 },
    // Tetraédrica real: los 4 H en los vértices de un tetraedro regular
    // centrado en C (signos alternados de una esquina de cubo → ángulo
    // C-H/C-H exacto de 109.47°, ver test "geometría tetraédrica de CH₄").
    atoms: [
      { symbol: 'C', x: 0, y: 0, z: 0 },
      { symbol: 'H', x: 0.69, y: 0.69, z: 0.69 },
      { symbol: 'H', x: 0.69, y: -0.69, z: -0.69 },
      { symbol: 'H', x: -0.69, y: 0.69, z: -0.69 },
      { symbol: 'H', x: -0.69, y: -0.69, z: 0.69 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 },
      { a: 0, b: 3, order: 1 }, { a: 0, b: 4, order: 1 },
    ],
  },
  {
    formula: 'NaCl', name: 'Salt (sodium chloride)', nameEs: 'Sal', nameIt: 'Sale', namePt: 'Sal', color: '#fcd34d',
    description: 'Everyday table salt. Essential for life and used to season and preserve food.',
    descriptionEs: 'La sal de mesa de todos los días. Esencial para la vida y usada para condimentar y conservar alimentos.',
    descriptionIt: 'Il comune sale da cucina. Essenziale per la vita e usato per insaporire e conservare i cibi.',
    descriptionPt: 'O sal de cozinha do dia a dia. Essencial à vida e usado para temperar e conservar alimentos.',
    composition: { Na: 1, Cl: 1 },
    atoms: [
      { symbol: 'Na', x: -0.75, y: 0 },
      { symbol: 'Cl', x: 0.75, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'HCl', name: 'Hydrochloric acid', nameEs: 'Ácido clorhídrico', nameIt: 'Acido cloridrico', namePt: 'Ácido clorídrico', color: '#86efac',
    description: 'Your stomach makes it to digest food. Also a workhorse acid in industry.',
    descriptionEs: 'Tu estómago lo produce para digerir la comida. También es un ácido clave en la industria.',
    descriptionIt: 'Il tuo stomaco lo produce per digerire il cibo. È anche un acido fondamentale nell\'industria.',
    descriptionPt: 'Seu estômago o produz para digerir a comida. Também é um ácido essencial na indústria.',
    composition: { H: 1, Cl: 1 },
    atoms: [
      { symbol: 'H', x: -0.65, y: 0 },
      { symbol: 'Cl', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'H₂', name: 'Hydrogen gas', nameEs: 'Hidrógeno gaseoso', nameIt: 'Idrogeno gassoso', namePt: 'Hidrogênio gasoso', color: '#7dd3fc',
    description: 'The lightest gas and a clean fuel: burning it produces only water.',
    descriptionEs: 'El gas más liviano y un combustible limpio: al quemarse solo produce agua.',
    descriptionIt: 'Il gas più leggero e un combustibile pulito: bruciando produce solo acqua.',
    descriptionPt: 'O gás mais leve e um combustível limpo: ao queimar produz apenas água.',
    composition: { H: 2 },
    atoms: [
      { symbol: 'H', x: -0.6, y: 0 },
      { symbol: 'H', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'O₂', name: 'Oxygen gas', nameEs: 'Oxígeno gaseoso', nameIt: 'Ossigeno gassoso', namePt: 'Oxigênio gasoso', color: '#f87171',
    description: 'The gas you breathe to stay alive — about 21% of the air around you.',
    descriptionEs: 'El gas que respirás para seguir vivo: cerca del 21% del aire que te rodea.',
    descriptionIt: 'Il gas che respiri per restare in vita: circa il 21% dell\'aria intorno a te.',
    descriptionPt: 'O gás que você respira para se manter vivo: cerca de 21% do ar ao seu redor.',
    composition: { O: 2 },
    atoms: [
      { symbol: 'O', x: -0.62, y: 0 },
      { symbol: 'O', x: 0.62, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  },
  {
    formula: 'N₂', name: 'Nitrogen gas', nameEs: 'Nitrógeno gaseoso', nameIt: 'Azoto gassoso', namePt: 'Nitrogênio gasoso', color: '#818cf8',
    description: 'About 78% of the air. Inert and often used to keep food fresh.',
    descriptionEs: 'Cerca del 78% del aire. Inerte y muy usado para mantener frescos los alimentos.',
    descriptionIt: 'Circa il 78% dell\'aria. Inerte e spesso usato per mantenere freschi gli alimenti.',
    descriptionPt: 'Cerca de 78% do ar. Inerte e muito usado para manter os alimentos frescos.',
    composition: { N: 2 },
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'N', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 3 }],
  },
  {
    formula: 'H₂O₂', name: 'Hydrogen peroxide', nameEs: 'Peróxido de hidrógeno', nameIt: 'Perossido di idrogeno', namePt: 'Peróxido de hidrogênio', color: '#bae6fd',
    description: 'A pale blue liquid used to disinfect wounds and bleach hair — water with one extra oxygen.',
    descriptionEs: 'Un líquido azul pálido que se usa para desinfectar heridas y decolorar el pelo: agua con un oxígeno de más.',
    descriptionIt: 'Un liquido azzurro pallido usato per disinfettare ferite e schiarire i capelli: acqua con un ossigeno in più.',
    descriptionPt: 'Um líquido azul-claro usado para desinfetar feridas e clarear o cabelo: água com um oxigênio a mais.',
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
    formula: 'O₃', name: 'Ozone', nameEs: 'Ozono', nameIt: 'Ozono', namePt: 'Ozônio', color: '#fca5a5',
    description: 'High in the atmosphere it shields us from UV rays; at ground level it is a pollutant.',
    descriptionEs: 'En lo alto de la atmósfera nos protege de los rayos UV; a nivel del suelo es un contaminante.',
    descriptionIt: 'In alto nell\'atmosfera ci protegge dai raggi UV; al livello del suolo è un inquinante.',
    descriptionPt: 'No alto da atmosfera nos protege dos raios UV; ao nível do solo é um poluente.',
    composition: { O: 3 },
    atoms: [
      { symbol: 'O', x: 0, y: -0.25 },
      { symbol: 'O', x: -0.95, y: 0.45 },
      { symbol: 'O', x: 0.95, y: 0.45 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'CO', name: 'Carbon monoxide', nameEs: 'Monóxido de carbono', nameIt: 'Monossido di carbonio', namePt: 'Monóxido de carbono', color: '#cbd5e1',
    description: 'A colorless, odorless and toxic gas from incomplete burning of fuels.',
    descriptionEs: 'Un gas incoloro, inodoro y tóxico que sale de la combustión incompleta de los combustibles.',
    descriptionIt: 'Un gas incolore, inodore e tossico prodotto dalla combustione incompleta dei combustibili.',
    descriptionPt: 'Um gás incolor, inodoro e tóxico vindo da queima incompleta de combustíveis.',
    composition: { C: 1, O: 1 },
    atoms: [
      { symbol: 'C', x: -0.6, y: 0 },
      { symbol: 'O', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 3 }],
  },
  {
    formula: 'NO', name: 'Nitric oxide', nameEs: 'Óxido nítrico', nameIt: 'Ossido nitrico', namePt: 'Óxido nítrico', color: '#c7d2fe',
    description: 'A signaling molecule in your body that relaxes blood vessels and controls blood flow.',
    descriptionEs: 'Una molécula señal de tu cuerpo que relaja los vasos sanguíneos y regula el flujo de sangre.',
    descriptionIt: 'Una molecola segnale del tuo corpo che rilassa i vasi sanguigni e regola il flusso del sangue.',
    descriptionPt: 'Uma molécula sinalizadora do seu corpo que relaxa os vasos sanguíneos e regula o fluxo de sangue.',
    composition: { N: 1, O: 1 },
    atoms: [
      { symbol: 'N', x: -0.6, y: 0 },
      { symbol: 'O', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }],
  },
  {
    formula: 'SO₂', name: 'Sulfur dioxide', nameEs: 'Dióxido de azufre', nameIt: 'Anidride solforosa', namePt: 'Dióxido de enxofre', color: '#fde047',
    description: 'A sharp-smelling gas from volcanoes and burning coal; used to preserve dried fruit.',
    descriptionEs: 'Un gas de olor penetrante de los volcanes y la quema de carbón; se usa para conservar fruta seca.',
    descriptionIt: 'Un gas dall\'odore pungente dei vulcani e della combustione del carbone; usato per conservare la frutta secca.',
    descriptionPt: 'Um gás de cheiro forte dos vulcões e da queima de carvão; usado para conservar frutas secas.',
    composition: { S: 1, O: 2 },
    atoms: [
      { symbol: 'S', x: 0, y: -0.1 },
      { symbol: 'O', x: -0.98, y: 0.5 },
      { symbol: 'O', x: 0.98, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 2 }, { a: 0, b: 2, order: 2 }],
  },
  {
    formula: 'H₂S', name: 'Hydrogen sulfide', nameEs: 'Sulfuro de hidrógeno', nameIt: 'Solfuro di idrogeno', namePt: 'Sulfeto de hidrogênio', color: '#fef08a',
    description: 'The "rotten egg" gas, toxic in high amounts and produced by decaying matter.',
    descriptionEs: 'El gas con olor a "huevo podrido", tóxico en grandes cantidades y producido por la materia en descomposición.',
    descriptionIt: 'Il gas dall\'odore di "uova marce", tossico in grandi quantità e prodotto dalla materia in decomposizione.',
    descriptionPt: 'O gás com cheiro de "ovo podre", tóxico em grandes quantidades e produzido pela matéria em decomposição.',
    composition: { H: 2, S: 1 },
    atoms: [
      { symbol: 'S', x: 0, y: -0.15 },
      { symbol: 'H', x: -0.85, y: 0.5 },
      { symbol: 'H', x: 0.85, y: 0.5 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }],
  },
  {
    formula: 'HF', name: 'Hydrogen fluoride', nameEs: 'Fluoruro de hidrógeno', nameIt: 'Fluoruro di idrogeno', namePt: 'Fluoreto de hidrogênio', color: '#bef264',
    description: 'Dissolved in water it becomes hydrofluoric acid, used to etch glass and silicon.',
    descriptionEs: 'Disuelto en agua se vuelve ácido fluorhídrico, usado para grabar vidrio y silicio.',
    descriptionIt: 'Disciolto in acqua diventa acido fluoridrico, usato per incidere vetro e silicio.',
    descriptionPt: 'Dissolvido em água vira ácido fluorídrico, usado para gravar vidro e silício.',
    composition: { H: 1, F: 1 },
    atoms: [
      { symbol: 'H', x: -0.6, y: 0 },
      { symbol: 'F', x: 0.6, y: 0 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }],
  },
  {
    formula: 'PH₃', name: 'Phosphine', nameEs: 'Fosfina', nameIt: 'Fosfina', namePt: 'Fosfina', color: '#fdba74',
    description: 'A toxic, flammable gas with a garlic-like smell, used in the semiconductor industry.',
    descriptionEs: 'Un gas tóxico e inflamable con olor a ajo, usado en la industria de los semiconductores.',
    descriptionIt: 'Un gas tossico e infiammabile con odore di aglio, usato nell\'industria dei semiconduttori.',
    descriptionPt: 'Um gás tóxico e inflamável com cheiro de alho, usado na indústria de semicondutores.',
    composition: { P: 1, H: 3 },
    // Piramidal trigonal, mismo patrón que NH₃ (ver comentario ahí).
    atoms: [
      { symbol: 'P', x: 0, y: 0, z: 0.35 },
      { symbol: 'H', x: 0, y: 0.9, z: -0.12 },
      { symbol: 'H', x: -0.8, y: -0.45, z: -0.12 },
      { symbol: 'H', x: 0.8, y: -0.45, z: -0.12 },
    ],
    bonds: [{ a: 0, b: 1, order: 1 }, { a: 0, b: 2, order: 1 }, { a: 0, b: 3, order: 1 }],
  },

  // --- Productos de 2º nivel (árbol de alquimia: se craftean combinando otras
  //     moléculas, no átomos sueltos). Ver ALCHEMY_RECIPES. ---
  {
    formula: 'H₂CO₃', name: 'Carbonic acid', nameEs: 'Ácido carbónico', nameIt: 'Acido carbonico', namePt: 'Ácido carbônico', color: '#67e8f9',
    description: 'Forms when CO₂ dissolves in water — it is what makes soda fizzy and rain slightly acidic.',
    descriptionEs: 'Se forma cuando el CO₂ se disuelve en agua: es lo que hace burbujeante a la gaseosa y levemente ácida a la lluvia.',
    descriptionIt: 'Si forma quando la CO₂ si scioglie in acqua: è ciò che rende frizzante la bibita e leggermente acida la pioggia.',
    descriptionPt: 'Forma-se quando o CO₂ se dissolve na água: é o que deixa o refrigerante borbulhante e a chuva levemente ácida.',
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
    formula: 'NH₄Cl', name: 'Ammonium chloride', nameEs: 'Cloruro de amonio', nameIt: 'Cloruro di ammonio', namePt: 'Cloreto de amônio', color: '#c4b5fd',
    description: 'A salt of ammonia and hydrochloric acid, used in fertilizers, batteries and cough medicine.',
    descriptionEs: 'Una sal de amoníaco y ácido clorhídrico, usada en fertilizantes, pilas y jarabes para la tos.',
    descriptionIt: 'Un sale di ammoniaca e acido cloridrico, usato in fertilizzanti, batterie e sciroppi per la tosse.',
    descriptionPt: 'Um sal de amônia e ácido clorídrico, usado em fertilizantes, pilhas e xaropes para tosse.',
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
    formula: 'H₂SO₃', name: 'Sulfurous acid', nameEs: 'Ácido sulfuroso', nameIt: 'Acido solforoso', namePt: 'Ácido sulfuroso', color: '#fef9c3',
    description: 'Forms when sulfur dioxide dissolves in water; the chemistry behind acid rain.',
    descriptionEs: 'Se forma cuando el dióxido de azufre se disuelve en agua; es la química detrás de la lluvia ácida.',
    descriptionIt: 'Si forma quando l\'anidride solforosa si scioglie in acqua; è la chimica dietro la pioggia acida.',
    descriptionPt: 'Forma-se quando o dióxido de enxofre se dissolve na água; é a química por trás da chuva ácida.',
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
    formula: 'NH₄OH', name: 'Ammonium hydroxide', nameEs: 'Hidróxido de amonio', nameIt: 'Idrossido di ammonio', namePt: 'Hidróxido de amônio', color: '#ddd6fe',
    description: 'Ammonia dissolved in water — the cloudy "ammonia" sold as a household cleaner.',
    descriptionEs: 'Amoníaco disuelto en agua: el "amoníaco" turbio que se vende como limpiador doméstico.',
    descriptionIt: 'Ammoniaca disciolta in acqua: l\'"ammoniaca" torbida venduta come detergente per la casa.',
    descriptionPt: 'Amônia dissolvida em água: a "amônia" turva vendida como produto de limpeza doméstica.',
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

/** Algo con nombre en los 4 idiomas (elemento o molécula). */
type Named = { name: string; nameEs: string; nameIt: string; namePt: string };

/** Nombre de un elemento o molécula en el idioma dado (inglés por defecto). */
export function localizedName(e: Named, lang: Lang): string {
  switch (lang) {
    case 'es': return e.nameEs;
    case 'it': return e.nameIt;
    case 'pt': return e.namePt;
    default: return e.name;
  }
}

/** Los 4 nombres de un elemento o molécula (para el match de voz multi-idioma). */
export function allNames(e: Named): string[] {
  return [e.name, e.nameEs, e.nameIt, e.namePt];
}

/** Descripción de una molécula en el idioma dado (inglés por defecto). */
export function localizedDescription(m: Molecule, lang: Lang): string {
  switch (lang) {
    case 'es': return m.descriptionEs;
    case 'it': return m.descriptionIt;
    case 'pt': return m.descriptionPt;
    default: return m.description;
  }
}

/** Etiqueta legible de un ingrediente en el idioma dado. */
export function ingredientLabel(id: IngredientId, lang: Lang): string {
  if (isElement(id)) return localizedName(ELEMENTS[id], lang);
  const m = BY_FORMULA[id];
  return m ? localizedName(m, lang) : id;
}

/** ¿Este ingrediente es un átomo (elemento de la tabla)? */
export function isElement(id: IngredientId): id is ElementSymbol {
  return Object.prototype.hasOwnProperty.call(ELEMENTS, id);
}

/** Molécula por fórmula, o undefined si no existe. */
export function findMolecule(formula: string): Molecule | undefined {
  return BY_FORMULA[formula];
}
