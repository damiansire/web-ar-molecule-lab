import { describe, it, expect } from "vitest";
import { INITIAL_STATE, transition, type AppState } from "./app-state";

describe("app-state machine", () => {
  it("arranca pidiendo permiso de cámara", () => {
    expect(INITIAL_STATE.status).toBe("requesting-permission");
  });

  it("permiso concedido → carga el modelo", () => {
    const next = transition(INITIAL_STATE, { type: "PERMISSION_GRANTED" });
    expect(next.status).toBe("loading-model");
  });

  it("permiso denegado → pantalla de denegado", () => {
    const next = transition(INITIAL_STATE, { type: "PERMISSION_DENIED" });
    expect(next.status).toBe("permission-denied");
  });

  it("desde denegado se puede reintentar", () => {
    const denied: AppState = { status: "permission-denied" };
    expect(transition(denied, { type: "RETRY" }).status).toBe("requesting-permission");
  });

  it("modelo cargado → listo", () => {
    const loading: AppState = { status: "loading-model" };
    expect(transition(loading, { type: "MODEL_LOADED" }).status).toBe("ready");
  });

  it("error del modelo guarda el mensaje", () => {
    const loading: AppState = { status: "loading-model" };
    const next = transition(loading, { type: "MODEL_ERROR", message: "boom" });
    expect(next).toEqual({ status: "error", error: "boom" });
  });

  it("desde error se puede reintentar", () => {
    const errored: AppState = { status: "error", error: "x" };
    expect(transition(errored, { type: "RETRY" }).status).toBe("requesting-permission");
  });

  it("ignora eventos fuera de orden (sin saltos inválidos)", () => {
    // Cargar modelo sin permiso no debe hacer nada.
    expect(transition(INITIAL_STATE, { type: "MODEL_LOADED" })).toBe(INITIAL_STATE);
    // Una vez listo, permanece listo.
    const ready: AppState = { status: "ready" };
    expect(transition(ready, { type: "PERMISSION_DENIED" })).toBe(ready);
  });
});
