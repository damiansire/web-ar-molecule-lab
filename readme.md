# AR Hand Figures

[![CI](https://github.com/damiansire/artificial-intelligence-augmented-reality-figures/actions/workflows/ci.yml/badge.svg)](https://github.com/damiansire/artificial-intelligence-augmented-reality-figures/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Realidad aumentada en el navegador: detecta tu mano con la cámara y dibuja una
figura 3D que la sigue en tiempo real. La detección corre en un **Web Worker**
(MediaPipe Hand Landmarker) para no bloquear el hilo principal, y el render 3D
lo hace **Three.js**.

**▶ Demo en vivo:** https://damiansire.github.io/artificial-intelligence-augmented-reality-figures/
_(requiere cámara; el video nunca sale de tu dispositivo)_

> Reescritura completa de la versión original (p5.js + ml5.js en el hilo
> principal). Se modernizó el stack, se separó el dominio puro de los _shells_
> imperativos y se movió la inferencia a un worker.

## Qué se puede hacer

Elegir entre 6 figuras 3D que siguen la mano (con **perspectiva**: cerca = más
grande), ajustar tamaño/velocidad/opacidad/material/color, mostrar aristas o
wireframe, sombra, **dos manos** a la vez, fondo de color, **oclusión** (la
figura queda detrás al dar vuelta la mano —_calibrada para la mano derecha_: con
la mano izquierda la oclusión se dispara con la palma en vez del dorso) y **sacar
una foto** (descarga un PNG). Cuando no hay mano, la figura queda de preview en
la esquina.

## Cómo funciona

```
┌───────────────── hilo principal ─────────────────┐      ┌──── Web Worker ────┐
│  cámara (getUserMedia) ──► <video>                │      │  MediaPipe         │
│        │ ImageBitmap (transferible)               │ ───► │  HandLandmarker    │
│        ▼                                          │      │  (WASM + GPU)      │
│  Three.js  ◄── landmarks ──────────────────────── │ ◄─── │  detectForVideo()  │
│  (figura 3D sobre la mano)                        │      └────────────────────┘
└───────────────────────────────────────────────────┘
```

- **`src/domain/`** — lógica pura y testeada (máquina de estados, mapeo de
  landmarks a pantalla, catálogo de figuras). Sin DOM ni dependencias.
- **`src/camera/`** — acceso a la cámara con errores tipados.
- **`src/inference/`** — el worker de MediaPipe y su cliente con back-pressure
  (un solo cuadro en vuelo; si llega otro antes de terminar, se descarta).
- **`src/render/`** — escena Three.js con cámara ortográfica mapeada a píxeles.
- **`src/ui/`** — pantallas (permiso / carga / error) y el `<figure-selector>`.

## Requisitos

- Node.js ≥ 20
- Un navegador con WebGL y `getUserMedia` (HTTPS o `localhost`).

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo (Vite)
npm test           # tests de dominio (Vitest)
npm run typecheck  # TypeScript en modo estricto
npm run format     # formatea con Prettier
npm run build      # build de producción a dist/
```

> La cámara sólo funciona en `localhost` o bajo HTTPS (requisito del navegador).

## Despliegue

Hay un workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
que publica `dist/` en **GitHub Pages** en cada push a `main`/`master`. Para
activarlo: Settings → Pages → Source: **GitHub Actions**. El `base` es relativo
(`./`), así que funciona tanto en la raíz como en un sub-path de proyecto.

## Configuración del modelo

Los assets de MediaPipe (bundle JS + WASM + modelo `.task`) se cargan desde el
CDN oficial, fijados por versión en [`src/config.ts`](src/config.ts). Para
self-hostearlos, copiá esos archivos a `public/` y cambiá las URLs.

El worker es **clásico** (no de tipo módulo) y carga MediaPipe con
`importScripts`: MediaPipe lo necesita, y así el mismo código funciona igual en
el dev server y en el build. Detalle en
[`hand-landmarker.worker.ts`](src/inference/hand-landmarker.worker.ts).

## Stack

Vite · TypeScript · Three.js · @mediapipe/tasks-vision · Vitest
