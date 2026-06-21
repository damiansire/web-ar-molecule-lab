/**
 * Detección de capacidades de plataforma (pura y testeable, sin tocar el DOM ni
 * crear contextos WebGL). La decisión "¿puedo usar el delegate GPU?" depende del
 * navegador, no sólo de que exista `OffscreenCanvas`.
 *
 * Caso clave: WebKit (Safari/iOS) recién soporta WebGL2 sobre `OffscreenCanvas`
 * desde la versión 17. En versiones anteriores, crear el contexto puede
 * "tener éxito" y aun así colgar el delegate GPU dentro de un worker. Por eso no
 * alcanza con un `getContext('webgl2')` ingenuo: hay que mirar el navegador.
 *
 * `userAgent` se inyecta como parámetro (en vez de leer `navigator` directo)
 * para poder testear la lógica sin un navegador real.
 */

/** ¿El user-agent corresponde a WebKit (Safari/iOS), excluyendo Chrome/Edge? */
export function isWebKit(userAgent: string): boolean {
  // Chrome, Edge y otros basados en Blink también incluyen "Safari" en su UA,
  // así que primero hay que descartarlos.
  if (/Chrome|Chromium|Edg\//.test(userAgent)) return false;
  return /\bAppleWebKit\b/.test(userAgent) && /\bSafari\b/.test(userAgent);
}

/**
 * Versión mayor de Safari/WebKit que reporta el user-agent, o `null` si no se
 * puede determinar (no es WebKit, o el patrón no matchea).
 */
export function webKitMajorVersion(userAgent: string): number | null {
  if (!isWebKit(userAgent)) return null;
  const match = userAgent.match(/Version\/(\d+)[\d.]*.*\bSafari\b/);
  return match ? Number(match[1]) : null;
}

/**
 * Decide si el delegate GPU es seguro para este navegador, asumiendo que el
 * contexto WebGL2 ya está disponible (`hasWebGl2`).
 *
 * - En WebKit exige versión >= 17 (antes el delegate GPU en worker es inestable).
 * - En el resto, alcanza con que exista WebGL2.
 */
export function supportsGpuDelegate(userAgent: string, hasWebGl2: boolean): boolean {
  if (!hasWebGl2) return false;
  if (isWebKit(userAgent)) {
    const version = webKitMajorVersion(userAgent);
    return version !== null && version >= 17;
  }
  return true;
}
