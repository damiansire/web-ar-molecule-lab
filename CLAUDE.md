# CLAUDE.md (web-ar-molecule-lab)

Sandbox de alquimia en el navegador: hand-tracking (MediaPipe) + voz combinan átomos en
moléculas, todo client-side, sin backend. Stack: TypeScript + Vite, sin framework de UI.
La barra de abajo cubre gráficos y seguimiento de manos en el navegador, Node/TypeScript,
arquitectura y tipado.

## Barra de calidad (build-time, no solo auditoría)

Este repo se **construye** contra la barra de abajo desde el primer cambio; revisar el drift
contra ella es una verificación, no el evento principal.

### Regla raíz: intención clara, sin adivinar
- **a.** Nombres revelan intención de dominio, no mecanismo (nada de `data`/`handle`/`manager`
  genéricos donde el dominio ya tiene un término; ver `chemistry.ts` como ejemplo bueno).
- **b.** Comentarios explican el POR QUÉ, nunca el QUÉ (si parafrasea el código, hay que
  renombrar/extraer en vez de comentar).
- **c.** Superficie pública autodocumentada: firma + tipos comunican el contrato sin leer el
  cuerpo.

### Encapsulamiento del cambio
- **d.** Un cambio en el core no debería tocar N archivos dispersos (evitar lógica duplicada
  que puede divergir; hoy `chemistry.ts` tiene dos motores de mezcla, no reintroducir ese
  patrón en código nuevo).
- **e.** Features borrables sin cirugía: nada de God-modules. `main.ts` es hoy la excepción
  a evitar (DOM+cámara+audio+FSM+render sin exports): código nuevo va en módulos con
  superficie exportada y testeable, no se le agrega más peso a `main.ts`.

### Integridad de estado / Resiliencia
- **f.** Estado se deriva, no se muta a escondidas.
- **g.** Consistencia ante excepción: nunca a medias.
- **h.** Boundaries (worker, cámara, red) comunican fallos vía log/telemetría, no se tragan
  errores en silencio.
- **i.** Límites explícitos: timeouts y reintentos acotados en toda llamada a un recurso
  externo (worker init, CDN, getUserMedia).
- **j.** Fail-closed donde importa (permisos de cámara/mic).

### Legibilidad en frío
- **k.** El README lidera con prueba visible + framing honesto; nombre/descripción no inflan
  ni sub-venden lo que el repo hace.
- **l.** Donde se promete robustez o performance, la prueba (test o benchmark reproducible)
  existe en esa ruta.
- **m.** Framing honesto: se reconoce el límite del claim (ej. postura de seguridad real vs
  la documentada).

## Reglas de stack (enforzables)

- **TypeScript estricto de verdad.** `tsconfig.json` tiene `strict: true`: no reintroducir
  `any` implícito ni explícito; si un dato es genuinamente desconocido, usar `unknown` +
  type narrowing, nunca `as Type` para silenciar el compilador salvo casteos inevitables de
  DOM/WebGL (ref: https://github.com/google-ai-edge/mediapipe).
- **Exhaustividad en discriminated unions.** `switch`/cadenas de `if` sobre uniones deben
  cerrar con `default`/`else` a `never` o error explícito, no dejarlo abierto.
- **Cero allocations en el render loop.** `requestAnimationFrame`/loops por-frame no crean
  `new` objetos temporales (`Vector`, arrays, matrices) por iteración: reusar singletons de
  módulo (`const _tmp = /*@__PURE__*/ new X()`), como ya hace `particles.ts` con su pool fijo.
  Es EL patrón de performance de three.js/drei si el 2D→3D avanza (ref:
  https://github.com/mrdoob/three.js, https://github.com/pmndrs/drei).
- **`sideEffects: false` + código tree-shakeable.** `package.json` ya lo declara; imports
  nombrados (`import { X } from 'lib'`), nunca `import * as X` de una lib grande (relevante
  si se agrega three.js).
- **Detección de capacidades del navegador sin try/catch ingenuo.** GPU/WebGL/OffscreenCanvas
  se detectan con casos especiales por navegador (Safari/WebKit necesita chequeo de versión,
  no solo "¿existe el símbolo?"), igual que guardas de running-mode con mensajes accionables
  que nombran el campo exacto a corregir (ref: https://github.com/google-ai-edge/mediapipe).
- **Un solo comando que encadena los gates.** `npm run verify` (`tsc --noEmit && vitest run`)
  es el gate de "está verde"; CI (`deploy.yml`) lo corre antes de `build`. No agregar un gate
  nuevo que no esté en ese comando (ref: https://github.com/pmndrs/drei).
- **Postmessage tipado, no switch crudo.** Si el worker de manos crece más tipos de mensaje,
  preferir una capa RPC tipada sobre un `switch` de strings sin tipar.

### Documentación
- El README nombra el proyecto igual que `package.json`/`manifest`, no linkea a archivos ni
  scripts que no existen, y no es un molde reciclado de otro repo (chequeo bloqueante al
  revisar).
- Lo que el README promete sobre seguridad/comportamiento (ej. CSP, idioma por defecto) debe
  coincidir con el código real: divergencia doc-vs-código es un hallazgo de calidad, no un
  detalle menor.

## Estado conocido

El código actual todavía no cumple toda la barra: `main.ts` concentra DOM, cámara, audio, FSM
y render sin exports (regla e), y `chemistry.ts` tiene dos motores de mezcla (regla d). La
barra rige hacia adelante: el código nuevo la cumple, no se le suma peso a `main.ts` ni se
reintroduce un segundo motor de mezcla, y la deuda existente se paga de forma incremental.
