/**
 * Consentimiento GDPR antes de pedir cámara/mic: persiste en localStorage si
 * el jugador ya aceptó, para no mostrar el modal en cada visita.
 *
 * Lógica pura y testeable (misma forma que inventory.ts): storage inyectable,
 * y si no hay storage disponible (modo privado, SSR) el consentimiento no se
 * recuerda entre sesiones pero el juego sigue funcionando — se vuelve a
 * preguntar, fail-closed en vez de asumir que ya se aceptó.
 */

/** Subconjunto de la Web Storage API que usamos (inyectable en tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Clave versionada: si cambia el texto del consentimiento, se sube la versión. */
export const CONSENT_KEY = 'molab.consent.v1';

/** Intenta resolver localStorage; null si no está disponible o tira (modo privado). */
function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.getItem(CONSENT_KEY);
      return localStorage;
    }
  } catch {
    /* sin acceso a storage */
  }
  return null;
}

/** ¿El jugador ya aceptó el consentimiento de cámara/mic en este dispositivo? */
export function hasConsent(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(CONSENT_KEY) === 'accepted';
  } catch {
    return false;
  }
}

/** Marca el consentimiento como aceptado (idempotente). No tira si el storage falla. */
export function grantConsent(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(CONSENT_KEY, 'accepted');
  } catch {
    /* cuota llena / sin permiso: el juego sigue, solo vuelve a preguntar la próxima vez */
  }
}
