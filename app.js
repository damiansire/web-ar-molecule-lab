import { loadScript } from "./utils/load.js";
import { EVENT_TYPES, MODELS, PAGES } from "./utils/constants.js";

import "./components/camera-permissions.js"; // Importa los web components
import "./components/loading-model-screen.js";
import "./components/figure-selector.js";

loadScript("./vendor/p5.min.js");
loadScript("./vendor/ml5.min.js");

const app = document.getElementById("app");

const scriptState = {
  state: {
    "p5.min.js": false,
    "ml5.min.js": false,
  },
  get isAllLoaded() {
    return Object.values(this.state).every((value) => value === true);
  },
  updateState: function (scriptName) {
    this.state[scriptName] = true;
    if (this.isAllLoaded) {
      const event = new CustomEvent("appStateChanged", {
        detail: {
          eventType: EVENT_TYPES.CURRENT_PAGE_CHANGED,
          newPage: PAGES.HANDPOSE_MODEL,
        },
      });
      document.dispatchEvent(event);
    }
  },
};

document.addEventListener("scriptLoaded", (event) => {
  const { scriptName } = event.detail;
  scriptState.updateState(scriptName);
});

const appState = {
  state: {
    currentPage: PAGES.CAMERA_PERMISSIONS,
    selectedModel: MODELS.HANDPOSE,
  },
  handleAppStateChanged: function (event) {
    switch (event.detail.eventType) {
      case EVENT_TYPES.CAMERA_PERMISSIONS:
        this.handleEventCameraPermissions(event.detail);
        break;
      default:
        break;
    }
    renderApp();
  },
  handleEventCameraPermissions: function (detail) {
    if (detail.allowCamera) {
      this.state.currentPage = PAGES.LOADING;
      //TODO:PERFORMANCE: IF THE MODEL IS ALREADY LOADED, SKIP THE LOADING SCREEN
    }
  },
  get currentPage() {
    return this.state.currentPage;
  },
};

document.addEventListener(
  "appStateChanged",
  (event) => {
    appState.handleAppStateChanged(event);
  },
  {
    capture: true,
  }
);

function renderApp() {
  switch (appState.currentPage) {
    case PAGES.CAMERA_PERMISSIONS:
      app.innerHTML = "<camera-permissions></camera-permissions>";
      break;

    case PAGES.LOADING_MODEL:
      app.innerHTML = "<loading-model-screen></loading-model-screen>";
      break;

    default:
      break;
  }
}

renderApp();
