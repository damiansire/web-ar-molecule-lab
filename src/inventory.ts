/**
 * Inventario de descubrimientos: los productos (fórmulas) que el jugador ya
 * formó. Persiste en localStorage para que el avance sobreviva a recargas.
 *
 * La lógica es pura y testeable: se le puede inyectar un storage falso. Si no hay
 * storage disponible (SSR, tests sin DOM), cae a un Set en memoria sin romper.
 */

/** Subconjunto de la Web Storage API que usamos (inyectable en tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Clave versionada: si cambia el formato, se sube la versión sin pisar datos viejos. */
export const INVENTORY_KEY = 'molab.inventory.v1';

export interface Inventory {
  /** ¿Ya se descubrió este producto? */
  has(id: string): boolean;
  /** Marca un producto como descubierto (idempotente). Devuelve true si es nuevo. */
  add(id: string): boolean;
  /** Productos descubiertos, en orden de descubrimiento. */
  list(): string[];
}

/** Intenta resolver localStorage; null si no está disponible o tira (modo privado). */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') {
      // Toque de prueba: algunos navegadores exponen el objeto pero tiran al usarlo.
      localStorage.getItem(INVENTORY_KEY);
      return localStorage;
    }
  } catch {
    /* sin acceso a storage */
  }
  return null;
}

function load(storage: StorageLike | null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(INVENTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Crea un inventario respaldado por `storage` (por defecto localStorage). El
 * orden de descubrimiento se conserva; los duplicados se ignoran.
 */
export function createInventory(storage: StorageLike | null = defaultStorage()): Inventory {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const id of load(storage)) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  function persist(): void {
    if (!storage) return;
    try {
      storage.setItem(INVENTORY_KEY, JSON.stringify(order));
    } catch {
      /* cuota llena / sin permiso: el juego sigue, solo no persiste */
    }
  }

  return {
    has: (id) => seen.has(id),
    add: (id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      order.push(id);
      persist();
      return true;
    },
    list: () => [...order],
  };
}
