/**
 * Componente `<experience-selector>`: barra para elegir la experiencia creativa
 * (figuras, dibujar, atrapar, galaxia, láseres). Emite `experience-change` con
 * `detail.kind`. Encapsulado en Shadow DOM, mismo lenguaje visual que
 * `<figure-selector>` pero con botones algo más grandes (es el selector primario).
 */
import {
  EXPERIENCES,
  DEFAULT_EXPERIENCE,
  isExperienceKind,
  type ExperienceKind,
} from "../domain/experiences";
import { ICONS } from "./icons";

// Nombre en inglés para el tooltip bilingüe (el ícono es el cue principal).
const EN: Record<ExperienceKind, string> = {
  figuras: "3D shapes",
  dibujo: "Draw",
  atrapar: "Catch",
  galaxia: "Galaxy",
  lasers: "Lasers",
};

export class ExperienceSelector extends HTMLElement {
  private selected: ExperienceKind = DEFAULT_EXPERIENCE;

  connectedCallback(): void {
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { display: block; }
        .bar {
          display: flex; flex-wrap: wrap; gap: 0.5rem;
          justify-content: center; padding: 0.6rem 0.75rem;
        }
        button {
          appearance: none; cursor: pointer;
          display: grid; place-items: center;
          width: 3.2rem; height: 3.2rem;
          background: rgba(17, 24, 39, 0.6);
          color: #f9fafb;
          border: 2px solid transparent;
          border-radius: 0.9rem;
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
      <div class="bar" role="group" aria-label="Elegir experiencia / Choose experience"></div>
    `;

    const bar = shadow.querySelector(".bar")!;
    for (const exp of EXPERIENCES) {
      const btn = document.createElement("button");
      btn.innerHTML = ICONS[exp.kind];
      btn.dataset.kind = exp.kind;
      const name = `${exp.label} / ${EN[exp.kind]}`;
      btn.title = name;
      btn.setAttribute("aria-label", name);
      btn.setAttribute("aria-pressed", String(exp.kind === this.selected));
      btn.addEventListener("click", () => this.select(exp.kind));
      bar.appendChild(btn);
    }
  }

  private select(kind: ExperienceKind): void {
    if (!isExperienceKind(kind)) return;
    this.selected = kind;
    this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.kind === kind));
    });
    this.dispatchEvent(new CustomEvent<ExperienceKind>("experience-change", { detail: kind }));
  }
}

customElements.define("experience-selector", ExperienceSelector);
