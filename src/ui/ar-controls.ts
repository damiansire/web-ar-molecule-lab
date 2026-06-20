/**
 * Componente `<ar-controls>`: panel de ajustes de la figura y la escena.
 * Emite `controls-change` con el estado completo en cada cambio.
 *
 * El panel se construye de forma declarativa a partir de helpers (slider /
 * color / toggle / toggle+color) para no repetir el cableado por cada control.
 * Cada control se muestra con un ícono (universal) y el nombre queda como
 * tooltip bilingüe, para que se entienda sin saber español.
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
          display: flex; flex-direction: column; gap: 0.55rem;
          padding: 0.85rem 1rem;
          background: rgba(17, 24, 39, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.8rem;
          backdrop-filter: blur(8px);
          color: #f9fafb;
          font: 600 0.8rem/1.2 system-ui, sans-serif;
          width: 13rem; max-width: 72vw; max-height: 82vh; overflow-y: auto;
        }
        .row { display: flex; flex-direction: column; gap: 0.3rem; }
        .row label { display: flex; align-items: center; justify-content: space-between; opacity: 0.9; }
        .ico { display: inline-flex; }
        .ico svg { display: block; }
        .val { color: #f45e61; font-variant-numeric: tabular-nums; }
        input[type="range"] { width: 100%; accent-color: #f45e61; cursor: pointer; }
        .color-row { flex-direction: row; align-items: center; justify-content: space-between; }
        input[type="color"] {
          width: 2.4rem; height: 1.6rem; padding: 0; border: none;
          background: none; cursor: pointer; border-radius: 0.3rem;
        }
        .sep { height: 1px; background: rgba(255,255,255,0.12); margin: 0.1rem 0; }
        .row label.toggle { display: flex; align-items: center; justify-content: flex-start; gap: 0.5rem; cursor: pointer; }
        input[type="checkbox"] { accent-color: #f45e61; width: 1rem; height: 1rem; cursor: pointer; }
      </style>
      <div class="panel"></div>
    `;
    const panel = shadow.querySelector(".panel") as HTMLElement;

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
      panel.append(row);
    };

    const colorPicker = (key: StringKey, icon: IconName, title: string) => {
      const row = el("div", "row color-row");
      row.title = title;
      const lab = document.createElement("label");
      lab.append(iconEl(icon));
      row.append(lab, this.makeColor(key, title));
      panel.append(row);
    };

    const toggle = (
      key: BooleanKey,
      icon: IconName,
      title: string,
      extra?: HTMLElement,
    ) => {
      const row = el("div", extra ? "row color-row" : "row");
      row.title = title;
      const lab = el("label", "toggle");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = this.state[key];
      cb.setAttribute("aria-label", title);
      cb.addEventListener("change", () => {
        this.state[key] = cb.checked;
        this.emit();
      });
      lab.append(cb, iconEl(icon));
      row.append(lab);
      if (extra) row.append(extra);
      panel.append(row);
    };

    const sep = () => panel.append(el("div", "sep"));

    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const mult = (v: number) => `${v.toFixed(1)}×`;

    slider("size", "size", "Tamaño / Size", 0.3, 2.5, 0.1, mult);
    slider("speed", "speed", "Velocidad de giro / Spin speed", 0, 3, 0.1, mult);
    slider("opacity", "opacity", "Opacidad / Opacity", 0.2, 1, 0.05, pct);
    sep();
    slider("metalness", "metalness", "Metálico / Metalness", 0, 1, 0.05, pct);
    slider("roughness", "roughness", "Rugosidad / Roughness", 0, 1, 0.05, pct);
    colorPicker("color", "color", "Color de figura / Figure color");
    toggle("faces", "faces", "Caras (relleno) / Faces (fill)");
    toggle("wireframe", "wireframe", "Malla / Wireframe");
    sep();
    toggle("edges", "edges", "Aristas / Edges", this.makeColor("edgeColor", "Color de arista / Edge color"));
    toggle("shadow", "shadow", "Sombra / Shadow");
    sep();
    toggle("multiHand", "hand", "Dos manos / Two hands");
    toggle("mirrored", "mirror", "Espejo / Mirror");
    toggle("bgEnabled", "background", "Fondo de color / Color background", this.makeColor("bgColor", "Color de fondo / Background color"));
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
