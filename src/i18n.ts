/**
 * Internacionalización: textos de UI en los 4 idiomas soportados. Puro (sin DOM),
 * para poder testearlo y reusarlo desde el dominio. Los nombres de elementos y
 * moléculas viven en `chemistry.ts` (uno por idioma); acá solo el chrome de la UI.
 */

export type Lang = 'es' | 'en' | 'it' | 'pt';
export const LANGS: Lang[] = ['es', 'en', 'it', 'pt'];

/** Etiqueta corta para el selector de idioma. */
export const LANG_LABEL: Record<Lang, string> = { es: 'ES', en: 'EN', it: 'IT', pt: 'PT' };

/**
 * Banderas como SVG inline (simplificadas pero reconocibles). A diferencia del
 * emoji, se ven igual en todos los sistemas. Markup propio, seguro para innerHTML.
 */
export const LANG_FLAG_SVG: Record<Lang, string> = {
  es: '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="3" height="2" fill="#c60b1e"/><rect y="0.5" width="3" height="1" fill="#ffc400"/></svg>',
  en: '<svg viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#012169"/><path d="M0,0 60,30 M60,0 0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 60,30 M60,0 0,30" stroke="#c8102e" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/></svg>',
  it: '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="3" height="2" fill="#fff"/><rect width="1" height="2" fill="#009246"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  pt: '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#009b3a"/><polygon points="10,1.5 18.5,7 10,12.5 1.5,7" fill="#ffdf00"/><circle cx="10" cy="7" r="2.6" fill="#002776"/></svg>',
};

/** Nombre del idioma en su propia lengua (para que sea obvio, aunque la bandera no renderice). */
export const LANG_NAME: Record<Lang, string> = { es: 'Español', en: 'English', it: 'Italiano', pt: 'Português' };

export type UIKey =
  | 'title' | 'lead' | 'start' | 'privacy' | 'statusIdle' | 'statusWarmup' | 'statusReady'
  | 'statusCam' | 'statusErr' | 'statusErrPermission' | 'statusErrNoCamera' | 'statusErrModel'
  | 'cauldron' | 'cauldronHint' | 'mix' | 'empty' | 'inventory' | 'inventoryEmpty'
  | 'voiceHint' | 'emptyCauldron' | 'noReaction' | 'emptied' | 'freeHand'
  | 'nothingInHand' | 'handLeft' | 'handRight' | 'hands';

