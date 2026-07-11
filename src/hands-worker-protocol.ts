/**
 * Protocolo tipado del worker de manos (`public/hands-worker.js`). Antes,
 * `hands.ts` armaba y leía los mensajes con `postMessage({ type: 'frame', ... })`
 * y `e.data?.type === 'result'` sueltos, sin un tipo compartido — un typo en
 * un `type` o un campo faltante recién se notaba en runtime. Estas uniones
 * discriminadas son la única fuente de verdad de la forma de los mensajes.
 *
 * El worker en sí sigue siendo JS clásico (ver el comentario al inicio de
 * `hands-worker.js` sobre por qué no puede ser un module worker), así que no
 * puede `import` este archivo — pero sus literales `{ type: '...' }` deben
 * seguir mirroreando exactamente estas formas. Si cambiás algo acá, replicá
 * el cambio ahí.
 */
import type { Hand } from './hands';

/** main → worker */
export type MainToWorkerMessage =
  | { type: 'init' }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };

/** worker → main */
export type WorkerToMainMessage =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'result'; hands: Hand[] };

/** Type guard mínimo: ¿esto que llegó por `message` tiene la forma esperada? */
export function isWorkerToMainMessage(data: unknown): data is WorkerToMainMessage {
  if (typeof data !== 'object' || data === null || !('type' in data)) return false;
  const type = (data as { type: unknown }).type;
  return type === 'ready' || type === 'error' || type === 'result';
}
