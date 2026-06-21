import { defineConfig } from "vite";

// `base: "./"` produces relative asset URLs so the build works both at a domain
// root and under a sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  worker: {
    // El worker es clásico (carga MediaPipe con importScripts); ver el archivo
    // del worker. IIFE es el formato correcto para un worker clásico.
    format: "iife",
  },
  build: {
    target: "es2022",
    // Three.js (build WebGPU + TSL/node-materials) queda aislado en su propio
    // chunk y se carga lazy (sólo al entrar a la vista AR), así que su tamaño es
    // esperado y no una regresión. El bundle WebGPU es mayor que el core WebGL.
    chunkSizeWarningLimit: 900,
  },
});
