/**
 * Acceso a la cámara con detección de capacidades y errores tipados.
 * Reemplaza el manejo original que llamaba a `getUserMedia` en cada re-render
 * y logueaba `[object DOMException]` sin distinguir el motivo del fallo.
 */
export type CameraErrorReason = "unsupported" | "denied" | "not-found" | "unknown";

export class CameraError extends Error {
  constructor(
    readonly reason: CameraErrorReason,
    message: string,
  ) {
    super(message);
    this.name = "CameraError";
  }
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/** Pide acceso a la cámara y devuelve el stream, o lanza un `CameraError`. */
export async function requestCamera(): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new CameraError(
      "unsupported",
      "Este navegador no soporta el acceso a la cámara (getUserMedia).",
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    throw new CameraError(reasonFromDomError(err), describeCameraError(err));
  }
}

function reasonFromDomError(err: unknown): CameraErrorReason {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") return "denied";
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError")
      return "not-found";
  }
  return "unknown";
}

function describeCameraError(err: unknown): string {
  const reason = reasonFromDomError(err);
  switch (reason) {
    case "denied":
      return "Permiso de cámara denegado. Habilitá la cámara desde el navegador y reintentá.";
    case "not-found":
      return "No se encontró ninguna cámara disponible.";
    default:
      return err instanceof Error ? err.message : "Error desconocido de cámara.";
  }
}
