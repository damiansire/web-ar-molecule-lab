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
  // español · inglés · italiano · portugués
  hidrogeno: 'H', hydrogen: 'H', idrogeno: 'H', hidrogenio: 'H',
  oxigeno: 'O', oxygen: 'O', ossigeno: 'O', oxigenio: 'O',
  carbono: 'C', carbon: 'C', carbonio: 'C',
  nitrogeno: 'N', nitrogen: 'N', azoto: 'N', nitrogenio: 'N',
  sodio: 'Na', sodium: 'Na',
  cloro: 'Cl', chlorine: 'Cl',
  fluor: 'F', fluorine: 'F', fluoro: 'F',
  azufre: 'S', sulfur: 'S', sulphur: 'S', zolfo: 'S', enxofre: 'S',
  fosforo: 'P', phosphorus: 'P',
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

/** Órdenes por voz: mezclar, vaciar, o depositar (genérico / mano izquierda / derecha). */
export type VoiceCommand = 'mix' | 'clear' | 'deposit' | 'deposit-left' | 'deposit-right';

// Vocabulario por orden (es · en · it · pt). normalize() ya quitó acentos.
const MIX_WORDS = new Set([
  'mezclar', 'mezcla', 'mezclalo', 'combinar', 'combina',
  'mix', 'brew', 'combine', 'mescola', 'mescolare', 'misturar', 'mistura',
]);
const CLEAR_WORDS = new Set([
  'vaciar', 'vacia', 'vacialo', 'limpiar', 'limpia',
  'empty', 'clear', 'svuota', 'svuotare', 'pulisci', 'esvaziar', 'esvazia', 'limpar',
]);
const DEPOSIT_WORDS = new Set([
  'echar', 'echa', 'soltar', 'solta', 'tirar', 'tira', 'depositar', 'deposita', 'vaya',
  'drop', 'metti', 'mettere', 'butta', 'lascia', 'jogar', 'joga',
]);
const LEFT_WORDS = new Set(['izquierda', 'left', 'sinistra', 'esquerda']);
const RIGHT_WORDS = new Set(['derecha', 'right', 'destra', 'direita']);

/**
 * Detecta una orden de voz. Precedencia: dirección (izquierda/derecha) sobre el
 * depósito genérico, y depósito/mezclar/vaciar entre sí. Devuelve `null` si no
 * se nombró ninguna orden.
 */
export function matchCommand(transcript: string): VoiceCommand | null {
  const words = normalize(transcript).split(/[^a-z]+/).filter(Boolean);
  const has = (set: Set<string>) => words.some((w) => set.has(w));
  if (has(LEFT_WORDS)) return 'deposit-left';
  if (has(RIGHT_WORDS)) return 'deposit-right';
  if (has(DEPOSIT_WORDS)) return 'deposit';
  if (has(MIX_WORDS)) return 'mix';
  if (has(CLEAR_WORDS)) return 'clear';
  return null;
}

/** Un producto invocable por voz: su id (fórmula) y los nombres que lo nombran (ES/EN). */
export interface ProductLexEntry {
  id: string;
  names: string[];
}

/** Normaliza a una secuencia de palabras separadas por espacios simples. */
function normalizeWords(s: string): string {
  return normalize(s).split(/[^a-z]+/).filter(Boolean).join(' ');
}

/**
 * Busca en el texto el nombre de un producto descubierto (ES o EN). Soporta
 * nombres de varias palabras ("dióxido de carbono") y, si hay varios candidatos,
 * prefiere el match más largo/específico. Devuelve el id (fórmula) o null.
 */
export function matchProduct(transcript: string, products: ProductLexEntry[]): string | null {
  const hay = ` ${normalizeWords(transcript)} `;
  let bestId: string | null = null;
  let bestLen = 0;
  for (const p of products) {
    for (const name of p.names) {
      const needle = normalizeWords(name);
      if (needle && hay.includes(` ${needle} `) && needle.length > bestLen) {
        bestId = p.id;
        bestLen = needle.length;
      }
    }
  }
  return bestId;
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
  if (base === 'it') return 'it-IT';
  if (base === 'pt') return 'pt-BR';
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

/** Lo que el jugador puede pedir por voz. */
export interface VoiceHandlers {
  /** Nombró un átomo. */
  onElement?: (s: ElementSymbol) => void;
  /** Dio una orden (mezclar, vaciar, depositar…). */
  onCommand?: (c: VoiceCommand) => void;
  /** Invocó un producto ya descubierto (devuelve su fórmula/id). */
  onProduct?: (id: string) => void;
  /** Productos invocables ahora mismo (cambia a medida que se descubren). */
  getProducts?: () => ProductLexEntry[];
}

export class VoiceRecognizer {
  private rec: SpeechRecognitionLike | null = null;
  private running = false;
  private lastKey: string | null = null;
  private lastAt = 0;

  /** ¿El navegador soporta reconocimiento de voz? */
  static get supported(): boolean {
    return getCtor() !== null;
  }

  /**
   * Empieza a escuchar y despacha intents al handler que corresponda. La
   * precedencia es: orden ("mezclar") > producto descubierto > elemento.
   * Devuelve false si no hay soporte o no pudo arrancar.
   *
   * `lang` define el locale del ASR; el juego es español-first, así que se le
   * pasa un locale español para transcribir bien "hidrógeno"/"mezclar".
   */
  start(handlers: VoiceHandlers, lang = defaultLang()): boolean {
    const Ctor = getCtor();
    if (!Ctor) return false;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechEventLike) => {
      const transcript = e.results[e.results.length - 1]?.[0]?.transcript ?? '';

      // Resolvemos el intent con precedencia y armamos una clave para el anti-rebote.
      let key: string | null = null;
      let fire: (() => void) | null = null;
      const command = matchCommand(transcript);
      if (command) {
        key = `cmd:${command}`;
        fire = () => handlers.onCommand?.(command);
      } else {
        const pid = handlers.getProducts ? matchProduct(transcript, handlers.getProducts()) : null;
        if (pid) {
          key = `prod:${pid}`;
          fire = () => handlers.onProduct?.(pid);
        } else {
          const sym = matchElement(transcript);
          if (sym) {
            key = `el:${sym}`;
            fire = () => handlers.onElement?.(sym);
          }
        }
      }
      if (!key || !fire) return;

      // Anti-rebote: los resultados intermedios disparan muchos eventos; no
      // repetimos el mismo intent en menos de 1.2 s.
      const now = performance.now();
      if (key === this.lastKey && now - this.lastAt < 1200) return;
      this.lastKey = key;
      this.lastAt = now;
      fire();
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
