import { defineConfig } from "vite";

// `base: "./"` produces relative asset URLs so the build works both at a domain
// root and under a sub-path (e.g. GitHub Pages project sites).
export default defineConfig({
  base: "./",
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
    // Three.js queda aislado en su propio chunk y se carga lazy (sólo al entrar
    // a la vista AR), así que su tamaño es esperado y no una regresión.
    chunkSizeWarningLimit: 600,
  },
});
