class LoadingModelScreen extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });

    const container = document.createElement("section");
    container.id = "loading-model-message-container";

    const div1 = document.createElement("div");
    const span1 = document.createElement("span");
    span1.textContent = "Loading the Artificial Intelligence model...";
    div1.appendChild(span1);

    const div2 = document.createElement("div");
    const span2 = document.createElement("span");
    span2.textContent = "Please wait...";
    div2.appendChild(span2);

    container.appendChild(div1);
    container.appendChild(div2);

    const style = document.createElement("style");
    style.textContent = `
      #loading-model-message-container {
        position: absolute; /* Or fixed, depending on your needs */
        top: 50%; /* Center vertically */
        left: 50%; /* Center horizontally */
        transform: translate(-50%, -50%); /* Adjust for centering */
        background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
        padding: 20px;
        border-radius: 5px;
        color: white; /* Text color */
        text-align: center; /* Center text */
        z-index: 1000; /* Ensure it's on top */
      }

      #loading-model-message-container div {
        margin-bottom: 10px; /* Space between lines */
      }
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);
  }

  // Method to show/hide the message
  show() {
    this.style.display = "block"; // Or however you want to show it
  }

  hide() {
    this.style.display = "none";
  }
}

customElements.define("loading-model-screen", LoadingModelScreen);
