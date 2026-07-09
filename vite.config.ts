import { defineConfig, type Plugin } from 'vite';

/**
 * Content-Security-Policy del build de producción.
 *
 * La app pide cámara (getUserMedia) y micrófono (SpeechRecognition). El bundle
 * ESM + runtime WASM de MediaPipe se vendorizan desde npm a public/mediapipe/
 * (ver scripts/vendor-mediapipe.mjs) y se sirven desde 'self' — ya NO hay CDN
 * de código en la CSP. Solo el MODELO (.task, datos, no código ejecutable)
 * sigue viniendo de storage.googleapis.com: es un binario de varios MB ajeno
 * al paquete npm; vendorizarlo exige una decisión de Git LFS para el repo
 * entero, fuera de este alcance (ver _audits/DECISIONES.md). Su origen queda
 * fijo en connect-src como única superficie externa restante.
 *
 * Notas:
 * - 'wasm-unsafe-eval' es necesario para compilar el WASM de MediaPipe.
 * - blob: en worker/connect cubre el ImageBitmap transferible y el loader
 *   interno de WASM de MediaPipe.
 */
const MODELS = 'https://storage.googleapis.com';

const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval' blob:`,
  `worker-src 'self' blob:`,
  `connect-src 'self' blob: ${MODELS}`,
  `img-src 'self' data: blob:`,
  `media-src 'self' blob: mediastream:`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

/** Inyecta el meta CSP solo en el build (no en dev: el HMR de Vite usa inline/eval). */
function cspMeta(): Plugin {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
      return html.replace('</title>', `</title>\n    ${tag}`);
    },
  };
}

export default defineConfig({
  // GitHub Pages sirve el proyecto bajo /web-ar-molecule-lab/, no en la raíz del
  // dominio. Sin este base, los assets se referencian como /assets/... y dan 404.
  base: '/web-ar-molecule-lab/',
  plugins: [cspMeta()],
});
