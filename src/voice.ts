/**
 * Comandos por voz: interpreta lo que dice el usuario y lo mapea a un elemento.
 *
 * `matchElement` es lógica pura (sin DOM) y se testea aislada. `VoiceRecognizer`
 * envuelve la Web Speech API del navegador (SpeechRecognition), que no se testea.
 */
import type { ElementSymbol } from './chemistry';

/** Quita acentos y baja a minúsculas para comparar de forma robusta. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Palabras (español + inglés) → símbolo. A propósito NO mapeamos letras sueltas
// ("o", "c", "n"...) porque chocan con palabras comunes y darían falsos positivos.
const WORD_TO_SYMBOL: Record<string, ElementSymbol> = {
  hidrogeno: 'H', hydrogen: 'H',
  oxigeno: 'O', oxygen: 'O',
  carbono: 'C', carbon: 'C',
  nitrogeno: 'N', nitrogen: 'N',
  sodio: 'Na', sodium: 'Na',
  cloro: 'Cl', chlorine: 'Cl',
};

/**
 * Devuelve el ÚLTIMO elemento mencionado en el texto (el más reciente gana),
 * o null si no se nombró ninguno.
 */
export function matchElement(transcript: string): ElementSymbol | null {
  const words = normalize(transcript).split(/[^a-z]+/).filter(Boolean);
  let found: ElementSymbol | null = null;
  for (const w of words) {
    const s = WORD_TO_SYMBOL[w];
    if (s) found = s;
  }
  return found;
}

/**
 * Mapea un código de idioma (BCP-47, p.ej. `"en"`, `"es-AR"`) a un locale válido
 * para SpeechRecognition. Si ya trae región (`en-US`), se respeta; si es solo el
 * idioma (`en`), se completa con una región por defecto. Para idiomas que no
 * soportamos cae a `en-US`, alineado con la UI (100% inglés).
 */
export function resolveLang(raw: string | null | undefined): string {
  const tag = (raw ?? '').trim().toLowerCase();
  if (!tag) return 'en-US';
  const base = tag.split('-')[0];
  if (tag.includes('-')) {
    // Ya tiene región: normalizamos a "xx-YY".
    const [lang, region] = tag.split('-');
    return `${lang}-${region.toUpperCase()}`;
  }
  if (base === 'es') return 'es-ES';
  if (base === 'en') return 'en-US';
  return 'en-US';
}

/** Idioma efectivo de la UI → locale del reconocedor. */
function defaultLang(): string {
  const fromHtml = typeof document !== 'undefined' ? document.documentElement.lang : '';
  const fromNav = typeof navigator !== 'undefined' ? navigator.language : '';
  return resolveLang(fromHtml || fromNav);
}

// --- Web Speech API (tipado mínimo: no está en lib.dom estándar) -------------
interface SpeechAlternativeLike { transcript: string }
interface SpeechResultLike { 0: SpeechAlternativeLike; length: number }
interface SpeechResultListLike { length: number; [i: number]: SpeechResultLike }
interface SpeechEventLike { results: SpeechResultListLike }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class VoiceRecognizer {
  private rec: SpeechRecognitionLike | null = null;
  private running = false;
  private lastSymbol: ElementSymbol | null = null;
  private lastAt = 0;

  /** ¿El navegador soporta reconocimiento de voz? */
  static get supported(): boolean {
    return getCtor() !== null;
  }

  /**
   * Empieza a escuchar. Llama `onElement` cuando se nombra un elemento.
   * Devuelve false si no hay soporte o no pudo arrancar.
   *
   * `lang` por defecto se deriva del idioma efectivo de la UI: la interfaz es
   * inglés (`<html lang="en">`) y el hint dice "say an element", así que el ASR
   * debe escuchar en inglés o no transcribe "oxygen"/"sodium". Si se pasa `lang`
   * explícito, manda ese.
   */
  start(onElement: (s: ElementSymbol) => void, lang = defaultLang()): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechEventLike) => {
      const last = e.results[e.results.length - 1];
      const sym = matchElement(last?.[0]?.transcript ?? '');
      if (!sym) return;
      // Anti-rebote: los resultados intermedios disparan muchos eventos; no
      // repetimos el mismo símbolo en menos de 1.2 s.
      const now = performance.now();
      if (sym === this.lastSymbol && now - this.lastAt < 1200) return;
      this.lastSymbol = sym;
      this.lastAt = now;
      onElement(sym);
    };
    rec.onerror = (e: unknown) => {
      // Si el usuario niega el micrófono, dejamos de reintentar (evita un loop).
      const code = (e as { error?: string })?.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') this.running = false;
    };
    // El reconocimiento se corta solo tras silencios; lo reanudamos si seguimos activos.
    rec.onend = () => { if (this.running) { try { rec.start(); } catch { /* ya activo */ } } };

    this.rec = rec;
    this.running = true;
    try {
      rec.start();
      return true;
    } catch {
      this.running = false;
      return false;
    }
  }

  stop(): void {
    this.running = false;
    if (this.rec) { try { this.rec.abort(); } catch { /* noop */ } }
  }
}
