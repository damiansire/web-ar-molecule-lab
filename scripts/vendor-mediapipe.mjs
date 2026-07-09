#!/usr/bin/env node
/**
 * Copia el runtime WASM + bundle ESM de @mediapipe/tasks-vision desde
 * node_modules a public/mediapipe/, para servirlos desde 'self' en vez de
 * jsdelivr (ver _audits/DECISIONES.md: hallazgo "MediaPipe sin SRI/vendorizado").
 *
 * Deliberadamente NO se commitea a git (public/mediapipe/ está en
 * .gitignore): es un artefacto de build 100% reproducible desde
 * node_modules/package-lock.json vía `npm ci`, igual que dist/. Corre como
 * `predev`/`prebuild` (npm ejecuta pre<script> automáticamente).
 *
 * El modelo (.task, storage.googleapis.com) NO se vendoriza acá: es un
 * binario de datos de varios MB ajeno al paquete npm — vendorizarlo exige
 * una decisión de Git LFS para el repo entero, fuera de este alcance. Sigue
 * sirviéndose desde el CDN de Google, con su origen fijado en la CSP.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision');
const DEST = join(ROOT, 'public', 'mediapipe');

// Bundle ESM explícito + TODO el directorio wasm/ (las variantes SIMD/no-SIMD/
// module que FilesetResolver elige según soporte del navegador no están
// fijadas por nombre en la API pública — copiar el directorio entero evita
// que un bump de versión agregue una variante nueva y quede afuera).
const BUNDLE_FILES = ['vision_bundle.mjs', 'vision_bundle.mjs.map'];

if (!existsSync(SRC)) {
  console.error(`vendor-mediapipe: no existe ${SRC} — ¿corriste \`npm install\`?`);
  process.exit(1);
}

let copied = 0;
for (const name of BUNDLE_FILES) {
  const from = join(SRC, name);
  if (!existsSync(from)) {
    console.error(`vendor-mediapipe: falta ${from} (¿cambió la versión del paquete?)`);
    process.exit(1);
  }
  mkdirSync(DEST, { recursive: true });
  copyFileSync(from, join(DEST, name));
  copied++;
}

const wasmSrc = join(SRC, 'wasm');
const wasmDest = join(DEST, 'wasm');
mkdirSync(wasmDest, { recursive: true });
for (const name of readdirSync(wasmSrc)) {
  copyFileSync(join(wasmSrc, name), join(wasmDest, name));
  copied++;
}

console.log(`vendor-mediapipe: ${copied} archivos copiados a public/mediapipe/`);
