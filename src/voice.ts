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
   */
  start(onElement: (s: ElementSymbol) => void, lang = 'es-ES'): boolean {
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
