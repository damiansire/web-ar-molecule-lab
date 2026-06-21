import { describe, it, expect } from 'vitest';
import { matchElement, resolveLang } from './voice';

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
