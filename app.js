import { EVENT_TYPES, PAGE_STATES } from "./utils/constants.js";
import "./components/camera-permissions.js"; // Importa los web components
import "./components/loading-model-screen.js";
import "./components/figure-selector.js";

const app = document.getElementById("app");
let ml5Cargado = false;

function cargarScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Error al cargar ${url}`));
    document.head.appendChild(script);
  });
}

const self = this; // Guardar el contexto

function manejarPermisosCamara(permissionState) {
  if (ml5Cargado) {
    mostrarFigureSelector();
  } else {
    mostrarLoadingModelScreen();
    cargarMl5();
  }
}

function cargarMl5() {
  cargarScript("./libs/ml5.min.js")
    .then(() => {
      ml5Cargado = true;
      mostrarFigureSelector();
    })
    .catch((error) => {
      console.error("Error al cargar ml5:", error);
      // Manejar el error adecuadamente
    });
}

function mostrarLoadingModelScreen() {
  app.innerHTML = "<loading-model-screen></loading-model-screen>";
  currentPage = PAGE_STATES.LOADING_MODEL; // Actualiza el estado de la página
}

function mostrarFigureSelector() {
  app.innerHTML = "<figure-selector></figure-selector>";
  currentPage = PAGE_STATES.FIGURE_SELECTOR; // Actualiza el estado de la página
}

document.addEventListener("DOMContentLoaded", () => {
  const appElement = document.querySelector("camera-permissions");
  console.log("encontrado el webcomponente");
  document.addEventListener(
    "appStateChanged",
    (event) => {
      const detail = event.detail;
      console.log(
        "Evento appStateChanged recibido (delegado) en index.html app.js:",
        detail
      );

      if (detail.eventType === "CAMERA_PERMISSIONS_GRANTED") {
        console.log("Permisos de cámara concedidos (delegado).");
        // Aquí puedes realizar las acciones necesarias.
      }
    },
    { capture: true }
  );
});
