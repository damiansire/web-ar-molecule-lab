import { loadScript } from "./utils/load.js";
import { EVENT_TYPES, MODELS, PAGES } from "./utils/constants.js";

import "./components/camera-permissions.js";
import "./components/loading-model-screen.js";
import "./components/figure-selector.js";

loadScript("./vendor/p5.min.js");
loadScript("./vendor/ml5.min.js");

const app = document.getElementById("app");

const appState = {
  state: {
    currentPage: PAGES.CAMERA_PERMISSIONS,
    selectedModel: MODELS.HANDPOSE,
    allowCamera: false,
    scriptsLoaded: {
      "p5.min.js": false,
      "ml5.min.js": false,
    },
    allScriptsLoaded: function () {
      return Object.values(this.scriptsLoaded).every((value) => value === true);
    },
  },

  handleAppStateChanged: function (event) {
    switch (event.detail.type) {
      case EVENT_TYPES.CAMERA_PERMISSIONS:
        this.handleEventCameraPermissions(event.detail);
        break;
      case EVENT_TYPES.SCRIPT_LOADED:
        this.handleScriptLoaded(event.detail.scriptName);
        break;
      default:
        break;
    }
    this.nextRoute();
    renderApp();
  },

  handleEventCameraPermissions: function (detail) {
    this.state.allowCamera = detail.allowCamera;
  },

  handleScriptLoaded: function (scriptName) {
    this.state.scriptsLoaded[scriptName] = true;
  },

  nextRoute: function () {
    const { currentPage } = this.state;

    switch (currentPage) {
      case PAGES.CAMERA_PERMISSIONS:
        if (this.state.allowCamera) {
          if (this.state.allScriptsLoaded()) {
            this.state.currentPage = PAGES.HANDPOSE_MODEL;
          } else {
            this.state.currentPage = PAGES.LOADING;
          }
        }
        break;

      case PAGES.LOADING:
        if (this.state.allScriptsLoaded()) {
          this.state.currentPage = PAGES.HANDPOSE_MODEL;
        }
        break;

      case PAGES.HANDPOSE_MODEL:

      default:
        break;
    }
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

document.addEventListener(
  "scriptLoaded",
  (event) => {
    appState.handleAppStateChanged({
      detail: { type: EVENT_TYPES.SCRIPT_LOADED, scriptName: event.detail.scriptName },
    });
  },
  { capture: true }
);

function renderApp() {
  switch (appState.state.currentPage) {
    case PAGES.CAMERA_PERMISSIONS:
      app.innerHTML = "<camera-permissions></camera-permissions>";
      break;

    case PAGES.LOADING:
      app.innerHTML = "<loading-model-screen></loading-model-screen>";
      break;

    case PAGES.HANDPOSE_MODEL:
      app.innerHTML = "hola";
      break;

    default:
      break;
  }
}

renderApp();
