# Frame budget del hand-tracking (warm-adn-1)

Este documento cubre dos cosas separadas: (1) que la inferencia de MediaPipe ya
corre en un Web Worker, no en el hilo principal, y (2) el presupuesto de
tiempo por frame que ese diseño implica — con la salvedad honesta de cómo se
midió.

## Estado real: la inferencia YA vive en un Web Worker

Antes de este trabajo ya existía `public/hands-worker.js` (worker **clásico**,
no module — MediaPipe necesita `importScripts` para su loader de WASM, que no
existe en module workers) + `src/hands.ts` (`HandTracker`) que lo maneja. El
diseño:

- **`OffscreenCanvas` + `ImageBitmap` transferible.** `HandTracker.grabBitmap()`
  dibuja el `<video>` en un `OffscreenCanvas` reusado (sin allocar de nuevo por
  frame), lo escala a `DETECT_WIDTH = 480px` y lo entrega como `ImageBitmap`
  transferido (zero-copy) al worker vía `postMessage(msg, [bitmap])`.
- **Back-pressure de 1 frame en vuelo.** `pump()` no manda un frame nuevo si
  `busy` sigue `true` (el worker no devolvió el resultado anterior) — evita
  encolar frames más rápido de lo que el worker los puede procesar.
- **Watchdog de dos capas**: `WORKER_RESULT_TIMEOUT_MS` (2s) suelta el
  back-pressure si un `result` se perdió o el worker murió sin disparar
  `error`; `WORKER_INIT_TIMEOUT_MS` (9s) cubre el arranque (CDN/WASM colgado).
  Si el worker no está disponible, cae a un `HandLandmarker` síncrono en el
  hilo principal (`initSync`) — degradado pero funcional.
- **Protocolo tipado** (`src/hands-worker-protocol.ts`): antes los mensajes se
  armaban y leían como objetos sueltos (`e.data?.type === 'result'`, cast a
  `any` implícito). Ahora `MainToWorkerMessage`/`WorkerToMainMessage` son
  uniones discriminadas con un type guard (`isWorkerToMainMessage`) — el
  worker sigue siendo JS clásico (no puede `import` el módulo TS), pero sus
  literales deben mirrorear esas formas exactamente (comentario cruzado en
  ambos archivos).

Este trabajo (warm-adn-1) agregó la capa tipada; el worker/OffscreenCanvas ya
existían de una iteración previa del repo.

## Presupuesto de frame: qué mide el código y cómo

El bombeo está limitado a `MIN_DETECT_INTERVAL_MS = 33ms` (~30Hz) en
`hands.ts` — no tiene sentido pedir detección más rápido que eso, y así se
acota cuánto trabajo por segundo puede generar el hilo principal (grab +
postMessage) y el worker (inferencia GPU/WASM).

`src/main.ts` ya instrumenta en runtime (bloque `SHOW_PERF`, solo en dev):

- `perfFps`: FPS del loop principal (media móvil).
- `perfFrameMs`: tiempo del *cuerpo* del loop por frame (desde el inicio de
  `loop()` hasta después de `render()`) — este es el costo en el hilo
  principal, que YA NO incluye la inferencia de MediaPipe (vive en el
  worker); si `perfFrameMs` se dispara, el sospechoso es render/interacción,
  no el tracking.
- `perfDetectHz`: frecuencia real de resultados devueltos por el tracker
  (`tracker.resultCount` diferenciado en el tiempo) — el Hz real de
  inferencia, topeado por `MIN_DETECT_INTERVAL_MS` y por cuánto tarda el
  worker en digerir cada frame.

Estas tres métricas se pintan en el HUD (esquina inferior, solo `import.meta.env.DEV`)
y se exponen en `window.__perf()` para leerlas por consola/script.

## Por qué NO hay un trace real de Chrome DevTools Performance acá

**Esto es explícito, no un detalle a pasar por alto**: este entorno de trabajo
no tiene una cámara real ni una sesión de navegador con GUI donde grabar un
trace de Chrome DevTools Performance mientras se mueve una mano frente a la
cámara — que es el escenario que hay que perfilar (el worker solo hace
trabajo real cuando `getUserMedia` entrega frames de video). Se intentó
levantar el flujo completo vía el Browser pane disponible en esta sesión: la
carga de MediaPipe (WASM + modelo) sí corrió y quedó lista ("Graph
successfully started running." en consola), pero sin un dispositivo de cámara
no hay forma de generar frames de mano reales para que `HandLandmarker`
detecte algo, y por lo tanto tampoco carga útil para el worker que perfilar.

En vez de inventar un trace o pegar números falsos, este documento se queda
con la instrumentación real que el código expone (`perfFps`/`perfFrameMs`/
`perfDetectHz` arriba) como la mejor aproximación disponible sin cámara. Si en
algún momento se corre con cámara real:

1. Abrir el juego con `npm run dev`, activar la cámara.
2. Chrome DevTools → pestaña **Performance** → grabar ~10s moviendo una mano.
3. Exportar el trace (`.json`) a `docs/perf/` junto a este documento.
4. Contrastar el tiempo de `postMessage`→`result` (round-trip del worker)
   contra `perfFrameMs` del hilo principal — deberían ser independientes: un
   worker lento NO debería subir `perfFrameMs`, solo bajar `perfDetectHz`.
