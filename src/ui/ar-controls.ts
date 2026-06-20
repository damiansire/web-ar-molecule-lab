/**
 * Componente `<ar-controls>`: panel de ajustes de la figura (tamaño, velocidad
 * de giro y color). Recupera los sliders que tenía la versión original.
 * Emite `controls-change` con `{ size, speed, color }` en cada cambio.
 */
export interface ControlsState {
  size: number;
  speed: number;
  color: string;
  /** Opacidad de la figura (0 = transparente, 1 = sólida). */
  opacity: number;
  /** Muestra las aristas (bordes) de la figura. */
  edges: boolean;
  edgeColor: string;
  /** Si está activo, reemplaza el video de la cámara por un color sólido. */
  bgEnabled: boolean;
  bgColor: string;
}

const DEFAULTS: ControlsState = {
  size: 1,
  speed: 1,
  color: "#f45e61",
  opacity: 1,
  edges: false,
  edgeColor: "#0b1020",
  bgEnabled: false,
  bgColor: "#101826",
};

export class ARControls extends HTMLElement {
  private state: ControlsState = { ...DEFAULTS };

  connectedCallback(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { display: block; }
        .panel {
          display: flex; flex-direction: column; gap: 0.6rem;
          padding: 0.85rem 1rem;
          background: rgba(17, 24, 39, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 0.8rem;
          backdrop-filter: blur(8px);
          color: #f9fafb;
          font: 600 0.8rem/1.2 system-ui, sans-serif;
          width: 12.5rem; max-width: 70vw;
        }
        .row { display: flex; flex-direction: column; gap: 0.3rem; }
        .row label { display: flex; justify-content: space-between; opacity: 0.9; }
        .val { color: #f45e61; font-variant-numeric: tabular-nums; }
        input[type="range"] { width: 100%; accent-color: #f45e61; cursor: pointer; }
        .color-row { flex-direction: row; align-items: center; justify-content: space-between; }
        input[type="color"] {
          width: 2.4rem; height: 1.6rem; padding: 0; border: none;
          background: none; cursor: pointer; border-radius: 0.3rem;
        }
        .sep { height: 1px; background: rgba(255,255,255,0.12); margin: 0.1rem 0; }
        .toggle { display: flex; align-items: center; gap: 0.45rem; cursor: pointer; }
        input[type="checkbox"] { accent-color: #f45e61; width: 1rem; height: 1rem; cursor: pointer; }
      </style>
      <div class="panel">
        <div class="row">
          <label>Tamaño <span class="val" id="size-val"></span></label>
          <input type="range" id="size" min="0.3" max="2.5" step="0.1" />
        </div>
        <div class="row">
          <label>Velocidad <span class="val" id="speed-val"></span></label>
          <input type="range" id="speed" min="0" max="3" step="0.1" />
        </div>
        <div class="row">
          <label>Opacidad <span class="val" id="opacity-val"></span></label>
          <input type="range" id="opacity" min="0.2" max="1" step="0.05" />
        </div>
        <div class="row color-row">
          <label>Color figura</label>
          <input type="color" id="color" />
        </div>
        <div class="row color-row">
          <label class="toggle"><input type="checkbox" id="edges" /> Aristas</label>
          <input type="color" id="edge-color" />
        </div>
        <div class="sep"></div>
        <div class="row color-row">
          <label class="toggle"><input type="checkbox" id="bg-enabled" /> Fondo de color</label>
          <input type="color" id="bg-color" />
        </div>
      </div>
    `;

    const size = shadow.getElementById("size") as HTMLInputElement;
    const speed = shadow.getElementById("speed") as HTMLInputElement;
    const opacity = shadow.getElementById("opacity") as HTMLInputElement;
    const color = shadow.getElementById("color") as HTMLInputElement;
    const edges = shadow.getElementById("edges") as HTMLInputElement;
    const edgeColor = shadow.getElementById("edge-color") as HTMLInputElement;
    const bgEnabled = shadow.getElementById("bg-enabled") as HTMLInputElement;
    const bgColor = shadow.getElementById("bg-color") as HTMLInputElement;
    size.value = String(this.state.size);
    speed.value = String(this.state.speed);
    opacity.value = String(this.state.opacity);
    color.value = this.state.color;
    edges.checked = this.state.edges;
    edgeColor.value = this.state.edgeColor;
    bgEnabled.checked = this.state.bgEnabled;
    bgColor.value = this.state.bgColor;

    const sizeVal = shadow.getElementById("size-val")!;
    const speedVal = shadow.getElementById("speed-val")!;
    const opacityVal = shadow.getElementById("opacity-val")!;
    const sync = () => {
      sizeVal.textContent = `${this.state.size.toFixed(1)}×`;
      speedVal.textContent = `${this.state.speed.toFixed(1)}×`;
      opacityVal.textContent = `${Math.round(this.state.opacity * 100)}%`;
    };
    sync();

    size.addEventListener("input", () => {
      this.state.size = Number(size.value);
      sync();
      this.emit();
    });
    speed.addEventListener("input", () => {
      this.state.speed = Number(speed.value);
      sync();
      this.emit();
    });
    opacity.addEventListener("input", () => {
      this.state.opacity = Number(opacity.value);
      sync();
      this.emit();
    });
    color.addEventListener("input", () => {
      this.state.color = color.value;
      this.emit();
    });
    edges.addEventListener("change", () => {
      this.state.edges = edges.checked;
      this.emit();
    });
    edgeColor.addEventListener("input", () => {
      this.state.edgeColor = edgeColor.value;
      this.emit();
    });
    bgEnabled.addEventListener("change", () => {
      this.state.bgEnabled = bgEnabled.checked;
      this.emit();
    });
    bgColor.addEventListener("input", () => {
      this.state.bgColor = bgColor.value;
      this.emit();
    });
  }

  private emit(): void {
    this.dispatchEvent(
      new CustomEvent<ControlsState>("controls-change", { detail: { ...this.state } }),
    );
  }
}

customElements.define("ar-controls", ARControls);
