import { describe, it, expect } from 'vitest';
import { createInventory, INVENTORY_KEY, type StorageLike } from './inventory';

/** Storage falso en memoria para testear la persistencia sin DOM. */
function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

describe('createInventory', () => {
  it('arranca vacío sin storage', () => {
    const inv = createInventory(null);
    expect(inv.list()).toEqual([]);
    expect(inv.has('H₂O')).toBe(false);
  });

  it('add marca como descubierto y devuelve true solo la primera vez', () => {
    const inv = createInventory(fakeStorage());
    expect(inv.add('H₂O')).toBe(true);
    expect(inv.has('H₂O')).toBe(true);
    expect(inv.add('H₂O')).toBe(false); // duplicado
    expect(inv.list()).toEqual(['H₂O']);
  });

  it('conserva el orden de descubrimiento', () => {
    const inv = createInventory(fakeStorage());
    inv.add('CO₂');
    inv.add('H₂O');
    inv.add('NaCl');
    expect(inv.list()).toEqual(['CO₂', 'H₂O', 'NaCl']);
  });

  it('persiste en el storage bajo la clave versionada', () => {
    const storage = fakeStorage();
    const inv = createInventory(storage);
    inv.add('H₂O');
    inv.add('CO₂');
    expect(JSON.parse(storage.data[INVENTORY_KEY])).toEqual(['H₂O', 'CO₂']);
  });

  it('rehidrata lo guardado en una sesión previa', () => {
    const storage = fakeStorage({ [INVENTORY_KEY]: JSON.stringify(['NaCl', 'H₂O']) });
    const inv = createInventory(storage);
    expect(inv.has('NaCl')).toBe(true);
    expect(inv.has('H₂O')).toBe(true);
    expect(inv.list()).toEqual(['NaCl', 'H₂O']);
  });

  it('tolera datos corruptos en storage (no rompe, arranca vacío)', () => {
    const storage = fakeStorage({ [INVENTORY_KEY]: 'no es json {' });
    const inv = createInventory(storage);
    expect(inv.list()).toEqual([]);
  });

  it('deduplica y descarta no-strings al rehidratar', () => {
    const storage = fakeStorage({ [INVENTORY_KEY]: JSON.stringify(['H₂O', 'H₂O', 42, null, 'CO₂']) });
    const inv = createInventory(storage);
    expect(inv.list()).toEqual(['H₂O', 'CO₂']);
  });
});
