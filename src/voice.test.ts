import { describe, it, expect } from 'vitest';
import { matchElement, matchCommand, matchProduct, resolveLang, type ProductLexEntry } from './voice';

describe('matchElement', () => {
  it('reconoce nombres en español (con y sin acento)', () => {
    expect(matchElement('hidrógeno')).toBe('H');
    expect(matchElement('hidrogeno')).toBe('H');
    expect(matchElement('oxígeno')).toBe('O');
    expect(matchElement('carbono')).toBe('C');
    expect(matchElement('nitrógeno')).toBe('N');
    expect(matchElement('sodio')).toBe('Na');
    expect(matchElement('cloro')).toBe('Cl');
  });

  it('reconoce nombres en inglés', () => {
    expect(matchElement('hydrogen')).toBe('H');
    expect(matchElement('oxygen')).toBe('O');
    expect(matchElement('sodium')).toBe('Na');
    expect(matchElement('chlorine')).toBe('Cl');
  });

  it('reconoce los elementos nuevos (flúor, azufre, fósforo)', () => {
    expect(matchElement('fluor')).toBe('F');
    expect(matchElement('flúor')).toBe('F');
    expect(matchElement('azufre')).toBe('S');
    expect(matchElement('sulfur')).toBe('S');
    expect(matchElement('fosforo')).toBe('P');
    expect(matchElement('fósforo')).toBe('P');
  });

  it('reconoce nombres en italiano y portugués', () => {
    expect(matchElement('idrogeno')).toBe('H');   // it
    expect(matchElement('ossigeno')).toBe('O');   // it
    expect(matchElement('zolfo')).toBe('S');      // it
    expect(matchElement('azoto')).toBe('N');      // it
    expect(matchElement('hidrogênio')).toBe('H'); // pt
    expect(matchElement('enxofre')).toBe('S');    // pt
    expect(matchElement('oxigênio')).toBe('O');   // pt
  });

  it('ignora mayúsculas y palabras alrededor', () => {
    expect(matchElement('dame OXÍGENO por favor')).toBe('O');
    expect(matchElement('quiero un poco de Sodio')).toBe('Na');
  });

  it('devuelve null si no se nombra ningún elemento', () => {
    expect(matchElement('')).toBeNull();
    expect(matchElement('hola que tal')).toBeNull();
    expect(matchElement('agua')).toBeNull(); // es una molécula, no un elemento
  });

  it('no confunde letras o palabras comunes con símbolos', () => {
    expect(matchElement('o sea')).toBeNull(); // "o" no es oxígeno
    expect(matchElement('no')).toBeNull();
  });

  it('si se nombran varios, gana el último mencionado', () => {
    expect(matchElement('oxígeno hidrógeno')).toBe('H');
    expect(matchElement('primero cloro y después sodio')).toBe('Na');
  });
});

describe('matchCommand', () => {
  it('reconoce mezclar en los 4 idiomas', () => {
    expect(matchCommand('mezclar')).toBe('mix');     // es
    expect(matchCommand('mix it')).toBe('mix');      // en
    expect(matchCommand('mescola tutto')).toBe('mix'); // it
    expect(matchCommand('misturar')).toBe('mix');    // pt
  });

  it('reconoce vaciar en los 4 idiomas', () => {
    expect(matchCommand('vaciar')).toBe('clear');    // es
    expect(matchCommand('empty')).toBe('clear');     // en
    expect(matchCommand('svuota')).toBe('clear');    // it
    expect(matchCommand('esvaziar')).toBe('clear');  // pt
  });

  it('reconoce la orden de depositar genérica', () => {
    expect(matchCommand('echar')).toBe('deposit');
    expect(matchCommand('soltar al cuenco')).toBe('deposit');
    expect(matchCommand('drop')).toBe('deposit');
    expect(matchCommand('jogar')).toBe('deposit');
  });

  it('reconoce depositar por mano (izquierda/derecha)', () => {
    expect(matchCommand('izquierda')).toBe('deposit-left');
    expect(matchCommand('mano derecha')).toBe('deposit-right');
    expect(matchCommand('left')).toBe('deposit-left');
    expect(matchCommand('destra')).toBe('deposit-right');
    // la dirección gana sobre el depósito genérico
    expect(matchCommand('echar a la izquierda')).toBe('deposit-left');
  });

  it('devuelve null si no hay orden', () => {
    expect(matchCommand('')).toBeNull();
    expect(matchCommand('hidrogeno')).toBeNull();
    expect(matchCommand('hola')).toBeNull();
  });
});

describe('matchProduct', () => {
  const products: ProductLexEntry[] = [
    { id: 'H₂O', names: ['Agua', 'Water'] },
    { id: 'CO₂', names: ['Dióxido de carbono', 'Carbon dioxide'] },
    { id: 'NaCl', names: ['Sal', 'Salt'] },
  ];

  it('reconoce un producto por su nombre en español (con acento)', () => {
    expect(matchProduct('quiero agua', products)).toBe('H₂O');
    expect(matchProduct('dame sal', products)).toBe('NaCl');
  });

  it('reconoce nombres de varias palabras', () => {
    expect(matchProduct('invocar dióxido de carbono', products)).toBe('CO₂');
    expect(matchProduct('carbon dioxide please', products)).toBe('CO₂');
  });

  it('reconoce el nombre en inglés', () => {
    expect(matchProduct('water', products)).toBe('H₂O');
  });

  it('devuelve null si no se nombra ningún producto descubierto', () => {
    expect(matchProduct('', products)).toBeNull();
    expect(matchProduct('hidrogeno', products)).toBeNull();
    expect(matchProduct('agua', [])).toBeNull(); // nada descubierto aún
  });

  it('prefiere el match más largo/específico', () => {
    const lex: ProductLexEntry[] = [
      { id: 'H₂O', names: ['Agua'] },
      { id: 'BRINE', names: ['Agua salada'] },
    ];
    expect(matchProduct('dame agua salada', lex)).toBe('BRINE');
  });
});

describe('resolveLang', () => {
  it('alinea con la UI inglesa por defecto (vacío → en-US)', () => {
    expect(resolveLang('')).toBe('en-US');
    expect(resolveLang(null)).toBe('en-US');
    expect(resolveLang(undefined)).toBe('en-US');
  });

  it('completa un idioma sin región', () => {
    expect(resolveLang('en')).toBe('en-US');
    expect(resolveLang('es')).toBe('es-ES');
  });

  it('respeta y normaliza un locale con región', () => {
    expect(resolveLang('en-GB')).toBe('en-GB');
    expect(resolveLang('es-ar')).toBe('es-AR');
    expect(resolveLang('EN-us')).toBe('en-US');
  });

  it('idioma no soportado cae a inglés (la UI es inglés)', () => {
    expect(resolveLang('fr')).toBe('en-US');
  });
});
