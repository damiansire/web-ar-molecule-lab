import { describe, it, expect } from 'vitest';
import { hasConsent, grantConsent, CONSENT_KEY, type StorageLike } from './privacy-consent';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
  };
}

describe('privacy-consent', () => {
  it('sin consentimiento previo, hasConsent es false', () => {
    expect(hasConsent(fakeStorage())).toBe(false);
  });

  it('sin storage disponible (modo privado/SSR), fail-closed: hasConsent es false', () => {
    expect(hasConsent(null)).toBe(false);
  });

  it('grantConsent persiste y hasConsent lo refleja después', () => {
    const storage = fakeStorage();
    expect(hasConsent(storage)).toBe(false);
    grantConsent(storage);
    expect(hasConsent(storage)).toBe(true);
  });

  it('grantConsent sin storage no tira (el juego sigue, solo no recuerda)', () => {
    expect(() => grantConsent(null)).not.toThrow();
  });

  it('un valor corrupto/legado en la clave no cuenta como consentimiento', () => {
    const storage = fakeStorage();
    storage.setItem(CONSENT_KEY, 'true'); // valor legado hipotético, no el literal esperado
    expect(hasConsent(storage)).toBe(false);
  });

  it('un storage que tira al leer no rompe: fail-closed', () => {
    const throwing: StorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(hasConsent(throwing)).toBe(false);
    expect(() => grantConsent(throwing)).not.toThrow();
  });
});
