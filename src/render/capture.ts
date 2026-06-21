/**
 * "Saca una foto" del AR: compone el video de fondo (espejado, recorte tipo
 * `cover`) y el canvas 3D en un canvas offscreen, y dispara la descarga del PNG.
 * El `glCanvas` debe haberse renderizado en este mismo tick (ver
 * `ARScene.renderForCapture()`): ya no se usa `preserveDrawingBuffer`.
 */
export function capturePhoto(opts: {
  video: HTMLVideoElement;
  glCanvas: HTMLCanvasElement;
  mirrored: boolean;
  /** Color sólido de fondo, o `null` para usar el video. */
  background: string | null;
}): void {
  const w = opts.glCanvas.width;
  const h = opts.glCanvas.height;
  if (!w || !h) return;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return;

  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, w, h);
  } else {
    drawCover(ctx, opts.video, w, h, opts.mirrored);
  }
  // El canvas 3D ya está en orientación de pantalla (sólo el video se espeja).
  ctx.drawImage(opts.glCanvas, 0, 0, w, h);

  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ar-figure.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
}

/** Dibuja el video cubriendo `dw`×`dh` (object-fit: cover), opcionalmente espejado. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  dw: number,
  dh: number,
  mirrored: boolean,
): void {
  const vw = video.videoWidth || dw;
  const vh = video.videoHeight || dh;
  const scale = Math.max(dw / vw, dh / vh);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (vw - sw) / 2;
  const sy = (vh - sh) / 2;
  ctx.save();
  if (mirrored) {
    ctx.translate(dw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}
