import './style.css';
import {
  brew,
  recipeText,
  findMolecule,
  isElement,
  ingredientLabel,
  localizedName,
  localizedDescription,
  allNames,
  ELEMENTS,
  MOLECULES,
  type ElementSymbol,
  type Molecule,
  type Cauldron,
  type IngredientId,
} from './chemistry';
import { HandTracker, resolveHandSlots, HAND_SLOTS, type Hand, type HandSlot } from './hands';
import { ParticleSystem } from './particles';
import { drawAtom, drawMolecule } from './structure';
import { Scene3D } from './render3d';
import { VoiceRecognizer, resolveLang, type ProductLexEntry, type VoiceCommand } from './voice';
import { createInventory } from './inventory';
import { t, LANGS, LANG_LABEL, LANG_FLAG_SVG, LANG_NAME, type Lang } from './i18n';
import { Layout, tileUnder, inRect, type Rect } from './layout';
import { startFailureKey } from './media-errors';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const DWELL_MS = 850;        // agarrar un átomo de la paleta
const DEPOSIT_MS = 320;      // soltar lo que sostenés dentro del cuenco
const MIX_DWELL_MS = 900;    // botón "Mezclar" por dwell
const CLEAR_DWELL_MS = 800;  // botón "Vaciar" por dwell
const SHELF_DWELL_MS = 750;  // sacar un producto del estante por dwell
const COOLDOWN_MS = 1200;    // entre mezclas
const MAX_COUNT = 6;
const MAX_FLOATING = 10;

// Idioma de la UI y del reconocimiento de voz. Por defecto inglés; el jugador lo
// cambia con el selector de banderas (visible siempre, también dentro del juego).
let lang: Lang = 'en';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const ctx = canvas.getContext('2d')!;
const scene3dCanvas = document.querySelector<HTMLCanvasElement>('#scene3d')!;
const scene3d = new Scene3D(scene3dCanvas);
// Si WebGL no está disponible, caemos al sprite 2D de siempre (structure.ts)
// en vez de dejar los ingredientes invisibles — ver Scene3D.available.
const use3D = scene3d.available;
const video = document.querySelector<HTMLVideoElement>('#cam')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const infoEl = document.querySelector<HTMLElement>('#info')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;

// Density del canvas: usamos el devicePixelRatio real, capeado a 2, para que el
// HUD (texto/vectores rasterizados directo en el canvas) no se vea borroso en
// pantallas HiDPI sin reventar el fill-rate en pantallas 3x.
const DPR = Math.min(window.devicePixelRatio || 1, 2);

// Geometría de la UI (paleta, cuenco, botones, estante): extraída a layout.ts
// (ver Layout ahí para el porqué del cacheo por-resize). `liquidGradientCache`
// se queda acá: depende de `ctx` (2D), es un detalle de render, no de geometría.
const layout = new Layout(DPR);
let liquidGradientCache: CanvasGradient | null = null;

