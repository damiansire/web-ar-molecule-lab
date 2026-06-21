/**
 * Smoke-test de runtime del render WebGPU (Three.js WebGPURenderer/TSL con
 * fallback WebGL2) del repo ar-hand-figures.
 *
 * Sirve `dist/` estáticamente, abre Chromium headless con flags para habilitar
 * WebGPU por software (SwiftShader/Vulkan/Dawn) y, dentro de la página, importa
 * el módulo real `ar-scene.js` para:
 *   1. Reportar navigator.gpu y requestAdapter() (backend real del adapter).
 *   2. Crear la ARScene contra un <canvas> real (ARScene.create) — esto ejecuta
 *      la MISMA selección de backend que la app (WebGPU o fallback WebGL2) y el
 *      renderer.init() async.
 *   3. Renderizar un frame explícito (renderForCapture) y leer píxeles del canvas
 *      para confirmar que NO quedó vacío/transparente.
 *
 * Uso: npm run build && node scripts/webgpu-smoke.mjs
 *
 * Salida: imprime un JSON con hasNavigatorGpu, info del adapter, backend elegido
 * por la ARScene (webgpu|webgl) y estadísticas de píxeles del canvas renderizado,
 * más toda la consola del browser. Deja una captura en scripts/webgpu-smoke.png.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");

// Playwright se instala vía `npx playwright` (no como dep local), así que lo
// resolvemos: primero como módulo normal y, si no, escaneando el cache de npx.
const require = createRequire(import.meta.url);
async function resolvePlaywright() {
  try {
    return require("playwright");
  } catch {
    /* no instalado localmente */
  }
  const npxCache = join(
    process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? "", "AppData/Local"),
    "npm-cache",
    "_npx",
  );
  if (existsSync(npxCache)) {
    const { readdirSync } = await import("node:fs");
    for (const dir of readdirSync(npxCache)) {
      const p = join(npxCache, dir, "node_modules", "playwright");
      if (existsSync(p)) {
        try {
          return require(p);
        } catch {
          /* siguiente candidato */
        }
      }
    }
  }
  throw new Error("No se pudo resolver playwright (ni local ni en el cache de npx).");
}
const { chromium } = await resolvePlaywright();

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
  ".svg": "image/svg+xml",
};

// Servidor estático mínimo de dist/. Inyecta COOP/COEP por las dudas y deja la
// CSP del index tal cual (se sirve el HTML real).
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let p = normalize(join(DIST, decodeURIComponent(url.pathname)));
    if (!p.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (url.pathname === "/" || !existsSync(p)) p = join(DIST, "index.html");
    const body = await readFile(p);
    res.writeHead(200, {
      "Content-Type": MIME[extname(p)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(404).end(String(e));
  }
});

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const base = `http://127.0.0.1:${port}`;
console.log(`[server] dist servido en ${base}`);

// Localizamos el chunk real del renderer (ar-scene-*.js) en dist/assets.
const fs = await import("node:fs/promises");
const assets = await fs.readdir(join(DIST, "assets"));
const arSceneFile = assets.find((f) => /^ar-scene-.*\.js$/.test(f));
if (!arSceneFile) throw new Error("No se encontró el chunk ar-scene-*.js en dist/assets.");
console.log(`[build] chunk del renderer: assets/${arSceneFile}`);

const launchArgs = [
  "--enable-unsafe-webgpu",
  "--enable-features=Vulkan",
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--ignore-gpu-blocklist",
  "--enable-webgpu-developer-features",
];

const browser = await chromium.launch({ headless: true, args: launchArgs });
const page = await browser.newPage();

const consoleLines = [];
page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

await page.goto(base, { waitUntil: "load" });

const result = await page.evaluate(async (arScenePath) => {
  const out = {
    hasNavigatorGpu: false,
    adapter: null,
    adapterError: null,
    sceneBackend: null,
    sceneError: null,
    rendererBackendField: null,
    canvasSize: null,
    pixelStats: null,
  };

  // 1) navigator.gpu + requestAdapter
  const gpu = navigator.gpu;
  out.hasNavigatorGpu = !!gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        let info = null;
        try {
          info = adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
        } catch {
          /* algunos builds no exponen info */
        }
        out.adapter = {
          isFallbackAdapter: !!adapter.isFallbackAdapter,
          features: [...(adapter.features ?? [])].slice(0, 8),
          info: info
            ? {
                vendor: info.vendor,
                architecture: info.architecture,
                device: info.device,
                description: info.description,
              }
            : "(adapter.info no expuesto)",
        };
      } else {
        out.adapter = "requestAdapter() devolvió null";
      }
    } catch (e) {
      out.adapterError = String(e);
    }
  }

  // 2) Crear la ARScene REAL contra un canvas en el DOM.
  const canvas = document.createElement("canvas");
  canvas.style.width = "640px";
  canvas.style.height = "480px";
  canvas.width = 640;
  canvas.height = 480;
  document.body.appendChild(canvas);

  try {
    const mod = await import(arScenePath);
    const scene = await mod.ARScene.create(canvas);
    out.sceneBackend = scene.backend ?? "(sin campo backend)";
    out.rendererBackendField = scene.renderer?.backend?.isWebGPUBackend
      ? "WebGPUBackend"
      : scene.renderer?.backend?.isWebGLBackend
        ? "WebGLBackend"
        : scene.renderer?.backend?.constructor?.name ?? "(desconocido)";

    // Color de fondo NO transparente para verificar que el renderer pinta:
    // setClearColor en el constructor es alpha 0; lo subimos para el test.
    scene.renderer.setClearColor(0x113355, 1);

    // 3) Forzar un render y leer píxeles EN EL MISMO TICK. Sin
    // preserveDrawingBuffer, el backbuffer WebGL se limpia tras la composición,
    // así que el readback (drawImage) debe ir inmediatamente después del render,
    // sin awaits intermedios que cedan al compositor.
    const glCanvas = scene.renderForCapture();
    out.canvasSize = { w: glCanvas.width, h: glCanvas.height };

    // Readback: copiamos el canvas WebGPU/WebGL a un canvas 2D (drawImage
    // funciona para ambos) y muestreamos píxeles. Inmediato, mismo tick.
    const probe = document.createElement("canvas");
    probe.width = glCanvas.width;
    probe.height = glCanvas.height;
    const ctx = probe.getContext("2d");
    ctx.drawImage(glCanvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    let nonZero = 0;
    let nonTransparent = 0;
    let rSum = 0,
      gSum = 0,
      bSum = 0;
    const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        a = data[i + 3];
      if (r || g || b) nonZero++;
      if (a > 0) nonTransparent++;
      rSum += r;
      gSum += g;
      bSum += b;
    }
    out.pixelStats = {
      totalPixels: total,
      nonZeroRGB: nonZero,
      nonTransparent,
      avg: {
        r: Math.round(rSum / total),
        g: Math.round(gSum / total),
        b: Math.round(bSum / total),
      },
    };

    scene.dispose?.();
  } catch (e) {
    out.sceneError = String(e?.stack || e);
  }

  return out;
}, `${base}/assets/${arSceneFile}`);

await page.screenshot({ path: join(__dirname, "webgpu-smoke.png") });

await browser.close();
server.close();

console.log("\n================ RESULTADO ================");
console.log(JSON.stringify(result, null, 2));
console.log("\n================ CONSOLA DEL BROWSER ================");
console.log(consoleLines.length ? consoleLines.join("\n") : "(sin logs de consola)");
console.log("\n[screenshot] scripts/webgpu-smoke.png");
