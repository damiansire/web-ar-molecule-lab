import './style.css';
import {
  combineStacks,
  recipeText,
  ELEMENTS,
  ELEMENT_ORDER,
  MOLECULES,
  type ElementSymbol,
  type Molecule,
} from './chemistry';
import { HandTracker, LM, type Hand } from './hands';
import { ParticleSystem } from './particles';
import { drawAtom, drawMolecule } from './structure';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const DWELL_MS = 850;
const COOLDOWN_MS = 1500;
const MAX_COUNT = 6;
const MAX_FLOATING = 10;

type Mode = 'normal' | 'challenge';

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const ctx = canvas.getContext('2d')!;
const video = document.querySelector<HTMLVideoElement>('#cam')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const statusEl = document.querySelector<HTMLParagraphElement>('#status')!;
const infoEl = document.querySelector<HTMLElement>('#info')!;
const startBtn = document.querySelector<HTMLButtonElement>('#start')!;

// Cap del device pixel ratio: en pantallas Retina/4K rendea muchísimos menos
// píxeles por frame (el mayor ahorro de performance) sin pérdida visual notoria.
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Precarga del modelo (en paralelo con el intro)
// ---------------------------------------------------------------------------
const tracker = new HandTracker();
const modelReady = tracker.init().then(
  () => { statusEl.textContent = '✨ Ready — pick a mode'; return true; },
  (err) => { console.error(err); statusEl.textContent = 'Model failed to load. Reload to retry.'; return false; },
);

// ---------------------------------------------------------------------------
// Estado de juego
// ---------------------------------------------------------------------------
let mode: Mode = 'normal';
let running = false;

interface HandState {
  present: boolean; x: number; y: number;
  held: ElementSymbol | null; count: number;
  dwellSymbol: ElementSymbol | null; dwellMs: number;
  /** Progreso de dwell sobre el botón de modo (in-canvas). */
  btnMs: number;
}
const makeHand = (): HandState => ({
  present: false, x: 0, y: 0, held: null, count: 0, dwellSymbol: null, dwellMs: 0, btnMs: 0,
});
type SlotName = 'Left' | 'Right';
const hands: Record<SlotName, HandState> = { Left: makeHand(), Right: makeHand() };

// Moléculas levitando (ambos modos). Posiciones en fracciones del canvas.
interface Floating { molecule: Molecule; x: number; y: number; vx: number; vy: number; rot: number; rotVel: number; }
const floating: Floating[] = [];

// Objetivos que caen (solo challenge).
interface Target { molecule: Molecule; x: number; y: number; vy: number; }
const targets: Target[] = [];

// Texto efímero (+100 / No reaction).
interface Toast { text: string; color: string; x: number; y: number; age: number; }
const toasts: Toast[] = [];

const discovered = new Set<string>(); // fórmulas formadas (normal)
let score = 0;
let combo = 0;
let elapsed = 0; // s en challenge
let spawnTimer = 0;
let cooldown = 0;
let modeSwitchCooldown = 0; // ms, evita re-toggles del botón de modo

const BTN_DWELL_MS = 1100;

const particles = new ParticleSystem();
let audioCtx: AudioContext | null = null;
let infoTimer: ReturnType<typeof setTimeout> | undefined;

// ---------------------------------------------------------------------------
// Arranque por modo
// ---------------------------------------------------------------------------
startBtn.addEventListener('click', () => start('normal'));

async function start(chosen: Mode) {
  mode = chosen;
  startBtn.disabled = true;
  try {
    statusEl.textContent = 'Requesting camera…';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 1280, height: 720 },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const ok = await modelReady;
    if (!ok) throw new Error('model not ready');

    audioCtx = new AudioContext();
    resetGame();
    overlay.classList.add('hidden');
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Couldn't access the camera. Check permissions and reload.";
    statusEl.classList.add('error');
    startBtn.disabled = false;
  }
}

function resetGame() {
  floating.length = 0;
  targets.length = 0;
  toasts.length = 0;
  discovered.clear();
  score = 0; combo = 0; elapsed = 0; spawnTimer = 0; cooldown = 0;
  if (mode === 'challenge') spawnTarget();
}

