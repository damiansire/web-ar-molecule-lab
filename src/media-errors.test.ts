import { describe, it, expect } from 'vitest';
import { startFailureKey } from './media-errors';

/**
 * Cubre el fallback de "cámara denegada" (warm-3/warm-5 del roast): antes de
 * este test, `startFailureKey` solo se ejercitaba manualmente dentro de
 * main.ts. El caso crítico es no confundir permiso denegado con "no hay
 * cámara" ni con "el modelo no cargó" — cada uno manda al usuario a hacer
 * algo distinto.
 */
describe('startFailureKey', () => {
  it('permiso de cámara/mic denegado → statusErrPermission', () => {
    expect(startFailureKey(new DOMException('denied', 'NotAllowedError'))).toBe('statusErrPermission');
  });

  it('bloqueo de seguridad (contexto no seguro, policy) → statusErrPermission', () => {
    expect(startFailureKey(new DOMException('blocked', 'SecurityError'))).toBe('statusErrPermission');
  });

  it('sin cámara física → statusErrNoCamera', () => {
    expect(startFailureKey(new DOMException('none', 'NotFoundError'))).toBe('statusErrNoCamera');
  });

  it('constraints imposibles (ej. resolución) → statusErrNoCamera', () => {
    expect(startFailureKey(new DOMException('bad constraints', 'OverconstrainedError'))).toBe('statusErrNoCamera');
  });

  it('cámara concedida pero el modelo de manos no cargó → statusErrModel, no "revisá permisos"', () => {
    expect(startFailureKey(new Error('MODEL_NOT_READY'))).toBe('statusErrModel');
  });

  it('otro DOMException no mapeado cae al genérico', () => {
    expect(startFailureKey(new DOMException('raro', 'AbortError'))).toBe('statusErr');
  });

  it('error no reconocido (ni DOMException ni MODEL_NOT_READY) cae al genérico', () => {
    expect(startFailureKey(new Error('algo distinto'))).toBe('statusErr');
    expect(startFailureKey('un string cualquiera')).toBe('statusErr');
    expect(startFailureKey(undefined)).toBe('statusErr');
  });
});
