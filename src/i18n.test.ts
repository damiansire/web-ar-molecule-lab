import { describe, it, expect } from 'vitest';
import { t, detectLang, LANGS, LANG_LABEL, type UIKey } from './i18n';

describe('detectLang', () => {
  it('mapea un tag BCP-47 al idioma soportado', () => {
    expect(detectLang('es-AR')).toBe('es');
    expect(detectLang('pt-BR')).toBe('pt');
    expect(detectLang('it')).toBe('it');
    expect(detectLang('en-US')).toBe('en');
  });

  it('cae a inglés para idiomas no soportados o vacíos', () => {
    expect(detectLang('fr')).toBe('en');
    expect(detectLang('')).toBe('en');
    expect(detectLang(null)).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
});

describe('catálogo de strings', () => {
  // Las claves que el código usa; si falta una traducción, t() devolvería undefined.
  const KEYS: UIKey[] = [
    'title', 'lead', 'start', 'privacy', 'statusIdle', 'statusWarmup', 'statusReady',
    'statusCam', 'statusErr', 'statusErrPermission', 'statusErrNoCamera', 'statusErrModel',
    'cauldron', 'cauldronHint', 'mix', 'empty',
    'inventory', 'inventoryEmpty', 'voiceHint', 'emptyCauldron', 'noReaction',
    'emptied', 'freeHand', 'nothingInHand', 'handLeft', 'handRight', 'hands',
    'startManual', 'manualHint',
    'consentTitle', 'consentBody', 'consentAccept', 'consentDecline',
  ];

  it('los 4 idiomas tienen todas las claves con texto no vacío', () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect(t(lang, key).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('hay etiqueta de selector para cada idioma', () => {
    for (const lang of LANGS) expect(LANG_LABEL[lang]).toMatch(/^[A-Z]{2}$/);
  });
});
