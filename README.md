# 🧪 Molecule Lab

**Combine atoms with your hands and your voice.** A chemistry lab in your browser:
name an atom and it appears in your hand, drop it into an **alchemy cauldron** at the
center of the scene, and on mixing a real molecule forms. Everything you create is kept
in an **inventory** to reuse — and the molecules you make can be combined with each other
to discover more complex compounds. Hand-tracking over your webcam, no controllers, no
installs.

🔗 **[Play online →](https://damiansire.github.io/web-ar-molecule-lab/)**

![Molecule Lab](docs/preview.png)

## How to play

1. Click **Activar cámara** and allow access.
2. **Say the name of an atom** (“hidrógeno”, “oxígeno”…) and it appears in your hand. No
   microphone? Grab it from the **palette** at the top by holding your fingertip over it.
3. **Bring your hand to the cauldron** to drop in what you are holding. Repeat to stack
   up (e.g. 2 hydrogen + 1 oxygen).
4. Say **“mezclar”** (or hold your fingertip on the **✨ Mezclar** button) and the
   cauldron resolves the recipe: the molecule is born and enters your **inventory**. No
   reaction? Adjust and try again, or **🗑 Vaciar** to start over.
5. Anything you already made can be **re-summoned** by voice (“agua”) or by taking it from
   the inventory **shelf** with your hand — and you can drop it back into the cauldron as
   an ingredient.

> The voice commands are in Spanish (the recognizer runs in `es-AR`): say the Spanish name
> of an atom or product, or “mezclar” to brew.

### The alchemy tree

The molecules you create are ingredients for new recipes. For example:

- **Water** (2 H + 1 O) + **Carbon dioxide** (1 C + 2 O) → **Carbonic acid**
- **Ammonia** (1 N + 3 H) + **Hydrochloric acid** → **Ammonium chloride**
- **Sulfur dioxide** + **Water** → **Sulfurous acid**

You craft the intermediates first, then combine them. The inventory is persistent: your
progress survives a page reload.

## Chemistry

- **Elements (9):** H · O · C · N · S · P · F · Na · Cl
- **First-level molecules:** H₂O, CO₂, NH₃, CH₄, NaCl, HCl, H₂, O₂, N₂, H₂O₂, O₃, CO,
  NO, SO₂, H₂S, HF, PH₃
- **Alchemy-tree compounds:** H₂CO₃, NH₄Cl, H₂SO₃, NH₄OH

Combinations are resolved by **ingredient identity**: an atom or an already-created
product. Adding content is declarative — add an element, a molecule (with its geometry),
or a recipe in `src/chemistry.ts`.

## Privacy

Everything runs **on your device**. The camera stream and the hand-tracking model execute
locally in your browser — the video never leaves your machine. Nothing is downloaded or
contacted until you click *Activar cámara*.

## Tech

- **Vite + TypeScript**, rendered on a 2D `<canvas>` over the mirrored webcam.
- **Hand tracking** via [MediaPipe Tasks Vision](https://developers.google.com/mediapipe),
  running in a Web Worker so inference never blocks the render loop.
- **Voice** via the Web Speech API (optional; the game works fully with gestures alone).
- **Pure, tested domain** (`src/chemistry.ts`): elements, molecules, recipes and the
  cauldron resolver (`brew`) live without the DOM and are covered by unit tests.
- A strict **Content-Security-Policy** injected at build time scopes network access to
  only the CDNs strictly required by the model.

## Development

```bash
npm install
npm run dev       # dev server at /web-ar-molecule-lab/
npm test          # unit tests (chemistry, inventory, voice, hands)
npm run build     # production build → dist/
```

> Requires a browser with `getUserMedia` (camera) support. A microphone is optional and
> only used to name atoms/products and say “mezclar”.

## Deployment

Pushing to `master` triggers a GitHub Actions workflow that builds the project and
publishes `dist/` to GitHub Pages. The Vite `base` is set to `/web-ar-molecule-lab/` to
match the Pages subpath.