/** Alterna Explore ⇄ Challenge (disparado por el botón in-canvas). */
function switchMode() {
  mode = mode === 'normal' ? 'challenge' : 'normal';
  hands.Left.btnMs = hands.Right.btnMs = 0;
  modeSwitchCooldown = 1200;
  infoEl.classList.add('hidden');
  if (mode === 'challenge') {
    targets.length = 0; toasts.length = 0;
    score = 0; combo = 0; elapsed = 0; spawnTimer = 0;
    spawnTarget();
  } else {
    targets.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let lastTime = 0;
let lastVideoTime = -1;

function loop(now: number) {
  if (!running) return;
  const dtMs = Math.min(now - lastTime, 100);
  const dt = dtMs / 1000;
  lastTime = now;
  const time = now / 1000;

  if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
    lastVideoTime = video.currentTime;
    syncHands(tracker.detect(video, now));
  }

  updateInteraction(dtMs);
  updateFloating(dt);
  if (mode === 'challenge') updateChallenge(dt);
  updateToasts(dtMs);
  particles.update(dt);
  if (cooldown > 0) cooldown = Math.max(0, cooldown - dtMs);
  if (modeSwitchCooldown > 0) modeSwitchCooldown = Math.max(0, modeSwitchCooldown - dtMs);

  render(time);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------------------
// Tracking → slots
// ---------------------------------------------------------------------------
function syncHands(detected: Hand[]) {
  hands.Left.present = false;
  hands.Right.present = false;
  const used = new Set<SlotName>();
  for (const hand of detected) {
    let slot: SlotName =
      hand.handedness === 'Left' || hand.handedness === 'Right' ? hand.handedness : 'Left';
    if (used.has(slot)) slot = slot === 'Left' ? 'Right' : 'Left';
    if (used.has(slot)) continue;
    used.add(slot);
    const tip = hand.landmarks[LM.INDEX_TIP];
    const st = hands[slot];
    st.present = true;
    st.x = (1 - tip.x) * canvas.width;
    st.y = tip.y * canvas.height;
  }
  for (const name of ['Left', 'Right'] as SlotName[]) {
    if (!hands[name].present) { hands[name].dwellSymbol = null; hands[name].dwellMs = 0; }
  }
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
interface Tile { symbol: ElementSymbol; x: number; y: number; size: number; }
// Memo: el layout solo cambia con el tamaño del canvas, no cada frame.
let tilesCache: Tile[] | null = null;
let tilesCacheW = -1;
function paletteTiles(): Tile[] {
  if (tilesCache && tilesCacheW === canvas.width) return tilesCache;
  const n = ELEMENT_ORDER.length;
  const size = Math.min(canvas.width / (n + 2), 132 * DPR);
  const gap = size * 0.28;
  const totalW = n * size + (n - 1) * gap;
  const startX = (canvas.width - totalW) / 2;
  const y = size * 0.4;
  tilesCache = ELEMENT_ORDER.map((symbol, i) => ({ symbol, x: startX + i * (size + gap), y, size }));
  tilesCacheW = canvas.width;
  return tilesCache;
}
function tileUnder(px: number, py: number, tiles: Tile[]): Tile | null {
  return tiles.find((t) => px >= t.x && px <= t.x + t.size && py >= t.y && py <= t.y + t.size) ?? null;
}

/** Botón de modo in-canvas (top-left), seleccionable con la mano por dwell. */
function modeButtonRect() {
  const w = Math.min(canvas.width * 0.24, 260 * DPR);
  const h = 64 * DPR;
  const pad = 18 * DPR;
  return { x: pad, y: pad, w, h };
}

// ---------------------------------------------------------------------------
// Interacción
// ---------------------------------------------------------------------------
function updateInteraction(dtMs: number) {
  const tiles = paletteTiles();
  const mb = modeButtonRect();
  for (const name of ['Left', 'Right'] as SlotName[]) {
    const st = hands[name];
    if (!st.present) { st.btnMs = 0; continue; }

    // Botón de modo (in-canvas, top-left) tiene prioridad sobre los tiles.
    if (st.x >= mb.x && st.x <= mb.x + mb.w && st.y >= mb.y && st.y <= mb.y + mb.h) {
      st.dwellSymbol = null; st.dwellMs = 0;
      st.btnMs += dtMs;
      if (st.btnMs >= BTN_DWELL_MS && modeSwitchCooldown === 0) switchMode();
      continue;
    }
    st.btnMs = 0;

    const over = tileUnder(st.x, st.y, tiles);
    if (over) {
      if (st.dwellSymbol === over.symbol) {
        st.dwellMs += dtMs;
        if (st.dwellMs >= DWELL_MS) {
          st.dwellMs = 0;
          if (st.held === over.symbol) st.count = Math.min(MAX_COUNT, st.count + 1);
          else { st.held = over.symbol; st.count = 1; }
        }
      } else { st.dwellSymbol = over.symbol; st.dwellMs = 0; }
    } else { st.dwellSymbol = null; st.dwellMs = 0; }
  }

  const a = hands.Left, b = hands.Right;
  if (a.present && b.present && a.held && b.held && cooldown === 0) {
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.18 * canvas.height) triggerCombine();
  }
}

function triggerCombine() {
  const a = hands.Left, b = hands.Right;
  const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
  const molecule = combineStacks({ symbol: a.held!, count: a.count }, { symbol: b.held!, count: b.count });
  cooldown = COOLDOWN_MS;
  a.held = b.held = null; a.count = b.count = 0;

  if (!molecule) {
    particles.burst(cx, cy, '#64748b', 45, 320 * DPR);
    toasts.push({ text: 'No reaction', color: '#94a3b8', x: cx / canvas.width, y: cy / canvas.height, age: 0 });
    playChime(false);
    return;
  }

  particles.burst(cx, cy, molecule.color, 180, 660 * DPR);
  playChime(true);
  spawnFloating(molecule, cx / canvas.width, cy / canvas.height);

  if (mode === 'challenge') {
    const i = targets.findIndex((t) => t.molecule.formula === molecule.formula);
    if (i >= 0) {
      targets.splice(i, 1);
      combo += 1;
      const pts = 100 * combo;
      score += pts;
      toasts.push({ text: `+${pts}${combo > 1 ? `  x${combo}` : ''}`, color: molecule.color, x: cx / canvas.width, y: cy / canvas.height, age: 0 });
    } else {
      toasts.push({ text: molecule.formula, color: molecule.color, x: cx / canvas.width, y: cy / canvas.height, age: 0 });
    }
  } else {
    discovered.add(molecule.formula);
    showInfo(molecule);
  }
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
    // Rebote suave dentro de la zona visible.
    if (f.x < 0.07) { f.x = 0.07; f.vx = Math.abs(f.vx); }
    if (f.x > 0.93) { f.x = 0.93; f.vx = -Math.abs(f.vx); }
    if (f.y < 0.16) { f.y = 0.16; f.vy = Math.abs(f.vy); }
    if (f.y > 0.82) { f.y = 0.82; f.vy = -Math.abs(f.vy); }
  }
}

// ---------------------------------------------------------------------------
// Challenge: objetivos que caen + dificultad creciente
// ---------------------------------------------------------------------------
function spawnTarget() {
  const molecule = MOLECULES[Math.floor(Math.random() * MOLECULES.length)];
  targets.push({ molecule, x: 0.12 + Math.random() * 0.76, y: -0.08, vy: fallSpeed() });
}
function fallSpeed() {
  return 0.045 + Math.min(0.08, elapsed * 0.0014); // acelera con el tiempo
}
function spawnInterval() {
  return Math.max(1.8, 3.6 - elapsed * 0.03);
}
function updateChallenge(dt: number) {
  elapsed += dt;
  spawnTimer += dt;
  if (spawnTimer >= spawnInterval()) { spawnTimer = 0; spawnTarget(); }
  for (let i = targets.length - 1; i >= 0; i--) {
    targets[i].y += targets[i].vy * dt;
    if (targets[i].y > 1.08) {
      targets.splice(i, 1);
      combo = 0; // se cortó la racha
    }
  }
}

function updateToasts(dtMs: number) {
  for (const t of toasts) { t.age += dtMs; t.y -= 0.00006 * dtMs; }
  for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].age > 1400) toasts.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Panel de info (modo normal)
