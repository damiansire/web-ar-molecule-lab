import { describe, it, expect } from 'vitest';
import { matchElement } from './voice';

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
