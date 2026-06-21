/**
 * Componente `<figure-selector>`: barra de botones para elegir la figura.
 * Emite el evento `figure-change` con `detail.kind` cuando el usuario elige.
 * Encapsulado en Shadow DOM para no filtrar estilos al resto de la app.
 */
import {
  FIGURES,
  DEFAULT_FIGURE,
  isFigureKind,
  type FigureKind,
} from "../domain/figures";
import { ICONS } from "./icons";

// Nombre en inglés para el tooltip bilingüe (el ícono es el cue principal).
const EN: Record<FigureKind, string> = {
  none: "None",
  square: "Square",
  cube: "Cube",
  cylinder: "Cylinder",
  cone: "Cone",
  torus: "Torus",
  sphere: "Sphere",
};

export class FigureSelector extends HTMLElement {
  private selected: FigureKind = DEFAULT_FIGURE;

  connectedCallback(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { display: block; }
        .bar {
          display: flex; flex-wrap: wrap; gap: 0.5rem;
          justify-content: center; padding: 0.75rem;
        }
        button {
          appearance: none; cursor: pointer;
          display: grid; place-items: center;
          width: 2.9rem; height: 2.9rem;
          background: rgba(17, 24, 39, 0.55);
          color: #f9fafb;
          border: 2px solid transparent;
          border-radius: 0.8rem;
          backdrop-filter: blur(6px);
          transition: border-color .15s, background .15s, transform .1s;
        }
        button svg { display: block; }
        button:hover { background: rgba(244, 94, 97, 0.35); }
        button:active { transform: scale(0.94); }
        button[aria-pressed="true"] {
          border-color: #f45e61;
          background: rgba(244, 94, 97, 0.85);
        }
      </style>
      <div class="bar" role="group" aria-label="Elegir figura / Choose figure"></div>
    `;

    const bar = shadow.querySelector(".bar")!;
    for (const fig of FIGURES) {
      const btn = document.createElement("button");
      btn.innerHTML = ICONS[fig.kind];
      btn.dataset.kind = fig.kind;
      const name = `${fig.label} / ${EN[fig.kind]}`;
      btn.title = name;
      btn.setAttribute("aria-label", name);
      btn.setAttribute("aria-pressed", String(fig.kind === this.selected));
      btn.addEventListener("click", () => this.select(fig.kind));
      bar.appendChild(btn);
    }
  }

  private select(kind: FigureKind): void {
    if (!isFigureKind(kind)) return;
    this.selected = kind;
    this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.kind === kind));
    });
    this.dispatchEvent(new CustomEvent<FigureKind>("figure-change", { detail: kind }));
  }
}

customElements.define("figure-selector", FigureSelector);