// ---------------------------------------------------------------------------
function showInfo(m: Molecule) {
  const elems = (Object.keys(m.composition) as ElementSymbol[])
    .filter((s) => (m.composition[s] ?? 0) > 0)
    .map((s) => {
      const el = ELEMENTS[s];
      return `<li><b style="color:${el.color}">${el.symbol}</b> ${el.name} · Z=${el.atomicNumber} · ×${m.composition[s]}</li>`;
    })
    .join('');
  infoEl.innerHTML = `
    <div class="info-head" style="--accent:${m.color}">
      <span class="info-formula">${m.formula}</span>
      <span class="info-name">${m.name}</span>
    </div>
    <p class="info-desc">${m.description}</p>
    <div class="info-recipe">Recipe: <b>${recipeText(m.composition)}</b></div>
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
  drawVideoMirrored();
  if (mode === 'challenge') drawTargets();
  else drawGuide(time);
  drawFloating();
  drawPalette(time);
  drawModeButton();
  for (const name of ['Left', 'Right'] as SlotName[]) drawHand(hands[name], time);
  particles.draw(ctx);
  drawToasts();
  if (mode === 'challenge') drawHud();
}

function drawModeButton() {
  const mb = modeButtonRect();
  const toChallenge = mode === 'normal';
  const accent = toChallenge ? '#fbbf24' : '#7dd3fc';
  const label = toChallenge ? '⚡ Challenge' : '🔬 Explore';
  const progress = Math.max(hands.Left.btnMs, hands.Right.btnMs) / BTN_DWELL_MS;

  roundRect(mb.x, mb.y, mb.w, mb.h, 14 * DPR);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
  ctx.fill();
  // Relleno de progreso del dwell.
  if (progress > 0) {
    ctx.save();
    roundRect(mb.x, mb.y, mb.w, mb.h, 14 * DPR);
    ctx.clip();
    ctx.fillStyle = accent + '33';
    ctx.fillRect(mb.x, mb.y, mb.w * Math.min(1, progress), mb.h);
    ctx.restore();
  }
  roundRect(mb.x, mb.y, mb.w, mb.h, 14 * DPR);
  ctx.lineWidth = 2 * DPR;
  ctx.strokeStyle = accent;
  ctx.stroke();

  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${20 * DPR}px system-ui, sans-serif`;
  ctx.fillText(label, mb.x + mb.w / 2, mb.y + mb.h / 2);
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

function drawFloating() {
  for (const f of floating) {
    const cx = f.x * canvas.width;
    const cy = f.y * canvas.height;
    const scale = 40 * DPR;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(f.rot);
    // halo
    ctx.beginPath();
    ctx.arc(0, 0, scale * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = f.molecule.color + '22';
    ctx.fill();
    drawMolecule(ctx, 0, 0, scale, f.molecule);
    ctx.restore();
    ctx.fillStyle = f.molecule.color;
    ctx.textAlign = 'center';
    ctx.font = `700 ${16 * DPR}px system-ui, sans-serif`;
    ctx.fillText(f.molecule.formula, cx, cy + scale * 1.8);
  }
}

function drawTargets() {
  for (const t of targets) {
    const cx = t.x * canvas.width;
    const cy = t.y * canvas.height;
    const scale = 32 * DPR;
    drawMolecule(ctx, cx, cy, scale, t.molecule);
    ctx.textAlign = 'center';
    ctx.fillStyle = t.molecule.color;
    ctx.font = `700 ${19 * DPR}px system-ui, sans-serif`;
    ctx.fillText(t.molecule.formula, cx, cy + scale * 1.6);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 ${13 * DPR}px system-ui, sans-serif`;
    ctx.fillText(recipeText(t.molecule.composition), cx, cy + scale * 1.6 + 21 * DPR);
  }
}

function drawGuide(time: number) {
  // Tira de moléculas-objetivo en la parte inferior (referencia, sin presión).
  const n = MOLECULES.length;
  const pad = 16 * DPR;
  const w = (canvas.width - pad * (n + 1)) / n;
  const h = Math.min(w * 1.15, 150 * DPR);
  const y = canvas.height - h - pad;
  MOLECULES.forEach((m, i) => {
    const x = pad + i * (w + pad);
    const done = discovered.has(m.formula);
    roundRect(x, y, w, h, 14 * DPR);
    ctx.fillStyle = done ? 'rgba(34,197,94,0.14)' : 'rgba(15,23,42,0.5)';
    ctx.fill();
    ctx.lineWidth = 2 * DPR;
    ctx.strokeStyle = done ? '#22c55e' : m.color + '88';
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = done ? 1 : 0.85;
    drawMolecule(ctx, x + w / 2, y + h * 0.34, Math.min(w, h) * 0.2, m);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = m.color;
    ctx.font = `700 ${Math.min(w * 0.16, 22 * DPR)}px system-ui, sans-serif`;
    ctx.fillText(m.formula, x + w / 2, y + h * 0.66);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `500 ${Math.min(w * 0.1, 13 * DPR)}px system-ui, sans-serif`;
    ctx.fillText(recipeText(m.composition), x + w / 2, y + h * 0.84);
    if (done) {
      ctx.fillStyle = '#22c55e';
      ctx.font = `800 ${16 * DPR}px system-ui, sans-serif`;
      ctx.fillText('✓', x + w - 14 * DPR, y + 16 * DPR);
    }
  });
  void time;
}

function drawPalette(time: number) {
  const tiles = paletteTiles();
  for (const t of tiles) {
    const el = ELEMENTS[t.symbol];
    roundRect(t.x, t.y, t.size, t.size, t.size * 0.18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
    ctx.fill();
    ctx.lineWidth = 2 * DPR;
    ctx.strokeStyle = el.color;
    ctx.stroke();
    drawAtom(ctx, t.x + t.size / 2, t.y + t.size * 0.42, t.size * 0.32, t.symbol, time);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${t.size * 0.12}px system-ui, sans-serif`;
    ctx.fillText(el.name, t.x + t.size / 2, t.y + t.size * 0.88);
  }
  for (const name of ['Left', 'Right'] as SlotName[]) {
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
    drawAtom(ctx, cx, cy, rad, st.held, time);
    if (st.count > 1) {
      const bx = cx + rad * 0.8, by = cy - rad * 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, 16 * DPR, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a'; ctx.fill();
      ctx.lineWidth = 2 * DPR;
      ctx.strokeStyle = ELEMENTS[st.held].color; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${18 * DPR}px system-ui, sans-serif`;
      ctx.fillText(`×${st.count}`, bx, by);
    }
  }
}

function drawToasts() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of toasts) {
    const a = 1 - t.age / 1400;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = t.color;
    ctx.font = `800 ${40 * DPR}px system-ui, sans-serif`;
    ctx.fillText(t.text, t.x * canvas.width, t.y * canvas.height);
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e5e7eb';
  ctx.font = `800 ${34 * DPR}px system-ui, sans-serif`;
  ctx.fillText(`${score}`, canvas.width - 24 * DPR, 22 * DPR);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 ${15 * DPR}px system-ui, sans-serif`;
  ctx.fillText('SCORE', canvas.width - 24 * DPR, 64 * DPR);
  if (combo > 1) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 ${20 * DPR}px system-ui, sans-serif`;
    ctx.fillText(`combo x${combo}`, canvas.width - 24 * DPR, 92 * DPR);
  }
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
// Pantalla de juego "viva" detrás del overlay de permisos (modo idle, sin cámara)
// ---------------------------------------------------------------------------
function renderIdle(time: number) {
  ctx.fillStyle = '#070912';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGuide(time);
  drawFloating();
  drawPalette(time);
}
function idleLoop(now: number) {
  if (running) return; // arrancó el juego: cedemos el loop
  const dt = Math.min(now - lastTime, 100) / 1000;
  lastTime = now;
  updateFloating(dt);
  renderIdle(now / 1000);
  requestAnimationFrame(idleLoop);
}

// Moléculas de muestra flotando como ambiente.
for (let i = 0; i < 3; i++) {
  spawnFloating(MOLECULES[(i * 3) % MOLECULES.length], 0.25 + Math.random() * 0.5, 0.35 + Math.random() * 0.3);
}
lastTime = performance.now();
requestAnimationFrame(idleLoop);