const STRINGS: Record<Lang, Record<UIKey, string>> = {
  es: {
    title: 'Cuenco de Alquimia',
    lead: 'Activá la cámara para jugar.',
    start: 'Activar cámara',
    privacy: '🔒 Corre en tu dispositivo · tu cámara nunca sale de acá',
    statusIdle: 'No se carga nada hasta que empieces.',
    statusWarmup: 'Preparando el modelo…',
    statusReady: '✨ Listo — tocá empezar',
    statusCam: 'Pidiendo la cámara…',
    statusErr: 'No se pudo acceder a la cámara. Revisá permisos y recargá.',
    statusErrPermission: 'Permiso de cámara denegado. Dale acceso y recargá.',
    statusErrNoCamera: 'No se encontró ninguna cámara en este dispositivo.',
    statusErrModel: 'No se pudo cargar el modelo de seguimiento de manos. Revisá tu conexión y recargá.',
    cauldron: '⚗ Cuenco',
    cauldronHint: 'acercá un átomo',
    mix: '✨ Mezclar',
    empty: '🗑 Vaciar',
    inventory: 'Inventario',
    inventoryEmpty: 'todavía no creaste nada — combiná átomos en el cuenco',
    voiceHint: 'decí: átomo · “echar” · “mezclar” · “vaciar”',
    emptyCauldron: 'Cuenco vacío',
    noReaction: 'No reacciona',
    emptied: 'Vaciado',
    freeHand: 'mostrá una mano libre',
    nothingInHand: 'Nada en',
    handLeft: 'la mano izquierda',
    handRight: 'la mano derecha',
    hands: 'tus manos',
  },
  en: {
    title: 'Alchemy Cauldron',
    lead: 'Enable your camera to play.',
    start: 'Enable camera',
    privacy: '🔒 Runs on your device · your camera never leaves it',
    statusIdle: 'Nothing loads until you start.',
    statusWarmup: 'Warming up the model…',
    statusReady: '✨ Ready — tap to start',
    statusCam: 'Requesting the camera…',
    statusErr: "Couldn't access the camera. Check permissions and reload.",
    statusErrPermission: 'Camera permission denied. Allow access and reload.',
    statusErrNoCamera: 'No camera found on this device.',
    statusErrModel: "Couldn't load the hand-tracking model. Check your connection and reload.",
    cauldron: '⚗ Cauldron',
    cauldronHint: 'bring an atom closer',
    mix: '✨ Mix',
    empty: '🗑 Empty',
    inventory: 'Inventory',
    inventoryEmpty: "you haven't made anything yet — combine atoms in the cauldron",
    voiceHint: 'say: atom · “drop” · “mix” · “empty”',
    emptyCauldron: 'Empty cauldron',
    noReaction: 'No reaction',
    emptied: 'Emptied',
    freeHand: 'show a free hand',
    nothingInHand: 'Nothing in',
    handLeft: 'the left hand',
    handRight: 'the right hand',
    hands: 'your hands',
  },
  it: {
    title: 'Calderone Alchemico',
    lead: 'Attiva la fotocamera per giocare.',
    start: 'Attiva fotocamera',
    privacy: '🔒 Gira sul tuo dispositivo · la fotocamera non esce mai da qui',
    statusIdle: 'Non si carica niente finché non inizi.',
    statusWarmup: 'Preparazione del modello…',
    statusReady: '✨ Pronto — tocca per iniziare',
    statusCam: 'Richiesta della fotocamera…',
    statusErr: "Impossibile accedere alla fotocamera. Controlla i permessi e ricarica.",
    statusErrPermission: "Permesso fotocamera negato. Consenti l'accesso e ricarica.",
    statusErrNoCamera: 'Nessuna fotocamera trovata su questo dispositivo.',
    statusErrModel: 'Impossibile caricare il modello di tracciamento delle mani. Controlla la connessione e ricarica.',
    cauldron: '⚗ Calderone',
    cauldronHint: 'avvicina un atomo',
    mix: '✨ Mescola',
    empty: '🗑 Svuota',
    inventory: 'Inventario',
    inventoryEmpty: 'non hai ancora creato niente — combina atomi nel calderone',
    voiceHint: 'dì: atomo · “metti” · “mescola” · “svuota”',
    emptyCauldron: 'Calderone vuoto',
    noReaction: 'Nessuna reazione',
    emptied: 'Svuotato',
    freeHand: 'mostra una mano libera',
    nothingInHand: 'Niente in',
    handLeft: 'la mano sinistra',
    handRight: 'la mano destra',
    hands: 'le tue mani',
  },
  pt: {
    title: 'Caldeirão de Alquimia',
    lead: 'Ative a câmera para jogar.',
    start: 'Ativar câmera',
    privacy: '🔒 Roda no seu dispositivo · sua câmera nunca sai daqui',
    statusIdle: 'Nada carrega até você começar.',
    statusWarmup: 'Preparando o modelo…',
    statusReady: '✨ Pronto — toque para começar',
    statusCam: 'Pedindo a câmera…',
    statusErr: 'Não foi possível acessar a câmera. Verifique as permissões e recarregue.',
    statusErrPermission: 'Permissão de câmera negada. Permita o acesso e recarregue.',
    statusErrNoCamera: 'Nenhuma câmera encontrada neste dispositivo.',
    statusErrModel: 'Não foi possível carregar o modelo de rastreamento de mãos. Verifique sua conexão e recarregue.',
    cauldron: '⚗ Caldeirão',
    cauldronHint: 'aproxime um átomo',
    mix: '✨ Misturar',
    empty: '🗑 Esvaziar',
    inventory: 'Inventário',
    inventoryEmpty: 'você ainda não criou nada — combine átomos no caldeirão',
    voiceHint: 'diga: átomo · “jogar” · “misturar” · “esvaziar”',
    emptyCauldron: 'Caldeirão vazio',
    noReaction: 'Sem reação',
    emptied: 'Esvaziado',
    freeHand: 'mostre uma mão livre',
    nothingInHand: 'Nada em',
    handLeft: 'a mão esquerda',
    handRight: 'a mão direita',
    hands: 'suas mãos',
  },
};

/** Texto de UI para un idioma y clave. */
export function t(lang: Lang, key: UIKey): string {
  return STRINGS[lang][key];
}

/** Detecta el idioma soportado a partir de un tag BCP-47 (ej. "pt-BR" → "pt"). */
export function detectLang(raw: string | null | undefined): Lang {
  const base = (raw ?? '').trim().toLowerCase().split('-')[0];
  return (LANGS as string[]).includes(base) ? (base as Lang) : 'en';
}
