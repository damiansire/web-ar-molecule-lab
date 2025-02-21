class FigureSelector extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("div");
    container.classList.add("principal-button-container");

    const buttons = [
      { id: "None", text: "Nada" },
      { id: "Cuadrado", text: "Cuadrado" },
      { id: "Cubo", text: "Cubo" },
      { id: "Cilindro", text: "Cilindro" },
      { id: "Cono", text: "Cono" },
      { id: "Toro", text: "Toro" },
      { id: "Esfera", text: "Esfera" },
    ];

    buttons.forEach((buttonData) => {
      const button = document.createElement("button");
      button.classList.add("figureButton");
      button.dataset.id = buttonData.id;
      button.textContent = buttonData.text;

      button.addEventListener("click", () => {
        const event = new CustomEvent("figure-selected", {
          detail: { figure: buttonData.id },
        });
        this.dispatchEvent(event);
      });

      container.appendChild(button);
    });

    const style = document.createElement("style");
    style.textContent = `
      .principal-button-container {
        display: flex;
        flex-direction: column; /* Your provided styles */
      }

      .figureButton {
        background: none;
        border: 0;
        box-sizing: border-box;
        margin: 1em;
        padding: 1em 2em;
        box-shadow: inset 0 0 0 2px #f45e61;
        color: #f45e61;
        font-size: inherit;
        font-weight: 700;
        position: relative;
        vertical-align: middle;
        cursor: pointer; /* Your provided styles */
      }
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);
  }
}

customElements.define("figure-selector", FigureSelector);
