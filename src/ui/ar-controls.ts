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
        :host { display: block; }
        .panel {
          display: flex; flex-direction: column; gap: 0.7rem;
          padding: 0.85rem 1rem;
          background: rgba(17, 24, 39, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.8rem;
          backdrop-filter: blur(8px);
          color: #f9fafb;
          font: 600 0.8rem/1.2 system-ui, sans-serif;
          width: 13rem; max-width: 72vw; max-height: 82vh; overflow-y: auto;
        }
        .sliders { display: flex; flex-direction: column; gap: 0.55rem; }
        .row { display: flex; flex-direction: column; gap: 0.3rem; }
        .row label { display: flex; align-items: center; justify-content: space-between; opacity: 0.9; }
        .ico { display: inline-flex; }
        .ico svg, .iconbtn svg { display: block; }
        .val { color: #f45e61; font-variant-numeric: tabular-nums; }
        input[type="range"] { width: 100%; accent-color: #f45e61; cursor: pointer; }
        .sep { height: 1px; background: rgba(255,255,255,0.12); }

        /* Sección de íconos: botones toggle + muestras de color */
        .icons { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .iconbtn, input[type="color"] {
          width: 2.4rem; height: 2.4rem; cursor: pointer;
          border-radius: 0.7rem;
        }
        .iconbtn {
          appearance: none; display: grid; place-items: center;
          background: rgba(255, 255, 255, 0.06);
          color: #f9fafb; border: 2px solid transparent;
          transition: border-color .15s, background .15s, transform .1s;
        }
        .iconbtn:hover { background: rgba(244, 94, 97, 0.3); }
        .iconbtn:active { transform: scale(0.94); }
        .iconbtn[aria-pressed="true"] {
          border-color: #f45e61; background: rgba(244, 94, 97, 0.85);
        }
        input[type="color"] {
          padding: 0; border: 2px solid rgba(255,255,255,0.18); background: none;
        }
      </style>
      <div class="panel">
        <div class="sliders"></div>
        <div class="sep"></div>
        <div class="icons" role="group" aria-label="Opciones / Options"></div>
        <div class="icons colors" role="group" aria-label="Colores / Colors"></div>
      </div>
    `;
    const sliders = shadow.querySelector(".sliders") as HTMLElement;
    const icons = shadow.querySelector(".icons") as HTMLElement;
    const colors = shadow.querySelector(".colors") as HTMLElement;

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

    const iconToggle = (key: BooleanKey, icon: IconName, title: string) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "iconbtn";
      btn.innerHTML = ICONS[icon];
      btn.title = title;
      btn.setAttribute("aria-label", title);
      btn.setAttribute("aria-pressed", String(this.state[key]));
      btn.addEventListener("click", () => {
        this.state[key] = !this.state[key];
        btn.setAttribute("aria-pressed", String(this.state[key]));
        this.emit();
      });
      icons.append(btn);
    };

    const colorSwatch = (key: StringKey, title: string) => {
      colors.append(this.makeColor(key, title));
    };

    // --- Sliders ---
    slider("size", "size", "Tamaño / Size", 0.3, 2.5, 0.1, mult);
    slider("speed", "speed", "Velocidad de giro / Spin speed", 0, 3, 0.1, mult);
    slider("opacity", "opacity", "Opacidad / Opacity", 0.2, 1, 0.05, pct);
    slider("metalness", "metalness", "Metálico / Metalness", 0, 1, 0.05, pct);
    slider("roughness", "roughness", "Rugosidad / Roughness", 0, 1, 0.05, pct);

    // --- Íconos toggle ---
    iconToggle("faces", "faces", "Caras (relleno) / Faces (fill)");
    iconToggle("wireframe", "wireframe", "Malla / Wireframe");
    iconToggle("edges", "edges", "Aristas / Edges");
    iconToggle("shadow", "shadow", "Sombra / Shadow");
    iconToggle("multiHand", "hand", "Dos manos / Two hands");
    iconToggle("mirrored", "mirror", "Espejo / Mirror");
    iconToggle("bgEnabled", "background", "Fondo de color / Color background");

    // --- Colores ---
    colorSwatch("color", "Color de figura / Figure color");
    colorSwatch("edgeColor", "Color de arista / Edge color");
    colorSwatch("bgColor", "Color de fondo / Background color");
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

customElements.define("ar-controls", ARControls);
