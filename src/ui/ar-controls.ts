/**
 * Componente `<ar-controls>`: panel de ajustes de la figura y la escena.
 * Emite `controls-change` con el estado completo en cada cambio.
 *
 * Dos secciones separadas:
 *  - Sliders (valores continuos): tamaño, velocidad, opacidad, material.
 *  - Íconos: toggles como botones que se "pintan" al activarse (sin checkbox),
 *    más una fila de muestras de color.
 * Cada control muestra un ícono universal; el nombre queda como tooltip
 * bilingüe (es / en) para entenderlo sin saber español.
 */
import { ICONS, type IconName } from "./icons";

export interface ControlsState {
  size: number;
  speed: number;
  /** Opacidad de la figura (0 = transparente, 1 = sólida). */
  opacity: number;
  /** Metalización del material (0 = mate, 1 = metálico). */
  metalness: number;
  /** Rugosidad del material (0 = espejado, 1 = difuso). */
  roughness: number;
  color: string;
  /** Muestra el relleno de las caras (apagado = figura hueca, sólo contorno). */
  faces: boolean;
  /** Modo malla (sólo aristas de triángulos, sin caras). */
  wireframe: boolean;
  /** Muestra las aristas (bordes) de la figura. */
  edges: boolean;
  edgeColor: string;
  /** Sombra (blob) bajo la figura. */
  shadow: boolean;
  /** Dibujar figuras en ambas manos. */
  multiHand: boolean;
  /** Oclusión: la figura queda por detrás al dar vuelta la mano. */
  occlusion: boolean;
  /** Vista espejada (selfie). */
  mirrored: boolean;
  /** Si está activo, reemplaza el video de la cámara por un color sólido. */
  bgEnabled: boolean;
  bgColor: string;
}

const DEFAULTS: ControlsState = {
  size: 1,
  speed: 1,
  opacity: 1,
  metalness: 0.25,
  roughness: 0.35,
  color: "#f45e61",
  faces: true,
  wireframe: false,
  edges: false,
  edgeColor: "#0b1020",
  shadow: false,
  multiHand: false,
  occlusion: true,
  mirrored: true,
  bgEnabled: false,
  bgColor: "#101826",
};

// Claves de ControlsState agrupadas por tipo de valor, para tipar los helpers.
type NumericKey = {
  [K in keyof ControlsState]: ControlsState[K] extends number ? K : never;
}[keyof ControlsState];
type StringKey = {
  [K in keyof ControlsState]: ControlsState[K] extends string ? K : never;
}[keyof ControlsState];
type BooleanKey = {
  [K in keyof ControlsState]: ControlsState[K] extends boolean ? K : never;
}[keyof ControlsState];

export class ARControls extends HTMLElement {
  private state: ControlsState = { ...DEFAULTS };

