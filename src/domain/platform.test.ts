import { describe, it, expect } from "vitest";
import { isWebKit, webKitMajorVersion, supportsGpuDelegate } from "./platform";

// User-agents representativos (recortados de los reales).
const UA = {
  safari17:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  safari16:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  iosSafari16:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
  chrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
};

describe("isWebKit", () => {
  it("reconoce Safari de escritorio", () => {
    expect(isWebKit(UA.safari17)).toBe(true);
  });
  it("reconoce Safari de iOS", () => {
    expect(isWebKit(UA.iosSafari16)).toBe(true);
  });
  it("descarta Chrome (aunque diga Safari en el UA)", () => {
    expect(isWebKit(UA.chrome)).toBe(false);
  });
  it("descarta Edge", () => {
    expect(isWebKit(UA.edge)).toBe(false);
  });
  it("descarta Firefox", () => {
    expect(isWebKit(UA.firefox)).toBe(false);
  });
});

describe("webKitMajorVersion", () => {
  it("extrae la versión mayor de Safari", () => {
    expect(webKitMajorVersion(UA.safari17)).toBe(17);
    expect(webKitMajorVersion(UA.safari16)).toBe(16);
  });
  it("es null para navegadores no-WebKit", () => {
    expect(webKitMajorVersion(UA.chrome)).toBeNull();
    expect(webKitMajorVersion(UA.firefox)).toBeNull();
  });
});

describe("supportsGpuDelegate", () => {
  it("nunca habilita GPU sin WebGL2", () => {
    expect(supportsGpuDelegate(UA.chrome, false)).toBe(false);
    expect(supportsGpuDelegate(UA.safari17, false)).toBe(false);
  });
  it("habilita GPU en navegadores no-WebKit con WebGL2", () => {
    expect(supportsGpuDelegate(UA.chrome, true)).toBe(true);
    expect(supportsGpuDelegate(UA.firefox, true)).toBe(true);
  });
  it("habilita GPU en Safari >= 17", () => {
    expect(supportsGpuDelegate(UA.safari17, true)).toBe(true);
  });
  it("bloquea GPU en Safari < 17 aunque haya WebGL2", () => {
    expect(supportsGpuDelegate(UA.safari16, true)).toBe(false);
    expect(supportsGpuDelegate(UA.iosSafari16, true)).toBe(false);
  });
});
