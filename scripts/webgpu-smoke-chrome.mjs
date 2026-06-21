/**
 * Smoke-test de runtime del render WebGPU apuntando al **Chrome de escritorio del
 * sistema** (no al Chromium empaquetado de Playwright).
 *
 * Motivo: con el Chromium de Playwright, `navigator.gpu.requestAdapter()` daba
 * null (sin backend GPU disponible en ese build). El Chrome real del sistema usa
 * el backend **D3D12** sobre la GPU física (Intel Iris Xe), así que el adapter
 * WebGPU debería existir de verdad.
 *
 * Diferencia clave con webgpu-smoke.mjs: `chromium.launch({ channel: 'chrome' })`.
 * Acepta MODE=headless | headed | new (default: headless) por env var, para
 * probar ambos (headed sobre GPU real casi siempre expone WebGPU).
 *
 * Sirve `dist/` por HTTP en 127.0.0.1 (origen seguro → navigator.gpu disponible),
 * importa el módulo real ar-scene.js, crea ARScene.create(canvas) con preferencia
 * WebGPU (NO fuerza WebGL), fuerza un render y lee píxeles en el mismo tick.
 *
 * Uso: npm run build && MODE=headed node scripts/webgpu-smoke-chrome.mjs
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

const MODE = (process.env.MODE ?? "headless").toLowerCase();

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
console.log(`[mode] ${MODE}`);

const fs = await import("node:fs/promises");
const assets = await fs.readdir(join(DIST, "assets"));
const arSceneFile = assets.find((f) => /^ar-scene-.*\.js$/.test(f));
if (!arSceneFile)
  throw new Error("No se encontró el chunk ar-scene-*.js en dist/assets.");
console.log(`[build] chunk del renderer: assets/${arSceneFile}`);

// Flags mínimos: NO forzamos swiftshader ni angle (queremos la GPU física real).
// --enable-unsafe-webgpu por si el build necesita el flag para exponer la API.
const launchArgs = ["--enable-unsafe-webgpu"];

const launchOpts = { channel: "chrome", args: launchArgs };
if (MODE === "headed") {
  launchOpts.headless = false;
} else if (MODE === "new") {
  // headless "new" de Chrome (soporta GPU). Playwright no tiene flag directo;
  // usamos headless:false-equivalente vía el flag de Chrome.
  launchOpts.headless = true;
  launchOpts.args = [...launchArgs, "--headless=new"];
} else {
  launchOpts.headless = true;
}

let browser;
try {
  browser = await chromium.launch(launchOpts);
} catch (e) {
  console.error(`[launch] FALLO al lanzar Chrome del sistema (channel:'chrome'): ${e}`);
  server.close();
  process.exit(2);
}
console.log(
  `[launch] Chrome del sistema lanzado (channel:'chrome', headless=${launchOpts.headless ?? false})`,
);

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
    rendererIsWebGPU: null,
    canvasSize: null,
    pixelStats: null,
  };

  // 1) navigator.gpu + requestAdapter (sin forzar nada)
  const gpu = navigator.gpu;
  out.hasNavigatorGpu = !!gpu;
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) {
        let info = null;
        try {
          info =
            adapter.info ??
            (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
        } catch {
          /* algunos builds no exponen info */
        }
        out.adapter = {
          isFallbackAdapter: !!adapter.isFallbackAdapter,
          features: [...(adapter.features ?? [])].slice(0, 12),
          info: info
            ? {
                vendor: info.vendor,
                architecture: info.architecture,
                device: info.device,
                description: info.description,
                backend: info.backend, // suele decir "D3D12"/"vulkan"/etc en Chrome
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

  // 2) Crear la ARScene REAL contra un canvas en el DOM (preferencia WebGPU).
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
    const be = scene.renderer?.backend;
    out.rendererIsWebGPU = !!be?.isWebGPUBackend;
    out.rendererBackendField = be?.isWebGPUBackend
      ? "WebGPUBackend"
      : be?.isWebGLBackend
        ? "WebGLBackend"
        : (be?.constructor?.name ?? "(desconocido)");

    scene.renderer.setClearColor(0x113355, 1);

    const glCanvas = scene.renderForCapture();
    out.canvasSize = { w: glCanvas.width, h: glCanvas.height };

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

await page.screenshot({ path: join(__dirname, `webgpu-smoke-chrome-${MODE}.png`) });

await browser.close();
server.close();

console.log("\n================ RESULTADO ================");
console.log(JSON.stringify(result, null, 2));
console.log("\n================ CONSOLA DEL BROWSER ================");
console.log(consoleLines.length ? consoleLines.join("\n") : "(sin logs de consola)");
console.log(`\n[screenshot] scripts/webgpu-smoke-chrome-${MODE}.png`);