  connectedCallback(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          position: absolute; inset: 0; display: block;
          pointer-events: none; /* sólo los controles capturan clics */
          color: #f9fafb; font: 600 0.8rem/1.2 system-ui, sans-serif;
        }
        .surface {
          background: rgba(17, 24, 39, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.9rem;
          backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        /* Barra superior de íconos (toggles), con su color colgando debajo */
        .topbar {
          position: absolute; top: max(0.8rem, env(safe-area-inset-top));
          left: 50%; transform: translateX(-50%);
          display: flex; flex-wrap: wrap; justify-content: center;
          align-items: flex-start; gap: 0.4rem;
          padding: 0.55rem 0.7rem; max-width: 94vw;
        }
        .item { position: relative; display: flex; align-items: center; }
        .iconbtn {
          appearance: none; cursor: pointer; display: grid; place-items: center;
          width: 2.4rem; height: 2.4rem; border-radius: 0.7rem;
          background: rgba(255, 255, 255, 0.06);
          color: #f9fafb; border: 2px solid transparent;
          transition: border-color .15s, background .15s, transform .1s;
        }
        .iconbtn svg { display: block; filter: drop-shadow(0 1px 1px rgba(0,0,0,.5)); }
        .iconbtn:hover { background: rgba(244, 94, 97, 0.3); }
        .iconbtn:active { transform: scale(0.92); }
        .iconbtn[aria-pressed="true"] {
          border-color: #f45e61; background: rgba(244, 94, 97, 0.85);
        }
        /* botón de color: el fondo del propio ícono refleja el color elegido */
        .iconbtn.colorbtn { border-color: rgba(255, 255, 255, 0.3); }
        .iconbtn.colorbtn:hover { filter: brightness(1.1); }
        /* swatch de un toggle: cuelga por fuera/debajo, sin agrandar la barra */
        .swatch {
          position: absolute; top: calc(100% + 0.7rem); left: 50%;
          transform: translateX(-50%);
          width: 2.4rem; height: 0.95rem; padding: 0; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.3); border-radius: 0.4rem; background: none;
        }
        /* input de color oculto (lo dispara el botón de color de figura) */
        .hidden-color {
          position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
        }

        /* Panel lateral de sliders */
        .sliders {
          position: absolute; top: max(0.8rem, env(safe-area-inset-top)); left: 0.8rem;
          display: flex; flex-direction: column; gap: 0.55rem;
          padding: 0.85rem 1rem; width: 11.5rem; max-width: 58vw;
        }
        .row { display: flex; flex-direction: column; gap: 0.3rem; }
        .row label { display: flex; align-items: center; justify-content: space-between; opacity: 0.9; }
        .ico { display: inline-flex; }
        .ico svg { display: block; }
        .val { color: #f45e61; font-variant-numeric: tabular-nums; }
        input[type="range"] { width: 100%; accent-color: #f45e61; cursor: pointer; }
      </style>
      <div class="topbar surface" role="group" aria-label="Opciones / Options"></div>
      <div class="sliders surface" role="group" aria-label="Ajustes / Settings"></div>
    `;
    const topbar = shadow.querySelector(".topbar") as HTMLElement;
    const sliders = shadow.querySelector(".sliders") as HTMLElement;

    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const mult = (v: number) => `${v.toFixed(1)}×`;

    const slider = (
      key: NumericKey,
      icon: IconName,
      title: string,
      min: number,
      max: number,
      step: number,
      fmt: (v: number) => string,
    ) => {
      const row = el("div", "row");
      row.title = title;
      const lab = document.createElement("label");
      const val = el("span", "val");
      lab.append(iconEl(icon), val);
      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(this.state[key]);
      input.setAttribute("aria-label", title);
      const refresh = () => (val.textContent = fmt(this.state[key]));
      refresh();
      input.addEventListener("input", () => {
        this.state[key] = Number(input.value);
        refresh();
        this.emit();
      });
      row.append(lab, input);
      sliders.append(row);
    };

    // Botón de ícono en la barra superior. Si trae `colorKey`, su muestra de
    // color aparece debajo sólo cuando el toggle está activo.
    const toggleItem = (
      key: BooleanKey,
      icon: IconName,
      title: string,
      colorKey?: StringKey,
      colorTitle?: string,
    ) => {
      const item = el("div", "item");
      const btn = iconButton(icon, title);
      item.append(btn);
      const swatch = colorKey && colorTitle ? this.makeColor(colorKey, colorTitle) : null;
      if (swatch) {
        swatch.className = "swatch"; // absoluto: cuelga debajo sin agrandar la barra
        item.append(swatch);
      }
      const sync = () => {
        const on = this.state[key];
        btn.setAttribute("aria-pressed", String(on));
        if (swatch) swatch.style.display = on ? "" : "none";
      };
      sync();
      btn.addEventListener("click", () => {
        this.state[key] = !this.state[key];
        sync();
        this.emit();
      });
      topbar.append(item);
    };

    // Ítem de color puro (la figura siempre tiene color): el fondo del ícono
    // refleja el color y al hacer click abre el selector. Sin muestra debajo,
    // así no cambia la altura de la barra.
    const colorItem = (key: StringKey, icon: IconName, title: string) => {
      const item = el("div", "item");
      const btn = iconButton(icon, title);
      btn.classList.add("colorbtn");
      btn.style.background = this.state[key];
      const input = this.makeColor(key, title);
      input.className = "hidden-color";
      input.addEventListener("input", () => {
        btn.style.background = input.value;
      });
      btn.addEventListener("click", () => input.click());
      item.append(btn, input);
      topbar.append(item);
    };

    // --- Sliders (panel izquierdo) ---
    slider("size", "size", "Tamaño / Size", 0.3, 2.5, 0.1, mult);
    slider("speed", "speed", "Velocidad de giro / Spin speed", 0, 3, 0.1, mult);
    slider("opacity", "opacity", "Opacidad / Opacity", 0.2, 1, 0.05, pct);
    slider("metalness", "metalness", "Metálico / Metalness", 0, 1, 0.05, pct);
    slider("roughness", "roughness", "Rugosidad / Roughness", 0, 1, 0.05, pct);

    // --- Barra superior de íconos ---
    colorItem("color", "color", "Color de figura / Figure color");
    toggleItem("faces", "faces", "Caras (relleno) / Faces (fill)");
    toggleItem("wireframe", "wireframe", "Malla / Wireframe");
    toggleItem(
      "edges",
      "edges",
      "Aristas / Edges",
      "edgeColor",
      "Color de arista / Edge color",
    );
    toggleItem("shadow", "shadow", "Sombra / Shadow");
    toggleItem("multiHand", "hand", "Dos manos / Two hands");
    toggleItem(
      "occlusion",
      "occlusion",
      "Oclusión (figura detrás) / Occlusion (figure behind)",
    );
    toggleItem("mirrored", "mirror", "Espejo / Mirror");
    toggleItem(
      "bgEnabled",
      "background",
      "Fondo / Background",
      "bgColor",
      "Color de fondo / Background color",
    );
  }

  /** Estado actual de los controles (para consumidores como "sacar foto"). */
  getState(): ControlsState {
    return { ...this.state };
  }

  private makeColor(key: StringKey, title: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "color";
    input.value = this.state[key];
    input.title = title;
    input.setAttribute("aria-label", title);
    input.addEventListener("input", () => {
      this.state[key] = input.value;
      this.emit();
    });
    return input;
  }

  private emit(): void {
    this.dispatchEvent(
      new CustomEvent<ControlsState>("controls-change", { detail: { ...this.state } }),
    );
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function iconEl(name: IconName): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "ico";
  span.innerHTML = ICONS[name];
  return span;
}

function iconButton(name: IconName, title: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "iconbtn";
  btn.innerHTML = ICONS[name];
  btn.title = title;
  btn.setAttribute("aria-label", title);
  return btn;
}

customElements.define("ar-controls", ARControls);