function resize() {
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  // scene3d comparte el mismo sistema de coordenadas (device px) que #stage,
  // así los cx/cy/scale que ya calcula el layout 2D sirven sin conversión.
  scene3d.resize(canvas.width, canvas.height);
  layout.resize(canvas.width, canvas.height);
  liquidGradientCache = null;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Precarga del modelo (perezosa: recién en la primera intención del usuario)
// ---------------------------------------------------------------------------
const tracker = new HandTracker();
let modelReady: Promise<boolean> | null = null;

function preloadModel(): Promise<boolean> {
  if (!modelReady) {
    statusEl.textContent = t(lang, 'statusWarmup');
    modelReady = tracker.init().then(
      () => { statusEl.textContent = t(lang, 'statusReady'); return true; },
      (err) => { console.error(err); statusEl.textContent = t(lang, 'statusErr'); return false; },
    );
  }
  return modelReady;
}

// Disparadores de intención: el primero gana (preloadModel es idempotente).
startBtn.addEventListener('pointerenter', preloadModel, { once: true });
startBtn.addEventListener('pointerdown', preloadModel, { once: true });
startBtn.addEventListener('focus', preloadModel, { once: true });

// ---------------------------------------------------------------------------
// Selector de idioma (overlay): cambia el HUD y el locale del reconocedor de voz
// ---------------------------------------------------------------------------
const langsEl = document.querySelector<HTMLDivElement>('#langs');       // overlay: bandera + nombre
const langbarEl = document.querySelector<HTMLDivElement>('#langbar');   // persistente in-game: bandera + código
const titleEl = document.querySelector<HTMLHeadingElement>('#title');
const leadEl = document.querySelector<HTMLParagraphElement>('.lead');
const privacyEl = document.querySelector<HTMLParagraphElement>('.privacy');

/** Aplica un idioma: textos del overlay, botones y —si ya se está jugando— la voz. */
function applyLang(l: Lang) {
  const changed = l !== lang;
  lang = l;
  document.documentElement.lang = l;
  if (titleEl) titleEl.textContent = t(l, 'title');
  if (leadEl) leadEl.textContent = t(l, 'lead');
  startBtn.textContent = t(l, 'start');
  if (privacyEl) privacyEl.textContent = t(l, 'privacy');
  // El status solo se pisa si seguimos en la pantalla idle (sin warmup en curso).
  if (!running && !modelReady) statusEl.textContent = t(l, 'statusIdle');
  renderLangButtons();
  // En vivo, reiniciamos el reconocedor para que escuche en el nuevo idioma.
  if (changed && running && voiceListening) restartVoice();
}

function makeLangButton(l: Lang, full: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'lang' + (l === lang ? ' active' : '');
  b.setAttribute('aria-pressed', String(l === lang));
  // Bandera SVG (markup propio, seguro) + nombre nativo o código.
  b.innerHTML = `<span class="flag">${LANG_FLAG_SVG[l]}</span><span class="lang-name">${full ? LANG_NAME[l] : LANG_LABEL[l]}</span>`;
  b.addEventListener('click', () => applyLang(l));
  return b;
}

function renderLangButtons() {
  if (langsEl) langsEl.replaceChildren(...LANGS.map((l) => makeLangButton(l, true)));
  if (langbarEl) langbarEl.replaceChildren(...LANGS.map((l) => makeLangButton(l, false)));
}

// La pintada inicial del overlay (applyLang) se hace al final del módulo, una vez
// declarado todo el estado (`running`, voz, etc.) que applyLang puede leer.

// ---------------------------------------------------------------------------
// Estado de juego
// ---------------------------------------------------------------------------
let running = false;

interface HandState {
  present: boolean; x: number; y: number;
  /** Lo que sostiene la mano: átomo o producto descubierto (o nada). */
  held: IngredientId | null; count: number;
  /** Progreso de dwell sobre un tile de la paleta. */
  dwellSymbol: ElementSymbol | null; dwellMs: number;
  /** Progreso de dwell para depositar en el cuenco. */
  depositMs: number;
  /** Progreso de dwell sobre el botón Mezclar. */
  mixMs: number;
  /** Progreso de dwell sobre el botón Vaciar. */
  clearMs: number;
  /** Producto del estante sobre el que se está haciendo dwell (o null). */
  shelfId: IngredientId | null; shelfMs: number;
}
const makeHand = (): HandState => ({
  present: false, x: 0, y: 0, held: null, count: 0,
  dwellSymbol: null, dwellMs: 0, depositMs: 0, mixMs: 0, clearMs: 0,
  shelfId: null, shelfMs: 0,
});
// `SlotName`/`SLOTS` son un alias local de `HandSlot`/`HAND_SLOTS` (hands.ts):
// acá se usan para el estado de JUEGO por mano (dwell, held...), no el tracking.
type SlotName = HandSlot;
const SLOTS = HAND_SLOTS;
const hands: Record<SlotName, HandState> = { Left: makeHand(), Right: makeHand() };

// El cuenco de alquimia: multiset de ingredientes acumulados (átomos y/o productos).
const contents: Cauldron = {};
// Cache de los ids con cantidad > 0. `contents` solo cambia en deposit/clear, así
// que en vez de recorrer Object.keys(...).filter(...) ~3×/frame lo derivamos una
// vez por cambio. Se invalida con invalidateCauldron().
let cauldronIdsCache: string[] | null = null;
function invalidateCauldron() { cauldronIdsCache = null; }
function cauldronIds(): string[] {
  return (cauldronIdsCache ??= Object.keys(contents).filter((k) => (contents[k] ?? 0) > 0));
}

// Snapshot del inventario (inventory.list() copia el array interno). Solo cambia
// en un `mezclar` exitoso (inventory.add); lo cacheamos para no copiar por frame.
let invListCache: string[] | null = null;
function invList(): string[] { return (invListCache ??= inventory.list()); }
function invalidateInventory() { invListCache = null; layout.invalidateShelf(); }

// Moléculas levitando tras una mezcla exitosa. Posiciones en fracciones del canvas.
interface Floating { molecule: Molecule; x: number; y: number; vx: number; vy: number; rot: number; rotVel: number; }
const floating: Floating[] = [];

// Texto efímero (nombre del producto / "No reacciona").
interface Toast { text: string; color: string; x: number; y: number; age: number; }
const toasts: Toast[] = [];

// Inventario persistente de productos descubiertos (fórmulas).
const inventory = createInventory();

let cooldown = 0;

const particles = new ParticleSystem();
let audioCtx: AudioContext | null = null;
let infoTimer: ReturnType<typeof setTimeout> | undefined;

// Voz: nombrar un átomo lo trae a la mano; decir "mezclar" cocina el cuenco.
const voice = new VoiceRecognizer();
let voiceListening = false;

/** Arranca la escucha de voz en el idioma actual. Devuelve si quedó activa. */
function startVoice(): boolean {
  return VoiceRecognizer.supported && voice.start({
    onElement: giveIngredient,
    onProduct: giveIngredient,
    onCommand: handleVoiceCommand,
    getProducts: productLexicon,
  }, resolveLang(lang));
}

/** Reinicia la voz (al cambiar de idioma en vivo) para escuchar en el nuevo locale. */
function restartVoice() {
  voice.stop();
  voiceListening = startVoice();
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
startBtn.addEventListener('click', () => start());

let camStream: MediaStream | null = null;

/**
 * Pide cámara y —si el navegador soporta voz— micrófono en UN SOLO prompt, para
 * no encadenar dos permisos (cámara y después el del reconocimiento de voz). Si
 * el micrófono no está disponible/permitido, reintenta solo con la cámara: el
 * juego sigue funcionando por gestos.
 */
async function requestMedia(): Promise<MediaStream> {
  const video = { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } };
  const wantsMic = VoiceRecognizer.supported;
  try {
    return await navigator.mediaDevices.getUserMedia({ video, audio: wantsMic });
  } catch (err) {
    if (!wantsMic) throw err;
    return await navigator.mediaDevices.getUserMedia({ video, audio: false });
  }
}

async function start() {
  startBtn.disabled = true;
  try {
    statusEl.textContent = t(lang, 'statusCam');
    const stream = await requestMedia();
    camStream = stream;
    // Solo el video alimenta el tracking; el track de audio (si lo hay) queda
    // abierto únicamente para que el reconocimiento de voz reuse el permiso.
    video.srcObject = stream;
    await video.play();

    const ok = await preloadModel();
    if (!ok) throw new Error('MODEL_NOT_READY');

    audioCtx = new AudioContext();
    resetGame();
    overlay.classList.add('hidden');
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);

    // Escucha de voz (el permiso de micrófono ya se pidió junto al de cámara).
    voiceListening = startVoice();
  } catch (err) {
    console.error(err);
    stopCamera();
    statusEl.textContent = t(lang, startFailureKey(err));
    statusEl.classList.add('error');
    startBtn.disabled = false;
  }
}

