import type { AnnotationOverlayState, AnnotationStroke, CursorState } from '@mlab/types';

interface InitMessage {
  type: 'init';
  readable: ReadableStream<VideoFrame>;
  writable: WritableStream<VideoFrame>;
}

interface CursorMessage {
  type: 'cursor';
  state: CursorState;
}

interface AnnotationsMessage {
  type: 'annotations';
  state: AnnotationOverlayState;
}

type WorkerInboundMessage = InitMessage | CursorMessage | AnnotationsMessage;

let currentState: CursorState = {
  visible: true,
  rect: null,
};

let currentAnnotations: AnnotationOverlayState = {
  strokes: [],
  activeStroke: null,
  spotlight: {
    enabled: false,
    x: 0.5,
    y: 0.5,
    radius: 0.14,
    zoom: 1,
    activeInViewer: false,
  },
};

let lastCursorRect: { x: number; y: number; w: number; h: number } | null = null;
let cursorStationarySince = 0;

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number } | null,
  b: { x: number; y: number; w: number; h: number } | null
): boolean {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateCursorState(next: CursorState) {
  const prevRect = currentState.rect;
  const nextRect = next.rect;
  const now = performance.now();

  if (!prevRect || !nextRect) {
    cursorStationarySince = now;
  } else {
    const dx = Math.abs(prevRect.x - nextRect.x);
    const dy = Math.abs(prevRect.y - nextRect.y);
    if (dx > 0.003 || dy > 0.003) {
      cursorStationarySince = now;
    }
  }

  currentState = next;
}

self.onmessage = (evt: MessageEvent<WorkerInboundMessage>) => {
  const data = evt.data;
  if (!data) return;

  if (data.type === 'cursor') {
    updateCursorState(data.state);
    return;
  }

  if (data.type === 'annotations') {
    if (data.state) {
      currentAnnotations = data.state;
    }
    return;
  }

  if (data.type === 'init') {
    runPipeline(data.readable, data.writable).catch((err) => {
      try {
        self.postMessage({ type: 'fatal', message: String(err) });
      } catch {}
    });
  }
};

async function runPipeline(
  readable: ReadableStream<VideoFrame>,
  writable: WritableStream<VideoFrame>
): Promise<void> {
  const reader = readable.getReader();
  const writer = writable.getWriter();

  let width = 0;
  let height = 0;
  let outCanvas: OffscreenCanvas | null = null;
  let outCtx: OffscreenCanvasRenderingContext2D | null = null;
  let plateCanvas: OffscreenCanvas | null = null;
  let plateCtx: OffscreenCanvasRenderingContext2D | null = null;
  let patchCanvas: OffscreenCanvas | null = null;
  let patchCtx: OffscreenCanvasRenderingContext2D | null = null;
  let blurCanvas: OffscreenCanvas | null = null;
  let blurCtx: OffscreenCanvasRenderingContext2D | null = null;

  let plateInitialized = false;
  let lastPlateUpdateAt = 0;
  let degraded = false;
  let avgProcessMs = 0;

  const ensureCanvases = (w: number, h: number): boolean => {
    if (w <= 0 || h <= 0 || typeof OffscreenCanvas === 'undefined') return false;
    if (outCanvas && width === w && height === h) return true;

    width = w;
    height = h;
    outCanvas = new OffscreenCanvas(w, h);
    outCtx = outCanvas.getContext('2d', { alpha: false });
    plateCanvas = new OffscreenCanvas(w, h);
    plateCtx = plateCanvas.getContext('2d', { alpha: false });
    patchCanvas = new OffscreenCanvas(256, 256);
    patchCtx = patchCanvas.getContext('2d', { alpha: false });
    blurCanvas = new OffscreenCanvas(32, 32);
    blurCtx = blurCanvas.getContext('2d', { alpha: false });
    plateInitialized = false;
    return !!(outCtx && plateCtx && patchCtx && blurCtx);
  };

  const toPixelRect = (norm: { x: number; y: number; w: number; h: number }) => {
    const x = Math.max(0, Math.floor(norm.x * width));
    const y = Math.max(0, Math.floor(norm.y * height));
    const w = Math.min(width - x, Math.ceil(norm.w * width));
    const h = Math.min(height - y, Math.ceil(norm.h * height));
    return { x, y, w, h };
  };

  /**
   * Atualiza o background plate preservando a região onde o cursor está no momento,
   * evitando gravar o desenho do ponteiro na placa de fundo limpa.
   */
  const updatePlatePreservingCursor = (
    frame: VideoFrame,
    cursorNorm: { x: number; y: number; w: number; h: number } | null
  ) => {
    if (!plateCtx || !plateCanvas || !patchCtx || !patchCanvas) return;

    if (!plateInitialized || !cursorNorm) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      plateInitialized = true;
      lastCursorRect = cursorNorm;
      return;
    }

    const px = toPixelRect(cursorNorm);
    if (px.w <= 0 || px.h <= 0) {
      plateCtx.drawImage(frame, 0, 0, width, height);
      return;
    }

    const saveW = Math.min(patchCanvas.width, px.w);
    const saveH = Math.min(patchCanvas.height, px.h);

    // Salva a região limpa anterior antes de atualizar o restante do quadro
    patchCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, 0, 0, saveW, saveH);
    plateCtx.drawImage(frame, 0, 0, width, height);
    plateCtx.drawImage(patchCanvas, 0, 0, saveW, saveH, px.x, px.y, px.w, px.h);
    lastCursorRect = cursorNorm;
  };

  /**
   * Preenche o retângulo do cursor interpolando a vizinhança imediata do quadro ao vivo
   * quando o cursor fica estacionado sobre vídeo em movimento.
   */
  const inpaintFromNeighborhood = (px: { x: number; y: number; w: number; h: number }) => {
    if (!outCtx || !outCanvas || !blurCtx || !blurCanvas) return;
    const margin = 10;
    const sx = Math.max(0, px.x - margin);
    const sy = Math.max(0, px.y - margin);
    const sw = Math.min(width - sx, px.w + margin * 2);
    const sh = Math.min(height - sy, px.h + margin * 2);
    if (sw <= 0 || sh <= 0) return;

    // Copia as bordas externas ao redor do cursor para um buffer reduzido e reescala suavizado
    blurCtx.clearRect(0, 0, 32, 32);
    // Topo e base ao redor do cursor
    if (px.y > margin) {
      blurCtx.drawImage(outCanvas, sx, sy, sw, margin, 0, 0, 32, 16);
    }
    if (px.y + px.h + margin <= height) {
      blurCtx.drawImage(outCanvas, sx, px.y + px.h, sw, margin, 0, 16, 32, 16);
    } else {
      blurCtx.drawImage(outCanvas, sx, sy, sw, margin, 0, 16, 32, 16);
    }
    outCtx.imageSmoothingEnabled = true;
    outCtx.drawImage(blurCanvas, 0, 0, 32, 32, px.x, px.y, px.w, px.h);
  };

  const drawStrokeOnCanvas = (
    ctx: OffscreenCanvasRenderingContext2D,
    stroke: AnnotationStroke,
    w: number,
    h: number
  ) => {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    const scale = Math.max(1, w / 1280);
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;

    if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = stroke.size * 3.2 * scale;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
    } else {
      ctx.globalAlpha = 1;
      ctx.lineWidth = stroke.size * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    if (stroke.tool === 'pen' || stroke.tool === 'highlighter') {
      ctx.beginPath();
      const first = pts[0];
      ctx.moveTo(first.x * w, first.y * h);
      if (pts.length === 1) {
        ctx.lineTo(first.x * w + 0.5, first.y * h + 0.5);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * w, pts[i].y * h);
        }
      }
      ctx.stroke();
    } else if (stroke.tool === 'rect' && pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const rx = Math.min(p0.x, p1.x) * w;
      const ry = Math.min(p0.y, p1.y) * h;
      const rw = Math.abs(p1.x - p0.x) * w;
      const rh = Math.abs(p1.y - p0.y) * h;
      ctx.strokeRect(rx, ry, rw, rh);
    } else if (stroke.tool === 'arrow' && pts.length >= 2) {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const x0 = p0.x * w;
      const y0 = p0.y * h;
      const x1 = p1.x * w;
      const y1 = p1.y * h;
      const headLen = Math.max(12, stroke.size * 3.5 * scale);
      const angle = Math.atan2(y1 - y0, x1 - x0);

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - headLen * Math.cos(angle - Math.PI / 6), y1 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x1 - headLen * Math.cos(angle + Math.PI / 6), y1 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  };

  const renderAnnotationsAndSpotlight = (
    ctx: OffscreenCanvasRenderingContext2D,
    canvas: OffscreenCanvas,
    ann: AnnotationOverlayState,
    cursorRect: { x: number; y: number; w: number; h: number } | null
  ) => {
    for (let i = 0; i < ann.strokes.length; i++) {
      drawStrokeOnCanvas(ctx, ann.strokes[i], width, height);
    }
    if (ann.activeStroke) {
      drawStrokeOnCanvas(ctx, ann.activeStroke, width, height);
    }

    if (ann.spotlight.enabled) {
      let normX = ann.spotlight.x;
      let normY = ann.spotlight.y;
      if (!ann.spotlight.activeInViewer && cursorRect) {
        normX = Math.min(1, Math.max(0, cursorRect.x + cursorRect.w * 0.35));
        normY = Math.min(1, Math.max(0, cursorRect.y + cursorRect.h * 0.35));
      }

      const cx = normX * width;
      const cy = normY * height;
      const minDim = Math.min(width, height);
      const radius = Math.max(36, ann.spotlight.radius * minDim);
      const zoom = ann.spotlight.zoom || 1;

      if (zoom > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        const srcW = (radius * 2) / zoom;
        const srcH = (radius * 2) / zoom;
        const srcX = cx - srcW / 2;
        const srcY = cy - srcH / 2;
        ctx.drawImage(canvas, srcX, srcY, srcW, srcH, cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
      ctx.fill('evenodd');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = Math.max(2, 2.5 * (width / 1280));
      ctx.stroke();
      ctx.restore();
    }
  };

  try {
    while (true) {
      const { done, value: frame } = await reader.read();
      if (done || !frame) break;

      const state = currentState;
      const ann = currentAnnotations;
      const hasOverlay =
        ann.strokes.length > 0 || ann.activeStroke !== null || ann.spotlight.enabled === true;
      const now = performance.now();

      // Caminho rápido (passthrough zero-copy): cursor visível, sem marcações/lupa ou pipeline degradado
      if (degraded || ((state.visible || !state.rect) && !hasOverlay)) {
        if (!degraded && ensureCanvases(frame.codedWidth || frame.displayWidth, frame.codedHeight || frame.displayHeight)) {
          if (!plateInitialized || now - lastPlateUpdateAt >= 90) {
            try {
              updatePlatePreservingCursor(frame, state.rect);
              lastPlateUpdateAt = now;
            } catch {}
          }
        }
        await writer.write(frame);
        frame.close();
        continue;
      }

      // Caminho de composição (ocultação do cursor e/ou marcações + lupa)
      const t0 = performance.now();
      const fw = frame.codedWidth || frame.displayWidth;
      const fh = frame.codedHeight || frame.displayHeight;

      if (!ensureCanvases(fw, fh) || !outCtx || !outCanvas || !plateCtx || !plateCanvas) {
        await writer.write(frame);
        frame.close();
        continue;
      }

      try {
        outCtx.drawImage(frame, 0, 0, width, height);

        if (!state.visible && state.rect) {
          const px = toPixelRect(state.rect);

          if (px.w > 0 && px.h > 0) {
            const stationaryMs = now - cursorStationarySince;
            const hadOverlapOnInit = !plateInitialized || rectsOverlap(state.rect, lastCursorRect);

            if (plateInitialized && (!hadOverlapOnInit || stationaryMs < 350)) {
              outCtx.drawImage(plateCanvas, px.x, px.y, px.w, px.h, px.x, px.y, px.w, px.h);
            } else {
              inpaintFromNeighborhood(px);
            }
          }
        }

        // Mantém o restante da placa de fundo atualizado a cada 90ms
        if (!plateInitialized || now - lastPlateUpdateAt >= 90) {
          updatePlatePreservingCursor(frame, state.rect);
          lastPlateUpdateAt = now;
        }

        if (hasOverlay) {
          renderAnnotationsAndSpotlight(outCtx, outCanvas, ann, state.rect);
        }

        const cleanFrame = new VideoFrame(outCanvas, {
          timestamp: frame.timestamp,
          duration: frame.duration ?? undefined,
        });
        frame.close();
        await writer.write(cleanFrame);
        cleanFrame.close();

        const dt = performance.now() - t0;
        avgProcessMs = avgProcessMs === 0 ? dt : avgProcessMs * 0.92 + dt * 0.08;
        if (!hasOverlay && avgProcessMs > 8.5) {
          degraded = true;
          try {
            self.postMessage({ type: 'degraded', avgProcessMs });
          } catch {}
        }
      } catch {
        // Fallback imediato em caso de erro de composição no frame
        try {
          await writer.write(frame);
        } catch {}
        try {
          frame.close();
        } catch {}
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
    try {
      await writer.close();
    } catch {}
  }
}
