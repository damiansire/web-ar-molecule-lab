/**
 * Diagnóstico del fallo al pedir cámara/mic o cargar el modelo de manos.
 * Aislado de main.ts (sin DOM) para poder testearlo sin levantar todo el
 * juego: antes esto era una función privada en main.ts que solo se ejercitaba
 * manualmente.
 */

/** Clave i18n (`src/i18n.ts`) del mensaje de error que corresponde mostrar. */
export type StartFailureKey =
  | 'statusErrPermission'
  | 'statusErrNoCamera'
  | 'statusErrModel'
  | 'statusErr';

/**
 * Distingue el diagnóstico correcto según qué falló: permiso de cámara
 * denegado, sin cámara físicamente, modelo de manos que no cargó, o algo
 * genérico. Antes todo colapsaba en "revisá permisos de cámara" incluso
 * cuando el problema era el modelo (falso diagnóstico que manda al usuario a
 * revisar un permiso que ya tenía bien).
 */
export function startFailureKey(err: unknown): StartFailureKey {
  if (err instanceof Error && err.message === 'MODEL_NOT_READY') return 'statusErrModel';
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') return 'statusErrPermission';
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') return 'statusErrNoCamera';
  }
  return 'statusErr';
}
