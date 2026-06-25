import { defineConfig, type Plugin } from 'vite';

/**
 * Content-Security-Policy del build de producción.
 *
 * La app pide cámara (getUserMedia) y micrófono (SpeechRecognition) y el worker
 * de tracking baja, por `import()` dinámico, el bundle + WASM de MediaPipe desde
 * jsdelivr y el modelo desde storage.googleapis.com. Sin CSP, un compromiso de
 * esos CDN ejecutaría código arbitrario en una página con acceso a la cámara —
 * justo lo que el overlay promete que no pasa. La CSP acota los orígenes a
 * 'self' + los CDN estrictamente necesarios (defensa en profundidad).
 *
 * Notas:
 * - 'wasm-unsafe-eval' es necesario para compilar el WASM de MediaPipe.
 * - blob: en worker/connect/script cubre el loader de WASM de MediaPipe.
 * - SRI no se aplica acá: el `import()` dinámico del worker no admite integrity
 *   por hash; vendorizar @mediapipe (ya es dep npm) y servirlo desde 'self'
 *   sería el cierre completo del vector — queda como mejora pendiente.
 */
const CDN = 'https://cdn.jsdelivr.net';
const MODELS = 'https://storage.googleapis.com';

const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval' blob: ${CDN}`,
  `worker-src 'self' blob:`,
  `connect-src 'self' blob: ${CDN} ${MODELS}`,
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