/** Apaga la cámara: detiene todas las pistas del stream y lo descarta. */
function stopCamera() {
  if (camStream) {
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
  }
  video.srcObject = null;
}

/** Teardown global: no deja cámara, micrófono, worker ni audio vivos. */
function teardown() {
  running = false;
  stopCamera();
  voice.stop();
  voiceListening = false;
  tracker.dispose();
  if (audioCtx) { audioCtx.close().catch(() => { /* ya cerrado */ }); audioCtx = null; }
}
window.addEventListener('pagehide', teardown);

function resetGame() {
  floating.length = 0;
  toasts.length = 0;
  for (const k of Object.keys(contents)) delete contents[k];
  invalidateCauldron();
  cooldown = 0;
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let lastTime = 0;

const SHOW_PERF = import.meta.env.DEV;
let perfFps = 60;
let perfFrameMs = 0;
let perfDetectHz = 0;
let perfLastResultCount = 0;
let perfHzAccum = 0;

function loop(now: number) {
  if (!running) return;
  const dtMs = Math.min(now - lastTime, 100);
  const dt = dtMs / 1000;
  lastTime = now;
  const time = now / 1000;
  const bodyStart = performance.now();

  if (video.readyState >= 2) tracker.pump(video, now);
  syncHands(tracker.hands);

  updateInteraction(dtMs);
  updateFloating(dt);
  updateToasts(dtMs);
  particles.update(dt);
  if (cooldown > 0) cooldown = Math.max(0, cooldown - dtMs);

  render(time);

  if (SHOW_PERF) {
    perfFps += ((1000 / Math.max(1, dtMs)) - perfFps) * 0.08;
    perfFrameMs += ((performance.now() - bodyStart) - perfFrameMs) * 0.08;
    perfHzAccum += dtMs;
    if (perfHzAccum >= 500) {
      perfDetectHz = (tracker.resultCount - perfLastResultCount) * (1000 / perfHzAccum);
      perfLastResultCount = tracker.resultCount;
      perfHzAccum = 0;
    }
    drawPerfHud();
  }

  requestAnimationFrame(loop);
}

function drawPerfHud() {
  const pad = 10 * DPR;
  ctx.save();
  ctx.font = `600 ${13 * DPR}px ui-monospace, monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const text = `${perfFps.toFixed(0)} fps · frame ${perfFrameMs.toFixed(1)}ms · detect ${perfDetectHz.toFixed(0)}Hz`;
  const w = ctx.measureText(text).width + pad * 2;
  const y = canvas.height - 28 * DPR - pad;
  ctx.fillStyle = 'rgba(2, 6, 23, 0.7)';
  ctx.fillRect(pad, y, w, 24 * DPR);
  ctx.fillStyle = perfFps < 40 ? '#f87171' : perfFps < 55 ? '#fbbf24' : '#4ade80';
  ctx.fillText(text, pad * 2, y + 5 * DPR);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tracking → slots
// ---------------------------------------------------------------------------
// La resolución de qué mano detectada va a cuál slot (Left/Right) y su punta de
// índice en pixels vive en hands.ts (resolveHandSlots): es tracking puro, no
// estado de juego. Acá solo se vuelca ese resultado sobre `hands` y se resetea
// el dwell de la mano que dejó de estar presente.
function syncHands(detected: Hand[]) {
  const resolved = resolveHandSlots(detected, canvas.width, canvas.height);
  for (const name of SLOTS) {
    const slot = resolved[name];
    const st = hands[name];
    st.present = slot.present;
    if (slot.present) { st.x = slot.x; st.y = slot.y; }
    else resetDwell(st);
  }
}

function resetDwell(st: HandState) {
  st.dwellSymbol = null; st.dwellMs = 0; st.depositMs = 0; st.mixMs = 0; st.clearMs = 0;
  st.shelfId = null; st.shelfMs = 0;
}


// ---------------------------------------------------------------------------
// Interacción
// ---------------------------------------------------------------------------
function updateInteraction(dtMs: number) {
  const tiles = layout.tiles();
  const c = layout.cauldron();
  const mix = layout.mixButton();
  const clr = layout.clearButton();
  const shelf = layout.shelf(invList());

  for (const name of SLOTS) {
    const st = hands[name];
    if (!st.present) { resetDwell(st); continue; }

    // 0) Estante de inventario (abajo): sacar un producto a la mano por dwell.
    //    Solo si la mano está libre (si ya sostiene algo, no interrumpimos).
    if (!st.held) {
      const cellHit = shelf.find((cell) => inRect(st.x, st.y, cell));
      if (cellHit) {
        st.dwellSymbol = null; st.dwellMs = 0; st.depositMs = 0; st.mixMs = 0; st.clearMs = 0;
        if (st.shelfId === cellHit.formula) {
          st.shelfMs += dtMs;
          if (st.shelfMs >= SHELF_DWELL_MS) { st.shelfMs = 0; giveIngredient(cellHit.formula); }
        } else { st.shelfId = cellHit.formula; st.shelfMs = 0; }
        continue;
      }
    }
    st.shelfId = null; st.shelfMs = 0;

    // 1) Paleta de átomos (arriba): agarrar/stackear por dwell.
    const over = tileUnder(st.x, st.y, tiles);
    if (over) {
      st.depositMs = 0; st.mixMs = 0; st.clearMs = 0;
      if (st.dwellSymbol === over.symbol) {
        st.dwellMs += dtMs;
        if (st.dwellMs >= DWELL_MS) {
          st.dwellMs = 0;
          if (st.held === over.symbol) st.count = Math.min(MAX_COUNT, st.count + 1);
          else { st.held = over.symbol; st.count = 1; }
        }
      } else { st.dwellSymbol = over.symbol; st.dwellMs = 0; }
      continue;
    }
    st.dwellSymbol = null; st.dwellMs = 0;

    // 2) Botón Mezclar (dwell). Solo cuenta si hay algo para mezclar y no estamos
    //    en cooldown; si no, el botón se comporta como deshabilitado (sin spam).
    if (inRect(st.x, st.y, mix)) {
      st.depositMs = 0; st.clearMs = 0;
      if (cauldronHasContents() && cooldown === 0) {
        st.mixMs += dtMs;
        if (st.mixMs >= MIX_DWELL_MS) { st.mixMs = 0; mezclar(); }
      } else { st.mixMs = 0; }
      continue;
    }
    st.mixMs = 0;

    // 3) Botón Vaciar (dwell).
    if (inRect(st.x, st.y, clr)) {
      st.depositMs = 0;
      st.clearMs += dtMs;
      if (st.clearMs >= CLEAR_DWELL_MS) { st.clearMs = 0; clearCauldron(); }
      continue;
    }
    st.clearMs = 0;

    // 4) Cuenco: si la mano sostiene algo y lo mete adentro, lo deposita.
    if (st.held && Math.hypot(st.x - c.cx, st.y - c.cy) <= c.r * 1.04) {
      st.depositMs += dtMs;
      if (st.depositMs >= DEPOSIT_MS) { st.depositMs = 0; deposit(st); }
      continue;
    }
    st.depositMs = 0;
  }
}

/** Mete lo que sostiene la mano en el cuenco y la deja libre. */
function deposit(st: HandState) {
  if (!st.held || st.count <= 0) return;
  const c = layout.cauldron();
  contents[st.held] = (contents[st.held] ?? 0) + st.count;
  invalidateCauldron(); // `contents` cambió → recalcular ids cacheados
  const color = isElement(st.held) ? ELEMENTS[st.held].color : findMolecule(st.held)?.color ?? '#a78bfa';
  particles.burst(c.cx, c.cy, color, 30, 280 * DPR);
  playChime(true);
  st.held = null; st.count = 0;
}

/** ¿El cuenco tiene al menos un ingrediente? */
function cauldronHasContents(): boolean {
  return cauldronIds().length > 0;
}

/**
 * Resuelve el cuenco con lo que tiene adentro. Los guards viven acá (no en el
 * call-site) para que las dos vías de disparo —dwell del botón y voz "mezclar"—
 * respeten el mismo cooldown y el mismo "no mezclar vacío".
 */
function mezclar() {
  if (cooldown !== 0) return;
  const c = layout.cauldron();
  if (!cauldronHasContents()) {
    pushToast(t(lang, 'emptyCauldron'), '#94a3b8', c.cx, c.cy);
    return;
  }
  cooldown = COOLDOWN_MS;
  const product = brew(contents);

  if (!product) {
    particles.burst(c.cx, c.cy, '#64748b', 50, 320 * DPR);
    pushToast(t(lang, 'noReaction'), '#94a3b8', c.cx, c.cy);
    playChime(false);
    return; // conservamos el contenido para que puedas ajustar
  }

  particles.burst(c.cx, c.cy, product.color, 180, 660 * DPR);
  playChime(true);
  spawnFloating(product, c.cx / canvas.width, (c.cy - c.r * 0.8) / canvas.height);
  const isNew = inventory.add(product.formula);
  if (isNew) invalidateInventory(); // el estante/lexicon cacheados cambiaron
  pushToast(`${localizedName(product, lang)}${isNew ? ' ✦' : ''}`, product.color, c.cx, c.cy - c.r * 0.6);
  clearContents();
  showInfo(product, isNew);
}

/** Vacía el cuenco con feedback (botón Vaciar). */
function clearCauldron() {
  if (!cauldronHasContents()) return;
  const c = layout.cauldron();
  particles.burst(c.cx, c.cy, '#94a3b8', 24, 240 * DPR);
  pushToast(t(lang, 'emptied'), '#94a3b8', c.cx, c.cy);
  clearContents();
  playChime(false);
}

/** Despacha una orden de voz a la acción correspondiente. */
function handleVoiceCommand(c: VoiceCommand) {
  if (c === 'mix') mezclar();
  else if (c === 'clear') clearCauldron();
  else if (c === 'deposit') depositByVoice('any');
  else if (c === 'deposit-left') depositByVoice('Left');
  else if (c === 'deposit-right') depositByVoice('Right');
}

/**
 * Deposita por voz lo que sostiene una mano (o cualquiera) en el cuenco, sin
 * tener que acercarla físicamente. `'any'` vacía las dos manos que tengan algo.
 */
function depositByVoice(which: SlotName | 'any') {
  const slots: SlotName[] = which === 'any' ? ['Right', 'Left'] : [which];
  let did = false;
  for (const n of slots) {
    const st = hands[n];
    if (st.held && st.count > 0) { deposit(st); did = true; }
  }
  if (!did) {
    const where = which === 'Left' ? t(lang, 'handLeft') : which === 'Right' ? t(lang, 'handRight') : t(lang, 'hands');
    pushToast(`${t(lang, 'nothingInHand')} ${where}`, '#94a3b8', canvas.width / 2, canvas.height * 0.42);
  }
}

function clearContents() {
  for (const k of Object.keys(contents)) delete contents[k];
  invalidateCauldron();
}

function pushToast(text: string, color: string, px: number, py: number) {
  toasts.push({ text, color, x: px / canvas.width, y: py / canvas.height, age: 0 });
}

// ---------------------------------------------------------------------------
// Traer un ingrediente a la mano (voz o estante)
// ---------------------------------------------------------------------------
/**
 * Pone `id` (átomo o producto descubierto) en una mano libre presente, o suma
 * una unidad si una mano ya lo sostiene. Sirve para la voz y para el estante.
 */
function giveIngredient(id: IngredientId) {
  const color = ingredientColor(id);
  const label = isElement(id) ? ELEMENTS[id].symbol : id;
  const order: SlotName[] = ['Right', 'Left'];
  for (const n of order) {
    const st = hands[n];
    if (st.present && st.held === id) {
      st.count = Math.min(MAX_COUNT, st.count + 1);
      ingredientFeedback(st, color, label);
      return;
    }
  }
  for (const n of order) {
    const st = hands[n];
    if (st.present && st.held === null) {
      st.held = id;
      st.count = 1;
      ingredientFeedback(st, color, label);
      return;
    }
  }
  pushToast(`${label} — ${t(lang, 'freeHand')}`, color, canvas.width / 2, canvas.height * 0.42);
}

function ingredientFeedback(st: HandState, color: string, label: string) {
  particles.burst(st.x, st.y - 40 * DPR, color, 26, 240 * DPR);
  pushToast(label, color, st.x, st.y - 96 * DPR);
  playChime(true);
}

/** Productos invocables por voz ahora: solo los ya descubiertos (nombres en 4 idiomas). */
function productLexicon(): ProductLexEntry[] {
  const out: ProductLexEntry[] = [];
  for (const formula of invList()) {
    const m = findMolecule(formula);
    if (m) out.push({ id: formula, names: allNames(m) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Levitación
// ---------------------------------------------------------------------------
function spawnFloating(molecule: Molecule, fx: number, fy: number) {
  floating.push({
    molecule, x: fx, y: fy,
    vx: (Math.random() - 0.5) * 0.04,
    vy: -0.03 - Math.random() * 0.02,
    rot: (Math.random() - 0.5) * 0.3,
    rotVel: (Math.random() - 0.5) * 0.4,
  });
  if (floating.length > MAX_FLOATING) floating.shift();
}

function updateFloating(dt: number) {
  for (const f of floating) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.rot += f.rotVel * dt;
    if (f.x < 0.07) { f.x = 0.07; f.vx = Math.abs(f.vx); }
    if (f.x > 0.93) { f.x = 0.93; f.vx = -Math.abs(f.vx); }
    if (f.y < 0.14) { f.y = 0.14; f.vy = Math.abs(f.vy); }
    if (f.y > 0.7) { f.y = 0.7; f.vy = -Math.abs(f.vy); }
  }
}

function updateToasts(dtMs: number) {
  for (const t of toasts) { t.age += dtMs; t.y -= 0.00006 * dtMs; }
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].age > 1500) toasts.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Panel de info
// ---------------------------------------------------------------------------
function showInfo(m: Molecule, isNew: boolean) {
  const elems = (Object.keys(m.composition) as ElementSymbol[])
    .filter((s) => (m.composition[s] ?? 0) > 0)
    .map((s) => {
      const el = ELEMENTS[s];
      return `<li><b style="color:${el.color}">${el.symbol}</b> ${localizedName(el, lang)} · Z=${el.atomicNumber} · ×${m.composition[s]}</li>`;
    })
    .join('');
  infoEl.innerHTML = `
    <div class="info-head" style="--accent:${m.color}">
      <span class="info-formula">${m.formula}</span>
      <span class="info-name">${localizedName(m, lang)}${isNew ? ' ✦' : ''}</span>
    </div>
    <p class="info-desc">${localizedDescription(m, lang)}</p>
    <div class="info-recipe">${recipeText(m.composition)}</div>
    <ul class="info-elements">${elems}</ul>`;
  infoEl.classList.remove('hidden');
  clearTimeout(infoTimer);
  infoTimer = setTimeout(() => infoEl.classList.add('hidden'), 7000);
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
function playChime(success: boolean) {
  if (!audioCtx) return;
  const notes = success ? [523.25, 659.25, 783.99] : [160, 120];
  notes.forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = success ? 'triangle' : 'sawtooth';
    osc.frequency.value = freq;
    const t0 = audioCtx!.currentTime + i * 0.07;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.connect(gain).connect(audioCtx!.destination);
    osc.start(t0); osc.stop(t0 + 0.4);
  });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(time: number) {
  if (use3D) scene3d.beginFrame();
  drawVideoMirrored();
  drawCauldron(time);
  drawFloating();
  drawPalette(time);
  drawMixButton();
  drawClearButton();
  drawShelf(time);
  drawVoiceHint();
  for (const name of SLOTS) drawHand(hands[name], time);
  particles.draw(ctx);
  drawToasts();
  if (use3D) scene3d.endFrame();
}

function drawVideoMirrored() {
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.fillStyle = 'rgba(5, 6, 10, 0.42)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** Dibuja un ingrediente (átomo o producto) centrado en (x,y). */
function drawIngredient(x: number, y: number, scale: number, id: IngredientId, time: number) {
  if (isElement(id)) {
    if (use3D) scene3d.atom(x, y, scale, id, time); else drawAtom(ctx, x, y, scale, id, time);
    return;
  }
  const m = findMolecule(id);
  if (!m) return;
  if (use3D) scene3d.molecule(x, y, scale, m, time * 0.35); else drawMolecule(ctx, x, y, scale, m);
}

/** Color representativo de un ingrediente. */
function ingredientColor(id: IngredientId): string {
  return isElement(id) ? ELEMENTS[id].color : findMolecule(id)?.color ?? '#a78bfa';
}

function drawCauldron(time: number) {
  const { cx, cy, r } = layout.cauldron();
  const ids = cauldronIds();
  const filled = ids.length > 0;

  // Halo exterior pulsante.
  const pulse = 1 + Math.sin(time * 1.8) * 0.03;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.5 * pulse);
  glow.addColorStop(0, filled ? 'rgba(167,139,250,0.30)' : 'rgba(99,102,241,0.16)');
  glow.addColorStop(1, 'rgba(15,23,42,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // "Líquido" del cuenco. El gradiente solo depende de la geometría (cx,cy,r), así
  // que lo construimos una vez y lo reusamos hasta el próximo resize.
  if (!liquidGradientCache) {
    const g = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(49, 46, 90, 0.92)');
    g.addColorStop(1, 'rgba(12, 14, 30, 0.92)');
    liquidGradientCache = g;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = liquidGradientCache;
  ctx.fill();

  // Borde del cuenco.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 4 * DPR;
  ctx.strokeStyle = filled ? 'rgba(196,181,253,0.95)' : 'rgba(129,140,248,0.7)';
  ctx.stroke();

  if (!filled) {
    ctx.fillStyle = 'rgba(214,222,235,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.min(r * 0.16, 26 * DPR)}px system-ui, sans-serif`;
    ctx.fillText(t(lang, 'cauldron'), cx, cy - r * 0.08);
    ctx.fillStyle = 'rgba(186,200,220,0.95)';
    ctx.font = `500 ${Math.min(r * 0.1, 15 * DPR)}px system-ui, sans-serif`;
    ctx.fillText(t(lang, 'cauldronHint'), cx, cy + r * 0.16);
    return;
  }

  // Ingredientes acumulados, en anillo dentro del cuenco.
  const ringR = r * 0.52;
  const step = (Math.PI * 2) / ids.length;
  ids.forEach((id, i) => {
    const a = -Math.PI / 2 + i * step + time * 0.25;
    const ix = cx + Math.cos(a) * ringR;
    const iy = cy + Math.sin(a) * ringR;
    const s = Math.min(r * 0.2, 34 * DPR);
    drawIngredient(ix, iy, s, id, time);
    // Badge de cantidad.
    const n = contents[id] ?? 0;
    if (n > 1) {
      const bx = ix + s * 0.9, by = iy - s * 0.9;
      ctx.beginPath();
      ctx.arc(bx, by, 13 * DPR, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.lineWidth = 2 * DPR; ctx.strokeStyle = ingredientColor(id); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${15 * DPR}px system-ui, sans-serif`;
      ctx.fillText(`×${n}`, bx, by);
    }
  });

  // Etiqueta de receta en el centro.
  const label = ids.map((id) => `${(contents[id] ?? 0) > 1 ? `${contents[id]} ` : ''}${ingredientLabel(id, lang)}`).join(' + ');
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.min(r * 0.1, 14 * DPR)}px system-ui, sans-serif`;
  wrapText(label, cx, cy, r * 1.7, Math.min(r * 0.13, 18 * DPR));
}

/** Dibuja texto centrado, partido en líneas para no exceder maxWidth. */
function wrapText(text: string, cx: number, cy: number, maxWidth: number, lineH: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineH));
}

function drawButton(rect: Rect, label: string, accent: string, progress: number, enabled: boolean) {
  roundRect(rect.x, rect.y, rect.w, rect.h, 14 * DPR);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.62)';
  ctx.fill();
  if (progress > 0) {
    ctx.save();
    roundRect(rect.x, rect.y, rect.w, rect.h, 14 * DPR);
    ctx.clip();
    ctx.fillStyle = accent + '33';
    ctx.fillRect(rect.x, rect.y, rect.w * Math.min(1, progress), rect.h);
    ctx.restore();
  }
  roundRect(rect.x, rect.y, rect.w, rect.h, 14 * DPR);
  ctx.lineWidth = 2 * DPR;
  ctx.strokeStyle = enabled ? accent : 'rgba(148,163,184,0.5)';
  ctx.stroke();
  ctx.fillStyle = enabled ? '#e5e7eb' : 'rgba(148,163,184,0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${20 * DPR}px system-ui, sans-serif`;
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawMixButton() {
  const rect = layout.mixButton();
  const progress = Math.max(hands.Left.mixMs, hands.Right.mixMs) / MIX_DWELL_MS;
  drawButton(rect, t(lang, 'mix'), '#fbbf24', progress, cauldronHasContents() && cooldown === 0);
}

function drawClearButton() {
  const rect = layout.clearButton();
  const progress = Math.max(hands.Left.clearMs, hands.Right.clearMs) / CLEAR_DWELL_MS;
  drawButton(rect, t(lang, 'empty'), '#f87171', progress, cauldronHasContents());
}

function drawFloating() {
  for (const f of floating) {
    const cx = f.x * canvas.width;
    const cy = f.y * canvas.height;
    const scale = 40 * DPR;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = f.molecule.color + '22';
    ctx.fill();
    if (use3D) scene3d.molecule(cx, cy, scale, f.molecule, f.rot);
    else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(f.rot);
      drawMolecule(ctx, 0, 0, scale, f.molecule);
      ctx.restore();
    }
    ctx.fillStyle = f.molecule.color;
    ctx.textAlign = 'center';
    ctx.font = `700 ${16 * DPR}px system-ui, sans-serif`;
    ctx.fillText(f.molecule.formula, cx, cy + scale * 1.8);
  }
}

function drawPalette(time: number) {
  const tiles = layout.tiles();
  for (const t of tiles) {
    const el = ELEMENTS[t.symbol];
    roundRect(t.x, t.y, t.size, t.size, t.size * 0.18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2 * DPR;
    ctx.strokeStyle = el.color;
    ctx.stroke();
    const acx = t.x + t.size / 2;
    const acy = t.y + t.size * 0.42;
    const ar = t.size * 0.3;
    if (use3D) scene3d.atom(acx, acy, ar, t.symbol, time); else drawAtom(ctx, acx, acy, ar, t.symbol, time);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${t.size * 0.13}px system-ui, sans-serif`;
    ctx.fillText(localizedName(el, lang), t.x + t.size / 2, t.y + t.size * 0.88);
  }
  // Anillo de progreso de dwell sobre el tile en foco.
  for (const name of SLOTS) {
    const st = hands[name];
    if (!st.present || !st.dwellSymbol || st.dwellMs <= 0) continue;
    const t = tiles.find((x) => x.symbol === st.dwellSymbol);
    if (!t) continue;
    const p = Math.min(1, st.dwellMs / DWELL_MS);
    ctx.beginPath();
    ctx.arc(t.x + t.size / 2, t.y + t.size / 2, t.size * 0.6, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.lineWidth = 5 * DPR;
    ctx.strokeStyle = ELEMENTS[st.dwellSymbol].color;
    ctx.stroke();
  }
}

/**
 * Estante de productos descubiertos (abajo-izquierda). Es interactivo: hacés
 * dwell con una mano libre sobre una celda para sacar ese producto a la mano y
 * volver a usarlo (en el cuenco o como ingrediente de otra receta).
 */
function drawShelf(time: number) {
  const total = invList().length;
  const pad = 16 * DPR;
  const cells = layout.shelf(invList());
  const labelY = (cells[0]?.y ?? canvas.height - 86 * DPR) - 18 * DPR;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  ctx.font = `700 ${14 * DPR}px system-ui, sans-serif`;
  ctx.fillText(`${t(lang, 'inventory')} (${total})`, pad, labelY);

  if (cells.length === 0) {
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = `500 ${13 * DPR}px system-ui, sans-serif`;
    ctx.fillText(t(lang, 'inventoryEmpty'), pad, labelY + 22 * DPR);
    return;
  }

  for (const cell of cells) {
    const m = findMolecule(cell.formula);
    if (!m) continue;
    roundRect(cell.x, cell.y, cell.w, cell.h, 12 * DPR);
    ctx.fillStyle = 'rgba(15,23,42,0.58)';
    ctx.fill();
    ctx.lineWidth = 2 * DPR;
    ctx.strokeStyle = m.color + 'aa';
    ctx.stroke();
    const mcx = cell.x + cell.w / 2;
    const mcy = cell.y + cell.h * 0.4;
    const mscale = cell.w * 0.2;
    if (use3D) scene3d.molecule(mcx, mcy, mscale, m, time * 0.35); else drawMolecule(ctx, mcx, mcy, mscale, m);
    ctx.fillStyle = m.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${12 * DPR}px system-ui, sans-serif`;
    ctx.fillText(m.formula, cell.x + cell.w / 2, cell.y + cell.h * 0.84);
  }

  // Anillo de progreso de dwell sobre la celda en foco.
  for (const name of SLOTS) {
    const st = hands[name];
    if (!st.present || !st.shelfId || st.shelfMs <= 0) continue;
    const cell = cells.find((c) => c.formula === st.shelfId);
    if (!cell) continue;
    const p = Math.min(1, st.shelfMs / SHELF_DWELL_MS);
    ctx.beginPath();
    ctx.arc(cell.x + cell.w / 2, cell.y + cell.h / 2, cell.w * 0.62, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.lineWidth = 4 * DPR;
    ctx.strokeStyle = findMolecule(st.shelfId)?.color ?? '#c4b5fd';
    ctx.stroke();
  }
}

/** Indicador de escucha por voz (esquina superior izquierda). */
function drawVoiceHint() {
  if (!voiceListening) return;
  const x = 18 * DPR;
  const y = 26 * DPR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${20 * DPR}px system-ui, sans-serif`;
  ctx.fillText('🎙', x, y);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
  ctx.font = `600 ${14 * DPR}px system-ui, sans-serif`;
  ctx.fillText(t(lang, 'voiceHint'), x + 26 * DPR, y);
}

function drawHand(st: HandState, time: number) {
  if (!st.present) return;
  ctx.beginPath();
  ctx.arc(st.x, st.y, 9 * DPR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  if (st.held && st.count > 0) {
    const rad = 42 * DPR;
    const cx = st.x;
    const cy = st.y - rad - 26 * DPR;
    drawIngredient(cx, cy, rad, st.held, time);
    if (st.count > 1) {
      const bx = cx + rad * 0.8, by = cy - rad * 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, 16 * DPR, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = ingredientColor(st.held); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${18 * DPR}px system-ui, sans-serif`;
      ctx.fillText(`×${st.count}`, bx, by);
    }
  }
  // Anillo de progreso de depósito al estar sobre el cuenco.
  if (st.depositMs > 0) {
    const p = Math.min(1, st.depositMs / DEPOSIT_MS);
    ctx.beginPath();
    ctx.arc(st.x, st.y, 22 * DPR, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.lineWidth = 4 * DPR;
    ctx.strokeStyle = '#c4b5fd';
    ctx.stroke();
  }
}

function drawToasts() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of toasts) {
    const a = 1 - t.age / 1500;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = t.color;
    ctx.font = `800 ${38 * DPR}px system-ui, sans-serif`;
    ctx.fillText(t.text, t.x * canvas.width, t.y * canvas.height);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Pantalla "viva" detrás del overlay de permisos (idle, sin cámara)
// ---------------------------------------------------------------------------
function renderIdle(time: number) {
  if (use3D) scene3d.beginFrame();
  ctx.fillStyle = '#070912';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCauldron(time);
  drawFloating();
  drawPalette(time);
  if (use3D) scene3d.endFrame();
}
function idleLoop(now: number) {
  if (running) return;
  const dt = Math.min(now - lastTime, 100) / 1000;
  lastTime = now;
  updateFloating(dt);
  renderIdle(now / 1000);
  requestAnimationFrame(idleLoop);
}

// Pintada inicial del overlay en el idioma por defecto (inglés). Se hace acá, al
// final del módulo, para que `running` y demás estado ya estén inicializados:
// applyLang los lee y, antes, esto tiraba "Cannot access 'running' before init".
applyLang(lang);

// Moléculas de muestra flotando como ambiente.
for (let i = 0; i < 3; i++) {
  spawnFloating(MOLECULES[(i * 3) % MOLECULES.length], 0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.18);
}
lastTime = performance.now();
requestAnimationFrame(idleLoop);

// Lectura de métricas para diagnóstico (solo DEV).
if (import.meta.env.DEV) {
  (window as unknown as { __perf: () => unknown }).__perf = () => ({
    fps: +perfFps.toFixed(1),
    frameMs: +perfFrameMs.toFixed(2),
    detectHz: +perfDetectHz.toFixed(1),
    running,
  });
}
