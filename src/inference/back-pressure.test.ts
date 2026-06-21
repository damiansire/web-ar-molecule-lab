import { describe, it, expect } from "vitest";
import { BackPressure } from "./back-pressure";

describe("BackPressure", () => {
  it("arranca libre", () => {
    expect(new BackPressure().busy).toBe(false);
  });

  it("el primer tryAcquire toma el gate", () => {
    const bp = new BackPressure();
    expect(bp.tryAcquire()).toBe(true);
    expect(bp.busy).toBe(true);
  });

  it("dropea mientras hay un cuadro en vuelo", () => {
    const bp = new BackPressure();
    expect(bp.tryAcquire()).toBe(true);
    expect(bp.tryAcquire()).toBe(false); // segundo cuadro: dropeado
    expect(bp.tryAcquire()).toBe(false);
    expect(bp.busy).toBe(true);
  });

  it("release libera el gate y deja pasar el siguiente cuadro", () => {
    const bp = new BackPressure();
    bp.tryAcquire();
    bp.release();
    expect(bp.busy).toBe(false);
    expect(bp.tryAcquire()).toBe(true); // ahora sí pasa
  });

  it("ciclo result: acquire -> release -> acquire (no se traba)", () => {
    const bp = new BackPressure();
    for (let i = 0; i < 5; i++) {
      expect(bp.tryAcquire()).toBe(true);
      bp.release(); // simula 'result' del worker
    }
  });

  it("libera ante un fallo de captura (createImageBitmap reject)", () => {
    const bp = new BackPressure();
    bp.tryAcquire();
    // El shell captura la excepción y llama release(); el gate no queda trabado.
    bp.release();
    expect(bp.tryAcquire()).toBe(true);
  });

  it("libera ante detect-error del worker (no se congela la detección)", () => {
    const bp = new BackPressure();
    bp.tryAcquire();
    bp.release(); // simula 'detect-error'
    expect(bp.busy).toBe(false);
  });

  it("release es idempotente (detect-error tardío seguido de result)", () => {
    const bp = new BackPressure();
    bp.tryAcquire();
    bp.release();
    bp.release(); // doble release no rompe
    expect(bp.busy).toBe(false);
    expect(bp.tryAcquire()).toBe(true);
  });

  it("reset deja el gate libre aunque hubiera un cuadro en vuelo", () => {
    const bp = new BackPressure();
    bp.tryAcquire();
    bp.reset(); // p. ej. al recrear el worker tras timeout de init
    expect(bp.busy).toBe(false);
    expect(bp.tryAcquire()).toBe(true);
  });
});
