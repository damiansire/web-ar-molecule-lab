import { EVENT_TYPES } from "../utils/constants.js";

class CameraPermissions extends HTMLElement {
  constructor() {
    super();

    this.attachShadow({ mode: "open" }); // Shadow DOM para encapsulación

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"; // Misma URL que en tu HTML
    this.shadowRoot.appendChild(link); // Añade los estilos al Shadow DOM

    // Estilos (copiados de tu HTML, adaptados para Shadow DOM)
    const style = document.createElement("style");
    style.textContent = `
      :host { /* Estilos para el web component */
        display: block; /* Asegura que el componente ocupe espacio */
      }
           body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }

        .card {
            background-color: white;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 1.5rem;
            max-width: 28rem;
            width: 100%;
        }

        .card-header {
            margin-bottom: 1rem;
        }

        .card-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #111827;
            margin: 0;
        }

        .card-description {
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 0.25rem;
        }

        .card-content {
            margin-bottom: 1.5rem;
        }

        .alert {
            background-color: #f3f4f6;
            border-radius: 0.375rem;
            padding: 1rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: flex-start;
        }

        .alert-icon {
            color: #6b7280;
            margin-right: 0.75rem;
            font-size: 1rem;
            align-self: center;

        }

        .alert-title {
            font-weight: 600;
            color: #111827;
            margin: 0;
        }

        .alert-description {
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 0.25rem;
        }

        .image-container {
            border: 2px dashed #d1d5db;
            border-radius: 0.5rem;
            overflow: hidden;
            margin-bottom: 1rem;
        }

        img {
            max-width: 100%;
            height: auto;
            display: block;
        }

        .instruction {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 1rem;
        }

        button {
            background-color: #2563eb;
            color: white;
            border: none;
            padding: 0.625rem 1.25rem;
            border-radius: 0.375rem;
            cursor: pointer;
            width: 100%;
            font-size: 0.875rem;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: #1d4ed8;
        }

        button:disabled {
            background-color: #9ca3af;
            cursor: not-allowed;
        }
    `;

    // HTML (copiado de tu HTML, adaptado para Shadow DOM)
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <div class="card-header">
        <h1 class="card-title">Camera Permissions</h1>
        <p class="card-description">We need your permission to use the camera</p>
      </div>
      <div class="card-content">
        <div class="alert">
          <i class="fas fa-camera alert-icon"></i>
          <div>
            <h2 class="alert-title">Camera access required</h2>
            <p class="alert-description">Please allow camera access to use this feature.</p>
          </div>
        </div>
        <div class="image-container">
          <img src="https://placehold.co/480x270/png" alt="How to allow camera permissions">
        </div>
        <p class="instruction">Click the "Allow" button when prompted by your browser to grant camera access.</p>
      </div>
      <button id="permissionButton">Request Camera Permission</button>
    `;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(card);

    const permissionButton = this.shadowRoot.getElementById("permissionButton");

    this.updateButtonState = (state) => {
      allowCamera = state === "granted";
      permissionButton.textContent = allowCamera
        ? "Permission Granted"
        : "Request Camera Permission";
      permissionButton.disabled = allowCamera;

      const event = new CustomEvent(EVENT_TYPES.APP_STATE_CHANGED, {
        detail: {
          eventType: EVENT_TYPES.CAMERA_PERMISSIONS,
          allowCamera: allowCamera,
        },
      });
      this.dispatchEvent(event);

      console.log(
        "Se emitio un nuevo estado de",
        EVENT_TYPES.CAMERA_PERMISSIONS,
        ", con:",
        state
      );
    };

    this.checkPermission = () => {
      console.log("Revisando permisos de la camera");
      navigator.permissions.query({ name: "camera" }).then((result) => {
        console.log("el permiso: ", result.state);
        this.updateButtonState(result.state);
        result.onchange = () => this.updateButtonState(result.state);
      });
    };

    this.requestPermission = () => {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          this.updateButtonState("granted");
        })
        .catch((err) => {
          console.error("Error requesting camera permission:", err);
          this.updateButtonState("denied");
        });
    };

    permissionButton.addEventListener("click", this.requestPermission.bind(this)); // bind para el contexto

    this.checkPermission();
  }
}

customElements.define("camera-permissions", CameraPermissions);
